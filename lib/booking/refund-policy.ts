import { daysUntilKst } from './kst';
import type { SessionProduct } from './products';

export type RefundTier = { readonly minDaysBefore: number; readonly rate: number };

/** 큰 것부터 검사한다. 비율 변경은 이 표만 고치면 화면·계산·약관이 함께 바뀐다. */
export const REFUND_TIERS = [
  { minDaysBefore: 3, rate: 1 },
  { minDaysBefore: 1, rate: 0.5 },
  { minDaysBefore: 0, rate: 0 },
] as const;

export const REFUND_POLICY_LINES = [
  '이용일 3일 전까지 취소: 전액 환불',
  '이용일 1~2일 전 취소: 50% 환불',
  '이용일 당일 취소: 환불 불가',
] as const;

/**
 * 음악연습실 시간제 환불 정책 — 녹음 세션(3일 전 전액)보다 짧다. 엔지니어 일정을 비우는
 * 녹음과 달리 무인 방 하나를 여는 일이라 하루 전까지도 다른 손님이 채울 수 있다.
 * 2026-09-24 운영자 확정: "당일취소 불가, 전일에는 50%, 그 전에는 100% 환불".
 */
export const PRACTICE_ROOM_REFUND_TIERS = [
  { minDaysBefore: 2, rate: 1 },
  { minDaysBefore: 1, rate: 0.5 },
  { minDaysBefore: 0, rate: 0 },
] as const;

export const PRACTICE_ROOM_REFUND_POLICY_LINES = [
  '이용일 2일 전까지 취소: 전액 환불',
  '이용일 전날 취소: 50% 환불',
  '이용일 당일 취소: 환불 불가',
] as const;

/**
 * 상품에 맞는 환불 규정 — 예약 위저드·관리 페이지·취소 계산·약관이 **같은 함수**를 쓴다.
 * 한 곳만 다른 표를 보면 화면에 보여 준 규정과 실제 환불액이 갈린다.
 */
export const refundPolicyFor = (
  product: Pick<SessionProduct, 'service'> | undefined,
): { tiers: readonly RefundTier[]; lines: readonly string[] } =>
  product?.service === 'practice-room'
    ? { tiers: PRACTICE_ROOM_REFUND_TIERS, lines: PRACTICE_ROOM_REFUND_POLICY_LINES }
    : { tiers: REFUND_TIERS, lines: REFUND_POLICY_LINES };

/**
 * 믹싱·마스터링 주문형 결제 환불 정책. 세션 예약과 달리 날짜 기준 단계별 환불이 아니라
 * "작업 착수" 시점 하나로 나뉜다 — 슬롯이 없어 날짜 개념이 없고, 파일을 받아 작업을
 * 시작하면 이미 엔지니어 시간이 들어간다. 착수 후 온라인 취소는 불가하되 관리자 임의
 * 환불은 남겨 둔다(work_orders.status가 received일 때만 고객 셀프 취소 가능 — service.ts).
 */
export const MIXING_REFUND_POLICY_LINES = [
  '작업 착수 전 취소: 전액 환불',
  '작업 착수 후: 온라인 취소 불가 (환불 문의는 010-4255-7893)',
] as const;

/**
 * 정기결제(연습실 월 이용료·프로듀싱 레슨) 환불 정책. 매월 결제일에 한 달치를
 * 선불로 청구하는 구조라 세션 예약(날짜별 단계 환불)·믹싱(착수 여부)과 다르게
 * "해지 시점부터 다음 결제가 멎는다"는 구독형 규칙 하나로 정리된다. 연습실은
 * 임대차 계약서(제2조·제4조·제9조)가 별도로 우선 적용된다.
 */
export const SUBSCRIPTION_REFUND_POLICY_LINES = [
  '정기결제는 매월 결제일에 한 달치가 선불로 청구됩니다.',
  '해지는 언제든 가능하며, 다음 결제일부터 청구가 멈춥니다(이미 결제된 달은 기간 끝까지 이용 가능).',
  '연습실은 임대차 계약서(제2조·제4조·제9조)가, 레슨은 결제 후 첫 수업 전 취소 시 전액 환불되며 수업 시작 후 잔여 회차 환불은 상담을 통해 안내드립니다.',
] as const;

/**
 * 아티스트 구독(월 후원 멤버십) 환불 정책. 계속거래(방문판매법)라 언제든 해지할 수 있어야
 * 하고, 미이용분 환급을 거부하는 조항은 강행규정 위반이다(계약 감사에서 이미 교정한 유형).
 * 첫 결제 후 7일은 청약철회 기간으로 전액 환불한다(스펙 §9). 그 뒤의 일할 환급은 자동
 * 실행이 아니라 요청 경로다 — 관리자 화면의 회차 환불로 처리한다.
 */
export const ARTIST_SUPPORT_REFUND_POLICY_LINES = [
  '매월 가입일과 같은 날 한 달치가 자동 결제됩니다(29~31일 가입은 매월 28일).',
  '해지는 관리 링크에서 언제든 가능하며, 다음 결제일부터 청구가 멈춥니다. 이미 결제한 달의 혜택은 그 달 말까지 유지됩니다.',
  '첫 결제 후 7일 이내에 해지하면 전액 환불됩니다. 그 이후 남은 기간의 환급은 문의 주시면 일할로 처리해 드립니다.',
  '판매자는 스튜디오 놀이며, 구독료 공급가의 90%가 지정하신 아티스트에게 지급됩니다.',
] as const;

/** 구독 종류에 맞는 규정 — 카드 등록 화면과 약관 페이지가 같은 함수를 쓴다. */
export const subscriptionRefundPolicyLines = (kind: string): readonly string[] =>
  kind === 'artist-support' ? ARTIST_SUPPORT_REFUND_POLICY_LINES : SUBSCRIPTION_REFUND_POLICY_LINES;

/**
 * 음원 발매 홍보 환불 정책. 믹싱(착수 여부 하나)과 달리 되돌릴 수 없는 단계가 둘이다 —
 * 자료 제작(의뢰인 음원에 맞춘 개별 제작물)과 발송(회수 불가). 결제 자체가 심사 통과
 * 뒤로 가 있어서, 받지 않기로 한 건은 애초에 환불 대상이 되지 않는다.
 *
 * 제작 착수 후 청약철회 제한의 근거는 전자상거래법 제17조 제2항 제3호(주문에 따라
 * 개별 생산되는 재화)인데, 같은 조 제6항이 "사업자가 미리 고지하지 않으면 제한할 수
 * 없다"고 못박고 있다. 그래서 근거 조항과 제한 사실을 여기 문구로 박아 둔다 —
 * 고지 없는 제한은 약관에 적혀 있어도 효력이 없고, 이 목록이 그 고지의 본체다.
 * music-promotion 페이지에서 결제 전에 이 페이지로 링크가 걸려 있어야 고지가 성립한다.
 */
export const PRESS_REFUND_POLICY_LINES = [
  '결제는 심사를 통과하고 발송 규모를 확정해 안내드린 다음입니다. 심사에서 받지 못하게 되면 비용이 청구되지 않습니다.',
  '제작 착수 전 취소: 전액 환불',
  '제작 착수 후: 환불되지 않습니다. 대신 그때까지 만든 보도자료·프레스킷·파생 원고·영상의 원본을 드리며, 다른 곳에 쓰셔도 됩니다.',
  '보도자료와 프레스킷은 의뢰인의 음원에 맞춰 개별 제작되는 결과물이라, 제작에 들어간 뒤에는 전자상거래법 제17조 제2항 제3호에 따라 청약철회가 제한됩니다.',
  '발송은 되돌릴 수 없습니다. 발송이 시작된 뒤에는 중단이나 회수를 요청하실 수 없습니다.',
  '기사 게재·라디오 송출·플레이리스트 수록은 매체가 정하는 일이라 환불 사유가 되지 않습니다. 다만 발송 전에 확정해 안내한 실행량에 미치지 못한 부분은 환불해 드립니다 — 저희가 책임지는 범위가 그것이기 때문입니다.',
] as const;

export interface RefundQuote {
  daysBefore: number;
  rate: number;
  refundAmount: number;
}

export const computeRefund = (
  totalAmount: number, startAt: Date, now: Date, tiers: readonly RefundTier[] = REFUND_TIERS,
): RefundQuote => {
  const daysBefore = daysUntilKst(now, startAt);
  const tier = tiers.find((t) => daysBefore >= t.minDaysBefore);
  const rate = tier ? tier.rate : 0; // 음수(지난 예약) 포함 — 환불 없음
  return { daysBefore, rate, refundAmount: Math.floor(totalAmount * rate) };
};
