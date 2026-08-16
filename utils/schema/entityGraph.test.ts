import { generateDefaultSchema } from './business';
import { generateCourseSchema, generateHowToSchema } from './basics';
import { generateAudioObjectSchema } from './media';
import { generatePersonProfileSchema, getOperatorPersonId } from './person';
import { generatePracticeRoomMonthlyRentSchema } from './commerce';
import { buildFinalSchemaData, collectSchemaItems } from '../../components/seo/schemaData';
import { LESSON_MONTHLY_PRICE } from '../../data/pricing';

// 엔티티 그래프 무결성 계약.
//
// 2026-08-09 감사에서 나온 실제 사고를 회귀 방지로 굳힌다:
//   - contact.tsx가 '@id': '…/#organization'에 '@type': 'LocalBusiness'를 붙여, 사이트 최상위
//     Organization이 이중 타이핑되고 url이 배열이 됐다.
//   - commerce.ts가 provider/seller에 '@type': 'LocalBusiness'를 다시 붙여, business.ts가
//     단일 타입으로 통합해 둔 #studio를 재타이핑했다.
//   - Organization에 founder가 없어 커머셜 페이지에 운영자(수상 이력) entity가 없었다.

const SITE = 'https://studionol.co.kr';
type Node = Record<string, unknown>;

const graphOf = (schemaInput: unknown): Node[] =>
  collectSchemaItems([generateDefaultSchema(SITE, 'ko'), schemaInput]);

const findById = (nodes: Node[], suffix: string) =>
  nodes.filter((n) => typeof n['@id'] === 'string' && (n['@id'] as string).endsWith(suffix));

describe('엔티티 그래프 — @id 유일성', () => {
  it('기본 그래프에 중복 @id가 없다', () => {
    const ids = generateDefaultSchema(SITE, 'ko')['@graph'].map((n: Node) => n['@id']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('#organization은 Organization 하나로만 타이핑된다', () => {
    const nodes = findById(generateDefaultSchema(SITE, 'ko')['@graph'], '#organization');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]['@type']).toBe('Organization');
    // url이 배열이 되면 조직 entity의 canonical URL이 모호해진다 — 예전 사고의 증상.
    expect(nodes[0].url).toBe(SITE);
  });

  it('#studio는 EntertainmentBusiness 단일 타입을 유지한다', () => {
    const nodes = findById(generateDefaultSchema(SITE, 'ko')['@graph'], '#studio');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]['@type']).toBe('EntertainmentBusiness');
  });

  it('연습실 Service의 provider·seller는 @type 없는 순수 참조다', () => {
    const service = generatePracticeRoomMonthlyRentSchema(`${SITE}/ko/practice-room`, 'ko') as Node;
    const offer = service.offers as Node;
    expect(service.provider).toEqual({ '@id': `${SITE}/#studio` });
    expect(offer.seller).toEqual({ '@id': `${SITE}/#studio` });
  });

  it('페이지 스키마를 합쳐도 #studio가 재타이핑되지 않는다', () => {
    const merged = graphOf(generatePracticeRoomMonthlyRentSchema(`${SITE}/ko/practice-room`, 'ko'));
    const typed = merged.filter(
      (n) => n['@id'] === `${SITE}/#studio` && n['@type'] !== undefined
    );
    expect(typed.map((n) => n['@type'])).toEqual(['EntertainmentBusiness']);
  });
});

describe('엔티티 그래프 — 운영자 Person을 커머셜 페이지에서 해석할 수 있다', () => {
  const personId = getOperatorPersonId(SITE);

  it('기본 그래프가 #person-hwang 실체 노드를 포함한다', () => {
    const nodes = findById(generateDefaultSchema(SITE, 'ko')['@graph'], '#person-hwang');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]['@type']).toBe('Person');
    // 수상 이력과 그것을 검증하는 제3자 보도가 함께 실려야 E-E-A-T 근거가 성립한다.
    // award는 배열이다 — 문자열 하나였을 땐 6건 중 1건만 나갔다(getOperatorAwards 참고).
    expect(nodes[0].award).toEqual(
      expect.arrayContaining([expect.stringContaining('한국대중음악상')])
    );
    expect((nodes[0].award as string[]).length).toBeGreaterThan(1);
    expect(Array.isArray(nodes[0].subjectOf)).toBe(true);
    // 얼굴 이미지도 커머셜 페이지까지 따라와야 entity에 인물이 연결된다.
    expect(nodes[0].image).toEqual(
      expect.objectContaining({ '@type': 'ImageObject', url: expect.stringContaining(SITE) })
    );
  });

  it('Organization·#studio 양쪽이 founder로 그 Person을 가리킨다', () => {
    const graph = generateDefaultSchema(SITE, 'ko')['@graph'];
    for (const suffix of ['#organization', '#studio']) {
      expect(findById(graph, suffix)[0].founder).toEqual({ '@id': personId });
    }
  });

  it('Course.instructor가 무명 Person이 아니라 #person-hwang을 참조한다', () => {
    const course = generateCourseSchema('t', 'd', SITE, 'img', `${SITE}/ko/lesson`, 'ko') as Node;
    const instance = course.hasCourseInstance as Node;
    expect(instance.instructor).toEqual({ '@id': personId });
  });

  it('Course.offers가 가격 SSOT 상수와 priceValidUntil을 쓴다', () => {
    const course = generateCourseSchema('t', 'd', SITE, 'img', `${SITE}/ko/lesson`, 'ko') as Node;
    const offers = course.offers as Node;
    expect(offers.price).toBe(LESSON_MONTHLY_PRICE);
    expect(offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('/author의 프로필 노드와 기본 그래프 노드가 값 충돌 없이 병합된다', () => {
    // 같은 @id 노드가 둘이어도 안전한 이유는 "값이 같아서"다. 이 계약이 깨지면
    // url·jobTitle이 배열로 합쳐져 예전 #organization 사고가 Person에서 재현된다.
    const merged = graphOf(generatePersonProfileSchema(SITE, 'ko', '설명'));
    const persons = merged.filter((n) => n['@id'] === personId);
    expect(persons.length).toBeGreaterThan(1);
    for (const key of ['@type', 'name', 'url', 'jobTitle', 'award']) {
      expect(new Set(persons.map((p) => JSON.stringify(p[key]))).size).toBe(1);
    }
  });
});

describe('self-serving 리뷰 마크업 비발행', () => {
  // Google은 자사 사이트가 자기 사업체에 대해 수집·호스팅한 리뷰를 리뷰 리치결과에서
  // 제외한다. 실어도 얻는 게 없고 수동조치 리스크만 남아 2026-08에 전면 제거했다.
  // 눈에 보이는 후기 섹션은 유지하므로, 되살릴 때는 외부 출처(네이버 플레이스 등)를
  // 가리키는 형태로 재설계할 것.
  it('includeReviews 값과 무관하게 aggregateRating·review를 내지 않는다', () => {
    for (const includeReviews of [true, false, undefined]) {
      const graph = generateDefaultSchema(SITE, 'ko', { includeReviews })['@graph'] as Node[];
      for (const node of graph) {
        expect(node.aggregateRating).toBeUndefined();
        expect(node.review).toBeUndefined();
      }
    }
  });
});

describe('미디어·절차 스키마 — 사실과 다른 마크업 방지', () => {
  it('HowTo는 도구를 모르면 tool을 아예 발행하지 않는다', () => {
    const howTo = generateHowToSchema(
      '인디 음원 디지털 유통 4단계 절차',
      'DistroKid 가입부터 메타데이터 입력까지',
      [{ name: '1단계', text: '유통사 계정을 만든다' }],
      undefined,
      'ko'
    ) as Node;
    // 예전엔 여기에 '전문 녹음 장비'가 조건 없이 붙어, 유통 절차에 없는 장비
    // 요구사항이 발행됐다(LLM이 요약할 때 그대로 주입될 수 있는 사실 오류).
    expect(howTo.tool).toBeUndefined();
  });

  it('HowTo는 frontmatter가 도구를 명시한 경우에만 tool을 낸다', () => {
    const howTo = generateHowToSchema(
      '보컬 마이크 배치 4단계',
      '설명',
      [{ name: '1단계', text: '마이크를 세운다' }],
      undefined,
      'ko',
      ['콘덴서 마이크', '팝 필터']
    ) as Node;
    expect(howTo.tool).toEqual([
      { '@type': 'HowToTool', name: '콘덴서 마이크' },
      { '@type': 'HowToTool', name: '팝 필터' },
    ]);
  });

  it('음원은 MusicRecording.audio(AudioObject)로 파일을 분리해 낸다', () => {
    const [track] = generateAudioObjectSchema(
      [{ name: 'wave', contentUrl: '/audio/wave.mp3', artist: 'Studio NOL' }],
      SITE,
      'ko'
    ) as Node[];
    // encodingFormat은 MediaObject 속성이라 MusicRecording에 직접 붙으면 무효다.
    expect(track.encodingFormat).toBeUndefined();
    expect(track.audio).toEqual(
      expect.objectContaining({
        '@type': 'AudioObject',
        contentUrl: `${SITE}/audio/wave.mp3`,
        encodingFormat: 'audio/mpeg',
      })
    );
  });
});

describe('엔티티 그래프 — 최종 직렬화', () => {
  it('includeSchema 경로에서 단일 @graph로 합쳐지고 @id가 유일하다', () => {
    const final = buildFinalSchemaData({
      includeSchema: true,
      schemaItems: graphOf(generateCourseSchema('t', 'd', SITE, 'img', `${SITE}/ko/lesson`, 'ko')),
    })!;
    const graph = final['@graph'] as Node[];
    const ids = graph.map((n) => n['@id']).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
