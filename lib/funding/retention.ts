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
 *
 * **이 파일의 핵심 전제(법률 판단, 변호사 확인 필요): 배송지·응원 메시지를 이 5년 보존의
 * 대상인 "재화 등의 공급에 관한 기록"으로 분류했다.** 근거: 배송 리워드는 실물 재화이고,
 * 배송지는 그 공급이 어디로 이뤄졌는지를 증명하는 기록의 일부다. 이 분류가 틀렸다면(즉
 * 배송지가 법정 보존 대상이 아니라면), 아래 판정 로직은 실제로는 파기해도 되는 개인정보를
 * 5년 동안 붙잡아 두는 셈이 되어 처리방침 8항의 "1년 뒤 파기" 약속을 지키지 못한다.
 * 반대로 이 분류가 맞는다면, 아래 로직이 하는 그대로가 옳다 — 법정 보존이 먼저다.
 *
 * 실제 영향: 펀딩 기능은 2026년에 시작했고 첫 파기 대상은 결제일로부터 5년 뒤(2031년
 * 이후)에나 나온다. 그때까지 이 크론은 매달 0건을 돌려주는 것이 정상 동작이다 — 장식이
 * 아니라 법정 보존 우선 원칙이 실제로 적용되고 있는 것이다. 이 전제를 재검토하려면
 * (예: 배송지는 5년 대상이 아니고 1년 뒤 바로 파기해야 한다는 결론이 나오면) 아래 WHERE의
 * 법정 보존 조건 자체를 다시 설계해야 한다.
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
 * 대상(대금결제·재화공급 기록)까지 함께 사라진다. 지우는 것은 배송지 필드(shipping*),
 * 운영자가 자유롭게 적는 admin_memo(이름·연락처 조각이 들어갈 수 있다 — 계약서 쪽
 * title·terminationReason과 같은 이유), 그리고 supporterMessage(응원 메시지)다.
 *
 * **supporterMessage를 지우는 이유**: 처리방침 6항(`FUNDING_COLLECTED_ITEMS`)이 이것을
 * "선택" 수집 항목으로 명시하고, 8항의 "1년 뒤 파기" 약속은 6항이 나열한 항목 전부에
 * 걸린다 — 응원 메시지만 빼는 예외가 어디에도 쓰여 있지 않다. 7항(`FUNDING_COLLECTION_PURPOSES`)이
 * "서포터 명단 공개에 동의한 경우 프로젝트 페이지에 이름과 응원 메시지 표시"를 목적으로
 * 들지만, 이 저장소를 확인한 시점(2026-09-21)에 그 공개 표시를 실제로 구현한 화면은
 * 없다(`displayNamePublic`은 관리자 화면·CSV export에서만 읽힌다) — 즉 "공개 게시물이라
 * 영구 보존해야 한다"는 반례가 아직 코드에 없다. 이후 서포터 명단 공개 화면이 실제로
 * 생기면 이 판단을 다시 봐야 한다 — 그 화면이 배포 후 1년 넘은 메시지까지 보여줘야
 * 한다면, 이 함수가 그 메시지를 먼저 지워 화면이 깨질 수 있다.
 *
 * **여기서 일부러 빼는 것: `fulfillment_updated_by`.** 발송 상태를 마지막으로 바꾼 주체
 * (`'admin'` 또는 `'creator:<id>'`, `lib/funding/fulfillment.ts`가 채운다)는 후원자의
 * 개인정보가 아니라 운영자·개설자 쪽 행위자 식별자다 — 이 함수가 지우는 배송지·admin_memo·
 * supporterMessage는 전부 "후원자가 우리에게 준 개인정보"라 처리방침 8항의 파기 약속이
 * 걸리지만, 이 컬럼은 그 대상이 아니다. 값에 `creator:<id>`가 들어 있어 "식별자니까 지우자"는
 * 판단이 나올 수 있는데, 그렇게 하면 "누가 발송 상태를 바꿨는지"에 대한 감사 기록이 배송지와
 * 같은 시점에 사라진다 — `retention.test.ts`의 "파기 후에도 fulfillment_updated_by는
 * 남는다"가 이 컬럼이 `.set()`에 실수로 섞여 들어가는 것을 잡는다.
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
      supporterMessage: null,
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
        // 파기할 것이 남아 있는 행만 — 이미 파기됐거나 애초에 배송지·메모·응원 메시지가
        // 없던 행은 건너뛴다.
        or(
          isNotNull(fundingPledges.shippingName),
          isNotNull(fundingPledges.shippingPhone),
          isNotNull(fundingPledges.shippingPostcode),
          isNotNull(fundingPledges.shippingAddress1),
          isNotNull(fundingPledges.shippingAddress2),
          isNotNull(fundingPledges.shippingMemo),
          isNotNull(fundingPledges.adminMemo),
          isNotNull(fundingPledges.supporterMessage),
        ),
      ),
    );

  return { purged: Number(result.rowsAffected ?? 0) };
};
