import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';
import { isRefundPendingStatus } from './policy';
import { isPastFundingEnd } from './projectState';
import { liveFundingOrderStatusList } from './refundable';

/**
 * 이 모듈은 서버 전용이다. 클라이언트에서 import하면 `lib/funding/projects.ts`의 최상위
 * `process.cwd()`가 번들에 끌려와 빌드가 깨진다.
 *
 * 개설자가 보는 자기 프로젝트의 후원 집계와 배송지.
 *
 * **creatorId를 인자로 요구하는 것이 이 함수의 전부다**(`creatorProjectList.ts`와 같은
 * 규칙). "전체를 가져와 화면에서 거른다"는 모양의 함수를 이 파일에 두지 않는다 — 한
 * 번이라도 그런 함수가 있으면 언젠가 소유 조건 없이 호출된다.
 *
 * 마감 **날짜** 전에는 개인정보를 한 줄도 내보내지 않는다. 모금 중에는 셀프 취소가
 * 자유로워(`assessSelfCancel`은 마감일이 지나야 막는다) 주소가 들어왔다 나갔다 하고,
 * 물량 준비에는 집계면 충분하다.
 *
 * **판정이 `isPastFundingEnd`(날짜만)인 이유** — 셀프 취소와 같은 선이어야 한다. 운영자가
 * 누른 `status: 'closed'`까지 마감으로 보면, 조기 종료한 순간 아직 취소가 자유로운 후원의
 * 이름·전화·주소가 개설자에게 나가고, 개설자가 `preparing`을 한 번 누르면 후원자는 원래
 * 마감일 전에 취소권을 잃는다. 운영자 종료는 **새 후원**만 막는다.
 *
 * 필드를 하나씩 골라 담는다 — 스프레드를 쓰지 않는다. 결제 금액·결제 수단·주문번호·
 * 서포터 이메일은 발송에 필요 없고, 이 화면의 props는 `__NEXT_DATA__`로 페이지 소스에
 * 실린다. 응원 메시지(`supporterMessage`)도 화이트리스트에 없다 — 발송에 필요한 값이
 * 아니라는 이 설계의 원칙대로면 담을 이유가 없다. 개설자가 읽고 싶어 할 값이라는 것은
 * 맞지만, 그건 별도 화면의 몫이지 배송 목록에 끼워 넣을 이유가 아니다.
 *
 * `isPastFundingEnd`는 `lib/funding/projects.ts`가 재수출하지만, 정의는 fs를 물지 않는
 * `./projectState`다 — 여기서는 그 정본에서 바로 값으로 가져온다.
 */

export interface CreatorShippingRow {
  pledgeId: string;
  rewardId: string;
  rewardTitle: string;
  quantity: number;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingPostcode: string | null;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingMemo: string | null;
  fulfillmentStatus: string;
  trackingCompany: string | null;
  trackingNumber: string | null;
  /**
   * 청약철회를 요청했는데 아직 환불이 끝나지 않은 건 — `'발송금지'`, 아니면 빈 문자열.
   *
   * 관리자 CSV(`pages/api/admin/funding/export.ts`)의 `shipHold`와 **같은 판정**이다
   * (`refundRequestedAt && isRefundPendingStatus(status)`). 무통장 청약철회는 orders.status가
   * paid로 남은 채 `refund_requested_at`만 찍히므로, 이 칸이 없으면 취소를 요청한 사람이
   * 배송 목록에 그대로 실린다. 물건이 나간 뒤 발송 상태를 저장하면 409라 기록조차 안 남는다.
   */
  shipHold: string;
}

export interface CreatorShippingSummary {
  backerCount: number;
  shippingRequiredCount: number;
  byReward: Array<{ rewardId: string; rewardTitle: string; quantity: number; requiresShipping: boolean }>;
}

export type CreatorShippingView =
  | { state: 'before_close'; summary: CreatorShippingSummary }
  | { state: 'open'; summary: CreatorShippingSummary; rows: CreatorShippingRow[] };

interface SummaryTotalsRow {
  backers: number | null;
  shipping_required: number | null;
}

interface SummaryByRewardRow {
  reward_id: string;
  reward_title: string;
  qty: number | null;
  requires_shipping: number | null;
}

interface ShippingRowRaw {
  pledge_id: string;
  reward_id: string;
  reward_title: string;
  quantity: number;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_postcode: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_memo: string | null;
  fulfillment_status: string;
  tracking_company: string | null;
  tracking_number: string | null;
  refund_requested_at: number | null;
  order_status: string;
}

const loadSummary = async (projectId: string, projectSlug: string): Promise<CreatorShippingSummary> => {
  const db = getDb();
  const totals = await db.all<SummaryTotalsRow>(sql`
    SELECT
      COUNT(*) AS backers,
      COUNT(CASE WHEN r.requires_shipping = 1 THEN 1 END) AS shipping_required
    FROM funding_pledges fp
    JOIN orders o ON o.id = fp.order_id
    LEFT JOIN funding_rewards r ON r.project_id = ${projectId} AND r.reward_id = fp.reward_id
    WHERE fp.project_slug = ${projectSlug} AND o.status IN (${liveFundingOrderStatusList()})
  `);
  const byReward = await db.all<SummaryByRewardRow>(sql`
    SELECT fp.reward_id AS reward_id, fp.reward_title AS reward_title,
           SUM(fp.quantity) AS qty, MAX(COALESCE(r.requires_shipping, 0)) AS requires_shipping
    FROM funding_pledges fp
    JOIN orders o ON o.id = fp.order_id
    LEFT JOIN funding_rewards r ON r.project_id = ${projectId} AND r.reward_id = fp.reward_id
    WHERE fp.project_slug = ${projectSlug} AND o.status IN (${liveFundingOrderStatusList()})
    GROUP BY fp.reward_id, fp.reward_title
    ORDER BY fp.reward_id ASC
  `);
  return {
    backerCount: Number(totals[0]?.backers ?? 0),
    shippingRequiredCount: Number(totals[0]?.shipping_required ?? 0),
    byReward: byReward.map((r) => ({
      rewardId: r.reward_id,
      rewardTitle: r.reward_title,
      quantity: Number(r.qty ?? 0),
      requiresShipping: Number(r.requires_shipping ?? 0) === 1,
    })),
  };
};

export const loadCreatorShipping = async (
  creatorId: string, projectId: string, now: Date = new Date(),
): Promise<CreatorShippingView | null> => {
  const db = getDb();
  const [project] = await db.select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!project) return null;

  const summary = await loadSummary(project.id, project.slug);

  if (!isPastFundingEnd({ endAt: project.endAt.toISOString() }, now)) {
    return { state: 'before_close', summary };
  }

  // 행 조건 셋: 주문이 살아 있는 상태(isLiveFundingOrderStatus — 환불된 후원은 여기서
  // 빠진다) + 리워드가 requiresShipping(INNER JOIN이 이걸 강제한다 — 디지털 전용 리워드는
  // funding_rewards.requires_shipping = 0이라 아예 매치되지 않는다) + fulfillmentStatus가
  // 취소가 아닌 것(fulfillmentStatusEnum에는 애초에 '취소' 값이 없다 — 취소된 후원은
  // orders.status가 refunded로 빠지므로 첫 조건이 이미 덮는다).
  const rows = await db.all<ShippingRowRaw>(sql`
    SELECT fp.id AS pledge_id, fp.reward_id AS reward_id, fp.reward_title AS reward_title, fp.quantity AS quantity,
           fp.shipping_name AS shipping_name, fp.shipping_phone AS shipping_phone,
           fp.shipping_postcode AS shipping_postcode, fp.shipping_address1 AS shipping_address1,
           fp.shipping_address2 AS shipping_address2, fp.shipping_memo AS shipping_memo,
           fp.fulfillment_status AS fulfillment_status,
           fp.tracking_company AS tracking_company, fp.tracking_number AS tracking_number,
           fp.refund_requested_at AS refund_requested_at, o.status AS order_status
    FROM funding_pledges fp
    JOIN orders o ON o.id = fp.order_id
    JOIN funding_rewards r ON r.project_id = ${project.id} AND r.reward_id = fp.reward_id
    WHERE fp.project_slug = ${project.slug}
      AND o.status IN (${liveFundingOrderStatusList()})
      AND r.requires_shipping = 1
    ORDER BY fp.created_at ASC
  `);

  return {
    state: 'open',
    summary,
    rows: rows.map((r) => ({
      pledgeId: r.pledge_id,
      rewardId: r.reward_id,
      rewardTitle: r.reward_title,
      quantity: Number(r.quantity),
      shippingName: r.shipping_name,
      shippingPhone: r.shipping_phone,
      shippingPostcode: r.shipping_postcode,
      shippingAddress1: r.shipping_address1,
      shippingAddress2: r.shipping_address2,
      shippingMemo: r.shipping_memo,
      fulfillmentStatus: r.fulfillment_status,
      trackingCompany: r.tracking_company,
      trackingNumber: r.tracking_number,
      shipHold: r.refund_requested_at !== null && isRefundPendingStatus(r.order_status) ? '발송금지' : '',
    })),
  };
};

export interface CreatorFulfillmentGate {
  /** 이 후원이 실제로 속한 프로젝트. `loadCreatorShipping`과 달리 URL의 :id를 신뢰하지
   * 않고 pledge에서 직접 되짚는다 — 소유·마감 판정을 URL 값으로 속일 수 없게 하려는
   * 것이다(아래 `loadFulfillmentGate` 주석 참조). */
  projectId: string;
  creatorId: string;
  /** 마감 **날짜**가 지났는가. 운영자가 누른 조기 종료는 보지 않는다(위 판정과 같은 선). */
  pastFundingEnd: boolean;
  /** 리워드가 배송을 요구하지 않으면(디지털 전용) false — pledge의 reward_id가
   * funding_rewards에 없는 경우(예: 파일 프로젝트 후원)도 false로 취급한다. */
  requiresShipping: boolean;
}

/**
 * 개설자 쓰기 라우트(`/api/funding/creator/projects/[id]/fulfillment`)가 소유·마감·
 * requiresShipping 세 게이트를 판정하는 자리.
 *
 * **URL의 프로젝트 id는 여기서 쓰지 않는다.** pledgeId → project_slug → 실제 소유 프로젝트
 * 순으로 되짚는다. 만약 URL id로 마감 여부를 판단하면, 개설자가 자기 소유의 다른(이미
 * 마감된) 프로젝트 id를 URL에 넣고 아직 진행 중인 자기 프로젝트의 pledgeId를 body에 넣어
 * 마감 게이트를 우회할 수 있다 — 소유는 두 경우 다 자신이라 그것만으로는 안 걸린다.
 * pledge가 실제로 속한 프로젝트를 다시 조회해 그 프로젝트의 상태로 판정하면 이 우회가
 * 애초에 성립하지 않는다.
 *
 * `setFulfillment`(fulfillment.ts)도 소유를 다시 확인하지만(actor.kind === 'creator'
 * 분기), 그건 소유만 본다 — 마감 여부와 requiresShipping은 이 함수가 보탠다.
 */
export const loadFulfillmentGate = async (pledgeId: string, now: Date = new Date()): Promise<CreatorFulfillmentGate | null> => {
  const db = getDb();
  const pledge = await db.query.fundingPledges.findFirst({
    where: (t, { eq: eqCol }) => eqCol(t.id, pledgeId),
  });
  if (!pledge) return null;

  const project = await db.query.fundingProjects.findFirst({
    where: (t, { eq: eqCol }) => eqCol(t.slug, pledge.projectSlug),
  });
  if (!project) return null;

  const reward = await db.query.fundingRewards.findFirst({
    where: (t, { and: andCols, eq: eqCol }) => andCols(eqCol(t.projectId, project.id), eqCol(t.rewardId, pledge.rewardId)),
  });

  return {
    projectId: project.id,
    creatorId: project.creatorId,
    pastFundingEnd: isPastFundingEnd({ endAt: project.endAt.toISOString() }, now),
    requiresShipping: reward?.requiresShipping === true,
  };
};
