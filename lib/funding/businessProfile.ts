import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { creatorBusinessProfiles, fundingCreators, fundingProjectPayouts, fundingProjects } from '../../db/schema';
import type { NtsBusinessStatus } from './businessStatus';

/**
 * 개설자 사업자 정보(`creator_business_profiles`, 0057) 읽기·지우기.
 * `savePayoutSection`·관리자 화면·파기가 함께 쓴다.
 *
 * 이 표는 마이그레이션 전 배포에서 없을 수 있다 — 그래서 **항상 컬럼을 고른 select**로 읽고(전 컬럼 select 금지,
 * 루트 CLAUDE.md 0022 절), 읽기 실패는 `'unavailable'`로 접어 사업자 칸만 끈다. 계좌·주민번호 경로는 이 표를 보지 않는다.
 */
export const TAX_DOCUMENT_PREFIX = 'tax-docs/';

export interface BusinessProfileView {
  businessNumber: string;
  businessName: string;
  representativeName: string;
  ntsStatus: NtsBusinessStatus;
  ntsTaxTypeCode: string | null;
  ntsTaxTypeLabel: string | null;
  /** ISO 문자열 — getServerSideProps props로 직렬화된다. */
  ntsCheckedAt: string | null;
  ntsCheckError: string | null;
  /** 사업자등록증이 있는가. Blob 경로는 싣지 않는다 — 열람은 관리자 경로가 따로 한다. */
  hasCertificate: boolean;
  certificateUploadedAt: string | null;
}

export const isMissingBusinessTable = (error: unknown): boolean =>
  /no such table: creator_business_profiles/i.test(String(error));

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const loadBusinessProfile = async (creatorId: string): Promise<BusinessProfileView | null | 'unavailable'> => {
  try {
    const [row] = await getDb().select({
      businessNumber: creatorBusinessProfiles.businessNumber,
      businessName: creatorBusinessProfiles.businessName,
      representativeName: creatorBusinessProfiles.representativeName,
      ntsStatus: creatorBusinessProfiles.ntsStatus,
      ntsTaxTypeCode: creatorBusinessProfiles.ntsTaxTypeCode,
      ntsTaxTypeLabel: creatorBusinessProfiles.ntsTaxTypeLabel,
      ntsCheckedAt: creatorBusinessProfiles.ntsCheckedAt,
      ntsCheckError: creatorBusinessProfiles.ntsCheckError,
      certificateKey: creatorBusinessProfiles.certificateKey,
      certificateUploadedAt: creatorBusinessProfiles.certificateUploadedAt,
    }).from(creatorBusinessProfiles).where(eq(creatorBusinessProfiles.creatorId, creatorId)).limit(1);
    if (!row) return null;
    const { certificateKey, ...rest } = row;
    return {
      ...rest,
      ntsCheckedAt: iso(rest.ntsCheckedAt),
      hasCertificate: Boolean(certificateKey?.trim()),
      certificateUploadedAt: iso(rest.certificateUploadedAt),
    };
  } catch (error: unknown) {
    if (!isMissingBusinessTable(error)) console.error('[funding] 사업자 정보 조회 실패', error);
    return 'unavailable';
  }
};

/**
 * 이 개설자에게 **사업자로 정산한 기록**(`withholding_amount = 0`인 펀딩 정산)이 있는가.
 * 있으면 세금 구분을 개인으로 바꿔도 사업자 행을 지우지 않는다 — 이미 받은 세금계산서와 대조할 근거다.
 *
 * `hasWithheldPayout`(creatorProjectWrite.ts)의 거울이다. 경계도 같다: 정산 기록에 세금 구분 컬럼이 없어
 * "원천징수인데 세액 0원"인 정산도 여기서는 사업자 정산으로 센다(남기는 쪽이라 안전하다). **둘을 함께 바꿀 것.**
 */
export const hasInvoicePayout = async (creatorId: string): Promise<boolean> => {
  const [row] = await getDb()
    .select({ id: fundingProjectPayouts.id })
    .from(fundingProjectPayouts)
    .innerJoin(fundingProjects, eq(fundingProjects.id, fundingProjectPayouts.projectId))
    .where(and(eq(fundingProjects.creatorId, creatorId), eq(fundingProjectPayouts.withholdingAmount, 0)))
    .limit(1);
  return Boolean(row);
};

/** Blob 키는 반드시 이 접두사 + creatorId/ 아래여야 지운다 — 남의 키·계약서 경로를 지우는 일을 막는다. */
export const isOwnTaxDocumentKey = (key: string, creatorId: string): boolean =>
  key.startsWith(`${TAX_DOCUMENT_PREFIX}${creatorId}/`) && !key.includes('..');

export type DeleteBlob = (key: string) => Promise<void>;

/**
 * `del`은 pathname도 받는다(@vercel/blob `del(urlOrPathname)`).
 * 지연 import — 이 모듈은 creatorProjectWrite를 거쳐 jsdom 테스트에도 실리는데, @vercel/blob(undici)은 그 환경에서
 * import만으로 깨진다(TextEncoder 없음).
 */
const defaultDeleteBlob: DeleteBlob = async (key) => {
  const { del } = await import('@vercel/blob');
  await del(key);
};

/** 사업자등록증 Blob 하나를 최선 노력으로 지운다. 실패는 로그만 — 고아 파일은 월 1회 청소가 지운다. */
export const deleteTaxDocumentBlob = async (
  key: string | null | undefined,
  creatorId: string,
  deleteBlob: DeleteBlob = defaultDeleteBlob,
): Promise<void> => {
  if (!key || !isOwnTaxDocumentKey(key, creatorId)) return;
  try {
    await deleteBlob(key);
  } catch {
    // 키·오류 원문을 남기지 않는다 — 경로에 creatorId가 들어 있어 creatorId만 적는다.
    console.error('[funding] 사업자등록증 Blob 삭제 실패 — 월 1회 청소가 지운다', { creatorId });
  }
};

/** 행을 먼저 지우고 Blob은 최선 노력으로. */
export const deleteBusinessProfile = async (creatorId: string, deps: { deleteBlob?: DeleteBlob } = {}): Promise<void> => {
  const db = getDb();
  const [row] = await db.select({ key: creatorBusinessProfiles.certificateKey }).from(creatorBusinessProfiles)
    .where(eq(creatorBusinessProfiles.creatorId, creatorId)).limit(1);
  await db.delete(creatorBusinessProfiles).where(eq(creatorBusinessProfiles.creatorId, creatorId));
  await deleteTaxDocumentBlob(row?.key, creatorId, deps.deleteBlob);
};

/**
 * 사업자등록증 키를 행에 쓴다. 행이 없으면 null(사업자 정보를 먼저 저장해야 한다).
 * 옛 키를 돌려주므로 호출자가 **행 갱신 뒤에** 옛 Blob을 지운다.
 */
export const setBusinessCertificate = async (
  creatorId: string,
  key: string,
  contentType: string,
  now: Date,
): Promise<{ previousKey: string | null } | null> => {
  const db = getDb();
  // 읽고 쓰는 사이에 다른 요청이 키를 바꾸면 옛 키를 놓쳐 Blob이 고아가 된다.
  // 읽은 키가 그대로일 때만 갱신하고(비교 후 쓰기), 아니면 다시 읽는다.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [row] = await db.select({ key: creatorBusinessProfiles.certificateKey }).from(creatorBusinessProfiles)
      .where(eq(creatorBusinessProfiles.creatorId, creatorId)).limit(1);
    if (!row) return null;
    const previousKey = row.key ?? null;
    const updated = await db.update(creatorBusinessProfiles).set({
      certificateKey: key,
      certificateContentType: contentType,
      certificateUploadedAt: now,
      updatedAt: now,
    }).where(and(
      eq(creatorBusinessProfiles.creatorId, creatorId),
      previousKey === null
        ? isNull(creatorBusinessProfiles.certificateKey)
        : eq(creatorBusinessProfiles.certificateKey, previousKey),
    )).returning({ id: creatorBusinessProfiles.creatorId });
    if (updated.length > 0) return { previousKey };
  }
  throw new Error('certificate_update_conflict');
};

/** 사업자등록증만 비운다(사업자 정보는 둔다). 행이 없으면 null. */
export const clearBusinessCertificate = async (
  creatorId: string,
  now: Date,
): Promise<{ previousKey: string | null } | null> => {
  const db = getDb();
  const [row] = await db.select({ key: creatorBusinessProfiles.certificateKey }).from(creatorBusinessProfiles)
    .where(eq(creatorBusinessProfiles.creatorId, creatorId)).limit(1);
  if (!row) return null;
  await db.update(creatorBusinessProfiles).set({
    certificateKey: null,
    certificateContentType: null,
    certificateUploadedAt: null,
    updatedAt: now,
  }).where(eq(creatorBusinessProfiles.creatorId, creatorId));
  return { previousKey: row.key ?? null };
};

/** 세금 구분이 사업자(`invoice`)인가 — 한 컬럼만 읽는다. 사업자 행은 개인으로 바꾼 뒤에도 근거로 남을 수 있어 행 유무로는 알 수 없다. */
export const isInvoiceTaxType = async (creatorId: string): Promise<boolean> => {
  const [row] = await getDb().select({ taxType: fundingCreators.taxType }).from(fundingCreators)
    .where(eq(fundingCreators.id, creatorId)).limit(1);
  return row?.taxType === 'invoice';
};
