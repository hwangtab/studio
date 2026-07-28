import { del } from '@vercel/blob';
import { and, eq, isNull, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contracts, signatures } from '../../db/schema';

/**
 * 계약서 제12조가 약속한 보관 기간. 계약 종료일로부터 이 기간이 지나면 개인정보를
 * 파기한다. 문구를 고칠 때는 lib/contracts/contract-template.md의 제12조도 함께 고쳐야
 * 한다 — 약속과 구현이 갈리면 어느 쪽도 지켜지지 않는다.
 */
export const RETENTION_YEARS = 3;

/** 파기 후 자리를 채우는 표시. 빈 값으로 두면 "누락"과 "파기"를 구분할 수 없다. */
const PURGED_MARK = '(개인정보 파기됨)';

export interface PurgeResult {
  purged: number;
  failed: number;
}

export const getRetentionBoundary = (now: Date = new Date()): Date => {
  const boundary = new Date(now);
  boundary.setFullYear(boundary.getFullYear() - RETENTION_YEARS);
  return boundary;
};

/**
 * 보관 기간이 지난 계약의 개인정보를 파기한다.
 *
 * 계약 행 자체는 남긴다. 기간·금액·호실처럼 개인을 식별하지 않는 항목은 운영 기록으로
 * 쓸 수 있고, 행을 통째로 지우면 "이런 계약이 있었다"는 사실까지 사라져 분쟁 시 정황을
 * 설명할 수 없다. 지우는 것은 이름·생년월일·연락처·주소, 이 정보가 그대로 박혀 있는
 * 계약 본문, 그리고 서명 이미지·IP·단말 정보다. 보관된 PDF에도 같은 내용이 있으므로
 * 함께 지운다.
 */
export const purgeExpiredPersonalData = async (now: Date = new Date()): Promise<PurgeResult> => {
  const boundary = getRetentionBoundary(now);

  const targets = await getDb()
    .select({ id: contracts.id, pdfUrl: contracts.pdfUrl })
    .from(contracts)
    .where(and(lt(contracts.endDate, boundary), isNull(contracts.purgedAt)));

  let purged = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      // PDF를 먼저 지운다. 여기서 실패하면 파기 표식을 남기지 않아 다음 회차에 다시 시도한다
      // — 표식만 찍고 파일이 남으면 파기됐다고 착각하게 된다.
      if (target.pdfUrl) {
        await del(target.pdfUrl);
      }

      await getDb().batch([
        getDb()
          .update(contracts)
          .set({
            customerName: PURGED_MARK,
            customerBirthdate: null,
            customerEmail: PURGED_MARK,
            customerPhone: PURGED_MARK,
            customerAddress: null,
            content: PURGED_MARK,
            pdfUrl: null,
            purgedAt: now,
            updatedAt: now,
          })
          .where(eq(contracts.id, target.id)),
        getDb()
          .update(signatures)
          .set({
            signerName: PURGED_MARK,
            signerEmail: PURGED_MARK,
            signatureData: null,
            ipAddress: null,
            userAgent: null,
            updatedAt: now,
          })
          .where(eq(signatures.contractId, target.id)),
      ]);

      purged += 1;
    } catch (error: unknown) {
      console.error(`[contracts/retention] Failed to purge ${target.id}:`, error);
      failed += 1;
    }
  }

  return { purged, failed };
};
