import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from './policy';
describe('assessSelfCancel', () => {
  it('paid + live + 발송 전이면 가능', () => {
    expect(assessSelfCancel({ orderStatus: 'paid', projectState: 'live', fulfillmentStatus: 'none' })).toEqual({ ok: true });
  });
  it.each([
    ['pending', 'live', 'none', 'not_paid'],
    ['paid', 'closed', 'none', 'project_not_live'],
    ['paid', 'live', 'preparing', 'fulfilling'],
  ])('%s/%s/%s → %s', (orderStatus, projectState, fulfillmentStatus, code) => {
    expect(assessSelfCancel({ orderStatus, projectState: projectState as never, fulfillmentStatus })).toEqual({ ok: false, code });
  });
});

/**
 * 토스 결제가 아닌 후원은 취소할 결제가 없다 — 환불이 계좌 송금이다. 판정이 이걸 안 보면
 * 화면이 "전액 환불" 버튼을 띄우는데 서버가 거절하는 죽은 버튼이 된다(실제로 그랬다).
 * 대상은 운영자가 계좌로 받아 수기 등록한 건과, 무통장입금 중단 전에 만들어진 건이다.
 */
describe('assessSelfCancel — 결제수단', () => {
  const live = { orderStatus: 'paid', projectState: 'live' as const, fulfillmentStatus: 'none' };

  it('토스 결제는 종전대로 셀프 취소를 허용한다', () => {
    expect(assessSelfCancel({ ...live, paymentMethod: 'toss' })).toEqual({ ok: true });
  });

  it('토스가 아니면 offline_payment로 막는다', () => {
    expect(assessSelfCancel({ ...live, paymentMethod: 'bank_transfer' }))
      .toEqual({ ok: false, code: 'offline_payment' });
  });

  it('결제수단을 넘기지 않으면 종전 판정 그대로다 — 기존 호출부를 깨지 않는다', () => {
    expect(assessSelfCancel(live)).toEqual({ ok: true });
  });

  it('모든 차단 코드에 안내 문구가 있다 — 화면이 undefined를 렌더하지 않는다', () => {
    for (const code of ['not_paid', 'project_not_live', 'fulfilling', 'offline_payment'] as const) {
      expect(typeof CANCEL_BLOCK_MESSAGES[code]).toBe('string');
      expect(CANCEL_BLOCK_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});
