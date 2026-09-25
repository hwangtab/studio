import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from './policy';
import { isPastFundingEnd } from './projectState';
describe('assessSelfCancel', () => {
  it('paid + 모금 중 + 발송 전이면 가능', () => {
    expect(assessSelfCancel({ orderStatus: 'paid', fundingEnded: false, fulfillmentStatus: 'none', paymentMethod: 'toss', downloadedAt: null })).toEqual({ ok: true });
  });
  it.each([
    ['pending', false, 'none', 'not_paid'],
    ['paid', true, 'none', 'project_not_live'],
    ['paid', false, 'preparing', 'fulfilling'],
  ])('%s/마감=%s/%s → %s', (orderStatus, fundingEnded, fulfillmentStatus, code) => {
    expect(assessSelfCancel({ orderStatus: orderStatus as string, fundingEnded: fundingEnded as boolean, fulfillmentStatus: fulfillmentStatus as string, paymentMethod: 'toss', downloadedAt: null })).toEqual({ ok: false, code });
  });
});

/**
 * 운영자가 종료 버튼을 누르는 상황(가격 표기 오류·문제 발생)이 바로 환불이 필요한
 * 상황이다. 예전에는 판정이 `computeProjectState !== 'live'`라 날짜 마감과 운영자 종료를
 * 구분하지 못했고, 종료를 누른 순간 기존 후원자의 셀프 취소가 함께 끊겼다.
 */
describe('운영자 종료는 셀프 취소를 끊지 않는다', () => {
  const project = { status: 'closed' as const, startAt: '2026-10-01T10:00:00+09:00', endAt: '2026-10-31T23:59:59+09:00' };
  const beforeEnd = new Date('2026-10-15T00:00:00Z');
  const afterEnd = new Date('2026-11-05T00:00:00Z');
  const pledge = { orderStatus: 'paid', fulfillmentStatus: 'none', paymentMethod: 'toss', downloadedAt: null };

  it('운영자 종료 + 마감일 전이면 셀프 취소가 된다', () => {
    expect(isPastFundingEnd(project, beforeEnd)).toBe(false);
    expect(assessSelfCancel({ ...pledge, fundingEnded: isPastFundingEnd(project, beforeEnd) })).toEqual({ ok: true });
  });

  it('마감일이 지나면 project_not_live', () => {
    expect(isPastFundingEnd(project, afterEnd)).toBe(true);
    expect(assessSelfCancel({ ...pledge, fundingEnded: isPastFundingEnd(project, afterEnd) }))
      .toEqual({ ok: false, code: 'project_not_live' });
  });
});

/**
 * 토스 결제가 아닌 후원은 취소할 결제가 없다 — 환불이 계좌 송금이다. 판정이 이걸 안 보면
 * 화면이 "전액 환불" 버튼을 띄우는데 서버가 거절하는 죽은 버튼이 된다(실제로 그랬다).
 * 대상은 운영자가 계좌로 받아 수기 등록한 건과, 무통장입금 중단 전에 만들어진 건이다.
 */
describe('assessSelfCancel — 결제수단', () => {
  const live = { orderStatus: 'paid', fundingEnded: false, fulfillmentStatus: 'none' };


  it('토스 결제는 종전대로 셀프 취소를 허용한다', () => {
    expect(assessSelfCancel({ ...live, paymentMethod: 'toss', downloadedAt: null })).toEqual({ ok: true });
  });

  it('토스가 아니면 offline_payment로 막는다', () => {
    expect(assessSelfCancel({ ...live, paymentMethod: 'bank_transfer', downloadedAt: null }))
      .toEqual({ ok: false, code: 'offline_payment' });
  });

  it('모든 차단 코드에 안내 문구가 있다 — 화면이 undefined를 렌더하지 않는다', () => {
    for (const code of ['not_paid', 'project_not_live', 'fulfilling', 'offline_payment'] as const) {
      expect(typeof CANCEL_BLOCK_MESSAGES[code]).toBe('string');
      expect(CANCEL_BLOCK_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});

/**
 * 약관 제8조 2항은 "내려받는 형태의 리워드는 내려받기가 시작된 뒤에는 청약철회가
 * 제한됩니다"(전자상거래법 제17조 2항 5호)라고 고지하고 동의까지 받는다. 그런데 판정
 * 근거가 서버에 없어 **고지만 있고 구현이 없었다** — 1.8GB 원본을 받고 전액 환불이 됐다.
 * 배송 리워드의 `fulfilling`에 해당하는, 디지털 리워드의 '이미 건네준 상태'다.
 */
describe('내려받기 뒤 청약철회 제한', () => {
  const base = {
    orderStatus: 'paid',
    fundingEnded: false,
    fulfillmentStatus: 'none',
    paymentMethod: 'toss',
  };

  it('내려받기 전에는 셀프 취소가 된다', () => {
    expect(assessSelfCancel({ ...base, downloadedAt: null })).toEqual({ ok: true });
  });

  it('내려받기가 시작됐으면 막는다', () => {
    const v = assessSelfCancel({ ...base, downloadedAt: new Date('2026-09-15T00:00:00Z') });
    expect(v).toEqual({ ok: false, code: 'downloaded' });
  });

  it('막는 이유를 서포터에게 설명한다 — 약관 조항을 짚는다', () => {
    expect(CANCEL_BLOCK_MESSAGES.downloaded).toContain('청약철회');
    expect(CANCEL_BLOCK_MESSAGES.downloaded).toContain('제8조');
  });

  it('다른 차단 사유가 먼저인 경우에는 그쪽을 알린다', () => {
    // 이미 환불된 건에 "내려받았다"를 이유로 대면 엉뚱한 안내가 된다.
    expect(assessSelfCancel({ ...base, orderStatus: 'refunded', downloadedAt: new Date() }))
      .toEqual({ ok: false, code: 'not_paid' });
  });
});
