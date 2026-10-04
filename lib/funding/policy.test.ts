import { assessSelfCancel, cancelBlockedMessage, canWithdrawBeforeDeposit, CANCEL_BLOCK_MESSAGES } from './policy';
import { isPastFundingEnd } from './projectState';
describe('assessSelfCancel', () => {
  it('paid + 모금 중 + 발송 전이면 가능', () => {
    expect(assessSelfCancel({ orderStatus: 'paid', fundingEnded: false, fulfillmentStatus: 'none', paymentMethod: 'toss', entrySource: 'online', downloadedAt: null })).toEqual({ ok: true, refundVia: 'card' });
  });
  it.each([
    ['pending', false, 'none', 'not_paid'],
    ['paid', true, 'none', 'project_not_live'],
    ['paid', false, 'preparing', 'fulfilling'],
  ])('%s/마감=%s/%s → %s', (orderStatus, fundingEnded, fulfillmentStatus, code) => {
    expect(assessSelfCancel({ orderStatus: orderStatus as string, fundingEnded: fundingEnded as boolean, fulfillmentStatus: fulfillmentStatus as string, paymentMethod: 'toss', entrySource: 'online', downloadedAt: null })).toEqual({ ok: false, code });
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
  const pledge = { orderStatus: 'paid', fulfillmentStatus: 'none', paymentMethod: 'toss', entrySource: 'online', downloadedAt: null };

  it('운영자 종료 + 마감일 전이면 셀프 취소가 된다', () => {
    expect(isPastFundingEnd(project, beforeEnd)).toBe(false);
    expect(assessSelfCancel({ ...pledge, fundingEnded: isPastFundingEnd(project, beforeEnd) })).toEqual({ ok: true, refundVia: 'card' });
  });

  it('마감일이 지나면 project_not_live', () => {
    expect(isPastFundingEnd(project, afterEnd)).toBe(true);
    expect(assessSelfCancel({ ...pledge, fundingEnded: isPastFundingEnd(project, afterEnd) }))
      .toEqual({ ok: false, code: 'project_not_live' });
  });
});

/**
 * 결제수단이 같은 `bank_transfer`라도 둘로 갈린다(PR #77의 죽은 버튼 교훈).
 * - 온라인 계좌 입금 → 셀프 취소를 받되 환불 계좌로(`refundVia: 'bank_account'`).
 * - 관리자 수기 등록 → 화면 취소 없음(`offline_payment`).
 */
describe('assessSelfCancel — 결제수단·등록 경로', () => {
  const live = { orderStatus: 'paid', fundingEnded: false, fulfillmentStatus: 'none' };

  it('토스 결제는 카드 취소로 셀프 취소를 허용한다', () => {
    expect(assessSelfCancel({ ...live, paymentMethod: 'toss', entrySource: 'online', downloadedAt: null })).toEqual({ ok: true, refundVia: 'card' });
  });

  it('온라인 계좌 입금은 환불 계좌로 셀프 취소를 허용한다', () => {
    expect(assessSelfCancel({ ...live, paymentMethod: 'bank_transfer', entrySource: 'online', downloadedAt: null }))
      .toEqual({ ok: true, refundVia: 'bank_account' });
  });

  it('관리자 수기 등록은 offline_payment로 막는다', () => {
    expect(assessSelfCancel({ ...live, paymentMethod: 'bank_transfer', entrySource: 'manual', downloadedAt: null }))
      .toEqual({ ok: false, code: 'offline_payment' });
  });

  it('온라인 계좌 입금도 발송 준비·내려받기·마감 규칙은 같다', () => {
    const bank = { ...live, paymentMethod: 'bank_transfer', entrySource: 'online' };
    expect(assessSelfCancel({ ...bank, fulfillmentStatus: 'preparing', downloadedAt: null })).toEqual({ ok: false, code: 'fulfilling' });
    expect(assessSelfCancel({ ...bank, downloadedAt: new Date() })).toEqual({ ok: false, code: 'downloaded' });
    expect(assessSelfCancel({ ...bank, fundingEnded: true, downloadedAt: null })).toEqual({ ok: false, code: 'project_not_live' });
    // 입금 전(pending)은 셀프 취소가 아니라 "입금 전 신청 취소"다.
    expect(assessSelfCancel({ ...bank, orderStatus: 'pending', downloadedAt: null })).toEqual({ ok: false, code: 'not_paid' });
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
    entrySource: 'online',
  };

  it('내려받기 전에는 셀프 취소가 된다', () => {
    expect(assessSelfCancel({ ...base, downloadedAt: null })).toEqual({ ok: true, refundVia: 'card' });
  });

  it('내려받기가 시작됐으면 막는다', () => {
    const v = assessSelfCancel({ ...base, downloadedAt: new Date('2026-09-15T00:00:00Z') });
    expect(v).toEqual({ ok: false, code: 'downloaded' });
  });

  it('막는 이유를 후원자에게 설명한다 — 약관 조항을 짚는다', () => {
    expect(CANCEL_BLOCK_MESSAGES.downloaded).toContain('청약철회');
    expect(CANCEL_BLOCK_MESSAGES.downloaded).toContain('제8조');
  });

  it('다른 차단 사유가 먼저인 경우에는 그쪽을 알린다', () => {
    // 이미 환불된 건에 "내려받았다"를 이유로 대면 엉뚱한 안내가 된다.
    expect(assessSelfCancel({ ...base, orderStatus: 'refunded', downloadedAt: new Date() }))
      .toEqual({ ok: false, code: 'not_paid' });
  });
});

// 음원을 내려받아 셀프 취소가 막혔어도, 함께 담은 실물 리워드는 받은 뒤 7일 안에 철회할 수
// 있다(전자상거래법 제17조 2항 5호는 그 디지털 콘텐츠만 제한). 문구가 그 사실을 가리지 않게.
describe('cancelBlockedMessage', () => {
  it('실물을 함께 담았으면 그 리워드는 문의로 철회할 수 있다고 덧붙인다', () => {
    const m = cancelBlockedMessage('downloaded', ['『발작』', '『갱도』']);
    expect(m.startsWith(CANCEL_BLOCK_MESSAGES.downloaded)).toBe(true);
    expect(m).toContain('『발작』, 『갱도』은(는) 받은 날부터 7일 안에 문의로 청약철회할 수 있습니다.');
  });
  it('음원만 담았거나 다른 사유면 기본 문구 그대로', () => {
    expect(cancelBlockedMessage('downloaded', [])).toBe(CANCEL_BLOCK_MESSAGES.downloaded);
    expect(cancelBlockedMessage('fulfilling', ['『발작』'])).toBe(CANCEL_BLOCK_MESSAGES.fulfilling);
  });
});

describe('canWithdrawBeforeDeposit — 입금 전 신청 취소', () => {
  it('입금 대기 중인 온라인 계좌 입금만', () => {
    expect(canWithdrawBeforeDeposit({ orderStatus: 'pending', paymentMethod: 'bank_transfer', entrySource: 'online' })).toBe(true);
  });
  it.each([
    ['paid', 'bank_transfer', 'online'],
    ['expired', 'bank_transfer', 'online'],
    ['pending', 'toss', 'online'],
    ['pending', 'bank_transfer', 'manual'],
  ])('%s/%s/%s → 아님', (orderStatus, paymentMethod, entrySource) => {
    expect(canWithdrawBeforeDeposit({ orderStatus, paymentMethod, entrySource })).toBe(false);
  });
});
