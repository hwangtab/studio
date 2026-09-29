/**
 * 후원 한 건의 **리워드 줄**을 읽는 단 하나의 입구.
 *
 * 한 주문에 여러 리워드를 담게 되면서(2026-09-28) 줄은 `funding_pledge_items`에 산다. 그런데
 * 그 표가 생기기 전의 후원과 관리자 수기 등록은 `funding_pledges`의 옛 단일 리워드 칸
 * (`reward_id`·`reward_title`·`unit_amount`·`quantity`)만 갖는다 — 그 경우 옛 칸이 곧 한 줄이다.
 * 옛 후원을 새 표로 옮겨 담지 않은 것은 마이그레이션을 "표 추가"로만 두기 위해서이고, 그
 * 대가로 줄을 읽는 곳은 전부 이 함수를 거쳐야 한다.
 *
 * 새 후원은 옛 칸에도 첫 줄을 복사해 둔다(NOT NULL). 그러니 옛 칸을 직접 읽으면 에러 없이
 * **첫 리워드만** 보인다 — 조용히 틀리는 쪽이라 더 위험하다.
 *
 * 이 모듈은 순수하다(DB·fs 없음) — 클라이언트 화면도 같은 판정을 쓴다.
 */

export interface PledgeLine {
  rewardId: string;
  rewardTitle: string;
  unitAmount: number;
  /** 산 수량. 환불해도 줄지 않는다 — 무엇을 샀는지는 기록이다. */
  quantity: number;
  /** 줄 단위 부분 환불로 돌려준 수량(lib/funding/lineRefund.ts). 옛 칸 폴백 줄은 늘 0. */
  refundedQuantity: number;
}

type PledgeItemLike = Omit<PledgeLine, 'refundedQuantity'> & { position: number; refundedQuantity?: number | null };

interface PledgeWithLegacyLine {
  rewardId: string;
  rewardTitle: string;
  unitAmount: number;
  quantity: number;
  items?: ReadonlyArray<PledgeItemLike> | null;
}

export const pledgeLines = (pledge: PledgeWithLegacyLine): PledgeLine[] => {
  const items = pledge.items ?? [];
  if (items.length === 0) {
    return [{ rewardId: pledge.rewardId, rewardTitle: pledge.rewardTitle, unitAmount: pledge.unitAmount, quantity: pledge.quantity, refundedQuantity: 0 }];
  }
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map(({ rewardId, rewardTitle, unitAmount, quantity, refundedQuantity }) => ({
      rewardId, rewardTitle, unitAmount, quantity, refundedQuantity: refundedQuantity ?? 0,
    }));
};

/**
 * **살아 있는** 줄만 — 수량은 `산 수량 − 환불 수량`, 0이 된 줄은 뺀다. 내려받기·배송·
 * "전부 디지털인가" 판정처럼 지금 이행해야 하는 것을 묻는 자리에 쓴다. 기록을 보여 주는
 * 자리(메일·관리자 표시)는 `pledgeLines`를 쓰고 환불을 따로 적는다.
 */
export const activePledgeLines = (lines: readonly PledgeLine[]): PledgeLine[] =>
  lines.flatMap((l) => {
    const quantity = l.quantity - l.refundedQuantity;
    return quantity > 0 ? [{ ...l, quantity, refundedQuantity: 0 }] : [];
  });

/** 줄들의 리워드 금액 합(추가 펀딩 제외). */
export const pledgeLinesAmount = (lines: readonly Pick<PledgeLine, 'unitAmount' | 'quantity'>[]): number =>
  lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0);

/** 한 줄 요약 — "『발작』 × 1, 『갱도』 × 1". 관리자 목록·CSV·장부처럼 칸이 하나인 자리에 쓴다. */
export const pledgeLinesLabel = (lines: readonly (Pick<PledgeLine, 'rewardTitle' | 'quantity'> & { refundedQuantity?: number })[]): string =>
  lines
    .map((l) => `${l.rewardTitle} × ${l.quantity}${l.refundedQuantity ? ` (${l.refundedQuantity}개 환불)` : ''}`)
    .join(', ');

/**
 * 짧은 이름 — 한 줄이면 그 제목, 여러 줄이면 "첫 제목 외 N건". 결제창 주문명처럼 길이 제한이
 * 있는 자리와, 새 후원의 옛 `reward_title` 칸에 쓴다(그 칸을 누가 읽어도 여러 개라는 것은 보이게).
 */
export const pledgeLinesShortTitle = (lines: readonly Pick<PledgeLine, 'rewardTitle'>[]): string =>
  lines.length <= 1 ? (lines[0]?.rewardTitle ?? '') : `${lines[0].rewardTitle} 외 ${lines.length - 1}건`;
