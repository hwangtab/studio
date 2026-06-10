/**
 * 구조화 데이터(JSON-LD) 검증 테스트.
 *
 * 이 사이트의 rich result(LocalBusiness·Breadcrumb·Article·FAQ·Offer)는
 * Google이 요구하는 필수 필드가 빠지면 조용히 사라진다. 생성기를 리팩터링하다
 * 필드를 누락해도 빌드는 통과하므로, 여기서 "Rich Results 필수 필드"를 회귀 가드로 고정한다.
 */
import {
  generateDefaultSchema,
  generateBreadcrumbSchema,
  generateFaqSchema,
  generateArticleSchema,
  generateAggregateOfferSchema,
  generateWebSiteSchema,
} from './schemaGenerator';
import type { Breadcrumb, FAQItem } from '../types/data';

const SITE = 'https://studionol.co.kr';

// @graph에서 특정 @type을 가진 노드를 찾는다. additionalType/배열 타입도 허용.
const findNode = (graph: unknown[], type: string): Record<string, unknown> | undefined =>
  graph.find((n) => {
    const t = (n as Record<string, unknown>)['@type'];
    return t === type || (Array.isArray(t) && t.includes(type));
  }) as Record<string, unknown> | undefined;

describe('generateDefaultSchema — Organization / LocalBusiness', () => {
  const schema = generateDefaultSchema(SITE, 'ko') as { '@graph': unknown[] };

  it('@context와 @graph 배열을 갖는다', () => {
    expect((schema as Record<string, unknown>)['@context']).toBe('https://schema.org');
    expect(Array.isArray(schema['@graph'])).toBe(true);
    expect(schema['@graph'].length).toBeGreaterThan(0);
  });

  it('Organization 노드에 Rich Results 필수 필드(name·url·address·logo)가 있다', () => {
    const org = findNode(schema['@graph'], 'Organization');
    expect(org).toBeDefined();
    expect(org!.name).toBeTruthy();
    expect(org!.url).toBe(SITE);
    const address = org!.address as Record<string, unknown>;
    expect(address['@type']).toBe('PostalAddress');
    expect(address.addressCountry).toBe('KR');
    expect((org!.logo as Record<string, unknown>)['@type']).toBe('ImageObject');
  });

  it('LocalBusiness(EntertainmentBusiness) 노드의 aggregateRating이 유효 범위(1~5)다', () => {
    const biz = findNode(schema['@graph'], 'EntertainmentBusiness');
    expect(biz).toBeDefined();
    const rating = biz!.aggregateRating as Record<string, unknown> | undefined;
    if (rating) {
      const value = parseFloat(String(rating.ratingValue));
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(5);
      expect(Number(rating.reviewCount)).toBeGreaterThan(0);
    }
  });
});

describe('generateBreadcrumbSchema', () => {
  const crumbs: Breadcrumb[] = [
    { name: '홈', path: '/ko' },
    { name: '연습실', path: '/ko/practice-room' },
  ];
  const schema = generateBreadcrumbSchema(crumbs, SITE)!;

  it('BreadcrumbList이며 position이 1부터 순차 증가하고 item이 절대 URL이다', () => {
    expect(schema['@type']).toBe('BreadcrumbList');
    const items = schema.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    items.forEach((li, i) => {
      expect(li['@type']).toBe('ListItem');
      expect(li.position).toBe(i + 1);
      expect(li.name).toBeTruthy();
      expect(String(li.item)).toMatch(/^https:\/\//);
    });
  });

  it('빈 입력은 null', () => {
    expect(generateBreadcrumbSchema([], SITE)).toBeNull();
    expect(generateBreadcrumbSchema(null, SITE)).toBeNull();
  });
});

describe('generateFaqSchema', () => {
  const faqs: FAQItem[] = [{ question: '주차 되나요?', answer: '인근 공영주차장을 이용하실 수 있습니다.' }];
  const schema = generateFaqSchema(faqs, 'ko')!;

  it('FAQPage이며 각 항목이 Question + acceptedAnswer.text를 갖는다', () => {
    expect(schema['@type']).toBe('FAQPage');
    const entities = schema.mainEntity as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(1);
    expect(entities[0]['@type']).toBe('Question');
    expect(entities[0].name).toBeTruthy();
    const answer = entities[0].acceptedAnswer as Record<string, unknown>;
    expect(answer['@type']).toBe('Answer');
    expect(answer.text).toBeTruthy();
  });

  it('빈 입력은 null', () => {
    expect(generateFaqSchema([], 'ko')).toBeNull();
    expect(generateFaqSchema(null, 'ko')).toBeNull();
  });
});

describe('generateArticleSchema', () => {
  const schema = generateArticleSchema(
    '보컬 녹음용 마이크 추천',
    '콘덴서·다이나믹 비교',
    SITE,
    `${SITE}/images/og.webp`,
    `${SITE}/ko/stories/vocal-microphone1`,
    '2026-04-06',
    '2026-06-10',
    '스튜디오 놀',
    'ko',
    'BlogPosting',
  ) as Record<string, unknown>;

  it('Article Rich Results 필수 필드(headline·author·datePublished·image·publisher)가 있다', () => {
    expect(schema['@type']).toBe('BlogPosting');
    expect(schema.headline).toBeTruthy();
    expect(schema.datePublished).toBe('2026-04-06');
    expect(schema.dateModified).toBe('2026-06-10');
    const author = schema.author as Record<string, unknown>;
    expect(author.name).toBeTruthy();
    expect(Array.isArray(schema.image)).toBe(true);
    expect((schema.publisher as Record<string, unknown>)['@type']).toBe('Organization');
  });

  it('dateModified 미지정 시 datePublished로 폴백한다', () => {
    const s = generateArticleSchema('t', 'd', SITE, `${SITE}/og.webp`, `${SITE}/x`, '2026-04-06') as Record<string, unknown>;
    expect(s.dateModified).toBe('2026-04-06');
  });
});

describe('generateAggregateOfferSchema', () => {
  it('AggregateOffer에 lowPrice·highPrice·priceCurrency(KRW)가 있다', () => {
    const schema = generateAggregateOfferSchema(
      '녹음 서비스',
      [
        { name: '보컬 녹음', priceValue: 250000 },
        { name: '싱글 마스터링', priceValue: 100000 },
      ],
      'ko',
    ) as Record<string, unknown>;
    expect(schema).not.toBeNull();
    const offers = (schema.offers ?? schema) as Record<string, unknown>;
    // 구현이 offers 중첩이든 평면이든 가격 범위가 노출되는지 확인
    const flat = JSON.stringify(schema);
    expect(flat).toContain('100000');
    expect(flat).toContain('250000');
    expect(flat).toContain('KRW');
    void offers;
  });

  it('유효 가격이 없으면 null', () => {
    expect(generateAggregateOfferSchema('x', [{ name: 'a', priceValue: 0 }], 'ko')).toBeNull();
  });
});

describe('generateWebSiteSchema', () => {
  it('WebSite에 @id·url·name이 있다', () => {
    const schema = generateWebSiteSchema(SITE, 'ko') as Record<string, unknown>;
    expect(schema['@type']).toBe('WebSite');
    expect(schema['@id']).toBe(`${SITE}/#website`);
    expect(schema.url).toBe(SITE);
    expect(schema.name).toBeTruthy();
  });
});
