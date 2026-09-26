import {
  ALBUM_BUNDLE_PRICE,
  DAY_LOCK_8H_PRICE,
  EP_BUNDLE_PRICE,
  formatPriceLabel,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL2_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_PACKAGE_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';
import { getMixingProduct } from '../booking/mixing-products';
import { getProduct, productsForService } from '../booking/products';
import {
  buildQuoteSummary,
  estimate,
  isComplete,
  makeQuoteCode,
  SCALE_QUESTIONS,
  SERVICE_CHOICES,
  type QuoteAnswers,
} from './estimate';

const won = (v: number) => formatPriceLabel(v, 'ko');

/** 모든 서비스·규모 조합의 완성된 답. */
const allCompleteAnswers = (): QuoteAnswers[] =>
  SERVICE_CHOICES.flatMap(({ id }) => {
    const scales = SCALE_QUESTIONS[id]?.choices.map((c) => c.id) ?? [undefined];
    return scales.map((scale) => ({
      service: id,
      scale,
      readiness: 'demo',
      fundingSource: 'funding',
      timing: '1m',
    }));
  });

describe('견적 요청서 — 즉시 견적', () => {
  it('필요한 문항을 다 답해야 견적이 나온다', () => {
    expect(estimate({ service: 'recording', scale: '1' })).toBeNull();
    expect(isComplete({ service: 'recording', scale: '1', readiness: 'ready', timing: '2w' })).toBe(true);
    // 발매는 제작비 마련 방법까지 묻는다.
    expect(isComplete({ service: 'release', scale: 'ep', readiness: 'demo', timing: '3m' })).toBe(false);
    // 축가는 규모·준비 상태를 묻지 않는다.
    expect(isComplete({ service: 'wedding', timing: '1m' })).toBe(true);
  });

  it('모든 조합이 견적을 낸다 — 빠진 분기가 없다', () => {
    for (const a of allCompleteAnswers()) {
      const e = estimate(a);
      expect(e).not.toBeNull();
      expect(e!.priceLabel.length).toBeGreaterThan(0);
    }
  });

  it('가격은 정본 상수에서 온다', () => {
    const base = { readiness: 'ready', timing: '2w' } as const;
    expect(estimate({ ...base, service: 'recording', scale: '1' })!.priceLabel).toBe(won(VOCAL_PACKAGE_PRICE));
    expect(estimate({ ...base, service: 'wedding' })!.priceLabel).toBe(won(WEDDING_PACKAGE_PRICE));
    expect(estimate({ ...base, service: 'mixing', scale: 'l2' })!.priceLabel).toContain(won(MIXING_LEVEL2_PRICE + MASTERING_SINGLE_PRICE));
    expect(estimate({ ...base, service: 'recording', scale: '4+' })!.priceLabel).toContain(won(DAY_LOCK_8H_PRICE * 2));
    for (const [scale, price] of [['single', SINGLE_BUNDLE_PRICE], ['ep', EP_BUNDLE_PRICE], ['album', ALBUM_BUNDLE_PRICE]] as const) {
      expect(estimate({ ...base, service: 'release', scale, fundingSource: 'self' })!.priceLabel).toBe(`${won(price)}부터`);
    }
  });

  it('발매는 상한을 약속하지 않고, 세션 연주비가 실비 별도라고 말한다', () => {
    const e = estimate({ service: 'release', scale: 'album', readiness: 'idea', fundingSource: 'self', timing: 'open' })!;
    expect(e.priceLabel).toMatch(/부터$/);
    expect(e.basis.join(' ')).toContain('세션 연주비는 포함되지 않고');
    expect(e.bookingHref).toBeUndefined();
  });

  it('온라인 예약 링크는 실제로 있는 상품만 가리킨다 — 없는 상품으로 보내면 금액이 달라진다', () => {
    for (const a of allCompleteAnswers()) {
      const href = estimate(a)!.bookingHref;
      if (!href) continue;
      const url = new URL(href, 'https://studionol.co.kr');
      const [, , , service] = url.pathname.split('/');
      const product = url.searchParams.get('product');
      if (service === 'mixing-mastering') {
        if (product) expect(getMixingProduct(product)).toBeDefined();
        continue;
      }
      expect(productsForService(service).length).toBeGreaterThan(0);
      if (product) expect(getProduct(product)?.service).toBe(service);
    }
  });

  it('연습실만 부가세 기준이 다르다', () => {
    expect(estimate({ service: 'practice', scale: 'hourly', timing: '2w' })!.vat).toBe('included');
    expect(estimate({ service: 'practice', scale: 'monthly', timing: '2w' })!.vat).toBe('final');
    expect(estimate({ service: 'lesson', timing: '2w' })!.vat).toBe('excluded');
  });
});

describe('견적 코드와 요약', () => {
  it('코드는 NOL- 뒤 헷갈리는 글자(0·O·1·I) 없이 6자', () => {
    const code = makeQuoteCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(code).toMatch(/^NOL-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('요약에는 답한 것과 견적만 있고 개인정보 칸은 없다', () => {
    const a: QuoteAnswers = { service: 'release', scale: 'ep', readiness: 'demo', fundingSource: 'funding', timing: '3m' };
    const s = buildQuoteSummary(a, estimate(a)!, 'NOL-ABCDEF');
    expect(s).toContain('NOL-ABCDEF');
    expect(s).toContain('EP (3~5곡)');
    expect(s).toContain('크라우드펀딩');
    expect(s).toContain(`${won(EP_BUNDLE_PRICE)}부터`);
    expect(s).not.toMatch(/이름|연락처|이메일|전화/);
  });
});
