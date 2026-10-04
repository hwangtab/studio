import {
  PAYMENT_CHOICES, buildTossPaymentRequest, paymentCustomerKey, visiblePaymentChoices, withApiKeyChannel,
} from './paymentChoices';
import { TOSS_KEY_CHANNEL_API_VALUE, TOSS_KEY_CHANNEL_PARAM, tossKeyChannelFromQuery } from '../booking/toss';

const params = {
  orderId: 'SNB-1', orderName: '녹음', customerName: '김', customerEmail: 'a@b.com', amount: 275000,
  successUrl: 'https://studionol.co.kr/ko/booking/success', failUrl: 'https://studionol.co.kr/ko/booking/fail?service=recording',
};

describe('결제수단 목록', () => {
  it('순서: 카드 / 계좌 입금 / 카카오·네이버·토스·페이코 / 애플페이 — 토스 계좌이체는 없다', () => {
    expect(PAYMENT_CHOICES.map((c) => c.id)).toEqual(['card', 'bank_transfer', 'kakaopay', 'naverpay', 'tosspay', 'payco', 'applepay']);
    expect(PAYMENT_CHOICES.some((c) => (c.id as string) === 'transfer')).toBe(false);
  });

  it('애플페이는 지원 환경에서만 보인다', () => {
    expect(visiblePaymentChoices({ applePaySupported: false }).map((c) => c.id)).not.toContain('applepay');
    expect(visiblePaymentChoices({ applePaySupported: true }).map((c) => c.id)).toContain('applepay');
  });

  it('간편결제 로고는 날짜 박힌 파일명이고 대체텍스트(=label)가 서비스 이름이다', () => {
    for (const c of PAYMENT_CHOICES.filter((x) => x.easyPay)) {
      expect(c.logo?.src).toMatch(/^\/images\/payment\/[a-z]+-\d{8}\.(png|svg)$/);
      expect(c.label).toBe(c.easyPay);
    }
  });
});

describe('buildTossPaymentRequest — 수단별 requestPayment 인자', () => {
  it('카드는 CARD + 카드 결제창(card 옵션 없음)', () => {
    expect(buildTossPaymentRequest('card', params)).toEqual({
      method: 'CARD', amount: { currency: 'KRW', value: 275000 }, orderId: 'SNB-1', orderName: '녹음',
      customerName: '김', customerEmail: 'a@b.com', successUrl: params.successUrl, failUrl: params.failUrl,
    });
  });

  it.each([
    ['kakaopay', '카카오페이'], ['naverpay', '네이버페이'], ['tosspay', '토스페이'], ['payco', '페이코'], ['applepay', '애플페이'],
  ] as const)('%s는 CARD + DIRECT + 한국어 easyPay(%s)', (id, easyPay) => {
    const req = buildTossPaymentRequest(id, params);
    expect(req.method).toBe('CARD');
    expect(req.card).toEqual({ flowMode: 'DIRECT', easyPay });
  });

  it('이메일이 비면 키를 싣지 않는다', () => {
    expect('customerEmail' in buildTossPaymentRequest('card', { ...params, customerEmail: '' })).toBe(false);
  });
});

describe('승인 채널 표식', () => {
  it('success 주소에 tosskey=api를 붙이고, 서버 판독기가 같은 값을 api로 읽는다', () => {
    expect(TOSS_KEY_CHANNEL_PARAM).toBe('tosskey');
    expect(TOSS_KEY_CHANNEL_API_VALUE).toBe('api');
    const url = new URL(withApiKeyChannel('https://studionol.co.kr/ko/funding/fail?slug=a'));
    expect(url.searchParams.get('slug')).toBe('a');
    expect(tossKeyChannelFromQuery(url.searchParams.get(TOSS_KEY_CHANNEL_PARAM))).toBe('api');
  });
});

describe('paymentCustomerKey', () => {
  it('주문번호가 토스 형식이면 그대로, 아니면 ANONYMOUS', () => {
    expect(paymentCustomerKey('TKT-20261024-ABCDEFGH', '@@ANONYMOUS')).toBe('TKT-20261024-ABCDEFGH');
    expect(paymentCustomerKey('한글', '@@ANONYMOUS')).toBe('@@ANONYMOUS');
  });
});
