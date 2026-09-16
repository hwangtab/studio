/**
 * 아티스트 구독의 순수 규칙 — 금액 분해, 정산 셈, 신청 검증, 결제일.
 * 돈이 걸린 숫자라 스펙 §10의 예시 값을 그대로 고정한다.
 */
import { ARTIST_SUPPORT_TIERS } from '../../data/pricing';
import { splitInclusiveAmount } from '../booking/amounts';
import { subscriptionAmounts, subscriptionOrderName } from '../billing/amounts';
import { computeArtistPayout } from './payout';
import { billingDayForSignup, validateArtistSupportSignup } from './signup';

jest.mock('../../data/artists', () => ({
  getSupportedArtist: (slug: string) =>
    slug === 'jai' ? { slug: 'jai', name: '자이', supportActive: true, taxType: 'withholding' } : null,
  SUPPORTED_ARTISTS: [],
}));

describe('splitInclusiveAmount — VAT 포함액 역산', () => {
  it.each([
    [5000, 4545, 455],
    [10000, 9091, 909],
    [30000, 27273, 2727],
  ])('%i원 → 공급가 %i + VAT %i, 합이 정확히 맞는다', (total, item, vat) => {
    expect(splitInclusiveAmount(total)).toEqual({ itemAmount: item, vatAmount: vat, totalAmount: total });
  });

  it('세 등급 전부 정수로 떨어지고 합이 표시가와 같다', () => {
    for (const tier of ARTIST_SUPPORT_TIERS) {
      const a = splitInclusiveAmount(tier.monthlyTotal);
      expect(Number.isInteger(a.itemAmount) && Number.isInteger(a.vatAmount)).toBe(true);
      expect(a.itemAmount + a.vatAmount).toBe(tier.monthlyTotal);
    }
  });
});

describe('subscriptionAmounts — 아티스트 구독', () => {
  it('등급 id로 포함액을 나눈다 — 표시가가 곧 청구액', () => {
    expect(subscriptionAmounts('artist-support', 'standard')).toEqual({ itemAmount: 9091, vatAmount: 909, totalAmount: 10000 });
  });

  it('등급이 없거나 모르면 null — 기본 등급으로 떨어뜨리지 않는다', () => {
    expect(subscriptionAmounts('artist-support')).toBeNull();
    expect(subscriptionAmounts('artist-support', 'gold')).toBeNull();
  });

  it('고정가 상품은 등급을 무시한다', () => {
    expect(subscriptionAmounts('lesson', 'standard')?.totalAmount).toBe(385000);
  });
});

describe('subscriptionOrderName', () => {
  it('구독 행을 주면 아티스트 이름이 붙는다 — 카드 명세서에서 무슨 결제인지 보이도록', () => {
    expect(subscriptionOrderName({ kind: 'artist-support', artistSlug: 'jai' })).toBe('자이 아티스트 구독');
  });
  it('아티스트를 모르면 일반 이름으로', () => {
    expect(subscriptionOrderName({ kind: 'artist-support', artistSlug: 'gone' })).toBe('아티스트 구독');
    expect(subscriptionOrderName('artist-support')).toBe('아티스트 구독');
  });
});

describe('computeArtistPayout — 스펙 §10 예시', () => {
  it('월 10,000원 1건, 원천징수: 7,912원 실수령', () => {
    expect(computeArtistPayout({ grossAmount: 10000, refundAmount: 0, taxType: 'withholding' })).toEqual({
      grossAmount: 10000,
      refundAmount: 0,
      supplyAmount: 9091,
      shareAmount: 8182,
      withholdingAmount: 270,
      netAmount: 7912,
    });
  });

  it('세금계산서 아티스트는 원천징수 0', () => {
    const p = computeArtistPayout({ grossAmount: 10000, refundAmount: 0, taxType: 'invoice' });
    expect(p.withholdingAmount).toBe(0);
    expect(p.netAmount).toBe(8182);
  });

  it('환불은 총액에서 먼저 뺀다 — 환불된 돈의 90%를 지급하지 않는다', () => {
    const p = computeArtistPayout({ grossAmount: 20000, refundAmount: 10000, taxType: 'withholding' });
    expect(p.supplyAmount).toBe(9091);
    expect(p.netAmount).toBe(7912);
  });

  it('환불이 총액을 넘어도 음수로 떨어지지 않는다', () => {
    const p = computeArtistPayout({ grossAmount: 5000, refundAmount: 9000, taxType: 'withholding' });
    expect(p.netAmount).toBe(0);
  });
});

describe('validateArtistSupportSignup', () => {
  const good = {
    artistSlug: 'jai',
    tierId: 'standard',
    customerName: '김후원',
    customerEmail: 'fan@example.com',
    customerPhone: '',
    displayName: '',
    displayConsent: true,
  };

  it('정상 입력을 통과시키고 표시명이 비면 이름으로 채운다', () => {
    const r = validateArtistSupportSignup(good);
    expect(r).toEqual({ ok: true, value: { ...good, displayName: '김후원' } });
  });

  it.each([
    [{ ...good, artistSlug: 'nobody' }, /아티스트/],
    [{ ...good, tierId: 'gold' }, /등급/],
    [{ ...good, customerName: '' }, /이름/],
    [{ ...good, customerEmail: 'nope' }, /이메일/],
    [{ ...good, customerPhone: 'abc' }, /전화번호/],
    [{ ...good, displayName: 'x'.repeat(31) }, /표시 이름/],
    ['not an object', /형식/],
  ])('%p → 거절', (body, pattern) => {
    const r = validateArtistSupportSignup(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(pattern);
  });

  it('동의는 정확히 true일 때만 참 — "true" 문자열은 동의가 아니다', () => {
    const r = validateArtistSupportSignup({ ...good, displayConsent: 'true' });
    expect(r.ok && r.value.displayConsent).toBe(false);
  });
});

describe('billingDayForSignup', () => {
  it('KST 가입일의 일을 결제일로', () => {
    // UTC 9/15 23:00 = KST 9/16 08:00
    expect(billingDayForSignup(new Date('2026-09-15T23:00:00Z'))).toBe(16);
  });
  it('29~31일은 28일로 고정', () => {
    expect(billingDayForSignup(new Date('2026-08-31T03:00:00Z'))).toBe(28);
    expect(billingDayForSignup(new Date('2026-08-29T03:00:00Z'))).toBe(28);
    expect(billingDayForSignup(new Date('2026-08-28T03:00:00Z'))).toBe(28);
  });
});
