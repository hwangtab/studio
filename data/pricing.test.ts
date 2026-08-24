/**
 * 가격 SSOT 정합 가드.
 *
 * 같은 가격이 data/pricing.ts 오퍼·utils/schema/business.ts(JSON-LD)·
 * pages/api/llms.ts(상수 import)·common.json 릴리즈 티어 카피에 흩어져 있다.
 * 한쪽만 고쳐 어긋나는 드리프트를 CI에서 잡는다 — 가격 개정 시 이 테스트가
 * 깨지면 남은 소비처를 마저 고치라는 신호다.
 */
import {
  COVER_VIDEO_PACKAGE_PRICE,
  DAY_LOCK_PRICE,
  formatPriceAmount,
  getPricingData,
  LESSON_MONTHLY_PRICE,
  MASTERING_PACKAGE_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  PRACTICE_ROOM_MONTHLY_PRICE,
  PRODUCTION_OFFER_PRICE,
  RECORDING_HOURLY_PRICE,
  RELEASE_ALBUM_FROM_PRICE,
  RELEASE_EP_FROM_PRICE,
  RELEASE_SINGLE_FROM_PRICE,
  RENTAL_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from './pricing';
import { generateDefaultSchema } from '../utils/schema/business';
import koCommon from '../public/locales/ko/common.json';

const LOCALES = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;

const collectOffers = (locale: (typeof LOCALES)[number]) => {
  const d = getPricingData(locale);
  return [
    ...d.recordingOffers,
    ...d.mixingOffers,
    ...d.masteringOffers,
    ...d.specialPackages,
    ...d.practiceRoomOffers,
    ...d.additionalServices,
  ];
};

describe('가격 SSOT 정합', () => {
  it('모든 로케일에서 priceDisplay가 priceValue의 포맷 문자열을 포함한다 (표시↔값 바인딩)', () => {
    for (const locale of LOCALES) {
      for (const offer of collectOffers(locale)) {
        expect(`${locale}:${offer.id}:${offer.priceDisplay}`).toContain(
          formatPriceAmount(offer.priceValue)
        );
      }
    }
  });

  it('오퍼 id ↔ SSOT 상수 매핑이 고정돼 있다 (한쪽만 고치면 실패)', () => {
    const byId = new Map(collectOffers('ko').map((o) => [o.id, o.priceValue]));
    expect(byId.get('recording-pro')).toBe(VOCAL_PACKAGE_PRICE);
    expect(byId.get('recording-hourly')).toBe(RECORDING_HOURLY_PRICE);
    expect(byId.get('recording-daylock')).toBe(DAY_LOCK_PRICE);
    expect(byId.get('mixing-level1')).toBe(MIXING_LEVEL1_PRICE);
    expect(byId.get('mixing-level2')).toBe(MIXING_LEVEL2_PRICE);
    expect(byId.get('mixing-level3')).toBe(MIXING_LEVEL3_PRICE);
    expect(byId.get('mastering-single')).toBe(MASTERING_SINGLE_PRICE);
    expect(byId.get('mastering-package')).toBe(MASTERING_PACKAGE_PRICE);
    expect(byId.get('package-wedding')).toBe(WEDDING_PACKAGE_PRICE);
    expect(byId.get('package-voiceover')).toBe(VOICEOVER_HOURLY_PRICE);
    expect(byId.get('package-cover-video')).toBe(COVER_VIDEO_PACKAGE_PRICE);
    expect(byId.get('package-rental')).toBe(RENTAL_HOURLY_PRICE);
    expect(byId.get('practice-room-monthly')).toBe(PRACTICE_ROOM_MONTHLY_PRICE);

    const d = getPricingData('ko');
    expect(d.lessonMonthlyPrice).toBe(LESSON_MONTHLY_PRICE);
    expect(d.practiceRoomMonthlyPrice).toBe(PRACTICE_ROOM_MONTHLY_PRICE);
  });

  it('JSON-LD makesOffer 가격이 SSOT 상수와 순서까지 일치한다', () => {
    const schema = generateDefaultSchema('https://studionol.co.kr', 'ko') as {
      '@graph': Array<Record<string, unknown>>;
    };
    const biz = schema['@graph'].find((n) => n['@type'] === 'EntertainmentBusiness') as {
      makesOffer: Array<{ price: number }>;
      hasOfferCatalog: { itemListElement: Array<{ price: number }> };
    };
    const expected = [
      RECORDING_HOURLY_PRICE,
      VOCAL_PACKAGE_PRICE,
      MIXING_LEVEL1_PRICE,
      PRODUCTION_OFFER_PRICE,
      PRACTICE_ROOM_MONTHLY_PRICE,
    ];
    expect(biz.makesOffer.map((o) => o.price)).toEqual(expected);
    expect(biz.hasOfferCatalog.itemListElement.map((o) => o.price)).toEqual(expected);
  });

  it('릴리즈 티어 카피(ko common.json)가 RELEASE_* 상수의 만원 표기를 포함한다', () => {
    const tiers = (
      koCommon as unknown as {
        releaseProject: { tiers: Record<'single' | 'ep' | 'album', { range: string }> };
      }
    ).releaseProject.tiers;
    const manwon = (n: number) => `${n / 10000}만원`;
    expect(tiers.single.range).toContain(manwon(RELEASE_SINGLE_FROM_PRICE));
    expect(tiers.ep.range).toContain(manwon(RELEASE_EP_FROM_PRICE));
    expect(tiers.album.range).toContain(manwon(RELEASE_ALBUM_FROM_PRICE));
  });

  // /pricing의 h1은 SERP <title>이 약속한 단가를 그대로 받아야 한다(약속-도착지 일치).
  // 이 카피만 i18n 보간 대신 리터럴인 이유는 pages/[locale]/pricing.tsx의 주석 참조 —
  // hero h1은 LCP 폰트 subset 생성기가 스캔하는 대상이라 보간을 쓸 수 없다.
  // 그래서 드리프트는 이 테스트가 막는다.
  it('pricing hero h1(ko common.json)이 핵심 단가의 만원 표기를 포함한다', () => {
    const heroTitle = (
      koCommon as unknown as { pricing: { hero: { title: string } } }
    ).pricing.hero.title;
    const manwon = (n: number) => `${n / 10000}만원`;
    expect(heroTitle).toContain(manwon(RECORDING_HOURLY_PRICE));
    expect(heroTitle).toContain(manwon(PRACTICE_ROOM_MONTHLY_PRICE));
    expect(heroTitle).toContain(manwon(WEDDING_PACKAGE_PRICE));
  });

  // h1이 <title>과 어긋나면 "가격 보러 왔는데 숫자가 없다"는 이탈이 재발한다.
  it('pricing seo.title과 hero.title이 같은 단가를 말한다', () => {
    const pricing = (
      koCommon as unknown as { pricing: { hero: { title: string }; seo: { title: string } } }
    ).pricing;
    const manwon = (n: number) => `${n / 10000}만원`;
    for (const price of [RECORDING_HOURLY_PRICE, PRACTICE_ROOM_MONTHLY_PRICE, WEDDING_PACKAGE_PRICE]) {
      expect(pricing.seo.title).toContain(manwon(price));
      expect(pricing.hero.title).toContain(manwon(price));
    }
  });
});
