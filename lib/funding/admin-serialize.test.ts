/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  REVIEW_CLEARED_MARKER, REVIEW_MEMO_MARKER, REVIEW_MEMO_PREFIXES,
  hasReviewMarker, isReviewWarningLine, serializePledgeForAdmin,
} from './admin-serialize';
import type { FundingOrder } from './service';

const NOW = new Date('2026-10-15T03:00:00Z');

const orderWith = (status: string, hasPayment: boolean, refundRequestedAt: Date | null = null, adminMemo: string | null = null): FundingOrder =>
  ({
    id: 'o1', orderNo: 'FND-1', status, totalAmount: 5000, customerName: '김후원',
    customerPhone: '010-1111-2222', customerEmail: 'a@example.com', notificationError: null, createdAt: NOW,
    fundingPledge: {
      id: 'p1', projectSlug: 'demo', paymentMethod: 'toss', entrySource: 'online', rewardTitle: 'CD',
      quantity: 1, additionalAmount: 0, fulfillmentStatus: 'none', trackingCompany: null, trackingNumber: null,
      shippingAddress1: null, supporterMessage: null, refundRequestedAt, paidAt: null,
      holdExpiresAt: NOW, adminMemo,
    },
    payments: hasPayment ? [{ id: 'pay1' }] : [],
  }) as unknown as FundingOrder;

describe('serializePledgeForAdmin — mismatch', () => {
  // pending만 보던 시절엔 승인 경합으로 expired·failed에 남은 "돈은 받았는데 확정 안 된" 건이
  // 관리자 화면에서 정상으로 보였다. 그게 정확히 찾아내야 할 사고 형태다.
  it.each(['pending', 'expired', 'failed'])('결제 기록이 있는데 %s면 미정합', (status) => {
    expect(serializePledgeForAdmin(orderWith(status, true), new Set()).mismatch).toBe(true);
  });
  it.each(['paid', 'partially_refunded', 'refunded'])('%s는 결제 기록이 있어도 정상', (status) => {
    expect(serializePledgeForAdmin(orderWith(status, true), new Set()).mismatch).toBe(false);
  });
  it('결제 기록이 없으면 어떤 상태든 미정합이 아니다', () => {
    expect(serializePledgeForAdmin(orderWith('expired', false), new Set()).mismatch).toBe(false);
  });
});

/**
 * 무통장 청약철회는 orders.status를 paid로 남긴 채 refundRequestedAt만 찍는다 — 목록의
 * 상태 칸만 보면 정상 확정 건과 구분이 안 되고, 그대로 발송 CSV에 실린다.
 */
describe('serializePledgeForAdmin — refundRequested', () => {
  it('환불 요청 시각이 있으면 status가 paid여도 refundRequested', () => {
    const item = serializePledgeForAdmin(orderWith('paid', true, new Date('2026-10-16T02:00:00Z')), new Set());
    expect(item.refundRequested).toBe(true);
    expect(item.status).toBe('paid');
    expect(item.refundRequestedAt).toBe('2026-10-16T02:00:00.000Z');
  });
  it('요청이 없으면 false', () => {
    expect(serializePledgeForAdmin(orderWith('paid', true), new Set()).refundRequested).toBe(false);
  });
  // cancel.ts는 환불할 때 refundRequestedAt을 지우지 않는다 — 시각만 보면 첫 환불을 처리한
  // 다음 날부터 배너·배지가 영구히 켜진 채로 남아 이 신호가 첫 사용 직후 죽는다.
  it('환불이 끝난 건은 요청 시각이 남아 있어도 false', () => {
    const item = serializePledgeForAdmin(orderWith('refunded', true, new Date('2026-10-16T02:00:00Z')), new Set());
    expect(item.refundRequested).toBe(false);
    // 상세 화면이 쓰는 원본 시각은 그대로 보존한다.
    expect(item.refundRequestedAt).toBe('2026-10-16T02:00:00.000Z');
  });
  // 잔액이 남은 부분환불 건은 아직 환불이 덜 끝난 것이라 신호가 꺼지면 안 된다.
  it('partially_refunded는 여전히 true', () => {
    expect(serializePledgeForAdmin(orderWith('partially_refunded', true, new Date()), new Set()).refundRequested).toBe(true);
  });
});

/**
 * 웹훅이 만료·failed 주문을 되살려 확정하면 한정 리워드 재고를 초과했을 수 있다.
 * confirm.ts는 그 흔적을 adminMemo에 남기지만, 그 값이 관리자 목록 어디에도 안 보여서
 * 로그에만 남고 아무도 확인하지 않았다.
 */
describe('serializePledgeForAdmin — needsReview', () => {
  // confirm.ts가 실제로 쓰는 두 문구. 이 상수가 어긋나면 배지가 조용히 꺼진다.
  const WEBHOOK_NOTES = [
    '[웹훅] 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요',
    '[웹훅] failed 처리 후 승인 확인 — 재고 초과 가능, 확인 필요',
  ];

  it.each(WEBHOOK_NOTES)('confirm.ts가 남기는 문구 "%s"를 표식으로 인식한다', (note) => {
    expect(note).toContain(REVIEW_MEMO_MARKER);
    expect(serializePledgeForAdmin(orderWith('paid', true, null, note), new Set()).needsReview).toBe(true);
  });

  // adminMemo는 append로 쌓인다 — 관계없는 메모가 뒤에 붙는다고 꺼지면 안 된다.
  it('관계없는 메모가 덧붙어도 켜진 채로 남는다', () => {
    const memo = `${WEBHOOK_NOTES[0]}\n[2026-10-20] 입금자명 김철수로 확인`;
    expect(serializePledgeForAdmin(orderWith('paid', true, null, memo), new Set()).needsReview).toBe(true);
  });

  /**
   * 해제 경로가 없는 경고는 첫 사용 직후 경보 피로로 죽는다 — 이 저장소가 refundRequestedAt
   * 으로 이미 겪은 형태다(지우는 코드가 하나도 없어 배너가 영구히 켜져 있었다).
   */
  it('해제 표식이 뒤에 붙으면 꺼진다', () => {
    const memo = `${WEBHOOK_NOTES[0]}\n[2026-10-20] ${REVIEW_CLEARED_MARKER} — 잔여 3개 확인`;
    expect(serializePledgeForAdmin(orderWith('paid', true, null, memo), new Set()).needsReview).toBe(false);
  });

  /**
   * 순서를 본다. 한 번 닫은 건을 웹훅이 다시 되살려 확정하면 새 경고가 해제 기록보다 뒤에
   * 붙는다 — 단순 포함 여부로 보면 그 두 번째 경고가 첫 해제에 묻혀 영영 안 뜬다.
   */
  it('닫은 뒤에 경고가 또 붙으면 다시 켜진다', () => {
    const memo = [
      WEBHOOK_NOTES[0],
      `[2026-10-20] ${REVIEW_CLEARED_MARKER} — 잔여 3개 확인`,
      WEBHOOK_NOTES[1],
    ].join('\n');
    expect(serializePledgeForAdmin(orderWith('paid', true, null, memo), new Set()).needsReview).toBe(true);
  });

  it('해제 표식만 있고 경고가 없으면 애초에 꺼진 상태', () => {
    expect(hasReviewMarker(`[2026-10-20] ${REVIEW_CLEARED_MARKER} — x`)).toBe(false);
  });

  /**
   * 판정이 문자열 위치(lastIndexOf)였을 때의 실패. 화면 배너가 "관리자 메모에 웹훅이 남긴
   * 원문이 있습니다"라고 안내하므로 사유에 원문을 인용하는 건 실제로 나올 법한 입력인데,
   * 그 인용이 마커의 마지막 등장 위치가 되어 **해제가 통째로 무효**가 됐다. 200으로 성공해도
   * 배지가 안 꺼지고, 같은 문구를 계속 인용하면 영구 점등한다.
   */
  it('해제 사유에 마커 문구를 그대로 인용해도 꺼진 상태가 유지된다', () => {
    const memo = [
      WEBHOOK_NOTES[0],
      `[2026-10-20] ${REVIEW_CLEARED_MARKER} — 웹훅 메모(${REVIEW_MEMO_MARKER}) 확인함, 문제없음`,
    ].join('\n');
    expect(hasReviewMarker(memo)).toBe(false);
  });

  // 경고·해제가 여러 번 오가도 마지막 줄의 순서만 본다.
  it('경고 → 해제 → 경고 → 해제 순이면 꺼진 상태', () => {
    const memo = [
      WEBHOOK_NOTES[0],
      `[2026-10-20] ${REVIEW_CLEARED_MARKER} — 1차 확인`,
      WEBHOOK_NOTES[1],
      `[2026-10-22] ${REVIEW_CLEARED_MARKER} — 2차 확인`,
    ].join('\n');
    expect(hasReviewMarker(memo)).toBe(false);
  });

  // 접두가 없는 줄은 경고가 아니다 — 운영자가 마커 문구만 적어 둔 메모로 신호가 켜지면
  // 배지의 뜻이 "웹훅이 되살린 건"에서 "메모에 이 문구가 있는 건"으로 바뀐다.
  it('접두 없이 마커 문구만 있는 줄은 경고로 세지 않는다', () => {
    expect(hasReviewMarker(`[2026-10-20] 확인 요청 — ${REVIEW_MEMO_MARKER}`)).toBe(false);
  });

  it('메모가 없거나 관계없는 메모면 false', () => {
    expect(serializePledgeForAdmin(orderWith('paid', true, null, null), new Set()).needsReview).toBe(false);
    expect(serializePledgeForAdmin(orderWith('paid', true, null, '입금자명 김철수'), new Set()).needsReview).toBe(false);
  });

  it('hasReviewMarker는 null·undefined를 안전하게 받는다', () => {
    expect(hasReviewMarker(null)).toBe(false);
    expect(hasReviewMarker(undefined)).toBe(false);
  });
});

/**
 * 표식 문자열은 confirm.ts(다른 작업이 소유)와 이 파일에 나뉘어 있다. 한쪽만 바뀌면 배지가
 * 조용히 꺼지고, 그 실패는 사고가 난 뒤에야 드러난다 — 소스를 직접 읽어 대조한다.
 *
 * "어딘가에 있다"만 보면 두 문구 중 **한쪽만** 바뀌었을 때 통과한다. confirm.ts에서
 * `[웹훅]`으로 시작하는 문자열 리터럴을 전부 뽑아 **모두가** 마커로 끝나는지 본다.
 *
 * 근본 해결은 아니다 — 확정 결합은 lib/funding/policy.ts에 상수를 두고 confirm.ts가
 * 조립하는 방식이어야 한다. policy.ts·confirm.ts 모두 이 작업의 소유가 아니라 이번엔
 * 소스 대조로 막고, 관련 PR이 모두 병합된 뒤 후속 커밋에서 접는다.
 */
describe('confirm.ts 소스 대조 — 표식이 어긋나면 배지가 조용히 꺼진다', () => {
  const source = () => readFileSync(path.join(process.cwd(), 'lib/funding/confirm.ts'), 'utf-8');
  const literalsIn = (src: string) => [...src.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]);

  // 꼬리 드리프트: 두 문구 중 한쪽만 바뀌어도 잡는다.
  it('[웹훅] 접두 문구가 전부 REVIEW_MEMO_MARKER로 끝난다', () => {
    const webhookNotes = literalsIn(source()).filter((l) => l.startsWith('[웹훅]'));
    expect(webhookNotes.length).toBeGreaterThan(0);
    for (const note of webhookNotes) expect(note.endsWith(REVIEW_MEMO_MARKER)).toBe(true);
  });

  /**
   * 접두 드리프트: 판정은 줄의 **형태**(접두 + 마커 꼬리)를 본다. confirm.ts가 마커를 단
   * 메모를 REVIEW_MEMO_PREFIXES에 없는 접두로 남기기 시작하면 경고가 통째로 안 잡힌다.
   */
  it('마커를 단 문구는 전부 경고 줄 형태를 만족한다', () => {
    const flagged = literalsIn(source()).filter((l) => l.includes(REVIEW_MEMO_MARKER));
    expect(flagged.length).toBeGreaterThan(0);
    for (const note of flagged) expect(isReviewWarningLine(note)).toBe(true);
  });

  it('알고 있는 접두가 실제로 confirm.ts에 하나 이상 쓰이고 있다', () => {
    expect(REVIEW_MEMO_PREFIXES.some((prefix) => source().includes(prefix))).toBe(true);
  });
});
