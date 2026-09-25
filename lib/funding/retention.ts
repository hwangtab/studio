import { and, eq, exists, gt, gte, inArray, isNotNull, isNull, lt, notExists, or, sql, type SQL } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingPledges, fundingProjectPayouts, fundingProjects } from '../../db/schema';
import { PURGED_MARK } from '../privacy/orderRetention';

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
 * title·terminationReason과 같은 이유), supporterMessage(응원 메시지), 그리고 publicName
 * (명단 표시 이름 — 지우는 방식이 다르다, 아래 `.set()` 주석)이다.
 *
 * **supporterMessage를 지우는 이유**: 처리방침 6항(`FUNDING_COLLECTED_ITEMS`)이 이것을
 * "선택" 수집 항목으로 명시하고, 8항의 "1년 뒤 파기" 약속은 6항이 나열한 항목 전부에
 * 걸린다 — 응원 메시지만 빼는 예외가 어디에도 쓰여 있지 않다. 7항(`FUNDING_COLLECTION_PURPOSES`)이
 * "후원자 명단 공개에 동의한 경우 프로젝트 페이지에 이름과 응원 메시지 표시"를 목적으로
 * 드는데, 그 화면은 **실제로 있다**(`components/funding/BackerWall.tsx`·`SupporterTicker.tsx`가
 * `aggregateProjectStatus`의 공개 명단·응원 메시지를 그린다). 그래도 8항의 파기 약속이
 * 우선이라 지우는 쪽을 택한다 — 파기 대상이 된 메시지는 그 화면에서도 사라진다. 고지한
 * 기간이 지난 개인정보를 "공개 게시물"이라는 이유로 남겨 두면 8항이 거짓이 된다.
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
 * **전달 표시가 없는 후원은 여기서 파기되지 않는다** — 기산점이 `delivered_at`이다. 그 후원은
 * 5년 파기로 결제자 이름이 지워질 때 `purgeFundingPersonalDataOfPurgedOrders`(lib/privacy/
 * orderRetention.ts)가 같은 항목을 지운다. 두 경로 모두 결제 후 5년이 하한이다 — 리워드를
 * 전달한 뒤에도 오배송·민원 대응에 배송지가 필요하다(운영자 결정, 2026-09-26).
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
      /**
       * 명단 표시 이름(가린 이름·닉네임)은 NULL이 아니라 **표식으로 덮는다.** 명단은
       * `COALESCE(public_name, customer_name)`을 쓰므로 NULL로 비우면 결제자 실명이 그
       * 자리에 올라간다 — 실명을 피하려던 사람을 파기가 실명으로 공개하게 된다. 명단 조회는
       * 이 표식을 보고 그 행을 내린다(lib/funding/service.ts). 실명을 고른 행(NULL)은 그대로 둔다.
       */
      publicName: sql`CASE WHEN ${fundingPledges.publicName} IS NULL THEN NULL ELSE ${PURGED_MARK} END`,
      updatedAt: now,
    })
    .where(
      and(
        /**
         * 기산점: 리워드 전달 완료. 아직 전달되지 않았으면(NULL) 파기 대상이 아니다.
         *
         * 배송 리워드는 운영자·개설자가 발송 상태를 `delivered`로 바꿀 때
         * (lib/funding/fulfillment.ts), 디지털 전용 리워드는 **결제가 확정될 때**
         * (lib/funding/confirm.ts) 이 값이 찍힌다 — 디지털은 확정 순간 내려받기가 열리므로
         * 그때가 전달 완료다. 예전에는 후자의 경로가 없어 디지털 전용 후원의 개인정보가
         * 영영 파기되지 않았다.
         */
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
        // 파기할 것이 남아 있는 행만 — 이미 파기됐거나 애초에 배송지·메모·응원 메시지·
        // 명단 표시 이름이 없던 행은 건너뛴다.
        or(
          isNotNull(fundingPledges.shippingName),
          isNotNull(fundingPledges.shippingPhone),
          isNotNull(fundingPledges.shippingPostcode),
          isNotNull(fundingPledges.shippingAddress1),
          isNotNull(fundingPledges.shippingAddress2),
          isNotNull(fundingPledges.shippingMemo),
          isNotNull(fundingPledges.adminMemo),
          isNotNull(fundingPledges.supporterMessage),
          and(isNotNull(fundingPledges.publicName), sql`${fundingPledges.publicName} <> ${PURGED_MARK}`),
        ),
      ),
    );

  return { purged: Number(result.rowsAffected ?? 0) };
};

/**
 * 원천징수한 정산의 지급일로부터 개설자 주민등록번호를 보관하는 기간.
 *
 * **이 값은 법이 정한 것이 아니라 운영 판단이다.** 이 작업에 근거로 주어진 법령이 정하는
 * 것은 *제출 기한*뿐이다 — 간이지급명세서는 지급일이 속하는 달의 다음 달 말일
 * (소득세법 제164조의3①), 지급명세서는 사업소득의 경우 다음 연도 3월 10일(같은 법 제164조①).
 * 둘 다 지급일로부터 길어야 1년 3개월 안에 끝나므로, 아래 5년은 그 기한을 훨씬 넘는다.
 *
 * 왜 제출 기한에 딱 맞추지 않는가: 제출한 뒤에도 수정신고·경정으로 같은 지급건을 다시
 * 신고해야 하는 일이 생기고, 그때 주민등록번호가 없으면 이미 떼어 간 세액을 신고할 수단이
 * 사라진다(암호문 자체가 없어지므로 복구가 불가능하다). 그 여지를 얼마나 길게 볼지가
 * 이 상수의 값이다.
 *
 * **5라는 숫자의 출처는 국세 관련 보존기간으로 알려진 기간이지만, 그 근거 법령은 이 작업에
 * 확인된 범위 밖이다 — 법이 5년을 정했다고 단정하지 않는다.** 세무 확인 뒤 값이 바뀔 수
 * 있고, 바뀌면 이 상수 하나만 고치면 된다. 함께 고쳐야 하는 문서는 처리방침의 파기 항이다.
 *
 * 접속기록 2년(`lib/privacy/accessLog.ts`)·후원 배송지 1년/법정 5년(이 파일 위쪽)과는
 * **대상도 기산점도 다른 별개의 기준이다.** 섞지 마라.
 */
export const RESIDENT_NUMBER_RETENTION_YEARS = 5;

/**
 * 원천징수 기록이 **한 번도 없는** 주민등록번호를 지우기까지 기다리는 기간(계정 최종 활동
 * 기준). **법이 정한 것이 아니라 운영 판단이다.**
 *
 * 원천징수가 한 번도 없었다면 이 번호로 제출할 지급명세서도 없다 — 즉 수집 목적이 아직
 * 발생하지 않았고, 계정이 잠들어 있다면 앞으로도 발생하지 않는다. 개인정보 보호법 제21조①이
 * 말하는 "불필요하게 되었을 때"가 그 상태다.
 *
 * 그런데 이 경우에는 기산점으로 쓸 지급 시각이 없다. 계정 생성일은 쓰지 않는다 — 지금
 * 활발히 준비 중인 개설자의 번호까지 나이만으로 지워 버린다. 대신 `updatedAt`(로그인과
 * 정산 정보 저장이 모두 갱신한다. `lib/funding/creatorToken.ts`·`creatorProjectWrite.ts`)을
 * 써서 **마지막으로 계정이 살아 있던 시각**부터 센다. 아래 `hasLiveProject` 조건이 함께
 * 걸리므로, 심사 중이거나 정산이 남은 프로젝트를 가진 개설자는 이 경로로 지워지지 않는다.
 */
export const RESIDENT_NUMBER_DORMANT_YEARS = 1;

/**
 * 목적이 끝난 개설자 주민등록번호를 파기한다.
 *
 * 개인정보 보호법 제21조①은 보유기간이 지나거나 처리 목적을 달성해 **불필요하게 되었을 때**
 * 지체 없이 파기하라고 하고, 단서의 예외는 "다른 법령에 따라 보존하여야 하는 경우"다.
 * "계정이 남아 있는 동안"은 그 예외가 아니다 — 그래서 자동 파기가 필요하다.
 *
 * **지우는 것은 `funding_creators.resident_number_enc` 하나뿐이다.** 계좌·세금 구분·연락처는
 * 이 함수의 대상이 아니다. 그 값들은 근거도 보존기간도 다르다.
 *
 * ## 파기 규칙 (전부 AND)
 *
 * 1. `resident_number_enc`가 남아 있다 — 이미 NULL이면 대상이 아니다(멱등).
 * 2. **정산이 남은 프로젝트가 없다.** 심사 중(`submitted`·`changes_requested`)이거나
 *    승인된(`approved`) 프로젝트 중에 아직 지급 완료된 정산 기록이 없는 것이 하나라도 있으면
 *    지우지 않는다 — 곧 원천징수에 쓸 값이다. 지워 버리면 개설자가 번호를 다시 입력해야
 *    정산이 진행된다.
 * 3. 그리고 아래 둘 중 하나:
 *    - **(A) 원천징수 기록이 있는 경우** — `withholding_amount > 0`인 정산 행 가운데
 *      아직 지급되지 않았거나(`paid_at IS NULL`) 지급일이 `RESIDENT_NUMBER_RETENTION_YEARS`
 *      안에 드는 것이 **하나도 없어야** 한다. 즉 기산점은 계정 생성일이 아니라 **원천징수한
 *      정산의 지급 시각**이고, 여러 건이면 가장 나중 지급이 기준이 된다.
 *    - **(B) 원천징수 기록이 한 번도 없는 경우** — 계정 최종 활동(`updated_at`)이
 *      `RESIDENT_NUMBER_DORMANT_YEARS`보다 오래됐어야 한다.
 *
 * ## 여기서 일부러 하지 않는 것
 *
 * - **행을 지우지 않는다.** 개설자 계정에는 프로젝트·정산이 매달려 있다.
 * - **다른 컬럼을 건드리지 않는다.** `updated_at`도 갱신하지 않는다 — 그 값이 (B)의
 *   기산점이라 파기가 스스로 시계를 되감는 꼴이 되고, 무엇보다 이 함수가 약속한 것은
 *   "그 컬럼만 NULL"이다.
 * - **후원자 개인정보(`purgeExpiredFundingPersonalData`)와 섞지 않는다.** 그쪽은 대상이
 *   `funding_pledges`이고 기산점은 리워드 전달 완료, 기간은 1년(법정 보존 5년 우선)이다.
 *   대상도 기산점도 기간도 다르므로 한 함수에 합치면 어느 한쪽이 틀린 시점에 지워진다.
 *
 * 실제 영향: 펀딩 정산은 2026년에 시작했으므로 (A)로 걸리는 첫 대상은 2031년 이후에 나온다.
 * 그때까지 이 함수가 0을 돌려주는 것은 정상 동작이다.
 */
export const purgeExpiredResidentNumbers = async (now: Date = new Date()): Promise<FundingPurgeResult> => {
  const db = getDb();
  const reportingBoundary = yearsAgo(now, RESIDENT_NUMBER_RETENTION_YEARS);
  const dormantBoundary = yearsAgo(now, RESIDENT_NUMBER_DORMANT_YEARS);

  /**
   * 이 개설자의 원천징수 정산 행. 추가 조건을 붙여 재사용한다.
   *
   * **경계(알고 남겨 둔다): `withholding_amount > 0`이라, 세금 구분이 원천징수인데 계산된
   * 세액이 0원인 정산은 (A)가 아니라 (B)로 떨어진다.** 지급명세서 제출 의무는 세액이 아니라
   * *지급 사실*에서 나오므로, 엄밀히는 그런 행도 (A)로 보는 것이 맞다.
   *
   * 그런데 `funding_project_payouts`에는 **세금 구분 컬럼이 없다.** 그래서 "원천징수인데
   * 세액 0"과 "사업자로 정산해 원천징수가 없음"이 기록상 똑같은 `withholding_amount = 0`이다.
   * 둘을 가르려면 컬럼을 하나 더 두는 마이그레이션이 필요하고, 그것 없이 기준을 `>= 0`으로
   * 넓히면 **사업자 정산만 있는 개설자의 주민등록번호가 영영 (A)에 붙잡혀** 파기되지 않는다 —
   * 개인정보 보호법 제21조①이 말하는 "불필요하게 되었을 때 지체 없이 파기"에 정면으로
   * 어긋나는 쪽이다. 두 오류 중 이쪽이 더 크다.
   *
   * 실현 가능성도 사실상 없다: 세액은 지급액의 3.3%이고 `netAmount <= 0`인 정산은
   * `nothing_to_pay`로 거부되므로(`payout.ts`), 0이 나오려면 지급액이 수십 원 수준이어야 한다.
   *
   * 기준을 바꾸려거든 **`lib/funding/creatorProjectWrite.ts`의 `hasWithheldPayout`도 함께
   * 바꿔야 한다** — 그쪽은 "세금 구분을 바꿔도 번호를 지우지 않는다"의 판정이라, 두 곳이
   * 갈리면 한 화면은 "지워진다"고 안내하고 크론은 지우지 않는(또는 그 반대) 상태가 된다.
   */
  const withheldPayouts = (extra?: SQL) =>
    db
      .select({ ok: sql`1` })
      .from(fundingProjectPayouts)
      .innerJoin(fundingProjects, eq(fundingProjects.id, fundingProjectPayouts.projectId))
      .where(
        and(
          eq(fundingProjects.creatorId, fundingCreators.id),
          gt(fundingProjectPayouts.withholdingAmount, 0),
          extra,
        ),
      );

  /**
   * 아직 신고 의무가 살아 있는 원천징수 — 지급 전이거나, 지급일이 보관 기간 안이다.
   * 하나라도 있으면 파기하지 않는다.
   */
  const withholdingStillInScope = withheldPayouts(
    or(isNull(fundingProjectPayouts.paidAt), gte(fundingProjectPayouts.paidAt, reportingBoundary)),
  );

  /**
   * 아직 정산이 끝나지 않은, 살아 있는 프로젝트. 지급 완료(`paid_at IS NOT NULL`)된 정산
   * 기록이 붙지 않은 심사 중·승인 프로젝트가 여기 걸린다. `draft`·`rejected`는 정산으로
   * 이어질 수 없으므로 제외한다.
   */
  const liveProjects = db
    .select({ ok: sql`1` })
    .from(fundingProjects)
    .where(
      and(
        eq(fundingProjects.creatorId, fundingCreators.id),
        inArray(fundingProjects.reviewStatus, ['submitted', 'changes_requested', 'approved']),
        notExists(
          db
            .select({ ok: sql`1` })
            .from(fundingProjectPayouts)
            .where(
              and(
                eq(fundingProjectPayouts.projectId, fundingProjects.id),
                isNotNull(fundingProjectPayouts.paidAt),
              ),
            ),
        ),
      ),
    );

  const result = await db
    .update(fundingCreators)
    // 이 컬럼 하나만. 계좌·세금 구분·연락처는 근거도 보존기간도 다르다.
    .set({ residentNumberEnc: null })
    .where(
      and(
        isNotNull(fundingCreators.residentNumberEnc),
        notExists(liveProjects),
        or(
          // (A) 원천징수 기록이 있고, 그중 신고 의무가 살아 있는 것이 없다.
          and(exists(withheldPayouts()), notExists(withholdingStillInScope)),
          // (B) 원천징수 기록이 한 번도 없고, 계정이 잠들어 있다.
          and(notExists(withheldPayouts()), lt(fundingCreators.updatedAt, dormantBoundary)),
        ),
      ),
    );

  return { purged: Number(result.rowsAffected ?? 0) };
};
