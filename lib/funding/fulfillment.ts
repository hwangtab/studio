import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fulfillmentStatusEnum } from '../../db/schema';
import { isLiveFundingOrderStatus, liveFundingOrderStatusList } from './refundable';
import { PRIVACY_ACTOR_ADMIN } from '../privacy/accessLog';
import { getFundingProjectAsync } from './repository';
import { isDigitalReward } from './shape';

/**
 * 발송 상태 전환을 관리자·개설자가 함께 쓰는 서비스로 뽑은 것.
 *
 * pages/api/admin/funding/pledges/[id].ts의 set_fulfillment 분기에 있던 로직을 그대로
 * 옮겼다 — SQL과 주석은 요약하지 않는다. 그 분기에는 이유가 적힌 규칙이 넷 있었고
 * (살아 있는 주문 집합, 환불 요청 건 차단, delivered_at의 COALESCE/NULL 규칙, 경합을
 * 막는 UPDATE ... WHERE), 개설자 경로가 이걸 다시 구현하면 두 벌이 갈라져 한쪽만
 * 고쳐지는 사고가 난다.
 */
/**
 * 누가 바꿨는지. 관리자도 **사람으로 특정한다** — 계정이 사람별로 갈려 있고
 * (`lib/contracts/admin-accounts.ts`) 가드가 성공에 `actor`를 실어 주는데, 예전엔 그 값을
 * 넘기지 않아 `fulfillment_updated_by`가 전부 `'admin'`으로 남았다. 발송 기록이 누가 눌렀는지
 * 가리키지 못하면 감사 기록으로 쓸 수 없다.
 *
 * `actor`가 없으면(ADMIN_ACCOUNTS를 쓰지 않는 배포·계정을 나누기 전 발급된 옛 세션) 지금처럼
 * `'admin'`으로 남는다 — 누구인지 모르는 것이 사실이다(`PRIVACY_ACTOR_ADMIN`과 같은 판단).
 */
export type FulfillmentActor =
  | { kind: 'admin'; actor?: string | null }
  | { kind: 'creator'; creatorId: string };

export type FulfillmentResult =
  | { ok: true }
  | {
      ok: false;
      code: 'not_found' | 'invalid_status' | 'not_live' | 'refund_requested' | 'conflict' | 'forbidden';
      message: string;
    };

export const setFulfillment = async (input: {
  pledgeId: string;
  status: string;
  trackingCompany?: string | null;
  trackingNumber?: string | null;
  actor: FulfillmentActor;
  now?: Date;
}): Promise<FulfillmentResult> => {
  const { pledgeId, status, actor } = input;
  const now = input.now ?? new Date();
  const db = getDb();

  if (!(fulfillmentStatusEnum as readonly string[]).includes(status)) {
    return { ok: false, code: 'invalid_status', message: '발송 상태가 올바르지 않습니다.' };
  }

  const row = await db.query.fundingPledges.findFirst({
    where: (t, { eq }) => eq(t.id, pledgeId),
    with: { order: true },
  });
  if (!row || !row.order) {
    return { ok: false, code: 'not_found', message: '펀딩 내역을 찾을 수 없습니다.' };
  }
  const pledge = row;
  const order = row.order;

  /**
   * 개설자 경로는 자기 프로젝트의 후원에만 닿는다. `funding_pledges.project_slug`는
   * **문자열**이고 승인 시 확정된다 — 마크다운 프로젝트의 후원은 `funding_projects`에
   * 대응 행이 없으므로 이 조회가 실패해 forbidden이 된다. 지금 운영 DB의 후원 26건이
   * 전부 그 마크다운 프로젝트(keep-singing-for-palestine)의 것이고, 그 후원자들은
   * "배송지는 개설자에게 제공되지 않는다"에 동의했다 — 이 격리가 그 동의를 소급해
   * 뒤집지 않는다.
   */
  if (actor.kind === 'creator') {
    const project = await db.query.fundingProjects.findFirst({
      where: (t, { eq }) => eq(t.slug, pledge.projectSlug),
    });
    if (!project || project.creatorId !== actor.creatorId) {
      return { ok: false, code: 'forbidden', message: '이 후원의 발송 상태를 바꿀 권한이 없습니다.' };
    }
  }

  // 상태 게이트는 CSV·집계·관리자 환불과 **같은 집합**을 본다(LIVE_FUNDING_ORDER_STATUSES).
  // 예전엔 여기만 'paid' 하나로 굳어 있어, 부분환불된 후원이 실제로 발송돼도 기록을 남길
  // 수 없었다 — 목록·CSV에는 영구 '미발송'으로 떠 다음 회차 중복 발송 후보가 됐고,
  // delivered_at이 안 찍혀 아래 주석이 말하는 파기 기산점 자체가 생기지 않았다.
  if (!isLiveFundingOrderStatus(order.status)) {
    return { ok: false, code: 'not_live', message: '확정된 펀딩만 발송 상태를 바꿀 수 있습니다.' };
  }

  // 무통장 청약철회는 자동 환불 경로가 없어 refundRequestedAt만 찍히고 주문은 paid로
  // 남는다. 그 상태를 '발송 완료'로 바꿀 수 있게 두면, 청약철회한 사람에게 실물이
  // 나간 기록이 시스템 안에서 정상 발송으로 굳는다. 예외는 두지 않는다 — 되돌리려면
  // 환불을 처리하거나(주문이 refunded가 되어 이 분기 앞에서 걸린다) 아래
  // clear_refund_request로 요청을 취소하는 두 경로뿐이다. 후자는 사유를 필수로 받아
  // 관리자 메모에 날짜와 함께 덧붙이고 후원자에게 메일을 보낸다 — 즉 둘 다 흔적이 남고
  // 고객도 알게 된다.
  if (pledge.refundRequestedAt) {
    return {
      ok: false,
      code: 'refund_requested',
      message: '환불 요청된 펀딩입니다. 환불을 처리하거나 요청을 취소한 뒤에 발송 상태를 바꿔 주세요.',
    };
  }

  // 빈 문자열은 "지우기"다 — null로 저장해야 잘못 입력한 운송장을 비울 수 있다. 명시적
  // null도 "지우기"로 다룬다 — undefined("이 필드는 안 건드린다")와 null("이 필드를 비워라")을
  // 구분해야 개설자 폼처럼 값을 갖고 있다가 사용자가 지운 경우를 표현할 수 있다. 관리자
  // 라우트는 지금 undefined만 넘기므로(문자열이 아니면 무조건 undefined로 변환) 이 분기는
  // 영향받지 않는다 — null을 실제로 보내는 것은 개설자 경로(다음 태스크)뿐이다.
  const trackingCompany = input.trackingCompany === undefined
    ? pledge.trackingCompany : (input.trackingCompany || null);
  const trackingNumber = input.trackingNumber === undefined
    ? pledge.trackingNumber : (input.trackingNumber || null);

  /**
   * delivered_at은 약관 제13조가 약속한 '리워드 전달 완료 후 1년 파기'의 기산점이다.
   * 그 값의 정본이 **리워드 종류에 따라 다르다.**
   *
   * **배송 리워드**: 기산점은 발송 상태와 일치시킨다.
   * delivered로 갈 때 COALESCE로 **첫 전달 시각을 보존**한다 — 운송장만 고쳐 다시 저장하는
   * 흔한 실무에서 기산점이 계속 밀리면 파기 시점도 함께 밀린다.
   * delivered에서 되돌릴 때(오조작 정정·반송) **NULL로 되돌린다** — 잘못 눌러 찍힌 시각을
   * 남겨 두면 아직 배송 중인 건의 배송지가 1년 뒤 파기 대상이 된다.
   *
   * **디지털 전용 리워드(requiresShipping: false)**: 이 함수가 delivered_at을 **건드리지
   * 않는다.** 그 값은 결제가 확정된 시각이고(lib/funding/confirm.ts), 확정 순간 내려받기가
   * 열리므로 그때가 전달 완료다 — 발송 상태가 아니라 확정이 정본이다. 예전엔 여기서
   * 무조건 NULL로 되돌려서, 운영자가 디지털 후원의 발송 상태를 한 번만 눌러도 기산점이
   * 사라지고 **다시 채우는 코드가 없었다**(확정은 이미 지났다).
   *
   * 프로젝트를 못 읽으면 배송 리워드로 다룬다 — 지금까지의 동작이고, 아직 전달되지 않은
   * 건에 기산점을 남기는 쪽보다 안전하다.
   */
  const project = await getFundingProjectAsync(pledge.projectSlug);
  const deliveredAt = isDigitalReward(project, pledge.rewardId)
    ? sql`delivered_at`
    : status === 'delivered'
      ? sql`COALESCE(delivered_at, ${Math.floor(now.getTime() / 1000)})`
      : sql`NULL`;

  // 개설자 actor는 소유 조건을 UPDATE의 WHERE에도 싣는다 — 읽고-검사-쓰기 사이에 프로젝트
  // 소유가 바뀌는 경로는 없지만(project.creatorId는 운영자만 바꾸는 값이고 그런 경로가
  // 이 저장소에 없다), 읽고-검사-쓰기 사이를 막는 것이 이 코드의 관례다. 관리자 actor는
  // 이 조건을 붙이지 않는다 — 관리자는 소유와 무관하게 전 후원을 다룬다.
  const ownerCondition = actor.kind === 'creator'
    ? sql`AND EXISTS (
        SELECT 1 FROM funding_projects p
        WHERE p.slug = funding_pledges.project_slug AND p.creator_id = ${actor.creatorId}
      )`
    : sql``;

  /**
   * 위 두 검사는 사람에게 이유를 알려 주기 위한 것이고, **경합을 막는 것은 이 WHERE다.**
   * 읽고-검사-쓰기 사이에 환불이 들어오면 두 요청이 모두 검사를 통과해 청약철회한 건이
   * '발송완료'로 굳는다. 조건을 UPDATE에 실으면 진 쪽이 rowsAffected 0을 받는다.
   * (lib/booking/cancel.ts의 선점 패턴과 같다.)
   *
   * **이 함수는 자기 손으로 매번 새로 읽는다**(pledgeId만 받고 스냅샷을 인자로 받지 않는다).
   * 그래서 위 사전 검사는 사실상 항상 최신 상태를 보고, 대부분의 경우 이 WHERE가 걸릴 일은
   * 없다 — 그런데도 WHERE를 지우지 않는다. 사전 검사와 이 UPDATE 사이에도 시간차가 있고
   * (아무리 짧아도 0은 아니다), 그 틈에 환불 요청이나 주문 상태 변경이 끼어들면 사전 검사는
   * 이미 통과한 뒤라 WHERE만 남는다. 즉 사전 검사와 WHERE는 **일부러 같은 불변식을 두 층에서
   * 지킨다** — 사전 검사는 사람에게 이유를 말해 주는 바깥쪽 층, WHERE는 그 사이 좁은 창의
   * 경합을 막는 마지막 층이다. 한쪽이 다른 쪽을 "중복"이라 보고 지우면 안 된다.
   */
  // 누가 바꿨는지는 admin_memo에 적지 않는다 — admin_memo는 retention.ts가 배송지와
  // 함께 파기하는 칸이라, 거기 적으면 감사 기록이 개인정보와 같은 시점에 사라진다.
  // fulfillment_updated_by는 파기 대상이 아닌 별도 컬럼이다(db/schema.ts 주석 참조).
  const updatedBy = actor.kind === 'admin'
    ? (actor.actor?.trim() || PRIVACY_ACTOR_ADMIN)
    : `creator:${actor.creatorId}`;

  const claim = await db.run(sql`
    UPDATE funding_pledges
    SET fulfillment_status = ${status},
        tracking_company = ${trackingCompany},
        tracking_number = ${trackingNumber},
        delivered_at = ${deliveredAt},
        fulfillment_updated_by = ${updatedBy},
        updated_at = unixepoch()
    WHERE id = ${pledge.id}
      AND refund_requested_at IS NULL
      AND EXISTS (SELECT 1 FROM orders o WHERE o.id = funding_pledges.order_id AND o.status IN (${liveFundingOrderStatusList()}))
      ${ownerCondition}
  `);
  if (Number(claim.rowsAffected) === 0) {
    return {
      ok: false,
      code: 'conflict',
      message: '그 사이 환불 요청이나 주문 상태 변경이 있었습니다. 새로고침 후 다시 확인해 주세요.',
    };
  }
  return { ok: true };
};
