import { type Locale } from '../../lib/i18n';
import { getSiteConfig, socialProfiles, studioOperator } from '../../data/siteConfig';
import { getSchemaLanguage } from './shared';
import { getOperatorAwards, getOperatorKnowsAbout } from './person';
import {
  RELEASE_SINGLE_FROM_PRICE,
  RELEASE_EP_FROM_PRICE,
  RELEASE_ALBUM_FROM_PRICE,
} from '../../data/pricing';

const RELEASE_SERVICE_NAMES: Record<Locale, string> = {
  ko: '음원 발매 프로듀싱',
  en: 'Music Release Production',
  zh: '音乐发行制作',
  es: 'Producción de Lanzamiento Musical',
  vi: 'Sản xuất phát hành âm nhạc',
  th: 'การโปรดิวซ์เพลงเพื่อปล่อยซิงเกิล',
  uz: 'Musiqa relizi prodakshn',
};
const RELEASE_SERVICE_DESCRIPTIONS: Record<Locale, string> = {
  ko: '인디 싱어송라이터의 음원 발매 — 기획·녹음·세션 연결·믹싱·유통·매체 PR까지 동행하는 프로듀싱 서비스. 15년차 프로듀서 황경하가 직접 책임집니다.',
  en: 'End-to-end indie release production — A&R, recording, session networking, mixing, distribution, and press PR. Led by 15-year veteran producer Hwang Gyeong-ha.',
  zh: '独立音乐人发行制作全程服务——A&R、录音、乐手对接、混音、发行与媒体公关。由15年制作人黄京河亲自负责。',
  es: 'Producción integral de lanzamientos indie — A&R, grabación, conexión con sesionistas, mezcla, distribución y prensa. Dirigido por el productor Hwang Gyeong-ha (15 años de experiencia).',
  vi: 'Sản xuất phát hành indie từ A đến Z — A&R, thu âm, kết nối session, mix, phân phối và PR báo chí. Do nhà sản xuất Hwang Gyeong-ha (15 năm kinh nghiệm) trực tiếp đảm nhận.',
  th: 'การโปรดิวซ์การปล่อยเพลงอินดี้แบบครบวงจร — A&R บันทึกเสียง เชื่อมต่อนักดนตรีเซสชัน มิกซ์ จัดจำหน่าย และประชาสัมพันธ์ นำโดยโปรดิวเซอร์ Hwang Gyeong-ha 15 ปี',
  uz: 'Indie reliz prodakshn — A&R, yozish, sessiya muzikantlari, miks, tarqatish va matbuot PR. 15 yillik prodyuser Hwang Gyeong-ha tomonidan boshqariladi.',
};
const RELEASE_PERSON_DESCRIPTIONS: Record<Locale, string> = {
  ko: '15년차 인디 음악 기획자·프로듀서. 인디씬에서 70개 이상의 음반을 기획·제작했으며 평론가·매체·세션 네트워크를 통해 인디 아티스트의 발매를 끝까지 동행합니다.',
  en: '15-year independent music producer & A&R, with 70+ released projects. Connects indie artists with critics, press, and session networks through the entire release journey.',
  zh: '15年独立音乐制作人/A&R，主导制作70余张唱片。通过乐评、媒体与乐手网络为独立艺人提供从企划到发行的全程支持。',
  es: 'Productor independiente y A&R con 15 años de experiencia y 70+ proyectos lanzados. Conecta a artistas indie con críticos, prensa y sesionistas durante todo el lanzamiento.',
  vi: 'Nhà sản xuất & A&R indie 15 năm kinh nghiệm, hơn 70 dự án đã phát hành. Kết nối nghệ sĩ indie với giới phê bình, báo chí và session.',
  th: 'โปรดิวเซอร์และ A&R อินดี้ 15 ปี ผลงานกว่า 70 ชุด เชื่อมต่อศิลปินอินดี้กับนักวิจารณ์ สื่อ และนักดนตรีเซสชัน',
  uz: '15 yillik indie prodyuser va A&R, 70+ reliz. Indie artistlarni tanqidchilar, matbuot va sessiya muzikantlari bilan bog‘laydi.',
};
const RELEASE_AUDIENCE_TYPES: Record<Locale, string> = {
  ko: '인디 싱어송라이터',
  en: 'Indie singer-songwriters',
  zh: '独立创作歌手',
  es: 'Cantautores indie',
  vi: 'Singer-songwriter indie',
  th: 'นักร้อง-นักแต่งเพลงอินดี้',
  uz: 'Indie qo‘shiqchi-bastakorlar',
};
const RELEASE_TIER_LABELS: Record<'single' | 'ep' | 'album', Record<Locale, string>> = {
  single: {
    ko: '싱글 발매 프로젝트', en: 'Single Release Project', zh: '单曲发行项目',
    es: 'Proyecto de Single', vi: 'Dự án phát hành Single', th: 'โปรเจกต์ปล่อยซิงเกิล', uz: 'Singl reliz loyihasi',
  },
  ep: {
    ko: 'EP 발매 프로젝트', en: 'EP Release Project', zh: 'EP发行项目',
    es: 'Proyecto de EP', vi: 'Dự án phát hành EP', th: 'โปรเจกต์ปล่อย EP', uz: 'EP reliz loyihasi',
  },
  album: {
    ko: '정규 앨범 발매 프로젝트', en: 'Full Album Release Project', zh: '正规专辑发行项目',
    es: 'Proyecto de Álbum', vi: 'Dự án phát hành Album', th: 'โปรเจกต์ปล่อยอัลบั้มเต็ม', uz: 'Toʻliq albom reliz loyihasi',
  },
};
/**
 * JSON-LD Offer에 실리는 티어 하한. data/pricing.ts의 SSOT 상수를 그대로 쓴다.
 *
 * 예전엔 { single: 500000, ep: 1500000, album: 4000000 }으로 박혀 있었다.
 * 상수가 EP 180만·정규 340만으로 바뀌었는데 이 파일만 안 따라와서, 구조화
 * 데이터가 실제 판매가와 다른 값을 검색엔진에 내보내고 있었다. 이 파일은
 * data/pricing.test.ts의 리터럴 스캔 대상이 아니라 CI가 잡지 못했다.
 */
const RELEASE_TIER_PRICES = {
  single: RELEASE_SINGLE_FROM_PRICE,
  ep: RELEASE_EP_FROM_PRICE,
  album: RELEASE_ALBUM_FROM_PRICE,
};
const RELEASE_TIER_DURATIONS = { single: 'P12W', ep: 'P6M', album: 'P12M' };

/**
 * Release Project Schema — Person(황경하) + Service(음원 발매 프로듀싱).
 * GEO/AI 검색에서 "인디 음원 발매 프로듀서"/"황경하"/"Studio NOL 발매" 쿼리에
 * entity로 잡히도록 Person.knowsAbout/sameAs/worksFor + Service.provider/performer/audience를 명시.
 * tier 미지정 시 Hub용: hasOfferCatalog로 3 tier 제공 / tier 지정 시 단일 Offer.
 */
export const generateReleaseProjectSchema = (
  siteUrl: string,
  locale: Locale,
  tier?: 'single' | 'ep' | 'album'
) => {
  const config = getSiteConfig(locale);
  const organizationId = `${siteUrl}/#organization`;
  // canonical Person @id — generateArticleSchema와 동일 ID로 묶어 단일 entity 보장
  const personId = `${siteUrl}/#person-hwang`;
  const schemaLanguage = getSchemaLanguage(locale);

  // 스튜디오 SNS + 운영자 본인 권위 프로필(ggac·Bugs) 병합 — generateArticleSchema와 동일 규칙.
  const personSameAs = [
    ...Object.values(socialProfiles),
    ...(studioOperator.sameAs ?? []),
  ].filter((url): url is string => typeof url === 'string' && url.trim() !== '');

  const operatorAwards = getOperatorAwards();

  const person = {
    '@type': 'Person',
    '@id': personId,
    name: studioOperator.name,
    jobTitle: studioOperator.jobTitleByLocale[locale] || studioOperator.jobTitleByLocale.ko,
    description: RELEASE_PERSON_DESCRIPTIONS[locale],
    // Person 권위 프로필 홈 — /author 프로필 페이지·generateArticleSchema와 일치 (단일 entity url).
    url: `${siteUrl}/${locale}/author`,
    ...(operatorAwards.length > 0 && { award: operatorAwards }),
    knowsAbout: getOperatorKnowsAbout(locale),
    ...(personSameAs.length > 0 && { sameAs: personSameAs }),
    worksFor: { '@type': 'Organization', '@id': organizationId, name: config.name },
  };

  const baseServiceName = tier ? RELEASE_TIER_LABELS[tier][locale] : RELEASE_SERVICE_NAMES[locale];
  const baseUrl = tier
    ? `${siteUrl}/${locale}/release-project/${tier}`
    : `${siteUrl}/${locale}/release-project`;

  const buildOffer = (t: 'single' | 'ep' | 'album') => ({
    '@type': 'Offer',
    name: RELEASE_TIER_LABELS[t][locale],
    priceCurrency: 'KRW',
    price: RELEASE_TIER_PRICES[t],
    priceSpecification: {
      '@type': 'PriceSpecification',
      priceCurrency: 'KRW',
      price: RELEASE_TIER_PRICES[t],
      valueAddedTaxIncluded: false,
    },
    availability: 'https://schema.org/InStock',
    url: `${siteUrl}/${locale}/release-project/${t}`,
    itemOffered: {
      '@type': 'Service',
      name: RELEASE_TIER_LABELS[t][locale],
      provider: { '@type': 'Organization', '@id': organizationId, name: config.name },
      performer: { '@id': personId },
      duration: RELEASE_TIER_DURATIONS[t],
    },
  });

  const service: Record<string, unknown> = {
    '@type': 'Service',
    '@id': `${baseUrl}#service`,
    serviceType: RELEASE_SERVICE_NAMES[locale],
    name: baseServiceName,
    description: RELEASE_SERVICE_DESCRIPTIONS[locale],
    inLanguage: schemaLanguage,
    provider: { '@type': 'Organization', '@id': organizationId, name: config.name },
    performer: { '@id': personId },
    areaServed: { '@type': 'Country', name: 'KR' },
    audience: { '@type': 'Audience', audienceType: RELEASE_AUDIENCE_TYPES[locale] },
    url: baseUrl,
    category: locale === 'ko' ? '음악 프로듀싱·발매 동행' : 'Music production & release accompaniment',
  };

  if (tier) {
    service.offers = buildOffer(tier);
    service.termsOfService = `${siteUrl}/${locale}/release-project`;
  } else {
    service.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: RELEASE_SERVICE_NAMES[locale],
      itemListElement: (['single', 'ep', 'album'] as const).map(buildOffer),
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [person, service],
  };
};
