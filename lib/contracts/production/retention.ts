import { del } from '@vercel/blob';
import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { productionContractEvents, productionContracts, productionContractSigners, refundAccounts } from '../../../db/schema';
import { contractPdfPathname } from '../pdfPath';
import { canonicalTermsJson, parseStoredTerms } from './terms';

/**
 * 계약서 제13조 3항이 약속한 보관 기간 — 계약이 끝난 날(최종 인도 또는 해지)부터 3년.
 * 고칠 때는 single-template.md 제13조와 처리방침(data/privacyPolicy.ts)도 함께 고친다.
 */
export const PRODUCTION_RETENTION_YEARS = 3;

/** 파기 후 자리를 채우는 표시(연습실 retention.ts와 같은 값 — 빈 값이면 "누락"과 "파기"를 구분할 수 없다). */
const PURGED_MARK = '(개인정보 파기됨)';

export const getProductionRetentionBoundary = (now: Date = new Date()): Date => {
  const boundary = new Date(now);
  boundary.setFullYear(boundary.getFullYear() - PRODUCTION_RETENTION_YEARS);
  return boundary;
};

/**
 * 보관 기간이 지난 제작 계약의 개인정보를 파기한다. 매월 purge-contracts 크론이 연습실 파기와 함께 부른다.
 *
 * 기산점은 상태마다 다르다.
 * - completed: 최종 인도로 끝난 날(completedAt)
 * - terminated: 해지한 날(terminatedAt)
 * - cancelled·expired: 체결되지 않은 계약 — 마지막으로 바뀐 날(updatedAt, 취소·만료 시각)
 *
 * signed(진행 중)는 대상이 아니다. 작업이 끝나지 않았는데 연락처를 지우면 인도도 정산도 못 한다.
 *
 * 계약 행은 남긴다(연습실과 같다). 금액·날짜·상태처럼 사람을 가리키지 않는 값은 "이런 계약이 있었다"는 운영
 * 기록으로 쓴다. 지우는 것은 이름·활동명·연락처·주소·생년월일, 그 값이 박힌 본문과 PDF, 서명 이미지·IP·단말
 * 정보, 자유 입력(제목·해지 사유), 곡 제목이다. 지문은 그대로 두며 대조하면 반드시 어긋난다 — 변조가 아니다.
 */
export const purgeExpiredProductionPersonalData = async (
  now: Date = new Date(),
): Promise<{ purged: number; failed: number }> => {
  const boundary = getProductionRetentionBoundary(now);

  const targets = await getDb()
    .select({ id: productionContracts.id, pdfUrl: productionContracts.pdfUrl, termsJson: productionContracts.termsJson })
    .from(productionContracts)
    .where(
      and(
        or(
          and(eq(productionContracts.status, 'completed'), lt(productionContracts.completedAt, boundary)),
          and(eq(productionContracts.status, 'terminated'), lt(productionContracts.terminatedAt, boundary)),
          and(
            inArray(productionContracts.status, ['cancelled', 'expired']),
            lt(productionContracts.updatedAt, boundary),
          ),
        ),
        // 기록을 만든 지도 그만큼 지났어야 한다 — 끝난 날을 소급해 적은 계약이 만들자마자 파기되지 않게.
        lt(productionContracts.createdAt, boundary),
        isNull(productionContracts.purgedAt),
      ),
    );

  let purged = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      // PDF를 먼저 지운다. 실패하면 파기 표식을 남기지 않아 다음 회차에 다시 시도한다.
      if (target.pdfUrl) await del(contractPdfPathname(target.pdfUrl));

      const terms = parseStoredTerms(target.termsJson);

      await getDb().batch([
        getDb()
          .update(productionContracts)
          .set({
            title: PURGED_MARK,
            clientName: PURGED_MARK,
            clientStageName: null,
            clientEmail: PURGED_MARK,
            clientPhone: PURGED_MARK,
            clientBirthdate: null,
            clientAddress: null,
            content: PURGED_MARK,
            // 곡 제목은 사람을 가리킬 수 있다(발매 전 곡이면 더욱). 금액·기한 조건은 운영 기록으로 남긴다.
            termsJson: canonicalTermsJson({ ...terms, songTitle: null }),
            terminationReason: null,
            notificationError: null,
            pdfUrl: null,
            purgedAt: now,
            updatedAt: now,
          })
          .where(eq(productionContracts.id, target.id)),
        // 운영자 행은 스튜디오 쪽 기록이라 남기고, 의뢰인·대리인 행만 지운다.
        getDb()
          .update(productionContractSigners)
          .set({
            name: PURGED_MARK,
            email: PURGED_MARK,
            phone: null,
            relation: null,
            signatureData: null,
            ipAddress: null,
            userAgent: null,
            firstViewedIp: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(productionContractSigners.contractId, target.id),
              inArray(productionContractSigners.role, ['client', 'guardian']),
            ),
          ),
        // 진행 기록은 종류·날짜·금액을 남기고(운영 기록), 메모·결과물 링크·수정 요청 내용(data_json)과 IP를 지운다.
        getDb()
          .update(productionContractEvents)
          .set({ dataJson: null, actorIp: null, noticeError: null })
          .where(eq(productionContractEvents.contractId, target.id)),
        // 해지 환불 계좌(결제 공용 표, 0072). 은행·예금주도 개인정보라 덮지 않고 행을 지운다(결제 쪽 파기와 같다).
        getDb()
          .delete(refundAccounts)
          .where(and(eq(refundAccounts.orderKind, 'production'), eq(refundAccounts.orderNo, target.id))),
      ]);
      purged += 1;
    } catch (error: unknown) {
      console.error(`[contracts/production/retention] Failed to purge ${target.id}:`, error);
      failed += 1;
    }
  }

  return { purged, failed };
};
