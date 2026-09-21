import { and, isNotNull, isNull, lt, or } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges } from '../../db/schema';

/**
 * 후원자 약관 제13조·처리방침 8항이 약속한 보관 기간 — 리워드 전달 완료 후 이 기간이
 * 지나면 지체 없이 파기한다. `PRIVACY_RETENTION_TEXT`(policy.ts)와 같은 값이다. 문구를
 * 고칠 때는 그 상수와 약관 본문(`pages/[locale]/funding/terms.tsx` 제13조)도 함께
 * 고쳐야 한다 — 약속과 구현이 갈리면 어느 쪽도 지켜지지 않는다.
 */
export const REWARD_RETENTION_YEARS = 1;

/**
 * 전자상거래법 제6조·시행령 제6조가 강제하는 법정 보존 기간. `PRIVACY_LEGAL_RETENTION_TEXT`
 * (policy.ts)가 고지하는 값과 같다 — 계약·청약철회 기록과 대금결제·재화공급 기록은 5년.
 *
 * 이 기간이 지나기 전에는 리워드 전달 후 1년이 지났어도 파기하지 않는다. 법정 보존이
 * 프라이버시 파기 약속보다 우선한다(계약서 쪽 `lib/contracts/retention.ts`와 같은 원칙).
 */
export const LEGAL_RETENTION_YEARS = 5;

export interface FundingPurgeResult {
  purged: number;
}

const yearsAgo = (now: Date, years: number): Date => {
  const boundary = new Date(now);
  boundary.setFullYear(boundary.getFullYear() - years);
  return boundary;
};

/**
 * 보관 기간이 지난 후원의 배송지·연락 관련 개인정보를 파기한다.
 *
 * **행은 지우지 않는다.** `funding_pledges`를 통째로 지우면 모금액·후원 통계·법정 보존
 * 대상(대금결제·재화공급 기록)까지 함께 사라진다. 지우는 것은 이 프로젝트의 리워드
 * 이행에만 쓰이는 배송지 필드(shipping*)와 운영자가 자유롭게 적는 admin_memo뿐이다 —
 * 후자는 이름·연락처 조각이 들어갈 수 있다(계약서 쪽 title·terminationReason과 같은 이유).
 *
 * **여기서 다루지 않는 것: `orders.customer_name`·`customer_phone`·`customer_email`.**
 * 이 값은 `orders` 테이블에 있고, 그 테이블은 예약·레슨 등 펀딩이 아닌 주문도 함께 쓴다.
 * 전자상거래법이 정한 "계약 또는 청약철회 등에 관한 기록"(5년) 자체가 이 값이라, 펀딩
 * 전용 파기 작업이 공유 테이블의 컬럼을 함부로 비우면 다른 주문 유형의 보존 의무까지
 * 건드리게 된다. 그 판단은 이 작업의 범위 밖이다 — 별도로 `orders` 전체의 보존 정책을
 * 설계해야 한다.
 *
 * **id로 재발급하지 않는 이유(idempotency 설계)**: 별도의 `purged_at` 컬럼을 두지 않는다.
 * 이 저장소에서 스키마를 늘리려면 마이그레이션을 생성·적용해야 하는데, 이 작업 범위에서는
 * DB 마이그레이션을 실행하지 않기로 했다. 대신 "파기할 것이 남아 있는가"(shipping* 또는
 * admin_memo 중 하나라도 NOT NULL)를 WHERE에 그대로 넣는다 — 한 번 파기하면 전부 NULL이
 * 되어 같은 행이 다음 실행에서 다시 걸리지 않는다.
 */
export const purgeExpiredFundingPersonalData = async (now: Date = new Date()): Promise<FundingPurgeResult> => {
  const rewardBoundary = yearsAgo(now, REWARD_RETENTION_YEARS);
  const legalBoundary = yearsAgo(now, LEGAL_RETENTION_YEARS);

  const result = await getDb()
    .update(fundingPledges)
    .set({
      shippingName: null,
      shippingPhone: null,
      shippingPostcode: null,
      shippingAddress1: null,
      shippingAddress2: null,
      shippingMemo: null,
      adminMemo: null,
      updatedAt: now,
    })
    .where(
      and(
        // 기산점: 리워드 전달 완료. 아직 전달되지 않았으면(NULL) 파기 대상이 아니다.
        isNotNull(fundingPledges.deliveredAt),
        lt(fundingPledges.deliveredAt, rewardBoundary),
        /**
         * 법정 보존 우선. 결제일(paidAt) 기준 5년이 아직 안 지났으면 리워드 전달 후 1년이
         * 지났어도 파기하지 않는다. paidAt이 없는 예외적인 행(수기 등록 등)은 생성일로
         * 대신 센다 — COALESCE를 sql로 감싸면 drizzle이 좌변 타입을 몰라 boundary(Date)를
         * unix timestamp로 변환하지 못하므로(계약서 쪽 retention.ts와 같은 함정), 타입이
         * 있는 컬럼을 각각 직접 비교해 같은 논리를 편다.
         */
        or(
          and(isNotNull(fundingPledges.paidAt), lt(fundingPledges.paidAt, legalBoundary)),
          and(isNull(fundingPledges.paidAt), lt(fundingPledges.createdAt, legalBoundary)),
        ),
        // 파기할 것이 남아 있는 행만 — 이미 파기됐거나 애초에 배송/메모가 없던 행은 건너뛴다.
        or(
          isNotNull(fundingPledges.shippingName),
          isNotNull(fundingPledges.shippingPhone),
          isNotNull(fundingPledges.shippingPostcode),
          isNotNull(fundingPledges.shippingAddress1),
          isNotNull(fundingPledges.shippingAddress2),
          isNotNull(fundingPledges.shippingMemo),
          isNotNull(fundingPledges.adminMemo),
        ),
      ),
    );

  return { purged: Number(result.rowsAffected ?? 0) };
};
