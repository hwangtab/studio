import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';
import { computeProjectState } from './projectState';
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
 * 마감 전(`upcoming`·`live`)에는 개인정보를 한 줄도 내보내지 않는다. 모금 중에는 셀프
 * 취소가 자유로워(`assessSelfCancel`은 live에서만 통과) 주소가 들어왔다 나갔다 하고,
 * 물량 준비에는 집계면 충분하다.
 *
 * 필드를 하나씩 골라 담는다 — 스프레드를 쓰지 않는다. 결제 금액·결제 수단·주문번호·
 * 서포터 이메일은 발송에 필요 없고, 이 화면의 props는 `__NEXT_DATA__`로 페이지 소스에
 * 실린다. 응원 메시지(`supporterMessage`)도 화이트리스트에 없다 — 발송에 필요한 값이
 * 아니라는 이 설계의 원칙대로면 담을 이유가 없다. 개설자가 읽고 싶어 할 값이라는 것은
 * 맞지만, 그건 별도 화면의 몫이지 배송 목록에 끼워 넣을 이유가 아니다.
 *
 * `computeProjectState`는 `lib/funding/projects.ts`가 재수출하지만, 정의는 fs를 물지 않는
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

  const state = computeProjectState(
    { status: project.status, startAt: project.startAt.toISOString(), endAt: project.endAt.toISOString() },
    now,
  );
  const summary = await loadSummary(project.id, project.slug);

  if (state !== 'closed') {
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
           fp.tracking_company AS tracking_company, fp.tracking_number AS tracking_number
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
    })),
  };
};
