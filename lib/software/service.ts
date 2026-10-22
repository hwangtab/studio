import { randomUUID } from 'crypto';
import { and, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { softwareActivations, softwareLicenses, type SoftwareLicense, type softwareLicenseSourceEnum } from '../../db/schema';
import { SOFTWARE_LICENSE_PUBLIC_KEYS } from '../../data/software/publicKeys';
import { SOFTWARE_DEACTIVATIONS_PER_30_DAYS } from '../../data/software/policy';
import { getAnySoftware, maxActivationsOf } from './catalog';
import { generateLicenseKey, licenseKeyHint, normalizeLicenseKey } from './key';
import { rawPublicKeyOf, signLicense, type LicenseFile, type LicenseSigner } from './licenseFile';
import { isUniqueConstraintError } from '../dbErrors';

/**
 * 라이선스 발급·활성화·해제. 규칙은 lib/software/CLAUDE.md.
 *
 * 활성화 한도는 **조건부 INSERT 한 문장**으로 지킨다 — 개수를 읽고 따로 넣으면 두 기기가 동시에 들어올 때
 * 둘 다 "아직 자리 있음"을 보고 한도를 넘는다.
 */

/**
 * 기기 식별값 — 플러그인이 `hex(sha256("<slug>:" + 원래 값))`으로 보낸다(연동 안내서 §2). 원래 값(UUID 등)을 받지 않으려고 형식을
 * 소문자 hex 64자로 못 박는다 — 처리방침·약관이 "원래 값이 아니라 변환한 값"이라고 약속한다.
 */
export const MACHINE_ID_PATTERN = /^[0-9a-f]{64}$/;
const LABEL_MAX = 80;
const APP_VERSION_MAX = 40;

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  return s ? s.slice(0, max) : null;
};

export type IssueLicenseInput = {
  productSlug: string;
  email: string;
  customerName?: string | null;
  source: (typeof softwareLicenseSourceEnum)[number];
  orderNo?: string | null;
  note?: string | null;
  maxActivations?: number;
};

/** 라이선스 한 개 발급. 키가 우연히 겹치면(100비트라 사실상 없음) 한 번 더 만든다. */
export const issueLicense = async (input: IssueLicenseInput): Promise<SoftwareLicense> => {
  const product = getAnySoftware(input.productSlug);
  if (!product) throw new Error(`[software] 없는 상품: ${input.productSlug}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await getDb()
        .insert(softwareLicenses)
        .values({
          id: randomUUID(),
          productSlug: product.slug,
          licenseKey: generateLicenseKey(),
          email: input.email.trim().toLowerCase(),
          customerName: input.customerName?.trim() || null,
          source: input.source,
          orderNo: input.orderNo ?? null,
          note: input.note?.trim() || null,
          maxActivations: input.maxActivations ?? maxActivationsOf(product),
        })
        .returning();
      return row;
    } catch (error) {
      if (attempt < 2 && isUniqueConstraintError(error)) continue;
      throw error;
    }
  }
  throw new Error('[software] 라이선스 키 생성 실패');
};

export type ActivateResult =
  | { ok: true; licenseFile: LicenseFile; reused: boolean }
  | { ok: false; code: 'bad_request' | 'invalid_key' | 'revoked' | 'activation_limit' };

export type ActivateInput = { key: unknown; product: unknown; machineId: unknown; label?: unknown; appVersion?: unknown };

const findLicense = async (key: unknown, product: unknown): Promise<SoftwareLicense | null | 'bad'> => {
  const normalized = normalizeLicenseKey(key);
  if (!normalized || typeof product !== 'string') return 'bad';
  const row = await getDb().query.softwareLicenses.findFirst({ where: eq(softwareLicenses.licenseKey, normalized) });
  // 다른 상품의 키는 "없는 키"와 같은 답 — 키가 어느 상품 것인지 드러내지 않는다.
  return row && row.productSlug === product ? row : null;
};

/**
 * 기기 하나를 활성화하고 서명 파일을 돌려준다. 같은 기기가 이미 활성이면 자리를 더 쓰지 않고 새 파일만 준다
 * (재설치·파일 분실). 형식 오류는 `bad_request`, 없는 키·다른 상품 키는 똑같이 `invalid_key`.
 */
export const activateLicense = async (input: ActivateInput, signer: LicenseSigner, now = new Date()): Promise<ActivateResult> => {
  if (typeof input.machineId !== 'string' || !MACHINE_ID_PATTERN.test(input.machineId)) return { ok: false, code: 'bad_request' };
  const found = await findLicense(input.key, input.product);
  if (found === 'bad') return { ok: false, code: 'bad_request' };
  if (!found) return { ok: false, code: 'invalid_key' };
  if (found.status !== 'active') return { ok: false, code: 'revoked' };

  const machineId = input.machineId;
  const label = clip(input.label, LABEL_MAX);
  const appVersion = clip(input.appVersion, APP_VERSION_MAX);
  const nowSec = Math.floor(now.getTime() / 1000);
  const db = getDb();

  const existing = await db.query.softwareActivations.findFirst({
    where: and(eq(softwareActivations.licenseId, found.id), eq(softwareActivations.machineId, machineId), isNull(softwareActivations.deactivatedAt)),
  });

  let reused = false;
  if (existing) {
    reused = true;
    await db.update(softwareActivations)
      .set({ lastSeenAt: now, ...(label ? { label } : {}), ...(appVersion ? { appVersion } : {}) })
      .where(eq(softwareActivations.id, existing.id));
  } else {
    // 활성화 행과 첫 활성화 시각을 한 batch(트랜잭션)로 — 고객 셀프 환불(lib/software/cancel.ts)이 둘 사이에 끼어
    // "기기는 붙었는데 활성화 기록은 없는" 순간을 보고 환불하지 못하게. 라이선스가 여전히 active일 때만 자리를 준다.
    const activationId = randomUUID();
    const [result] = await db.batch([
      db.run(sql`
        INSERT INTO software_activations (id, license_id, machine_id, label, app_version, activated_at, last_seen_at)
        SELECT ${activationId}, ${found.id}, ${machineId}, ${label}, ${appVersion}, ${nowSec}, ${nowSec}
        WHERE (SELECT count(*) FROM software_activations WHERE license_id = ${found.id} AND deactivated_at IS NULL) < ${found.maxActivations}
          AND NOT EXISTS (SELECT 1 FROM software_activations WHERE license_id = ${found.id} AND machine_id = ${machineId} AND deactivated_at IS NULL)
          AND EXISTS (SELECT 1 FROM software_licenses WHERE id = ${found.id} AND status = 'active')
      `),
      db.run(sql`
        UPDATE software_licenses SET first_activated_at = COALESCE(first_activated_at, ${nowSec})
        WHERE id = ${found.id} AND EXISTS (SELECT 1 FROM software_activations WHERE id = ${activationId})
      `),
    ]);
    if (Number(result.rowsAffected) === 0) {
      // 같은 기기가 바로 앞에서 동시에 들어와 자리를 잡았을 수 있다 — 그러면 재사용으로 본다.
      const raced = await db.query.softwareActivations.findFirst({
        where: and(eq(softwareActivations.licenseId, found.id), eq(softwareActivations.machineId, machineId), isNull(softwareActivations.deactivatedAt)),
      });
      if (raced) reused = true;
      else {
        // 그 사이 환불·취소됐으면 revoked로 답한다.
        const now2 = await db.query.softwareLicenses.findFirst({ where: eq(softwareLicenses.id, found.id) });
        return { ok: false, code: now2 && now2.status !== 'active' ? 'revoked' : 'activation_limit' };
      }
    }
  }

  const licenseFile = signLicense({
    lic: found.id,
    product: found.productSlug,
    machine: machineId,
    edition: 'full',
    issuedAt: now.toISOString(),
    keyHint: licenseKeyHint(found.licenseKey),
  }, signer);
  return { ok: true, licenseFile, reused };
};

export type DeactivateResult =
  | { ok: true; deactivated: boolean }
  | { ok: false; code: 'bad_request' | 'invalid_key' | 'deactivation_limit' };

const DEACTIVATION_WINDOW_SEC = 30 * 24 * 60 * 60;

/**
 * 고객 쪽 기기 해제 — 30일 한도(`SOFTWARE_DEACTIVATIONS_PER_30_DAYS`)를 **같은 UPDATE의 WHERE**로 건다(동시 요청에도 넘지 않게).
 * `target`은 기기 식별값(플러그인) 또는 활성화 행 id(구매 내역 화면). 대상이 이미 해제됐으면 `deactivated: false`(멱등).
 */
export const customerDeactivate = async (
  licenseId: string,
  target: { machineId: string } | { activationId: string },
  now = new Date(),
): Promise<DeactivateResult> => {
  const nowSec = Math.floor(now.getTime() / 1000);
  const db = getDb();
  const match = 'machineId' in target ? sql`machine_id = ${target.machineId}` : sql`id = ${target.activationId}`;
  const result = await db.run(sql`
    UPDATE software_activations SET deactivated_at = ${nowSec}
    WHERE license_id = ${licenseId} AND ${match} AND deactivated_at IS NULL
      AND (SELECT count(*) FROM software_activations WHERE license_id = ${licenseId} AND deactivated_at >= ${nowSec - DEACTIVATION_WINDOW_SEC}) < ${SOFTWARE_DEACTIVATIONS_PER_30_DAYS}
  `);
  if (Number(result.rowsAffected) > 0) return { ok: true, deactivated: true };
  const stillActive = await db.query.softwareActivations.findFirst({
    where: and(
      eq(softwareActivations.licenseId, licenseId),
      'machineId' in target ? eq(softwareActivations.machineId, target.machineId) : eq(softwareActivations.id, target.activationId),
      isNull(softwareActivations.deactivatedAt),
    ),
  });
  return stillActive ? { ok: false, code: 'deactivation_limit' } : { ok: true, deactivated: false };
};

/** 플러그인의 "이 기기에서 해제". 이미 해제됐어도 성공(멱등) — `deactivated`로 실제로 바뀌었는지만 알린다. */
export const deactivateMachine = async (input: ActivateInput, now = new Date()): Promise<DeactivateResult> => {
  if (typeof input.machineId !== 'string' || !MACHINE_ID_PATTERN.test(input.machineId)) return { ok: false, code: 'bad_request' };
  const found = await findLicense(input.key, input.product);
  if (found === 'bad') return { ok: false, code: 'bad_request' };
  if (!found) return { ok: false, code: 'invalid_key' };
  return customerDeactivate(found.id, { machineId: input.machineId }, now);
};

/**
 * 서명키가 플러그인에 박힐 공개키 목록에 있는가. 없으면 플러그인이 검증하지 못하는 파일을 내주게 되므로
 * 활성화 API가 닫힌다.
 */
export const isSignerPublished = (signer: LicenseSigner): boolean => {
  const published = SOFTWARE_LICENSE_PUBLIC_KEYS[signer.kid];
  // kid만 맞고 다른 키(회전 실수·preview 키)면 플러그인이 검증하지 못하는 파일을 200으로 내주게 된다 — 짝까지 본다.
  return Boolean(published) && rawPublicKeyOf(signer.key) === published;
};

// ─── 관리자 ────────────────────────────────────────────────────────────────────

export type AdminLicenseRow = {
  id: string;
  productSlug: string;
  licenseKey: string;
  email: string;
  customerName: string | null;
  source: string;
  orderNo: string | null;
  note: string | null;
  maxActivations: number;
  status: string;
  issuedAt: string;
  firstActivatedAt: string | null;
  activations: { id: string; machineId: string; label: string | null; appVersion: string | null; activatedAt: string; lastSeenAt: string }[];
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** 최근 발급순. `q`는 이메일·키·주문번호 부분 일치. 활성 기기(해제 안 된 것)만 붙인다. */
export const listAdminLicenses = async (q = '', limit = 100): Promise<AdminLicenseRow[]> => {
  const term = q.trim();
  const db = getDb();
  const pattern = `%${term.replace(/[%_]/g, '')}%`;
  const rows = await db.query.softwareLicenses.findMany({
    where: term ? or(like(softwareLicenses.email, pattern.toLowerCase()), like(softwareLicenses.licenseKey, pattern.toUpperCase()), like(softwareLicenses.orderNo, pattern.toUpperCase())) : undefined,
    orderBy: desc(softwareLicenses.issuedAt),
    limit,
  });
  if (rows.length === 0) return [];
  // 활성 기기는 한 번에 읽어 라이선스별로 묶는다(행마다 따로 읽으면 목록 한 번에 최대 101회 조회가 된다).
  // (license_id, machine_id) 인덱스의 앞 칸이 license_id라 IN 조회가 인덱스를 탄다.
  const acts = await db.query.softwareActivations.findMany({
    where: and(inArray(softwareActivations.licenseId, rows.map((r) => r.id)), isNull(softwareActivations.deactivatedAt)),
    orderBy: desc(softwareActivations.activatedAt),
  });
  const actsByLicense = new Map<string, typeof acts>();
  for (const a of acts) actsByLicense.set(a.licenseId, [...(actsByLicense.get(a.licenseId) ?? []), a]);
  return rows.map((r) => ({
    id: r.id, productSlug: r.productSlug, licenseKey: r.licenseKey, email: r.email, customerName: r.customerName,
    source: r.source, orderNo: r.orderNo, note: r.note, maxActivations: r.maxActivations, status: r.status,
    issuedAt: r.issuedAt.toISOString(), firstActivatedAt: iso(r.firstActivatedAt),
    activations: (actsByLicense.get(r.id) ?? []).map((a) => ({
      id: a.id, machineId: a.machineId, label: a.label, appVersion: a.appVersion,
      activatedAt: a.activatedAt.toISOString(), lastSeenAt: a.lastSeenAt.toISOString(),
    })),
  }));
};

/** 라이선스 취소 — 새 기기 활성화가 막힌다. 이미 활성화한 기기는 오프라인 파일이라 계속 돈다(의도). */
export const revokeLicense = async (id: string, now = new Date()): Promise<boolean> => {
  const r = await getDb().update(softwareLicenses)
    .set({ status: 'revoked', revokedAt: now })
    .where(and(eq(softwareLicenses.id, id), eq(softwareLicenses.status, 'active')));
  return Number(r.rowsAffected) > 0;
};

/** 기기 해제 — `activationId`가 없으면 그 라이선스의 활성 기기 전부. */
export const adminDeactivate = async (licenseId: string, activationId?: string, now = new Date()): Promise<number> => {
  const r = await getDb().update(softwareActivations)
    .set({ deactivatedAt: now })
    .where(and(
      eq(softwareActivations.licenseId, licenseId),
      isNull(softwareActivations.deactivatedAt),
      ...(activationId ? [eq(softwareActivations.id, activationId)] : []),
    ));
  return Number(r.rowsAffected);
};

/**
 * 플러그인 요청 본문. JUCE `URL::withPOSTData`는 Content-Type을 주지 않으면 `application/x-www-form-urlencoded`를 붙여,
 * Next가 JSON 문자열 전체를 폼 키 하나로 풀어 버린다(2026-10-14 감사). 문자열이거나 그런 모양이면 JSON으로 다시 읽는다.
 */
export const pluginRequestBody = (raw: unknown): Record<string, unknown> => {
  const tryJson = (text: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(text) as unknown;
      return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  if (typeof raw === 'string') return tryJson(raw) ?? {};
  if (typeof raw !== 'object' || raw === null) return {};
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0].startsWith('{') && (obj[keys[0]] === '' || obj[keys[0]] === undefined)) return tryJson(keys[0]) ?? obj;
  return obj;
};
