import { type Locale } from '../../lib/i18n';

// Offer.priceValidUntil — Google Rich Results는 가격 만료일이 없으면 가격을 '만료'로
// 처리해 리치 결과에서 가격 표시를 제거하거나 경고를 낸다. 빌드(SSG) 시점 기준
// +12개월로 고정한다(빌드 주기가 1년을 넘기지 않는 한 유효).
export const getOfferPriceValidUntil = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() + 12);
  return date.toISOString().split('T')[0];
};

export const OFFER_CATALOG_NAMES: Record<Locale, string> = {
  ko: '스튜디오 서비스', en: 'Studio Services', zh: '工作室服务',
  es: 'Servicios del Estudio', vi: 'Dịch vụ Studio', th: 'บริการสตูดิโอ', uz: 'Studiya xizmatlari',
};
export const RECORDING_OFFER_NAMES: Record<Locale, string> = {
  ko: '레코딩 서비스', en: 'Recording Service', zh: '录音服务',
  es: 'Servicio de Grabación', vi: 'Dịch vụ thu âm', th: 'บริการบันทึกเสียง', uz: 'Yozuv xizmati',
};
export const VOCAL_PACKAGE_OFFER_NAMES: Record<Locale, string> = {
  ko: '보컬 녹음 1프로 (1곡 패키지)', en: 'Vocal Recording 1-Song Package', zh: '人声录音1首套餐',
  es: 'Paquete de Grabación Vocal (1 canción)', vi: 'Gói thu âm vocal (1 bài)',
  th: 'แพ็กเกจอัดเสียงร้อง (1 เพลง)', uz: "Vokal yozish paketi (1 qo'shiq)",
};
export const MIXING_OFFER_NAMES: Record<Locale, string> = {
  ko: '믹싱 & 마스터링', en: 'Mixing & Mastering', zh: '混音与母带',
  es: 'Mezcla y Masterización', vi: 'Mixing & Mastering', th: 'มิกซ์ & มาสเตอริ่ง', uz: 'Miks & Mastering',
};
export const LESSON_OFFER_NAMES: Record<Locale, string> = {
  ko: '1:1 프로듀싱 레슨 (미디·작곡·믹싱)', en: '1:1 Producing Lesson (MIDI, composition, mixing)',
  zh: '1对1音乐制作课程 (MIDI·作曲·混音)', es: 'Clase 1:1 de Producción (MIDI, composición, mezcla)',
  vi: 'Lớp sản xuất âm nhạc 1:1 (MIDI, sáng tác, mixing)', th: 'คลาสโปรดิวซ์ 1:1 (MIDI แต่งเพลง มิกซ์)',
  uz: "1:1 prodyuserlik darsi (MIDI, kompozitsiya, miks)",
};
export const WEDDING_OFFER_NAMES: Record<Locale, string> = {
  ko: '축가 완성 패키지', en: 'Wedding Song Complete Package', zh: '婚礼献唱完整套餐',
  es: 'Paquete Completo de Canción de Boda', vi: 'Gói hoàn chỉnh bài hát cưới', th: 'แพ็กเกจเพลงงานแต่งครบชุด',
  uz: "To'y qo'shig'i to'liq paketi",
};
export const VOICEOVER_OFFER_NAMES: Record<Locale, string> = {
  ko: '성우·내레이션 녹음', en: 'Voiceover & Narration Recording', zh: '配音/旁白录音',
  es: 'Grabación de Locución y Narración', vi: 'Thu âm lồng tiếng & dẫn chuyện', th: 'อัดเสียงพากย์/บรรยาย',
  uz: 'Voiceover va hikoya yozuvi',
};
export const COVER_VIDEO_OFFER_NAMES: Record<Locale, string> = {
  ko: '커버 영상 촬영 올인원 패키지', en: 'Cover Video All-in-One Package', zh: '翻唱视频一站式套餐',
  es: 'Paquete Todo en Uno para Video Cover', vi: 'Gói trọn gói quay video cover', th: 'แพ็กเกจวิดีโอคัฟเวอร์ครบวงจร',
  uz: 'Cover video uchun hammasi bir paketda',
};
export const PRACTICE_OFFER_NAMES: Record<Locale, string> = {
  ko: '음악연습실 입주 프로그램', en: 'Premium Practice Room Residency', zh: '高级练习室入驻计划',
  es: 'Programa de Residencia de Sala Premium', vi: 'Chương trình thuê phòng tập cao cấp',
  th: 'โปรแกรมเช่าห้องซ้อมระดับพรีเมียม', uz: "Premium mashg'ulot xonasi dasturi",
};
/** 연습실 시간제(2026-09-25). 월세 입주(PRACTICE_OFFER_NAMES)와 별개 오퍼. VAT 포함 소비자가. */
export const PRACTICE_HOURLY_OFFER_NAMES: Record<Locale, string> = {
  ko: '음악연습실 시간제 이용', en: 'Practice Room Hourly Use', zh: '练习室按小时使用',
  es: 'Sala de práctica por hora', vi: 'Phòng tập theo giờ', th: 'ห้องซ้อมรายชั่วโมง', uz: "Mashq xonasi soatlik",
};
export const RELEASE_PRESS_OFFER_NAMES: Record<Locale, string> = {
  ko: '음원 발매 홍보', en: 'Release Press Campaign', zh: '音乐发行宣传',
  es: 'Campaña de Prensa', vi: 'Chiến dịch PR phát hành', th: 'แคมเปญข่าวประชาสัมพันธ์', uz: 'Reliz uchun press-kampaniya',
};
export const FUNDING_DESIGN_OFFER_NAMES: Record<Locale, string> = {
  ko: '펀딩 설계 대행', en: 'Crowdfunding Design', zh: '众筹设计代理',
  es: 'Diseño de Crowdfunding', vi: 'Thiết kế crowdfunding', th: 'ออกแบบคราวด์ฟันดิง', uz: 'Crowdfunding dizayni',
};
export const ITEM_LIST_NAMES: Record<Locale, string> = {
  ko: '포트폴리오', en: 'Portfolio', zh: '作品集',
  es: 'Portafolio', vi: 'Danh mục tác phẩm', th: 'ผลงาน', uz: 'Portfolio',
};

const schemaLanguageByLocale: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  zh: 'zh-CN',
  es: 'es-ES',
  vi: 'vi-VN',
  th: 'th-TH',
  uz: 'uz-UZ',
};

export const getSchemaLanguage = (locale: Locale): string => schemaLanguageByLocale[locale] || schemaLanguageByLocale.ko;

// 스키마 대표 이미지(Organization/EntertainmentBusiness/Product 등 image 필드)의 단일 소스.
// 예전엔 세 곳(business.ts ×2, commerce.ts ×1)이 각자 `${siteUrl}/thumbnail.jpg`를 하드코딩했는데,
// 그 루트 파일은 middleware.ts 로케일 매처에 걸려 /thumbnail.jpg → 307 → /ko/thumbnail.jpg → 404였다
// (public/thumbnail.jpg 자체는 실재하지만 라우팅이 씹는다). `/images/`는 매처에서 이미 제외돼 있어
// 같은 문제가 재발하지 않는다. 스키마 소비자 호환성이 넓은 .jpg를 쓴다(SEO.tsx 기본 ogImage인
// .webp와는 다르다 — 그건 사람이 보는 OG 카드, 이건 구조화 데이터 image).
export const DEFAULT_SCHEMA_IMAGE = {
  url: '/images/og-default.jpg',
  width: 1200,
  height: 630,
} as const;
