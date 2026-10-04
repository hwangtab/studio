import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

import * as schema from '../../db/schema';
import { showTicketTypes, showtimes, shows, showZones } from '../../db/schema';
import { validateShowSlug } from './reservedSlugs';
import { descriptionBlocks, performerNames, serializeNotices, serializePerformers, type ShowPerformer } from './structured';
import { salesCloseAt } from './time';

/**
 * 공연 등록 — 정의(data/shows/<slug>.ts)를 slug 기준으로 멱등하게 shows·show_zones·showtimes·
 * show_ticket_types에 맞춘다. 화면에서 공연 메타를 편집하지 않기로 했으므로(스크립트가 담당) 이 모듈이
 * 공연 정의의 유일한 쓰기 경로다.
 *
 * 다시 돌려도 같은 결과다 — 이미 같은 값이면 쓰지 않는다(updated_at도 올리지 않는다).
 *
 * **건드리지 않는 것**
 * - `shows.status`·`notice_key`·`id`: 공개 여부는 관리자 화면의 전환이 정본이다. 스크립트가 draft로
 *   되돌리면 판매 중인 공연이 조용히 내려간다. 새로 만들 때만 draft다.
 * - 이미 있는 회차: 시각 변경·취소는 `changeShowtime`/`cancelShowtime`(주문·스캔 링크·환불을 함께 다룬다)이
 *   정본이다. 정의에 없는 시각의 회차는 지우지 않고 경고만 한다.
 * - 정의에서 빠진 구역·티켓타입: 지우지 않는다(후원 기록처럼 티켓이 id로 참조한다).
 *
 * **막는 것**(오류로 멈춘다)
 * - 이미 팔린 티켓타입의 가격 변경 — 티켓에 단가가 복사돼 있어 환불·표시가 어긋난다. 새 이름의
 *   티켓타입을 추가한다.
 * - 구역 정원을 이미 잡힌 좌석 수 밑으로 낮추는 것.
 */

export type ShowSeedDb = LibSQLDatabase<typeof schema>;

export interface ShowDefinition {
  slug: string;
  title: string;
  subtitle?: string | null;
  presenterName: string;
  /** 출연진 — 이름 필수, 소개·사진·SNS 선택. 사진은 /images/shows/ 아래 경로(존재를 검증한다). */
  performers: ShowPerformer[];
  ageRating: string;
  runningMinutes: number;
  venueName: string;
  venueAddress: string;
  /** 소개 본문. 빈 줄로 문단을 가른다. 시간·수익·가격 안내는 여기 넣지 말고 아래 전용 칸에. */
  description: string;
  coverImage: string | null;
  /** 1200x630 공유 카드. 없으면 coverImage. */
  ogImage?: string | null;
  /** 일시 아래 한 줄. 예) "18:00 입장 시작 · 18:30 공연 시작" */
  scheduleNote?: string | null;
  /** 현장 판매 안내 한 줄. 온라인 결제와 무관한 안내문구. */
  onSitePriceNote?: string | null;
  /** 소개 아래 짧은 안내 목록(수익 사용처 등). */
  notices?: string[];
  mapUrl?: string | null;
  zones: Array<{ code: string; label: string; capacity: number }>;
  /** 절대 시각 — KST는 `new Date('2026-10-24T18:30:00+09:00')`처럼 오프셋을 명시한다. */
  showtimes: Array<{ startsAt: Date }>;
  ticketTypes: Array<{ zoneCode: string; name: string; price: number; quota: number | null; compQuota: number }>;
}

export interface ShowSeedReport {
  slug: string;
  applied: boolean;
  created: boolean;
  /** 실제로 하게 될(또는 한) 쓰기 목록. 비어 있으면 이미 최신이다. */
  actions: string[];
  warnings: string[];
}

export class ShowSeedError extends Error {}

/** utils/imageMetadata.json — 빌드가 만드는 치수 사전. 여기 없는 이미지는 치수 검증을 건너뛴다. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const imageMetadata = require('../../utils/imageMetadata.json') as Record<string, { width: number; height: number }>;

/** `/images/…` 경로가 public/ 아래 실제 파일인지. 포스터·사진을 빼먹은 채 시드하면 화면에 빈 칸이 뜬다. */
const publicFileExists = (webPath: string): boolean => existsSync(join(process.cwd(), 'public', webPath));

export function validateShowDefinition(def: ShowDefinition): string[] {
  const errors: string[] = [];
  const slugError = validateShowSlug(def.slug);
  if (slugError) errors.push(slugError);
  for (const key of ['title', 'presenterName', 'ageRating', 'venueName', 'venueAddress', 'description'] as const) {
    if (!def[key].trim()) errors.push(`${key}가 비어 있습니다.`);
  }
  if (descriptionBlocks(def.description)[0]?.type !== 'p') errors.push('description은 문단으로 시작해야 합니다(첫 문단이 검색 결과·OG 요약이 된다).');
  if (def.title.includes(' — ')) errors.push('title에 " — "로 부제를 끼우지 말고 subtitle 칸을 쓰세요.');
  if (def.performers.length === 0) errors.push('출연진이 하나 이상 필요합니다.');
  const performerNameSet = new Set<string>();
  for (const perf of def.performers) {
    if (!perf.name.trim()) errors.push('출연자 이름이 비어 있습니다.');
    if (performerNameSet.has(perf.name)) errors.push(`출연자 "${perf.name}"이 중복입니다.`);
    performerNameSet.add(perf.name);
    if (perf.photo && !publicFileExists(perf.photo)) errors.push(`출연자 "${perf.name}": 사진 파일이 없습니다(${perf.photo}).`);
  }
  for (const [key, value] of [['coverImage', def.coverImage], ['ogImage', def.ogImage ?? null]] as const) {
    if (value && !publicFileExists(value)) errors.push(`${key} 파일이 없습니다(${value}).`);
  }
  if (def.ogImage) {
    const size = imageMetadata[def.ogImage];
    if (size && !(size.width === 1200 && size.height === 630)) errors.push(`ogImage는 1200x630이어야 합니다(지금 ${size.width}x${size.height}).`);
  }
  if (!Number.isInteger(def.runningMinutes) || def.runningMinutes <= 0) errors.push('runningMinutes는 양의 정수여야 합니다.');
  if (def.zones.length === 0) errors.push('구역이 하나 이상 필요합니다.');
  const codes = new Set<string>();
  for (const z of def.zones) {
    if (codes.has(z.code)) errors.push(`구역 code "${z.code}"가 중복입니다.`);
    codes.add(z.code);
    if (!Number.isInteger(z.capacity) || z.capacity <= 0) errors.push(`구역 ${z.code}: 정원은 양의 정수여야 합니다.`);
  }
  if (def.showtimes.length === 0) errors.push('회차가 하나 이상 필요합니다.');
  const times = new Set<number>();
  for (const s of def.showtimes) {
    if (Number.isNaN(s.startsAt.getTime())) errors.push('회차 시각이 올바르지 않습니다.');
    if (times.has(s.startsAt.getTime())) errors.push('같은 시각의 회차가 중복입니다.');
    times.add(s.startsAt.getTime());
  }
  if (def.ticketTypes.length === 0) errors.push('티켓타입이 하나 이상 필요합니다.');
  const names = new Set<string>();
  for (const t of def.ticketTypes) {
    if (!codes.has(t.zoneCode)) errors.push(`티켓타입 "${t.name}": 없는 구역 ${t.zoneCode}`);
    const key = `${t.zoneCode}/${t.name}`;
    if (names.has(key)) errors.push(`티켓타입 "${t.name}"이 구역 ${t.zoneCode}에서 중복입니다.`);
    names.add(key);
    if (!Number.isInteger(t.price) || t.price < 0) errors.push(`티켓타입 "${t.name}": 가격은 0 이상의 정수여야 합니다.`);
    if (t.quota !== null && (!Number.isInteger(t.quota) || t.quota <= 0)) errors.push(`티켓타입 "${t.name}": quota는 null 또는 양의 정수여야 합니다.`);
    if (!Number.isInteger(t.compQuota) || t.compQuota < 0) errors.push(`티켓타입 "${t.name}": compQuota는 0 이상의 정수여야 합니다.`);
  }
  return errors;
}

const newId = () => randomBytes(16).toString('hex');
const sec = (d: Date) => Math.floor(d.getTime() / 1000);

type BatchItem = Parameters<ShowSeedDb['batch']>[0][number];

export async function seedShow(db: ShowSeedDb, def: ShowDefinition, opts: { apply: boolean; now?: Date }): Promise<ShowSeedReport> {
  const errors = validateShowDefinition(def);
  if (errors.length > 0) throw new ShowSeedError(`공연 정의 오류:\n- ${errors.join('\n- ')}`);

  const now = opts.now ?? new Date();
  const actions: string[] = [];
  const warnings: string[] = [];
  const writes: BatchItem[] = [];

  const meta = {
    title: def.title,
    subtitle: def.subtitle ?? null,
    presenterName: def.presenterName,
    performers: performerNames(def.performers),
    performersJson: serializePerformers(def.performers),
    ageRating: def.ageRating,
    runningMinutes: def.runningMinutes,
    venueName: def.venueName,
    venueAddress: def.venueAddress,
    description: def.description,
    coverImage: def.coverImage,
    ogImage: def.ogImage ?? null,
    scheduleNote: def.scheduleNote ?? null,
    onSitePriceNote: def.onSitePriceNote ?? null,
    noticesJson: def.notices && def.notices.length > 0 ? serializeNotices(def.notices) : null,
    mapUrl: def.mapUrl ?? null,
  };

  const existing = await db.query.shows.findFirst({ where: (s, { eq: e }) => e(s.slug, def.slug) });
  const showId = existing?.id ?? newId();

  if (!existing) {
    actions.push(`공연 생성(draft): ${def.slug}`);
    writes.push(db.insert(shows).values({ id: showId, slug: def.slug, ...meta, status: 'draft' }));
  } else {
    const changed = (Object.keys(meta) as Array<keyof typeof meta>).filter((k) => existing[k] !== meta[k]);
    if (changed.length > 0) {
      actions.push(`공연 정보 갱신: ${changed.join(', ')}`);
      writes.push(db.update(shows).set({ ...meta, updatedAt: sec(now) }).where(eq(shows.id, showId)));
    }
  }

  // 구역
  const zoneRows = existing ? await db.select().from(showZones).where(eq(showZones.showId, showId)) : [];
  const zoneIdByCode = new Map<string, string>();
  for (const z of def.zones) {
    const row = zoneRows.find((r) => r.code === z.code);
    if (!row) {
      const id = newId();
      zoneIdByCode.set(z.code, id);
      actions.push(`구역 생성: ${z.code} (정원 ${z.capacity})`);
      writes.push(db.insert(showZones).values({ id, showId, code: z.code, label: z.label, capacity: z.capacity }));
      continue;
    }
    zoneIdByCode.set(z.code, row.id);
    if (row.label === z.label && row.capacity === z.capacity) continue;
    if (z.capacity < row.capacity) {
      const peak = await peakHeldSeats(db, row.id);
      if (z.capacity < peak) {
        throw new ShowSeedError(`구역 ${z.code}: 정원을 ${z.capacity}명으로 낮출 수 없습니다(한 회차에 이미 ${peak}석이 잡혀 있음).`);
      }
    }
    actions.push(`구역 갱신: ${z.code} 정원 ${row.capacity}→${z.capacity}`);
    writes.push(db.update(showZones).set({ label: z.label, capacity: z.capacity }).where(eq(showZones.id, row.id)));
  }
  for (const r of zoneRows) {
    if (!def.zones.some((z) => z.code === r.code)) warnings.push(`DB에만 있는 구역 ${r.code}는 건드리지 않았습니다.`);
  }

  // 회차
  const showtimeRows = existing ? await db.select().from(showtimes).where(eq(showtimes.showId, showId)) : [];
  for (const s of def.showtimes) {
    const startsAt = sec(s.startsAt);
    if (showtimeRows.some((r) => r.startsAt === startsAt)) continue;
    actions.push(`회차 생성: ${s.startsAt.toISOString()}`);
    writes.push(db.insert(showtimes).values({ id: newId(), showId, startsAt, salesCloseAt: sec(salesCloseAt(s.startsAt)) }));
  }
  for (const r of showtimeRows) {
    if (!def.showtimes.some((s) => sec(s.startsAt) === r.startsAt)) {
      warnings.push(`DB에만 있는 회차(startsAt=${r.startsAt})는 건드리지 않았습니다. 시각 변경은 관리자 화면의 회차 변경을 쓰세요.`);
    }
  }

  // 티켓타입
  const typeRows = existing ? await db.select().from(showTicketTypes).where(eq(showTicketTypes.showId, showId)) : [];
  for (const t of def.ticketTypes) {
    const zoneId = zoneIdByCode.get(t.zoneCode)!;
    const row = typeRows.find((r) => r.zoneId === zoneId && r.name === t.name);
    if (!row) {
      actions.push(`티켓타입 생성: ${t.name} ${t.price}원`);
      writes.push(db.insert(showTicketTypes).values({ id: newId(), showId, zoneId, name: t.name, price: t.price, quota: t.quota, compQuota: t.compQuota }));
      continue;
    }
    if (row.price === t.price && row.quota === t.quota && row.compQuota === t.compQuota) continue;
    if (row.price !== t.price) {
      const sold = await db.select({ n: sql<number>`count(*)` }).from(schema.showTickets).where(eq(schema.showTickets.ticketTypeId, row.id));
      if (Number(sold[0]?.n ?? 0) > 0) {
        throw new ShowSeedError(`티켓타입 "${t.name}": 이미 티켓이 있어 가격을 ${row.price}→${t.price}원으로 바꿀 수 없습니다. 새 이름의 티켓타입을 추가하세요.`);
      }
    }
    actions.push(`티켓타입 갱신: ${t.name} (가격 ${row.price}→${t.price}, quota ${row.quota}→${t.quota}, comp ${row.compQuota}→${t.compQuota})`);
    writes.push(db.update(showTicketTypes).set({ price: t.price, quota: t.quota, compQuota: t.compQuota }).where(eq(showTicketTypes.id, row.id)));
  }
  for (const r of typeRows) {
    if (!def.ticketTypes.some((t) => zoneIdByCode.get(t.zoneCode) === r.zoneId && t.name === r.name)) {
      warnings.push(`DB에만 있는 티켓타입 "${r.name}"은 건드리지 않았습니다.`);
    }
  }

  if (opts.apply && writes.length > 0) {
    await db.batch(writes as [BatchItem, ...BatchItem[]]);
  }
  return { slug: def.slug, applied: opts.apply && writes.length > 0, created: !existing, actions, warnings };
}

/** 구역에서 한 회차에 잡힌(held·issued·refunding) 좌석 수의 최댓값. */
async function peakHeldSeats(db: ShowSeedDb, zoneId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.showTickets)
    .innerJoin(showTicketTypes, eq(showTicketTypes.id, schema.showTickets.ticketTypeId))
    .where(and(eq(showTicketTypes.zoneId, zoneId), inArray(schema.showTickets.status, ['held', 'issued', 'refunding'])))
    .groupBy(schema.showTickets.showtimeId);
  return rows.reduce((max, r) => Math.max(max, Number(r.n)), 0);
}
