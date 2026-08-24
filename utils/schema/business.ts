import { type Locale } from '../../lib/i18n';
import { getSiteConfig, socialProfiles } from '../../data/siteConfig';
import {
  MIXING_LEVEL1_PRICE,
  PRACTICE_ROOM_MONTHLY_PRICE,
  PRODUCTION_OFFER_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
} from '../../data/pricing';
import { buildOperatorPersonNode, getOperatorPersonId } from './person';
import {
  getOfferPriceValidUntil,
  MIXING_OFFER_NAMES,
  OFFER_CATALOG_NAMES,
  PRACTICE_OFFER_NAMES,
  PRODUCTION_OFFER_NAMES,
  RECORDING_OFFER_NAMES,
  VOCAL_PACKAGE_OFFER_NAMES,
} from './shared';

export const generateDefaultSchema = (
  siteUrl: string,
  locale: Locale = 'ko',
  options: { includeReviews?: boolean } = {}
) => {
  const config = getSiteConfig(locale);

  // aggregateRating/review 마크업은 발행하지 않는다 (2026-08 결정).
  //
  // Google은 자사 사이트가 자기 사업체에 대해 수집·호스팅한 리뷰를 self-serving으로 규정해
  // LocalBusiness·Organization 리뷰 리치결과 대상에서 제외한다. 즉 실을 때 얻는 것은 없고
  // 구조화 데이터 수동조치 리스크만 남는다. 실제로 이 사이트는 자체 후기 4건(전원 5점,
  // 저자 마스킹)으로 만든 5.0/5를 51개 페이지 — 스튜디오가 주제도 아닌 포트폴리오 상세
  // 30여 개 포함 — 에 내보내고 있었다. 네이버는 애초에 JSON-LD 리뷰를 소비하지 않으므로
  // 이 마크업의 국내 이득도 0이다.
  //
  // 눈에 보이는 후기 섹션(components/ui/ReviewSection)은 그대로 둔다 — 사람이 읽는 사회적
  // 증거는 유지하고 검색엔진용 별점 주장만 내리는 것이다.
  //
  // 되살릴 조건: 네이버 플레이스·구글 비즈니스 프로필에 제3자 리뷰가 쌓이면, 자사 집계가
  // 아니라 그 외부 출처를 #studio의 sameAs로 가리키는 형태로 다시 설계할 것.
  // includeReviews 옵션은 호출부(SEO.tsx includeBusinessReviews)와의 계약이라 시그니처만 보존한다.
  void options;

  const localeContactUrl = `${siteUrl}/${locale}/contact`;
  const socialLinks = Object.values(socialProfiles).filter(url => url && url.trim() !== '');
  // sameAs는 "이 엔티티의 다른 표현"만 넣는다. 좌표 링크(maps.google.com/?q=위경도)는 지도 위
  // 한 지점일 뿐 어떤 사업체도 식별하지 않으므로 여기 넣지 않는다 — 그건 hasMap의 몫이다.
  // 네이버는 단축 URL이 아니라 플레이스 ID가 박힌 정본을, 구글은 GBP CID를 쓴다.
  const sameAsLinks = [
    config.contact.kakaoUrl,
    config.contact.naverPlaceUrl,
    config.contact.googleBusinessUrl,
    ...socialLinks,
  ].filter(url => typeof url === 'string' && url.trim() !== '');

  const organizationId = `${siteUrl}/#organization`;
  const studioId = `${siteUrl}/#studio`;
  const personId = getOperatorPersonId(siteUrl);

  const offerCatalogName = OFFER_CATALOG_NAMES[locale];
  const recordingOfferName = RECORDING_OFFER_NAMES[locale];
  const vocalPackageOfferName = VOCAL_PACKAGE_OFFER_NAMES[locale];
  const mixingOfferName = MIXING_OFFER_NAMES[locale];
  const productionOfferName = PRODUCTION_OFFER_NAMES[locale];
  const practiceOfferName = PRACTICE_OFFER_NAMES[locale];
  const priceValidUntil = getOfferPriceValidUntil();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: config.name,
        alternateName: 'Studio NOL',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo512.png`,
          width: 512,
          height: 512,
        },
        image: {
          '@type': 'ImageObject',
          url: `${siteUrl}/thumbnail.jpg`,
          width: 1440,
          height: 809,
        },
        email: config.contact.email,
        telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'reservations',
            telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
            email: config.contact.email,
            url: localeContactUrl,
            availableLanguage: ['ko-KR', 'en-US', 'zh-CN', 'es-ES', 'vi-VN', 'th-TH', 'uz-UZ'],
          },
        ],
        legalName: 'Studio NOL',
        // Google Rich Results: Organization에 address 권장(누락 시 warning).
        // LocalBusiness(#studio)와 동일한 PostalAddress를 공유.
        address: {
          '@type': 'PostalAddress',
          streetAddress: config.contact.address,
          addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
          addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
          postalCode: '03424',
          addressCountry: 'KR',
        },
        sameAs: sameAsLinks,
        foundingDate: '2024-01-01',
        // 조직 ↔ 운영자 연결. 이 한 줄이 /pricing·/recording 같은 커머셜 페이지에서
        // "이 스튜디오를 누가 운영하는가"를 AI 엔진이 따라갈 수 있게 만든다
        // (실체는 아래 @graph의 #person-hwang 노드).
        founder: { '@id': personId },
        numberOfEmployees: { '@type': 'QuantitativeValue', value: 5 },
        description: config.description,
        slogan: 'Realizing artists\' musical vision through sound',
        knowsLanguage: ['ko-KR', 'en-US', 'zh-CN', 'es-ES', 'vi-VN', 'th-TH', 'uz-UZ'],
        knowsAbout: [
          'Music Recording', 'Audio Mixing', 'Audio Mastering', 'Music Production',
          'Vocal Recording', 'Voice Acting Recording', 'Wedding Song Recording',
          'Music Lesson', 'Practice Room', 'Home Recording',
          locale === 'ko' ? '녹음 제작' : 'Sound Engineering',
          locale === 'ko' ? '음반 기획' : 'Album Production',
        ],
      },
      {
        // EntertainmentBusiness는 schema.org 계층상 LocalBusiness의 하위 타입.
        // multi-type(["LocalBusiness", "EntertainmentBusiness"])은 Google 검사기가
        // 두 entity로 중복 카운트하므로 단일 타입으로 통합. LocalBusiness rich result도
        // 하위 타입으로 그대로 인정됨.
        '@type': 'EntertainmentBusiness',
        additionalType: 'https://www.wikidata.org/wiki/Q746359',
        '@id': studioId,
        name: 'Studio NOL',
        image: {
          '@type': 'ImageObject',
          url: `${siteUrl}/thumbnail.jpg`,
          width: 1440,
          height: 809,
        },
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo512.png`,
          width: 512,
          height: 512,
        },
        url: siteUrl,
        description: config.description,

        priceRange: '$$',
        address: {
          '@type': 'PostalAddress',
          streetAddress: config.contact.address,
          addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
          addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
          postalCode: '03424',
          addressCountry: 'KR',
        },
        telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
        email: config.contact.email,
        // 연중무휴 24시간 운영 — 연습실은 도어록 출입, 녹음도 24시간 예약을 받는다.
        // public/locales/*/common.json의 contact.hours.*가 화면에 표시하는 값과 같아야 한다
        // (구글은 구조화 데이터가 페이지에 보이는 내용을 반영하도록 요구한다). 한쪽만 고치지 말 것.
        //
        // 2026-08-24에 이 값을 10:00–23:59로 좁혔다가 되돌렸다. "영업시간=직원 응대 시간"으로
        // 읽은 것이 오독이었다 — 무인 운영 업종에서 이 필드는 이용 가능 시간을 뜻하고,
        // 네이버 지역검색은 목록 카드에 이 값을 그대로 노출한다(경쟁 연습실이 전부 "24시간
        // 영업"이라, 좁히는 순간 목록 단계에서 탈락한다). 좁히려면 그 노출 손실부터 계산할 것.
        //
        // Schema.org spec상 24:00 표기는 일부 validator가 경고로 처리하므로 23:59가 가장
        // 안전한 자정 표기. 평일·주말이 같은 값이라 단일 entry로 통합.
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '00:00',
            closes: '23:59',
          },
        ],
        potentialAction: {
          '@type': 'ReserveAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/${locale}/contact`,
          },
          result: {
            '@type': 'Reservation',
            name: locale === 'ko' ? '스튜디오 예약' : 'Studio Reservation',
          },
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 37.614353,
          longitude: 126.925887,
        },
        areaServed: {
          '@type': 'GeoCircle',
          geoMidpoint: {
            '@type': 'GeoCoordinates',
            latitude: 37.614353,
            longitude: 126.925887,
          },
          geoRadius: 50000,
        },
        hasMap: [
          config.contact.naverMapUrl,
          'https://maps.google.com/?q=37.614353,126.925887',
        ].filter((url): url is string => Boolean(url && url.trim())),
        // Organization(#organization)과 같은 목록을 쓴다 — 두 노드는 같은 실체를 가리키므로
        // sameAs가 갈리면 엔티티 해석이 흔들린다. 좌표 링크는 위 sameAsLinks 주석 참조.
        sameAs: sameAsLinks,
        paymentAccepted: 'Cash, Credit Card, Bank Transfer, KakaoPay',
        currenciesAccepted: 'KRW',

        parentOrganization: {
          '@id': organizationId,
        },
        // #studio에도 founder를 둔다. 로컬 결과·AI 답변이 Organization이 아니라 이
        // LocalBusiness 노드만 읽고 지나가는 경우가 많아, 여기 없으면 운영자 연결이 끊긴다.
        founder: { '@id': personId },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: offerCatalogName,
          itemListElement: [
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: RECORDING_HOURLY_PRICE,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: recordingOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: VOCAL_PACKAGE_PRICE,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: vocalPackageOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: MIXING_LEVEL1_PRICE,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: mixingOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: PRODUCTION_OFFER_PRICE,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: productionOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              name: practiceOfferName,
              priceCurrency: 'KRW',
              price: PRACTICE_ROOM_MONTHLY_PRICE,
              priceValidUntil,
              url: `${siteUrl}/${locale}/practice-room`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: practiceOfferName,
                provider: {
                  '@type': 'Organization',
                  '@id': organizationId,
                },
              },
            },
          ],
        },
        makesOffer: [
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: RECORDING_HOURLY_PRICE,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: recordingOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: VOCAL_PACKAGE_PRICE,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: vocalPackageOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: MIXING_LEVEL1_PRICE,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: mixingOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: PRODUCTION_OFFER_PRICE,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: productionOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: PRACTICE_ROOM_MONTHLY_PRICE,
            priceValidUntil,
            url: `${siteUrl}/${locale}/practice-room`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: practiceOfferName },
          },
        ],
      },
      // 운영자 Person entity 실체. 위 두 노드의 founder 참조가 가리키는 대상이며,
      // 2017 한국대중음악상 수상(award) + 제3자 보도(subjectOf)를 함께 실어 커머셜
      // 페이지에서도 E-E-A-T 근거가 검증 가능하게 한다.
      // /author는 여기에 description을 더한 같은 @id 노드를 추가로 낸다 — 값이 충돌하지
      // 않는 병합이라 안전하다(utils/schema/person.ts buildOperatorPersonNode 주석 참고).
      buildOperatorPersonNode(siteUrl, locale),
    ],
  };
};
