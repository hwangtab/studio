import { sql, type SQL } from 'drizzle-orm';

/**
 * 후원 줄 전체를 한 표처럼 읽는 파생 테이블 — `pledge_id, reward_id, reward_title, unit_amount,
 * quantity, position`. **`quantity`는 살아 있는 수량**(산 수량 − 줄 단위 환불 수량)이다 —
 * 재고·판매 수량·배송 목록이 전부 이 값을 본다. 환불로 0이 된 줄도 행은 남으니, 줄을
 * 나열하는 자리는 `quantity > 0`으로 거른다.
 *
 * 새 후원은 `funding_pledge_items`에 줄을 적고, 옛 후원·수기 등록은 `funding_pledges`의 단일
 * 리워드 칸만 갖는다. 재고·판매 수량처럼 줄을 합산하는 SQL은 전부 이걸 거친다 — 새 표만 보면
 * 옛 후원이 통째로 빠지고, 옛 칸만 보면 여러 리워드 후원의 둘째 줄부터 빠진다. TS 쪽 짝은
 * `pledgeLines`(lib/funding/pledgeLines.ts)다.
 */
export const fundingPledgeLinesSql = (): SQL => sql`(
  SELECT i.pledge_id AS pledge_id, i.reward_id AS reward_id, i.reward_title AS reward_title,
         i.unit_amount AS unit_amount, i.quantity - i.refunded_quantity AS quantity, i.position AS position
  FROM funding_pledge_items i
  UNION ALL
  SELECT fp0.id, fp0.reward_id, fp0.reward_title, fp0.unit_amount, fp0.quantity, 0
  FROM funding_pledges fp0
  WHERE NOT EXISTS (SELECT 1 FROM funding_pledge_items i0 WHERE i0.pledge_id = fp0.id)
)`;
