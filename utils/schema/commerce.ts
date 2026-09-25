import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { PRACTICE_ROOM_HOURLY_PRICE_INCL, PRACTICE_ROOM_MONTHLY_PRICE } from '../../data/pricing';
import { DEFAULT_SCHEMA_IMAGE, getSchemaLanguage } from './shared';

export const generatePracticeRoomMonthlyRentSchema = (
  pageUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);
  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 12);

  // Localized service name/description per locale. Korean 본문은 KR 검색용 그대로
  // 유지하고, 그 외 locale은 자연스러운 영어/현지 표현으로 출력해 Google가
  // /en/practice-room 등 외국어 페이지에서 한글 잔재로 인한 페널티를 받지
  // 않도록 한다.
  // hourlyOfferName: 시간제 오퍼명(2026-09-25). VAT 포함 소비자가와 짝.
  type ServiceCopy = { name: string; serviceType: string; description: string; offerName: string; hourlyOfferName: string };
  const copyByLocale: Record<string, ServiceCopy> = {
    ko: {
      name: '음악연습실 월세 입주 — 스튜디오 놀',
      serviceType: '음악연습실 월세 입주',
      description:
        '서울 은평구 연신내역 도보 5분 거리 24시간 음악연습실 월세 입주 프로그램. 보증금 없음, 최소 1개월, 개별 도어록·냉난방·방음 설계 포함.',
      offerName: '음악연습실 월세 입주 (개인 연습실)',
      hourlyOfferName: '시간제 연습실 (시간당, 부가세 포함)',
    },
    en: {
      name: 'Monthly Practice Room Residency — Studio NOL',
      serviceType: 'Music practice room monthly rental',
      description:
        '24/7 soundproof music practice room in Eunpyeong-gu, Seoul — 5 min from Yeonsinnae Station. No deposit, 1-month minimum, private door lock, climate control, and studio-grade acoustic isolation.',
      offerName: 'Monthly Practice Room Residency (Private Room)',
      hourlyOfferName: 'Hourly practice room (VAT included)',
    },
    zh: {
      name: '音乐练习室月租入住 — Studio NOL',
      serviceType: '音乐练习室月租',
      description:
        '首尔恩平区延新内站步行5分钟，24小时音乐练习室月租入住。无押金，最短1个月，独立门锁、冷暖空调、专业隔音设计。',
      offerName: '音乐练习室月租入住（个人练习室）',
      hourlyOfferName: '按小时练习室（含税）',
    },
    es: {
      name: 'Sala de ensayo musical con alquiler mensual — Studio NOL',
      serviceType: 'Alquiler mensual de sala de ensayo musical',
      description:
        'Sala de ensayo musical 24/7 en Eunpyeong-gu, Seúl, a 5 min de la estación Yeonsinnae. Sin depósito, mínimo 1 mes, cerradura privada, climatización y aislamiento acústico profesional.',
      offerName: 'Alquiler mensual de sala de ensayo (sala privada)',
      hourlyOfferName: 'Sala de práctica por hora (IVA incluido)',
    },
    vi: {
      name: 'Phòng tập nhạc thuê tháng — Studio NOL',
      serviceType: 'Cho thuê phòng tập nhạc theo tháng',
      description:
        'Phòng tập nhạc cách âm 24/7 ở Eunpyeong-gu, Seoul, 5 phút từ ga Yeonsinnae. Không cọc, thuê tối thiểu 1 tháng, khóa riêng, điều hòa và cách âm chuyên nghiệp.',
      offerName: 'Phòng tập nhạc thuê tháng (phòng riêng)',
      hourlyOfferName: 'Phòng tập theo giờ (đã gồm VAT)',
    },
    th: {
      name: 'ห้องซ้อมดนตรีเช่ารายเดือน — Studio NOL',
      serviceType: 'เช่าห้องซ้อมดนตรีรายเดือน',
      description:
        'ห้องซ้อมดนตรีกันเสียง 24 ชม. ใน Eunpyeong-gu กรุงโซล ห่างจากสถานี Yeonsinnae 5 นาที ไม่มีค่ามัดจำ เช่าขั้นต่ำ 1 เดือน มีล็อกประตูส่วนตัว ปรับอุณหภูมิ และกันเสียงระดับสตูดิโอ',
      offerName: 'ห้องซ้อมดนตรีรายเดือน (ห้องส่วนตัว)',
      hourlyOfferName: 'ห้องซ้อมรายชั่วโมง (รวม VAT)',
    },
    uz: {
      name: 'Oylik musiqa mashq xonasi — Studio NOL',
      serviceType: 'Musiqa mashq xonasi oylik ijarasi',
      description:
        '24/7 tovush izolyatsiyali musiqa mashq xonasi, Eunpyeong-gu, Seul, Yeonsinnae bekatidan 5 daqiqa. Depozitsiz, minimal 1 oy, shaxsiy qulf, iqlim nazorati va professional akustik izolyatsiya.',
      offerName: 'Oylik mashq xonasi (shaxsiy xona)',
      hourlyOfferName: 'Soatlik mashq xonasi (QQS bilan)',
    },
  };
  const copy = copyByLocale[locale] ?? copyByLocale.ko;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#practice-room-monthly-rent`,
    name: copy.name,
    serviceType: copy.serviceType,
    description: copy.description,
    // @id 참조만 남긴다. @type을 다시 붙이면 business.ts가 EntertainmentBusiness 단일
    // 타입으로 통합해 둔 #studio를 LocalBusiness로 재타이핑해, 그 파일이 피하려던
    // "Google 검사기가 두 entity로 중복 카운트" 상태를 되돌린다.
    // 같은 @graph에 #studio 전체 노드가 항상 실리므로 name·url은 여기서 반복할 필요가 없다.
    provider: { '@id': `${config.url}/#studio` },
    // 21개 dedicated 지역 LP가 커버하는 service area를 명시. Google이 LocalBusiness
    // service area를 정밀히 인식해 '연신내 음악연습실' 등 long-tail 지역 검색에서
    // 부스트. 행정구역(City/AdministrativeArea) + 동·역 단위 Place 혼합.
    // alternateName: 영문 음역 병기 — 외국인 사용자가 영문 'Yeonsinnae' 등으로 검색
    // 시에도 Google이 동일 area로 매칭하도록 시그널 보강.
    areaServed: [
      { '@type': 'City', name: '서울특별시', alternateName: 'Seoul' },
      { '@type': 'AdministrativeArea', name: '은평구', alternateName: 'Eunpyeong-gu' },
      { '@type': 'AdministrativeArea', name: '서대문구', alternateName: 'Seodaemun-gu' },
      { '@type': 'AdministrativeArea', name: '고양시 덕양구', alternateName: 'Goyang-si Deokyang-gu' },
      { '@type': 'AdministrativeArea', name: '고양시 일산동구', alternateName: 'Goyang-si Ilsandong-gu' },
      { '@type': 'AdministrativeArea', name: '고양시 일산서구', alternateName: 'Goyang-si Ilsanseo-gu' },
      { '@type': 'Place', name: '연신내', alternateName: 'Yeonsinnae' },
      { '@type': 'Place', name: '불광', alternateName: 'Bulgwang' },
      { '@type': 'Place', name: '대조동', alternateName: 'Daejo-dong' },
      { '@type': 'Place', name: '녹번', alternateName: 'Nokbeon' },
      { '@type': 'Place', name: '독바위', alternateName: 'Dokbawi' },
      { '@type': 'Place', name: '구산', alternateName: 'Gusan' },
      { '@type': 'Place', name: '역촌', alternateName: 'Yeokchon' },
      { '@type': 'Place', name: '응암', alternateName: 'Eungam' },
      { '@type': 'Place', name: '새절', alternateName: 'Saejeol' },
      { '@type': 'Place', name: '증산', alternateName: 'Jeungsan' },
      { '@type': 'Place', name: '상암', alternateName: 'Sangam' },
      { '@type': 'Place', name: '구파발', alternateName: 'Gupabal' },
      { '@type': 'Place', name: '지축', alternateName: 'Jichuk' },
      { '@type': 'Place', name: '삼송', alternateName: 'Samsong' },
      { '@type': 'Place', name: '원흥', alternateName: 'Wonheung' },
      { '@type': 'Place', name: '원당', alternateName: 'Wondang' },
      { '@type': 'Place', name: '일산', alternateName: 'Ilsan' },
    ],
    offers: [{
      '@type': 'Offer',
      name: copy.offerName,
      price: PRACTICE_ROOM_MONTHLY_PRICE,
      priceCurrency: 'KRW',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: PRACTICE_ROOM_MONTHLY_PRICE,
        priceCurrency: 'KRW',
        unitCode: 'MON',
        unitText: locale === 'ko' ? '월'
          : locale === 'zh' ? '月'
          : locale === 'es' ? 'mes'
          : locale === 'vi' ? 'tháng'
          : locale === 'th' ? 'เดือน'
          : locale === 'uz' ? 'oy'
          : 'month',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'MON',
        },
      },
      availability: 'https://schema.org/InStock',
      priceValidUntil: priceValidUntil.toISOString().split('T')[0],
      url: pageUrl,
      eligibleRegion: { '@type': 'Country', name: 'KR' },
      // provider와 같은 이유로 참조만 (위 주석 참고).
      seller: { '@id': `${config.url}/#studio` },
    }, {
      // 시간제 — 2026-09-25 사이트 예약 오픈. **VAT 포함** 소비자가(월세는 별도) — 두 오퍼의
      // 과세 표기가 다르다는 것을 여기 남긴다. 예약 액션은 아래 potentialAction.
      '@type': 'Offer',
      '@id': `${pageUrl}#practice-room-hourly`,
      name: copy.hourlyOfferName,
      price: PRACTICE_ROOM_HOURLY_PRICE_INCL,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      // provider와 같은 순수 @id 참조 — @type을 다시 붙이면 #studio가 재타이핑된다(entityGraph.test).
      seller: { '@id': `${config.url}/#studio` },
      url: `${config.url}/ko/booking/practice-room`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: PRACTICE_ROOM_HOURLY_PRICE_INCL,
        priceCurrency: 'KRW',
        valueAddedTaxIncluded: true,
        unitCode: 'HUR',
        unitText: locale === 'ko' ? '시간'
          : locale === 'zh' ? '小时'
          : locale === 'es' ? 'hora'
          : locale === 'vi' ? 'giờ'
          : locale === 'th' ? 'ชั่วโมง'
          : locale === 'uz' ? 'soat'
          : 'hour',
      },
    }],
    // 사이트에서 바로 예약 — AI·검색엔진이 "예약 가능"과 그 주소를 읽게 한다.
    potentialAction: {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${config.url}/ko/booking/practice-room`,
        inLanguage: 'ko',
        actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'],
      },
      result: { '@type': 'Reservation', name: copy.hourlyOfferName },
    },
  };
};

export interface AggregateOfferInput {
  name: string;
  priceValue: number;
}

export const generateAggregateOfferSchema = (
  catalogName: string,
  offers: AggregateOfferInput[],
  locale: Locale = 'ko'
) => {
  const prices = offers.map((o) => o.priceValue).filter((p) => p > 0);
  if (prices.length === 0) return null;

  const config = getSiteConfig(locale);
  const schemaLanguage = getSchemaLanguage(locale);
  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 12);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${config.url}/#pricing-catalog`,
    name: catalogName,
    inLanguage: schemaLanguage,
    image: `${config.url}${DEFAULT_SCHEMA_IMAGE.url}`,
    brand: {
      '@type': 'Organization',
      '@id': `${config.url}/#organization`,
      name: config.name,
    },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      priceCurrency: 'KRW',
      offerCount: offers.length,
      priceValidUntil: priceValidUntil.toISOString().split('T')[0],
      availability: 'https://schema.org/InStock',
      offers: offers.map((offer) => ({
        '@type': 'Offer',
        name: offer.name,
        // 가격 미정(0) 항목은 price를 생략 — price:0은 "무료"로 오인되어 rich result 왜곡.
        ...(offer.priceValue > 0 && { price: offer.priceValue }),
        priceCurrency: 'KRW',
      })),
    },
  };
};
