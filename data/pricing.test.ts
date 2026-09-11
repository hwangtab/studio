/**
 * 가격 SSOT 정합 가드.
 *
 * 같은 가격이 data/pricing.ts 오퍼·utils/schema/business.ts(JSON-LD)·
 * pages/api/llms.ts(상수 import)·common.json 릴리즈 티어 카피에 흩어져 있다.
 * 한쪽만 고쳐 어긋나는 드리프트를 CI에서 잡는다 — 가격 개정 시 이 테스트가
 * 깨지면 남은 소비처를 마저 고치라는 신호다.
 */
import {
  ALBUM_BUNDLE_PER_SONG_PRICE,
  ALBUM_BUNDLE_PRICE,
  ALBUM_LINE_ITEM_TOTAL,
  CONSULTING_HOURLY_PRICE,
  COVER_VIDEO_PACKAGE_PRICE,
  DAY_LOCK_PRICE,
  EP_BUNDLE_PER_SONG_PRICE,
  EP_BUNDLE_PRICE,
  EP_LINE_ITEM_TOTAL,
  FUNDING_DESIGN_PRICE,
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
  RELEASE_PRESS_INTRO_ENDS_ON,
  RELEASE_PRESS_INTRO_PRICE,
  RELEASE_PRESS_PRICE,
  RELEASE_SINGLE_FROM_PRICE,
  RELEASE_SONG_PRODUCTION_UNIT_PRICE,
  RENTAL_HOURLY_PRICE,
  SINGLE_BUNDLE_PRICE,
  SINGLE_LINE_ITEM_TOTAL,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from './pricing';
import { generateDefaultSchema } from '../utils/schema/business';
import { generatePracticeRoomMonthlyRentSchema } from '../utils/schema/commerce';
import { generateReleaseProjectSchema } from '../utils/schema/releaseProject';
import { generateCourseSchema } from '../utils/schema/basics';
import fs from 'fs';
import path from 'path';

import koCommon from '../public/locales/ko/common.json';

const LOCALES = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;

const SITE_URL = 'https://studionol.co.kr';

/**
 * 중첩된 JSON-LD 어디에 있든 주어진 키의 숫자 값을 전부 모은다.
 * Offer가 hasOfferCatalog·priceSpecification 등 여러 겹으로 들어가므로
 * 경로를 특정하지 않고 값만 본다 — 스키마 구조가 바뀌어도 가드가 살아남는다.
 */
const collectNumbers = (node: unknown, key: string): number[] => {
  if (Array.isArray(node)) return node.flatMap((child) => collectNumbers(child, key));
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => {
      const here = k === key ? [Number(v)].filter((n) => Number.isFinite(n)) : [];
      return [...here, ...collectNumbers(v, key)];
    });
  }
  return [];
};

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
    expect(byId.get('package-single-bundle')).toBe(SINGLE_BUNDLE_PRICE);
    expect(byId.get('package-ep-bundle')).toBe(EP_BUNDLE_PRICE);
    expect(byId.get('package-album-bundle')).toBe(ALBUM_BUNDLE_PRICE);
    expect(byId.get('package-voiceover')).toBe(VOICEOVER_HOURLY_PRICE);
    // 발매 홍보는 도입가로 판다 — 표시·청구가 정가가 아니라 도입가여야 한다.
    expect(byId.get('service-release-press')).toBe(RELEASE_PRESS_INTRO_PRICE);
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

  /**
   * business.ts(JSON-LD) 외에도 utils/schema/commerce.ts(연습실 Service 스키마)와
   * pages/[locale]/studio-info.tsx(LocalBusiness Offer)가 가격 리터럴을 따로 들고
   * 있었다(각각 360,000·100,000/500,000) — 값은 정본과 일치했지만 SSOT 링크가 없어
   * 상수가 바뀌어도 안 따라올 수 있었다. commerce.ts는 여기서 직접 검사하고,
   * studio-info.tsx는 컴포넌트 내부 useMemo라 단위 테스트로 값을 못 뽑으므로
   * import 자체(파일 상단에서 data/pricing 상수를 참조하는지)로 대신 확인한다.
   */
  it('utils/schema/commerce.ts 연습실 Offer 가격이 SSOT 상수와 일치한다', () => {
    const schema = generatePracticeRoomMonthlyRentSchema(
      'https://studionol.co.kr/ko/practice-room',
      'ko'
    ) as { offers: { price: number; priceSpecification: { price: number } } };
    expect(schema.offers.price).toBe(PRACTICE_ROOM_MONTHLY_PRICE);
    expect(schema.offers.priceSpecification.price).toBe(PRACTICE_ROOM_MONTHLY_PRICE);
  });

  it('pages/[locale]/studio-info.tsx가 가격 리터럴 대신 SSOT 상수를 import한다', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'pages', '[locale]', 'studio-info.tsx'),
      'utf8'
    );
    expect(source).toMatch(
      /import\s*{[^}]*\bRECORDING_HOURLY_PRICE\b[^}]*}\s*from\s*['"]\.\.\/\.\.\/data\/pricing['"]/
    );
    expect(source).toMatch(
      /import\s*{[^}]*\bDAY_LOCK_PRICE\b[^}]*}\s*from\s*['"]\.\.\/\.\.\/data\/pricing['"]/
    );
    expect(source).toContain('price: RECORDING_HOURLY_PRICE');
    expect(source).toContain('price: DAY_LOCK_PRICE');
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


  /**
   * data/*.ts에 만원 리터럴로 박힌 가격이 SSOT 상수를 벗어나지 않는지 본다.
   *
   * 왜 필요한가: 위 테스트들은 public/locales/ko/common.json만 본다. 그래서
   * data/buyerIntentHubs.ts의 발매 허브 카드에 "EP 약 150만원~ · 정규 약 400만원~"이
   * 문자열로 박혀 있다가 티어 하한이 180만·340만으로 바뀌어도 아무도 못 잡았다
   * (2026-09-02에 손으로 발견). 상수가 움직였는데 카피가 안 따라오는 것 —
   * 이게 이 저장소에서 실제로 나는 드리프트 형태다.
   *
   * 규칙: data/ 아래 모든 .ts(테스트 파일은 제외)에 나오는
   * "250,000원"·"25만원"은
   *   (a) 현재 SSOT 상수 중 하나이거나
   *   (b) 우리 상품이 아닌 외부 시세여서 EXTERNAL_MARKET_AMOUNTS에 등재됐거나
   * 둘 중 하나여야 한다. 새 가격을 카피에 넣을 땐 formatPriceLabel로 상수에서
   * 끌어오는 게 원칙이고, 리터럴이 꼭 필요하면 여기서 걸린다.
   *
   * pricing.ts 본체도 이제 스캔 대상이다 — 상수뿐 아니라 그 상수를 설명하는
   * 파생 합계 카피("55만원"·"212만원"·"424만원")도 들고 있어서, 예전엔 여기만
   * 빼놓아 상수가 바뀌어도 카피가 안 따라오는 드리프트를 못 잡았다. 지금은 그
   * 파생 합계도 SINGLE_LINE_ITEM_TOTAL 등으로 상수화해 formatPriceLabel로
   * 끌어 쓰므로, 본체를 포함해도 리터럴이 남지 않는다.
   *
   * 대상에서 뺀 것: docs/wiki는 log.md·decisions/가 과거 수치를 그대로 남기는
   * 이력 문서라 현재값 강제가 맞지 않는다. common.json은 위 테스트들이 맡는다.
   */
  /**
   * 발매 홍보 도입가는 한시 할인이다.
   *
   * 정가를 한 번도 팔지 않은 채 할인가만 계속 운영하면 표시광고법상 부당한
   * 표시·광고가 된다 — 기간이 무기한 연장되는 것이 전형적인 제재 사유다.
   * 기한이 지나면 이 테스트가 CI를 세워 "정가로 돌릴지, 기간을 다시 정할지"를
   * 강제로 묻는다. 날짜만 옮기고 지나가지 말 것.
   */
  it('발매 홍보 도입가 기간이 아직 남아 있다 (지나면 정가로 돌릴 것)', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(today <= RELEASE_PRESS_INTRO_ENDS_ON).toBe(true);
    expect(RELEASE_PRESS_INTRO_PRICE).toBeLessThan(RELEASE_PRESS_PRICE);
  });


  /**
   * 발매 티어 JSON-LD가 SSOT 상수를 그대로 내보낸다.
   *
   * utils/schema/releaseProject.ts가 { single: 500000, ep: 1500000, album: 4000000 }을
   * 리터럴로 들고 있다가 상수(EP 180만·정규 340만)와 어긋난 채로 배포된 적이 있다.
   * 그동안 EP·정규 발매 페이지의 Offer.price가 실제 판매가와 다른 값을 검색엔진에
   * 나가고 있었는데, 이 파일은 data/**의 리터럴 스캔 대상이 아니고 반환값을 보는
   * 테스트도 없어서 CI가 잡을 방법이 없었다.
   */
  it('발매 티어 JSON-LD Offer 가격이 SSOT 상수와 일치한다', () => {
    const expected: Record<'single' | 'ep' | 'album', number> = {
      single: RELEASE_SINGLE_FROM_PRICE,
      ep: RELEASE_EP_FROM_PRICE,
      album: RELEASE_ALBUM_FROM_PRICE,
    };
    for (const tier of ['single', 'ep', 'album'] as const) {
      const graph = generateReleaseProjectSchema(SITE_URL, 'ko', tier);
      const prices = collectNumbers(graph, 'price');
      expect(prices).toContain(expected[tier]);
      // 다른 티어 가격이 섞여 나가면 안 된다 — 예전 드리프트가 정확히 그 모양이었다.
      for (const other of ['single', 'ep', 'album'] as const) {
        if (other === tier || expected[other] === expected[tier]) continue;
        expect(prices).not.toContain(expected[other]);
      }
    }

    // 티어를 지정하지 않으면 hasOfferCatalog로 셋을 모두 싣는다.
    const hub = collectNumbers(generateReleaseProjectSchema(SITE_URL, 'ko'), 'price');
    for (const tier of ['single', 'ep', 'album'] as const) {
      expect(hub).toContain(expected[tier]);
    }
  });

  /**
   * 레슨 Course 스키마도 같은 사고 이력이 있다(basics.ts 주석 참조 — 리터럴 350000이
   * 박혀 있었다). 고쳐졌지만 회귀를 막는 테스트가 없어서 여기에 건다.
   */
  it('레슨 Course JSON-LD 가격이 LESSON_MONTHLY_PRICE와 일치한다', () => {
    const schema = generateCourseSchema(
      '프로듀싱 레슨',
      '미디·작곡·믹싱·마스터링',
      SITE_URL,
      `${SITE_URL}/images/og.webp`,
      `${SITE_URL}/ko/lesson`,
      'ko'
    );
    expect(collectNumbers(schema, 'price')).toContain(LESSON_MONTHLY_PRICE);
  });

  /**
   * OG 이미지 메타(next-sitemap.config.js)의 금액.
   *
   * 구글 이미지 검색에 나가는 title·caption인데 .js 파일이라 data/** 리터럴 스캔에
   * 안 잡히고 상수를 import하지도 않는다. 실제로 축가가 ₩150K로 굳어 있었다 —
   * 실제 판매가는 35만원이라 검색 결과가 절반 이하 가격을 광고하던 셈이다.
   */
  it('OG 이미지 메타의 금액이 SSOT 상수와 일치한다 (next-sitemap.config.js)', () => {
    const config = fs.readFileSync(path.join(__dirname, '..', 'next-sitemap.config.js'), 'utf8');
    const toK = (won: number) => `₩${won / 1000}K`;
    const expectations: { route: string; won: number }[] = [
      { route: '/recording', won: VOCAL_PACKAGE_PRICE },
      { route: '/mixing-mastering', won: MIXING_LEVEL1_PRICE },
      { route: '/wedding-song', won: WEDDING_PACKAGE_PRICE },
      { route: '/voice-acting', won: VOICEOVER_HOURLY_PRICE },
      { route: '/cover-video', won: COVER_VIDEO_PACKAGE_PRICE },
    ];
    // 어긋난 라우트를 한 번에 모아 보여준다 — 하나씩 터지면 여러 번 돌려야 한다.
    const offenders = expectations
      .map(({ route, won }) => {
        const line = config.split('\n').find((l) => l.includes(`'${route}':`) && l.includes('title:'));
        if (!line) return `${route}: pageImageMap 항목 없음`;
        return line.includes(toK(won)) ? null : `${route}: OG 타이틀이 ${toK(won)}를 말하지 않음`;
      })
      .filter((x): x is string => x !== null);
    expect(offenders).toEqual([]);

    // /pricing 캡션은 네 상품을 한 줄에 나열한다.
    const pricingLine = config.split('\n').find((l) => l.includes("'/pricing':"));
    expect(pricingLine).toBeDefined();
    for (const won of [
      PRACTICE_ROOM_MONTHLY_PRICE,
      RECORDING_HOURLY_PRICE,
      WEDDING_PACKAGE_PRICE,
      VOICEOVER_HOURLY_PRICE,
    ]) {
      expect(pricingLine).toContain(toK(won));
    }
  });

  it('data/**/*.ts의 가격 리터럴이 SSOT 상수를 벗어나지 않는다', () => {
    // 우리 상품이 아니어서 상수가 바뀌어도 따라가면 안 되는 금액.
    const NON_SSOT_AMOUNTS = new Map<number, string>([
      // 300000은 RELEASE_PRESS_INTRO_PRICE이기도 해서 ssot에서 먼저 걸러진다.
      // 이 항목은 그 상수와 무관한 외부 시세 카피가 남아 있다는 기록으로 둔다.
      [300000, '오디오 인터페이스 입문가 "20~30만원"의 상단 (외부 시세)'],
      [1390000, '해외 음악 PR 시세 비교 주석 "$995 ≈ 139만원" (외부 시세)'],
      [30000, '유통 대행사(DistroKid) 연 정액 "3만원대" (외부 시세)'],
      [87500, '레슨 월정액 350,000원을 월 4회로 나눈 회당 환산값'],
      [4200, '언론 기사 제목 "천 번을 들어줘야 4200원" 인용'],
    ]);
    const ssot = new Set<number>([
      RECORDING_HOURLY_PRICE,
      VOCAL_PACKAGE_PRICE,
      DAY_LOCK_PRICE,
      MIXING_LEVEL1_PRICE,
      MIXING_LEVEL2_PRICE,
      MIXING_LEVEL3_PRICE,
      MASTERING_SINGLE_PRICE,
      MASTERING_PACKAGE_PRICE,
      WEDDING_PACKAGE_PRICE,
      VOICEOVER_HOURLY_PRICE,
      COVER_VIDEO_PACKAGE_PRICE,
      RENTAL_HOURLY_PRICE,
      LESSON_MONTHLY_PRICE,
      PRACTICE_ROOM_MONTHLY_PRICE,
      PRODUCTION_OFFER_PRICE,
      RELEASE_SINGLE_FROM_PRICE,
      RELEASE_EP_FROM_PRICE,
      RELEASE_ALBUM_FROM_PRICE,
      SINGLE_BUNDLE_PRICE,
      EP_BUNDLE_PRICE,
      ALBUM_BUNDLE_PRICE,
      // 번들 카피(subtitle·description·features)가 formatPriceLabel로 끌어 쓰는
      // 파생 합계·곡당 단가. pricing.ts 본체를 더 이상 스캔 대상에서 빼지 않으므로
      // (아래 walk 참조) 이 파일 자신의 카피도 여기서 함께 검사받는다.
      SINGLE_LINE_ITEM_TOTAL,
      RELEASE_SONG_PRODUCTION_UNIT_PRICE,
      EP_LINE_ITEM_TOTAL,
      ALBUM_LINE_ITEM_TOTAL,
      EP_BUNDLE_PER_SONG_PRICE,
      ALBUM_BUNDLE_PER_SONG_PRICE,
      FUNDING_DESIGN_PRICE,
      CONSULTING_HOURLY_PRICE,
      RELEASE_PRESS_PRICE,
      RELEASE_PRESS_INTRO_PRICE,
    ]);

    // data/ 아래 전체를 훑는다 — data/portfolio/처럼 하위 디렉터리에 가격이
    // 들어와도 놓치지 않으려면 재귀여야 한다. pricing.ts 본체도 이제 포함한다 —
    // 상수뿐 아니라 그 상수를 설명하는 카피(파생 합계 "55만원"류)도 들고 있어서,
    // 예전 제외 규칙은 상수가 바뀌어도 카피가 안 따라오는 드리프트를 못 잡았다.
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        if (!e.name.endsWith('.ts') || e.name.includes('.test.')) return [];
        return [full];
      });

    // "250,000원"과 "25만원" 둘 다 본다. 실제 카피는 두 형식이 섞여 있고,
    // 만원 표기만 보던 첫 버전은 faq.ts의 원 단위 단가를 통째로 놓쳤다.
    const AMOUNT = /(\d[\d,]{2,})\s*원|(\d+)\s*만원/g;

    const offenders: string[] = [];
    for (const file of walk(__dirname)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(AMOUNT)) {
        const won = m[1] ? Number(m[1].replace(/,/g, '')) : Number(m[2]) * 10_000;
        if (ssot.has(won) || NON_SSOT_AMOUNTS.has(won)) continue;
        offenders.push(`${path.relative(__dirname, file)}: "${m[0]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });


  /**
   * 릴리즈 티어 하한을 7개 로케일 전부에서 본다.
   *
   * 위의 "릴리즈 티어 카피" 테스트는 ko common.json만 보므로, 비-ko 로케일 카피에
   * 박힌 가격은 아무도 검사하지 않는 상태였다. 로케일마다 표기가 다르지만
   * (ko "180만원~" · en "₩1.8M" · zh "₩180万起") 숫자로 파싱해 비교하면
   * 표기 형식과 무관하게 값만 강제할 수 있다.
   *
   * 넓은 규칙("모든 금액은 상수여야 한다")은 쓰지 않는다 — common.json에는
   * 증분(정규 "12곡 +400만원")·환산(레슨 "회당 87,500원")·시장 시세가 정상적으로
   * 섞여 있어서 오탐이 100건 넘게 난다. 실제 사고는 "상수가 바뀌었는데 카피가
   * 안 따라온 것"이므로, 상수를 그대로 말해야 하는 키만 지정해서 본다.
   */
  it('릴리즈 티어 하한이 7개 로케일 카피와 일치한다 (표기 형식 무관)', () => {
    // ₩1.8M · ₩180万 · ₩1,800,000 · 1,800,000원 · 180만원 을 모두 원 단위로 읽는다.
    const AMOUNT = /₩\s*(\d+(?:\.\d+)?)\s*([MK万])|₩\s*(\d[\d,]{2,})|(\d[\d,]{2,})\s*원|(\d+)\s*만원/g;
    const parseAmounts = (text: string): number[] => {
      const out: number[] = [];
      for (const m of text.matchAll(AMOUNT)) {
        if (m[1]) {
          const unit = { M: 1_000_000, K: 1_000, 万: 10_000 }[m[2] as 'M' | 'K' | '万'];
          out.push(Math.round(Number(m[1]) * unit));
        } else if (m[3]) out.push(Number(m[3].replace(/,/g, '')));
        else if (m[4]) out.push(Number(m[4].replace(/,/g, '')));
        else if (m[5]) out.push(Number(m[5]) * 10_000);
      }
      return out;
    };

    const expected: Record<'single' | 'ep' | 'album', number> = {
      single: RELEASE_SINGLE_FROM_PRICE,
      ep: RELEASE_EP_FROM_PRICE,
      album: RELEASE_ALBUM_FROM_PRICE,
    };

    const misses: string[] = [];
    for (const locale of LOCALES) {
      const common = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', locale, 'common.json'), 'utf8')
      ) as {
        releaseProject: {
          tiers: Record<string, { range: string; detail: { priceRange: string } }>;
        };
      };
      for (const tier of ['single', 'ep', 'album'] as const) {
        const node = common.releaseProject.tiers[tier];
        for (const [field, text] of [
          ['range', node.range],
          ['detail.priceRange', node.detail.priceRange],
        ] as const) {
          if (!parseAmounts(text).includes(expected[tier])) {
            misses.push(`${locale}/${tier}.${field}: "${text}" (기대 ${expected[tier]})`);
          }
        }
      }
    }
    expect(misses).toEqual([]);
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
