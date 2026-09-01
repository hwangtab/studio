import type { Locale } from '../lib/i18n';

// ─────────────────────────────────────────────────────────────────────────────
// 가격 단일 소스(SSOT).
// 소비처: 이 파일의 오퍼 priceValue · utils/schema/business.ts(JSON-LD Offer) ·
// pages/api/llms.ts(AI 인덱스) · pages/[locale]/pricing.tsx(가격 페이지) ·
// data/home.ts(홈 USP) · lesson.tsx 등 페이지. 같은 값이 여러 파일에 리터럴로
// 흩어져 있다가 한쪽만 고쳐 어긋나는 드리프트를 구조적으로 차단한다.
// data/pricing.test.ts가 표시문자열↔값·스키마↔상수 정합을 CI에서 강제한다.
// 주의: 350,000은 서로 다른 세 상품(레슨 월정액·축가 패키지·음반 기획 오퍼)의
// 우연한 동일값, 500,000은 6시간 Day Lock과도 우연히 겹친다 — 반드시 상품별 상수를
// 쓸 것(일괄 치환 금지).
// 반면 통합 번들(SINGLE/EP/ALBUM_BUNDLE_PRICE)과 발매 티어 하한(RELEASE_*_FROM_PRICE)이
// 같은 값인 것은 우연이 아니라 의도다: 번들은 발매 프로젝트의 고정 구성 엔트리이고,
// 발매 티어는 거기서 세션 편성·편곡 확장·PR 라운드를 올려 견적하는 같은 상품군이다.
// 한쪽을 바꾸면 다른 쪽도 함께 움직여야 한다 (data/pricing.test.ts가 강제).
// ─────────────────────────────────────────────────────────────────────────────
export const RECORDING_HOURLY_PRICE = 100000;
export const VOCAL_PACKAGE_PRICE = 250000; // 보컬 녹음 1프로(1곡·3시간)
export const DAY_LOCK_PRICE = 500000; // 6시간 패키지
export const MIXING_LEVEL1_PRICE = 200000;
export const MIXING_LEVEL2_PRICE = 350000;
export const MIXING_LEVEL3_PRICE = 500000;
export const MASTERING_SINGLE_PRICE = 100000;
/** EP·정규(4곡 이상) 일괄 마스터링 곡당 단가. 싱글 단건보다 곡당 2만원 낮다. */
export const MASTERING_PACKAGE_PRICE = 80000;
export const WEDDING_PACKAGE_PRICE = 350000; // 축가/이벤트 녹음(행사용 믹싱 포함)
export const VOICEOVER_HOURLY_PRICE = 100000;
export const COVER_VIDEO_PACKAGE_PRICE = 350000;
export const RENTAL_HOURLY_PRICE = 100000; // 촬영 대관
export const LESSON_MONTHLY_PRICE = 350000;
export const PRACTICE_ROOM_MONTHLY_PRICE = 360000;
/** schema.org '음반 기획(Album Production)' 오퍼 앵커 — 별개 오퍼(레슨·축가와 값만 동일). */
export const PRODUCTION_OFFER_PRICE = 350000;
// 발매 프로젝트 티어 시작가 — 한국어 카피 SSOT는 common.json releaseProject.tiers.*.range
// ("약 50만원~" 등)이며, data/pricing.test.ts가 아래 상수와 만원 표기 정합을 강제한다.
// 각 티어의 하한은 아래 통합 번들(고정 구성 정찰가)과 같은 값이다 — 번들이 발매
// 프로젝트의 최소 구성이고, 세션 편성·편곡 확장·PR 라운드는 그 위로 견적된다.
export const RELEASE_SINGLE_FROM_PRICE = 500000; // = SINGLE_BUNDLE_PRICE (1곡)
export const RELEASE_EP_FROM_PRICE = 1800000; // = EP_BUNDLE_PRICE (4곡 기준 하한, 상품은 3-5곡)
export const RELEASE_ALBUM_FROM_PRICE = 3400000; // = ALBUM_BUNDLE_PRICE (8곡 기준)
/**
 * 1곡 통합 싱글 패키지 — 제작 단가 VOCAL_PACKAGE_PRICE(250,000) + MIXING_LEVEL1_PRICE(200,000)
 * + MASTERING_SINGLE_PRICE(100,000) = 550,000의 9.1% 할인이며, 그 위에 기획·유통 등록·
 * 보도자료가 얹힌다. RELEASE_SINGLE_FROM_PRICE와 같은 값인 것은 의도다 — 이 번들이
 * 발매 싱글의 고정 구성 엔트리다.
 */
export const SINGLE_BUNDLE_PRICE = 500000;
/**
 * EP 통합 패키지(4곡 기준) — 곡당 제작 단가 530,000(VOCAL_PACKAGE_PRICE +
 * MIXING_LEVEL1_PRICE + MASTERING_PACKAGE_PRICE) × 4 = 2,120,000의 약 15% 할인이며,
 * 그 위에 앨범 기획·유통 등록·보도자료가 얹힌다. 곡당 450,000.
 * RELEASE_EP_FROM_PRICE와 같은 값 — 발매 EP의 고정 구성 엔트리다.
 */
export const EP_BUNDLE_PRICE = 1800000;
/**
 * 정규 통합 패키지(8곡 기준) — 곡당 제작 단가 530,000 × 8 = 4,240,000의 약 20% 할인이며,
 * 그 위에 A&R 컨설팅·유통 등록·보도자료가 얹힌다. 곡당 425,000.
 * 싱글 9% → EP 15% → 정규 20%로 곡수에 따라 할인이 커지는 사다리다.
 * RELEASE_ALBUM_FROM_PRICE와 같은 값 — 발매 정규의 고정 구성 엔트리다.
 */
export const ALBUM_BUNDLE_PRICE = 3400000;

/** 350000 → "350,000". 서버·클라이언트 동일 결과를 보장하려 로케일을 명시 고정. */
export const formatPriceAmount = (value: number): string => value.toLocaleString('en-US');

/**
 * 헤드라인·FAQ 본문에 인라인으로 박는 짧은 가격 표기.
 * ko는 '36만원'(검색 쿼리·SERP title과 같은 표기), 그 외 로케일은 '₩360,000'.
 * 만원 단위로 떨어지지 않는 값은 ko에서도 숫자 표기로 폴백한다.
 *
 * 이 헬퍼가 필요한 이유: 가격을 카피에 넣으려면 지금까지 JSON 문자열에 리터럴로
 * 박는 수밖에 없었고(예: pricing.seo.title), 그게 이 파일이 막으려는 드리프트다.
 * i18n interpolation 값으로 넘기면 카피는 번역 파일에, 숫자는 SSOT에 남는다.
 */
export const formatPriceLabel = (value: number, locale: Locale): string => {
  if (locale === 'ko' && value % 10000 === 0) return `${value / 10000}만원`;
  return `₩${formatPriceAmount(value)}`;
};

// Helper for translations
const t = (locale: Locale, dict: { ko: string; en: string; zh?: string; es?: string; vi?: string; th?: string; uz?: string }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

// Helper for array translations
const tArray = (locale: Locale, dict: { ko: string[]; en: string[]; zh?: string[]; es?: string[]; vi?: string[]; th?: string[]; uz?: string[] }) => {
  return dict[locale] || dict['en'] || dict['ko'];
};

export const getPricingData = (locale: Locale) => {
  const vatNotice = t(locale, {
    ko: '모든 가격은 VAT(부가가치세) 별도입니다.',
    en: 'All prices exclude VAT.',
    zh: '所有价格均不含增值税 (VAT)。',
    es: 'Todos los precios excluyen el IVA.',
    vi: 'Tất cả giá chưa bao gồm VAT.',
    th: 'ราคาทั้งหมดไม่รวม VAT',
    uz: 'Barcha narxlar VATsiz.',
  });

  const recordingOffers = [
    {
      id: "recording-pro",
      title: t(locale, { ko: "보컬 녹음 1프로", en: "Vocal Recording (1 Song)", zh: "人声录音 (1首)", es: "Grabación Vocal (1 Canción)", vi: "Thu âm vocal (1 bài)", th: "อัดเสียงร้อง (1 เพลง)", uz: "Vokal yozuvi (1 qo\'shiq)" }),
      subtitle: t(locale, { ko: "전담 엔지니어, 3시간 기준", en: "Dedicated engineer, 3-hour session", zh: "专属工程师, 3小时基准", es: "Ingeniero dedicado, sesión de 3 horas", vi: "Kỹ sư chuyên trách, buổi 3 giờ", th: "วิศวกรประจำ, เซสชัน 3 ชั่วโมง", uz: "Maxsus muhandis, 3 soatlik seans" }),
      priceDisplay: t(locale, { ko: "250,000원", en: "₩250,000", zh: "₩250,000", es: "₩250,000", vi: "₩250,000", th: "₩250,000", uz: "₩250,000" }),
      priceValue: 250000,
      unit: t(locale, { ko: "/ 1프로", en: "/ song", zh: "/ 首", es: "/ canción", vi: "/ bài", th: "/ เพลง", uz: "/ qo\'shiq" }),
      description: t(locale, {
        ko: "보컬 1곡 녹음을 위한 기본 패키지입니다. 전담 엔지니어 진행, 3시간 기준.",
        en: "Standard package for recording 1 vocal song. Dedicated engineer, based on 3 hours.",
        zh: "录制1首人声歌曲的基本套餐。专属工程师陪同，以3小时为基准。",
        es: "Paquete estándar para grabar 1 canción vocal. Ingeniero dedicado, basado en 3 horas.",
        vi: "Gói cơ bản cho thu âm 1 bài vocal. Kỹ sư chuyên trách, cơ sở 3 giờ.",
        th: "แพ็กเกจมาตรฐานสำหรับอัด 1 เพลงร้อง วิศวกรเสียงประจำ อ้างอิงตาม 3 ชั่วโมง",
        uz: "1 ta vokal qo\'shiq yozish uchun standart paket. Maxsus muhandis, 3 soat asosida."
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ["전담 엔지니어 진행", "보컬 디렉팅·마이크 포지셔닝 포함", "테이크 선별 및 기본 편집 포함", "3시간 기준 (추가 시 시간당 레코딩 요금 적용)"],
        en: ["Dedicated engineer included", "Vocal directing & mic positioning", "Take selection & basic editing", "Based on 3 hours (hourly rate applies for extra time)"],
        zh: ["专属工程师陪同", "含人声指导及麦克风定位", "含录音片段筛选及基本剪辑", "以3小时为基准（超时按小时计费）"],
        es: ["Ingeniero dedicado incluido", "Dirección vocal y posicionamiento de micrófono", "Selección de tomas y edición básica", "Basado en 3 horas (tarifa por hora si se excede)"],
        vi: ["Kỹ sư chuyên trách", "Đạo diễn vocal & định vị mic", "Chọn take & chỉnh sửa cơ bản", "Cơ sở 3 giờ (vượt giờ tính theo giờ)"],
        th: ["วิศวกรเสียงประจำ", "กำกับการร้องและจัดตำแหน่งไมค์", "คัดเลือก take และตัดต่อเบื้องต้น", "อ้างอิง 3 ชั่วโมง (เกินคิดรายชั่วโมง)"],
        uz: ["Maxsus muhandis bilan", "Vokal direktori va mikrofon joylashuvi", "Take tanlash va asosiy tahrirlash", "3 soat asosida (ortiqcha vaqt soatlik tarif)"]
      }),
    },
    {
      id: "recording-hourly",
      title: t(locale, { ko: "시간당 레코딩", en: "Hourly Recording", zh: "小时录音", es: "Grabación por Hora", vi: "Thu âm theo giờ", th: "บันทึกเสียงรายชั่วโมง", uz: "Soatlik yozuv" }),
      subtitle: t(locale, { ko: "최소 2시간부터, 성우·악기 보정", en: "From 2 hours, voiceover & overdubs", zh: "最少2小时, 配音·补录", es: "Desde 2 horas, locución y sobredoblaje", vi: "Từ 2 giờ, voiceover & overdub", th: "ตั้งแต่ 2 ชม. พากย์ & overdub", uz: "2 soatdan, voiceover va overdub" }),
      priceDisplay: t(locale, { ko: "100,000원", en: "₩100,000", zh: "₩100,000", es: "₩100,000", vi: "₩100,000", th: "₩100,000", uz: "₩100,000" }),
      priceValue: 100000,
      unit: t(locale, { ko: "/ 시간", en: "/ hour", zh: "/ 小时", es: "/ hora", vi: "/ giờ", th: "/ ชั่วโมง", uz: "/ soat" }),
      description: t(locale, {
        ko: "성우 녹음, 악기 추가 녹음, 보정 작업 등 시간 단위가 필요한 경우에 적합합니다.",
        en: "Ideal for voiceovers, overdubs, or correction sessions billed by the hour.",
        zh: "适合配音、补录乐器或按小时计费的修正录音。",
        es: "Ideal para locuciones, sobredoblajes o sesiones de corrección por hora.",
        vi: "Lý tưởng cho voiceover, thu thêm nhạc cụ hoặc phiên chỉnh sửa tính theo giờ.",
        th: "เหมาะสำหรับงานพากย์ การอัดซ้อนทับ หรือเซสชันแก้ไขที่คิดราคาต่อชั่วโมง",
        uz: "Voiceover, cholg'u qo'shish yoki soatlik hisoblash zarur bo'lgan tuzatish seanslari uchun mos."
      }),
      features: tArray(locale, {
        ko: ["전담 엔지니어 진행", "최소 2시간부터 예약 가능", "보정·추가 녹음·성우에 적합", "실시간 모니터링 및 피드백"],
        en: ["Dedicated engineer included", "Minimum 2-hour booking", "Great for overdubs, voiceover & fixes", "Real-time monitoring & feedback"],
        zh: ["专属工程师陪同", "最少预约2小时", "适合补录、配音及修正录音", "实时监听与即时反馈"],
        es: ["Ingeniero dedicado incluido", "Reserva mínima de 2 horas", "Ideal para sobredoblajes, locución y correcciones", "Monitoreo en tiempo real y retroalimentación"],
        vi: ["Kỹ sư chuyên trách", "Đặt tối thiểu 2 giờ", "Phù hợp overdub, voiceover & chỉnh sửa", "Giám sát thời gian thực & phản hồi"],
        th: ["วิศวกรเสียงประจำ", "จองขั้นต่ำ 2 ชั่วโมง", "เหมาะสำหรับ overdub วอยซ์โอเวอร์ และแก้ไข", "มอนิเตอร์แบบเรียลไทม์และฟีดแบ็ก"],
        uz: ["Maxsus muhandis bilan", "Minimal 2 soat bron", "Overdub, voiceover va tuzatishlar uchun mos", "Real vaqt monitoring va fikr-mulohaza"]
      }),
    },
    {
      id: "recording-daylock",
      title: t(locale, { ko: '6시간 패키지 (Day Lock)', en: '6-Hour Package (Day Lock)', zh: '6小时套餐 (Day Lock)', es: 'Paquete de 6 Horas', vi: 'Gói 6 giờ (Day Lock)', th: 'แพ็กเกจ 6 ชั่วโมง (Day Lock)', uz: '6 soatlik paket (Day Lock)' }),
      subtitle: t(locale, { ko: '장시간 작업용, 약 17% 할인', en: 'Long sessions, ~17% off', zh: '长时间工作, 约17%折扣', es: 'Sesiones largas, ~17% de descuento', vi: 'Buổi dài, giảm ~17%', th: 'เซสชันยาว, ลด ~17%', uz: 'Uzoq seanslar, ~17% chegirma' }),
      priceDisplay: t(locale, { ko: '500,000원', en: '₩500,000', zh: '₩500,000', es: '₩500,000', vi: '₩500,000', th: '₩500,000', uz: '₩500,000' }),
      priceValue: 500000,
      unit: t(locale, { ko: '/ 일', en: '/ day', zh: '/ 天', es: '/ día', vi: '/ ngày', th: '/ วัน', uz: '/ kun' }),
      description: t(locale, {
        ko: '앨범 작업 등 장시간 녹음이 필요할 때 합리적인 선택입니다.',
        en: 'Rational choice for album projects or long recording sessions.',
        zh: '专辑制作等需要长时间录音时的合理选择。',
        es: 'Elección racional para proyectos de álbumes o sesiones largas.',
        vi: 'Lựa chọn hợp lý cho dự án album hoặc buổi thu kéo dài.',
        th: 'ตัวเลือกที่คุ้มค่าสำหรับงานอัลบั้มหรือการอัดเสียงระยะยาว',
        uz: 'Albom loyihalari yoki uzoq yozuv seanslari uchun oqilona tanlov.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['6시간 패키지 (약 17% 할인)', '충분한 휴식과 여유로운 작업', '식사 시간 포함', '장시간 집중이 필요한 프로젝트에 최적'],
        en: ['6-hour package (~17% discount)', 'Relaxed work pace', 'Meal break included', 'Optimized for focus-heavy projects'],
        zh: ['6小时套餐（约17%折扣）', '从容的工作节奏，充分休息', '含用餐时间', '适合需要长时间专注的项目'],
        es: ['Paquete de 6 horas (~17% de descuento)', 'Ritmo de trabajo relajado con descansos suficientes', 'Pausa para comida incluida', 'Optimizado para proyectos que requieren concentración prolongada'],
        vi: ['Gói 6 giờ (giảm ~17%)', 'Nhịp làm việc thoải mái, nghỉ ngơi đầy đủ', 'Bao gồm thời gian ăn', 'Tối ưu cho dự án cần tập trung dài'],
        th: ['แพ็กเกจ 6 ชั่วโมง (ลด ~17%)', 'ทำงานสบาย ๆ มีเวลาพักเพียงพอ', 'รวมเวลาพักทานอาหาร', 'เหมาะกับโปรเจกต์ที่ต้องโฟกัสนาน'],
        uz: ['6 soatlik paket (taxm. 17% chegirma)', 'Rahat ish tempi va yetarli dam olish', 'Ovqatlanish vaqti kiritilgan', 'Uzoq vaqt diqqat talab qiladigan loyihalar uchun optimal']
      }),
    },
  ];

  const mixingOffers = [
    {
      id: 'mixing-level1',
      title: t(locale, { ko: '10트랙 이하', en: 'Up to 10 Tracks', zh: '10轨以下', es: 'Hasta 10 Pistas', vi: 'Tối đa 10 Track', th: 'ไม่เกิน 10 แทร็ก', uz: '10 trekkacha' }),
      subtitle: t(locale, { ko: '보컬+MR·소편성 · 수정 2회', en: 'Vocal + MR / small ensemble · 2 revisions', zh: '人声+MR·小编制 · 含2次修改', es: 'Vocal + MR / conjunto pequeño · 2 revisiones', vi: 'Vocal + MR / dàn nhỏ · 2 lần chỉnh sửa', th: 'ร้อง + MR / วงเล็ก · แก้ไข 2 ครั้ง', uz: 'Vokal + MR / kichik ansambl · 2 tahrir' }),
      priceDisplay: t(locale, { ko: '200,000원', en: '₩200,000', zh: '₩200,000', es: '₩200,000', vi: '₩200,000', th: '₩200,000', uz: '₩200,000' }),
      priceValue: 200000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '심플한 구성의 곡에 적합합니다.',
        en: 'Perfect for songs with simple arrangements.',
        zh: '适合结构简单的歌曲。',
        es: 'Perfecto para canciones con arreglos simples.',
        vi: 'Phù hợp cho bài có cấu trúc đơn giản.',
        th: 'เหมาะสำหรับเพลงที่เรียบเรียงไม่ซับซ้อน',
        uz: 'Soddaroq aranjirovkali qo\'shiqlar uchun mos.'
      }),
      features: tArray(locale, {
        ko: ['10 트랙 이하', '보컬 + MR 또는 소편성 악기', '기본 2회 수정 포함', '밸런스 및 톤 보정'],
        en: ['Under 10 tracks', 'Vocal + MR or small ensemble', '2 revisions included', 'Balance & tone correction'],
        zh: ['10轨以下', '人声 + MR 或小编制乐器', '含2次修改', '音量平衡及音色调整'],
        es: ['Menos de 10 pistas', 'Vocal + MR o conjunto pequeño', '2 revisiones incluidas', 'Corrección de balance y tono'],
        vi: ['Dưới 10 track', 'Vocal + MR hoặc dàn nhạc nhỏ', 'Bao gồm 2 lần chỉnh sửa', 'Cân bằng & chỉnh tone'],
        th: ['ต่ำกว่า 10 แทร็ก', 'ร้อง + MR หรือวงเล็ก', 'รวมแก้ไข 2 ครั้ง', 'ปรับบาลานซ์และโทน'],
        uz: ['10 ta trackgacha', 'Vokal + MR yoki kichik ansambl', '2 ta tahrir kiritilgan', 'Balans va ton tuzatish']
      }),
    },
    {
      id: 'mixing-level2',
      title: t(locale, { ko: '11~30트랙', en: '11–30 Tracks', zh: '11–30轨', es: '11–30 Pistas', vi: '11–30 Track', th: '11–30 แทร็ก', uz: '11–30 Trek' }),
      subtitle: t(locale, { ko: '일반 밴드·팝 편곡 · 수정 2회', en: 'Band / pop arrangement · 2 revisions', zh: '一般乐队·流行编曲 · 含2次修改', es: 'Banda / arreglo pop · 2 revisiones', vi: 'Band / pop arrangement · 2 lần chỉnh sửa', th: 'วง / เรียบเรียงป๊อป · แก้ไข 2 ครั้ง', uz: 'Band / pop aranjirovka · 2 tahrir' }),
      priceDisplay: t(locale, { ko: '350,000원', en: '₩350,000', zh: '₩350,000', es: '₩350,000', vi: '₩350,000', th: '₩350,000', uz: '₩350,000' }),
      priceValue: 350000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '일반적인 밴드 구성이나 팝 음악에 적합합니다.',
        en: 'Suitable for standard band arrangements or pop music.',
        zh: '适合一般乐队编制或流行音乐。',
        es: 'Adecuado para arreglos de banda estándar o música pop.',
        vi: 'Phù hợp cho band tiêu chuẩn hoặc nhạc pop.',
        th: 'เหมาะสำหรับวงมาตรฐานหรือเพลงป๊อป',
        uz: 'Standart band aranjirovkasi yoki pop musiqasi uchun mos.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['11 ~ 30 트랙', '풀 밴드 구성 또는 팝 편곡', '기본 2회 수정 포함', '디테일한 이펙팅 및 공간감 형성'],
        en: ['11 ~ 30 tracks', 'Full band or pop arrangement', '2 revisions included', 'Detailed effects & spatial design'],
        zh: ['11–30轨', '完整乐队或流行编曲', '含2次修改', '精细效果处理及空间感营造'],
        es: ['11–30 pistas', 'Arreglo de banda completa o pop', '2 revisiones incluidas', 'Efectos detallados y diseño espacial'],
        vi: ['11–30 track', 'Band đầy đủ hoặc pop arrangement', 'Bao gồm 2 lần chỉnh sửa', 'Hiệu ứng chi tiết & tạo không gian'],
        th: ['11–30 แทร็ก', 'วงเต็มหรือเรียบเรียงป๊อป', 'รวมแก้ไข 2 ครั้ง', 'เอฟเฟกต์ละเอียดและการออกแบบมิติ'],
        uz: ['11–30 track', 'To"liq band yoki pop aranjirovka', '2 ta tahrir kiritilgan', 'Batafsil effektlar va fazoviy dizayn']
      }),
    },
    {
      id: 'mixing-level3',
      title: t(locale, { ko: '31트랙 이상', en: '31+ Tracks', zh: '31轨以上', es: '31+ Pistas', vi: '31+ Track', th: '31+ แทร็ก', uz: '31+ Trek' }),
      subtitle: t(locale, { ko: '대편성·복잡한 일렉트로닉 · 수정 2회', en: 'Large ensemble / complex electronic · 2 revisions', zh: '大编制·复杂电子 · 含2次修改', es: 'Gran ensemble / electrónica compleja · 2 revisiones', vi: 'Dàn lớn / electronic phức tạp · 2 lần chỉnh sửa', th: 'วงใหญ่ / อิเล็กทรอนิกส์ซับซ้อน · แก้ไข 2 ครั้ง', uz: 'Katta ansambl / murakkab elektronika · 2 tahrir' }),
      priceDisplay: t(locale, { ko: '500,000원', en: '₩500,000', zh: '₩500,000', es: '₩500,000', vi: '₩500,000', th: '₩500,000', uz: '₩500,000' }),
      priceValue: 500000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '대편성 오케스트라나 복잡한 레이어의 곡에 적합합니다.',
        en: 'Suitable for large orchestras or complex layers.',
        zh: '适合大型管弦乐团或复杂层次的歌曲。',
        es: 'Adecuado para grandes orquestas o capas complejas.',
        vi: 'Phù hợp cho dàn nhạc lớn hoặc lớp layer phức tạp.',
        th: 'เหมาะสำหรับออร์เคสตราขนาดใหญ่หรือเพลงที่มีเลเยอร์ซับซ้อน',
        uz: 'Katta orkestr yoki murakkab layerli qo\'shiqlar uchun mos.'
      }),
      features: tArray(locale, {
        ko: ['31 트랙 이상', '대편성 또는 복잡한 일렉트로닉', '기본 2회 수정 포함', '최고 수준의 디테일 작업'],
        en: ['31+ tracks', 'Large ensemble or complex electronic', '2 revisions included', 'Highest level of detail'],
        zh: ['31轨以上', '大编制或复杂电子音乐', '含2次修改', '最高水准的细节处理'],
        es: ['31 o más pistas', 'Gran ensemble o electrónica compleja', '2 revisiones incluidas', 'Mayor nivel de detalle'],
        vi: ['31 track trở lên', 'Dàn nhạc lớn hoặc electronic phức tạp', 'Bao gồm 2 lần chỉnh sửa', 'Chi tiết ở mức cao nhất'],
        th: ['31 แทร็กขึ้นไป', 'วงใหญ่หรืออิเล็กทรอนิกส์ซับซ้อน', 'รวมแก้ไข 2 ครั้ง', 'งานละเอียดระดับสูงสุด'],
        uz: ['31+ track', 'Katta ansambl yoki murakkab elektronika', '2 ta tahrir kiritilgan', 'Eng yuqori darajadagi detal ishlov']
      }),
    },
  ];

  const masteringOffers = [
    {
      id: 'mastering-single',
      title: t(locale, { ko: '싱글 마스터링', en: 'Single Mastering', zh: '单曲母带处理', es: 'Masterización de Sencillo', vi: 'Mastering single', th: 'มาสเตอริ่งซิงเกิล', uz: 'Single mastering' }),
      subtitle: t(locale, { ko: '1곡 디지털 발매용', en: '1 song, digital release', zh: '1首, 数字发行', es: '1 canción, lanzamiento digital', vi: '1 bài, phát hành kỹ thuật số', th: '1 เพลง, การเผยแพร่ดิจิทัล', uz: '1 qo\'shiq, raqamli chiqarish' }),
      priceDisplay: t(locale, { ko: '100,000원', en: '₩100,000', zh: '₩100,000', es: '₩100,000', vi: '₩100,000', th: '₩100,000', uz: '₩100,000' }),
      priceValue: 100000,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '디지털 싱글 발매를 위한 최적의 마스터링입니다.',
        en: 'Optimized mastering for digital single release.',
        zh: '针对数字单曲发行的最佳母带处理。',
        es: 'Masterización optimizada para lanzamiento de sencillo digital.',
        vi: 'Mastering tối ưu cho phát hành single kỹ thuật số.',
        th: 'มาสเตอริ่งที่เหมาะที่สุดสำหรับซิงเกิลดิจิทัล',
        uz: 'Raqamli singl chiqishi uchun optimallashtirilgan mastering.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['스트리밍 플랫폼 규격 준수', '기본 1회 수정 포함', '고해상도 음원 제공', '장르별 최적화된 라우드니스 설정'],
        en: ['Streaming platform standards', '1 revision included', 'High-res audio files', 'Genre-optimized loudness'],
        zh: ['符合流媒体平台规格标准', '含1次修改', '提供高解析度音频文件', '按流派优化响度设置'],
        es: ['Cumple con los estándares de plataformas de streaming', '1 revisión incluida', 'Archivos de audio de alta resolución', 'Loudness optimizado por género'],
        vi: ['Tuân thủ chuẩn nền tảng streaming', 'Bao gồm 1 lần chỉnh sửa', 'File âm thanh độ phân giải cao', 'Loudness tối ưu theo thể loại'],
        th: ['ตามมาตรฐานแพลตฟอร์มสตรีมมิง', 'รวมแก้ไข 1 ครั้ง', 'ไฟล์เสียงความละเอียดสูง', 'ตั้งค่า loudness ให้เหมาะกับแนวเพลง'],
        uz: ['Streaming platforma standartlariga mos', '1 ta tahrir kiritilgan', 'Yuqori rezolyutsiyali audio fayllar', 'Janrga mos loudness sozlamalari']
      }),
    },
    {
      id: 'mastering-package',
      title: t(locale, { ko: 'EP · 정규 마스터링', en: 'EP · Album Mastering', zh: 'EP·专辑母带处理', es: 'Masterización de EP · Álbum', vi: 'Mastering EP · album', th: 'มาสเตอริ่ง EP · อัลบั้ม', uz: 'EP · albom masteringi' }),
      subtitle: t(locale, { ko: '4곡↑ 일괄 의뢰 시 곡당', en: '4+ tracks, per-song rate', zh: '4首以上, 每首单价', es: '4+ canciones, tarifa por canción', vi: '4+ bài, đơn giá mỗi bài', th: '4+ เพลง, ราคาต่อเพลง', uz: '4+ trek, har bir trek narxi' }),
      priceDisplay: t(locale, { ko: '80,000원', en: '₩80,000', zh: '₩80,000', es: '₩80,000', vi: '₩80,000', th: '₩80,000', uz: '₩80,000' }),
      priceValue: MASTERING_PACKAGE_PRICE,
      unit: t(locale, { ko: '/ 곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '4곡 이상을 한 번에 맡길 때 적용되는 곡당 단가입니다.',
        en: 'Per-song rate applied when mastering four or more tracks together.',
        zh: '一次委托4首以上时适用的每首单价。',
        es: 'Tarifa por canción al masterizar cuatro o más pistas juntas.',
        vi: 'Đơn giá mỗi bài khi mastering từ 4 bài trở lên cùng lúc.',
        th: 'ราคาต่อเพลงเมื่อมาสเตอร์ 4 เพลงขึ้นไปพร้อมกัน',
        uz: 'To\'rt va undan ortiq trekni birga masteringlashda qo\'llaniladigan narx.'
      }),
      features: tArray(locale, {
        ko: ['4곡 이상 일괄 의뢰 시 적용', '앨범 전체 톤·라우드니스 통일', '스트리밍 플랫폼 규격 준수', '고해상도 음원 제공'],
        en: ['Applies to four or more tracks', 'Consistent tone & loudness across the album', 'Streaming platform standards', 'High-res audio files'],
        zh: ['一次委托4首以上时适用', '统一整张专辑的音色与响度', '符合流媒体平台规格标准', '提供高解析度音频文件'],
        es: ['Se aplica a cuatro o más pistas', 'Tono y loudness uniformes en todo el álbum', 'Cumple con los estándares de plataformas de streaming', 'Archivos de audio de alta resolución'],
        vi: ['Áp dụng từ 4 bài trở lên', 'Thống nhất tone và loudness toàn album', 'Tuân thủ chuẩn nền tảng streaming', 'File âm thanh độ phân giải cao'],
        th: ['ใช้กับ 4 เพลงขึ้นไป', 'ปรับโทนและ loudness ทั้งอัลบั้มให้สม่ำเสมอ', 'ตามมาตรฐานแพลตฟอร์มสตรีมมิง', 'ไฟล์เสียงความละเอียดสูง'],
        uz: ['To"rt va undan ortiq trek uchun', 'Albom bo"ylab ton va loudness bir xil', 'Streaming platforma standartlariga mos', 'Yuqori rezolyutsiyali audio fayllar']
      }),
    },
  ];

  const additionalServices = [
    {
      id: 'service-consulting',
      title: t(locale, { ko: '기획/컨설팅', en: 'Consulting', zh: '策划/咨询', es: 'Consultoría', vi: 'Tư vấn', th: 'ให้คำปรึกษา', uz: 'Konsalting' }),
      priceDisplay: t(locale, { ko: '50,000원', en: '₩50,000', zh: '₩50,000', es: '₩50,000', vi: '₩50,000', th: '₩50,000', uz: '₩50,000' }),
      priceValue: 50000,
      unit: t(locale, { ko: '/ 시간', en: '/ hour', zh: '/ 小时', es: '/ hora', vi: '/ giờ', th: '/ ชั่วโมง', uz: '/ soat' }),
      description: t(locale, {
        ko: '프로젝트 기획, 일정 관리, 예산 수립 등 전반적인 앨범 제작 컨설팅',
        en: 'Album production consulting including planning, scheduling, and budgeting.',
        zh: '项目策划、日程管理、预算制定等整体专辑制作咨询',
        es: 'Consultoría de producción de álbumes, incluyendo planificación, programación y presupuesto.',
        vi: 'Tư vấn sản xuất album: kế hoạch, lịch trình, ngân sách.',
        th: 'ให้คำปรึกษาการผลิตอัลบั้ม ครอบคลุมการวางแผน ตารางงาน และงบประมาณ',
        uz: 'Albom ishlab chiqarish bo"yicha rejalash, jadval va byudjet konsaltingi.'
      }),
    },
    {
      id: 'service-funding',
      title: t(locale, { ko: '펀딩 설계 대행', en: 'Crowdfunding Design', zh: '众筹设计代理', es: 'Diseño de Crowdfunding', vi: 'Thiết kế crowdfunding', th: 'ออกแบบคราวด์ฟันดิง', uz: 'Crowdfunding dizayni' }),
      priceDisplay: t(locale, { ko: '400,000원', en: '₩400,000', zh: '₩400,000', es: '₩400,000', vi: '₩400,000', th: '₩400,000', uz: '₩400,000' }),
      priceValue: 400000,
      description: t(locale, {
        ko: '텀블벅 등 크라우드 펀딩 페이지 기획, 스토리텔링, 리워드 설계',
        en: 'Planning and storytelling for crowdfunding projects (Tumblbug, etc.).',
        zh: 'Tumblbug等众筹页面策划、故事讲述、回报设计',
        es: 'Planificación y narración para proyectos de crowdfunding.',
        vi: 'Lập kế hoạch trang crowdfunding (Tumblbug, v.v.), storytelling và thiết kế reward.',
        th: 'วางแผนหน้า crowdfunding (Tumblbug ฯลฯ) การเล่าเรื่อง และออกแบบรีวอร์ด',
        uz: 'Crowdfunding sahifasini rejalash (Tumblbug va b.), storytelling hamda reward dizayni.'
      }),
      note: t(locale, { ko: '+ 성공 수수료 10% (후불)', en: '+ 10% success fee', zh: '+ 10% 成功手续费', es: '+ 10% tarifa de éxito', vi: '+ Phí thành công 10% (trả sau)', th: '+ ค่าธรรมเนียมความสำเร็จ 10% (ชำระภายหลัง)', uz: '+ 10% muvaffaqiyat to"lovi (keyin to"lanadi)' }),
    },
    {
      id: 'service-promo',
      title: t(locale, { ko: '기본 홍보 패키지', en: 'Basic Promotion', zh: '基础宣传套餐', es: 'Promoción Básica', vi: 'Gói PR cơ bản', th: 'แพ็กเกจโปรโมตพื้นฐาน', uz: 'Asosiy targ"ibot paketi' }),
      priceDisplay: t(locale, { ko: '300,000원', en: '₩300,000', zh: '₩300,000', es: '₩300,000', vi: '₩300,000', th: '₩300,000', uz: '₩300,000' }),
      priceValue: 300000,
      description: t(locale, {
        ko: '전문 보도자료 작성, 국내외 매체·라디오·플레이리스트 피칭, 주요 음악 사이트 앨범 소개 등록 대행',
        en: 'Press release writing, media distribution, and music site registration.',
        zh: '撰写专业新闻稿并分发给媒体，代为登记主要音乐网站专辑介绍',
        es: 'Redacción de comunicados de prensa, distribución en medios y registro en sitios de música.',
        vi: 'Viết thông cáo báo chí, phân phối truyền thông và đăng giới thiệu album trên các trang nhạc.',
        th: 'เขียนข่าวประชาสัมพันธ์ กระจายสื่อ และลงทะเบียนแนะนำอัลบั้มในเว็บเพลงหลัก',
        uz: 'Press-reliz yozish, OAV tarqatish va musiqiy saytlar ro"yxatiga kiritish.'
      }),
    },
    {
      id: 'service-epk',
      title: t(locale, { ko: 'EPK 웹사이트', en: 'EPK Website', zh: 'EPK 网站', es: 'Sitio Web EPK', vi: 'Website EPK', th: 'เว็บไซต์ EPK', uz: 'EPK veb-sayti' }),
      priceDisplay: t(locale, { ko: '500,000원', en: '₩500,000', zh: '₩500,000', es: '₩500,000', vi: '₩500,000', th: '₩500,000', uz: '₩500,000' }),
      priceValue: 500000,
      description: t(locale, {
        ko: '아티스트/앨범 소개를 위한 반응형 웹사이트 제작 (Electronic Press Kit)',
        en: 'Responsive website for artist/album introduction (Electronic Press Kit).',
        zh: '制作艺术家/专辑介绍的响应式网站 (电子新闻资料包)',
        es: 'Sitio web adaptable para presentación de artista/álbum (Kit de Prensa Electrónico).',
        vi: 'Tạo website responsive giới thiệu nghệ sĩ/album (Electronic Press Kit).',
        th: 'สร้างเว็บไซต์แบบ responsive เพื่อแนะนำศิลปิน/อัลบั้ม (Electronic Press Kit)',
        uz: "San'atkor/albom taqdimoti uchun moslashuvchan veb-sayt (Electronic Press Kit)."
      }),
    },
  ];

  const specialPackages = [
    {
      id: 'package-single-bundle',
      title: t(locale, {
        ko: '1곡 통합 싱글 패키지 (기획~발매)',
        en: 'Single Song Bundle (Planning to Release)',
        zh: '单曲一站式套餐（策划至发行）',
        es: 'Paquete Single Completo (De la planificación al lanzamiento)',
        vi: 'Gói 1 bài trọn gói (Lên kế hoạch đến phát hành)',
        th: 'เพลงเดี่ยวแพ็กเกจครบ (วางแผนถึงวางจำหน่าย)',
        uz: "1 ta qo\'shiq to\'liq paket (Rejadan chiqarishgacha)"
      }),
      subtitle: t(locale, {
        ko: '기획·제작·유통·홍보 올인원 (제작 단가 대비 ~9% 할인)',
        en: 'Planning, production, distribution & PR in one (~9% off production rates)',
        zh: '策划·制作·发行·宣传一站式（较制作单价约9%折扣）',
        es: 'Planificación, producción, distribución y prensa en uno (~9% menos que las tarifas de producción)',
        vi: 'Lên kế hoạch, sản xuất, phát hành & PR trọn gói (giảm ~9% so với giá sản xuất)',
        th: 'วางแผน · ผลิต · จัดจำหน่าย · ประชาสัมพันธ์ ครบวงจร (ลด ~9% จากราคาผลิต)',
        uz: "Reja, ishlab chiqarish, tarqatish va PR birgalikda (ishlab chiqarish narxidan ~9% arzon)"
      }),
      priceDisplay: t(locale, { ko: '500,000원', en: '₩500,000', zh: '₩500,000', es: '₩500,000', vi: '₩500,000', th: '₩500,000', uz: '₩500,000' }),
      priceValue: SINGLE_BUNDLE_PRICE,
      unit: t(locale, { ko: '/ 1곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '기획 상담부터 유통 등록·발매 홍보까지 한 곡을 끝까지 함께하는 패키지입니다. 보컬 녹음·믹싱·마스터링 제작 단가 합계 55만원보다 싸면서, 앨범 기획과 유통·보도자료가 함께 들어갑니다.',
        en: 'One song carried from the first planning conversation through distribution and release PR. Priced below the ₩550,000 production line-item total, with planning, distribution and press outreach included.',
        zh: '从策划咨询到发行登记与宣传，一首歌全程陪伴。价格低于 ₩550,000 的制作单项合计，且包含策划、发行与新闻稿。',
        es: 'Una canción acompañada desde la planificación hasta la distribución y la prensa de lanzamiento. Cuesta menos que la suma de producción (₩550.000) e incluye planificación, distribución y difusión a prensa.',
        vi: 'Một bài hát được đồng hành từ khâu lên kế hoạch đến phát hành và PR. Giá thấp hơn tổng chi phí sản xuất ₩550.000, đã bao gồm lên kế hoạch, phát hành và gửi thông cáo báo chí.',
        th: 'ดูแลหนึ่งเพลงตั้งแต่การวางแผนจนถึงการจัดจำหน่ายและประชาสัมพันธ์ ราคาต่ำกว่าผลรวมค่าผลิต ₩550,000 และรวมการวางแผน จัดจำหน่าย และส่งข่าวประชาสัมพันธ์',
        uz: "Bitta qo'shiq rejalashtirishdan tarqatish va PRgacha birga olib boriladi. Narxi ishlab chiqarish yig'indisi ₩550,000 dan past, rejalashtirish, tarqatish va matbuotga yuborish ham kiradi."
      }),
      features: tArray(locale, {
        ko: ['기획 · 방향 디렉팅', '보컬 녹음 1프로 (3시간, 전담 엔지니어)', '믹싱 10트랙 이하 (수정 2회)', '싱글 마스터링 (수정 1회)', '디지털 유통 등록 (멜론·스포티파이·애플뮤직·유튜브뮤직)', '발매 홍보 — 국내 기자·평론가 + 해외 매체·라디오·플레이리스트 피칭', '개별 합계 대비 약 9% 할인'],
        en: ['Concept planning & direction', 'Vocal Recording 1 Song (3h, dedicated engineer)', 'Mixing ≤10 Tracks (2 revisions)', 'Single Mastering (1 revision)', 'Digital distribution (Melon, Spotify, Apple Music, YouTube Music)', 'Release promotion — pitched to Korean journalists/critics and international media, radio & playlist curators', '~9% off line-item total'],
        zh: ['策划 · 方向指导', '人声录音1首（3小时，专属工程师）', '混音 ≤10轨（含2次修改）', '单曲母带（含1次修改）', '数字发行登记（Melon·Spotify·Apple Music·YouTube Music）', '撰写发行新闻稿并发送给音乐记者·乐评人', '比单项合计便宜约9%'],
        es: ['Planificación de concepto y dirección', 'Grabación vocal 1 canción (3h, ingeniero dedicado)', 'Mezcla ≤10 pistas (2 revisiones)', 'Masterización de sencillo (1 revisión)', 'Distribución digital (Melon, Spotify, Apple Music, YouTube Music)', 'Nota de prensa redactada y enviada a periodistas y críticos musicales', '~9% de descuento sobre los ítems'],
        vi: ['Lên kế hoạch & định hướng', 'Thu âm vocal 1 bài (3h, kỹ sư chuyên trách)', 'Mixing ≤10 track (2 lần chỉnh sửa)', 'Mastering single (1 lần chỉnh sửa)', 'Đăng ký phát hành số (Melon, Spotify, Apple Music, YouTube Music)', 'Viết thông cáo phát hành & gửi tới nhà báo, nhà phê bình âm nhạc', 'Giảm ~9% so với tổng các mục'],
        th: ['วางแผนคอนเซปต์และกำกับทิศทาง', 'อัดเสียงร้อง 1 เพลง (3 ชม. วิศวกรประจำ)', 'มิกซ์ ≤10 แทร็ก (แก้ไข 2 ครั้ง)', 'มาสเตอร์ซิงเกิล (แก้ไข 1 ครั้ง)', 'ลงทะเบียนจัดจำหน่ายดิจิทัล (Melon, Spotify, Apple Music, YouTube Music)', 'เขียนข่าวประชาสัมพันธ์และส่งถึงนักข่าวและนักวิจารณ์ดนตรี', 'ลด ~9% จากรายการรวม'],
        uz: ["Konsepsiya rejasi va yo'nalish", 'Vokal yozuv 1 qo\'shiq (3 soat, maxsus muhandis)', 'Miks ≤10 trek (2 tahrir)', 'Single mastering (1 tahrir)', 'Raqamli tarqatish (Melon, Spotify, Apple Music, YouTube Music)', 'Chiqarish uchun press-reliz yozilib, musiqa jurnalistlari va tanqidchilariga yuboriladi', 'Alohida narxlardan ~9% chegirma']
      }),
    },
    {
      id: 'package-ep-bundle',
      title: t(locale, {
        ko: 'EP 통합 패키지 (4곡 기준)',
        en: 'EP Bundle (4 Songs)',
        zh: 'EP 套餐（4首）',
        es: 'Paquete EP (4 Canciones)',
        vi: 'Gói EP (4 bài)',
        th: 'แพ็กเกจ EP (4 เพลง)',
        uz: "EP paketi (4 ta qo\'shiq)"
      }),
      subtitle: t(locale, {
        ko: '곡당 45만원 · 기획·제작·유통·홍보 (~15% 할인)',
        en: '₩450,000 per song · planning, production, distribution & PR (~15% off)',
        zh: '每首 ₩450,000 · 策划·制作·发行·宣传（约15%折扣）',
        es: '₩450.000 por canción · planificación, producción, distribución y prensa (~15% de descuento)',
        vi: '₩450.000/bài · lên kế hoạch, sản xuất, phát hành & PR (giảm ~15%)',
        th: '₩450,000 ต่อเพลง · วางแผน ผลิต จัดจำหน่าย ประชาสัมพันธ์ (ลด ~15%)',
        uz: "Har bir qo'shiq ₩450,000 · reja, ishlab chiqarish, tarqatish va PR (~15% chegirma)"
      }),
      priceDisplay: t(locale, { ko: '1,800,000원', en: '₩1,800,000', zh: '₩1,800,000', es: '₩1,800,000', vi: '₩1,800,000', th: '₩1,800,000', uz: '₩1,800,000' }),
      priceValue: EP_BUNDLE_PRICE,
      unit: t(locale, { ko: '/ 4곡', en: '/ 4 songs', zh: '/ 4首', es: '/ 4 canciones', vi: '/ 4 bài', th: '/ 4 เพลง', uz: "/ 4 qo\'shiq" }),
      description: t(locale, {
        ko: 'EP 한 장을 기획부터 유통·홍보까지 끝까지 함께 만듭니다. 곡당 45만원으로 제작 단가 합계 212만원보다 싸면서, 앨범 기획·트랙리스트 큐레이션과 유통 등록·보도자료가 함께 들어갑니다. 곡수가 다르면 곡당 단가로 견적합니다.',
        en: 'A full EP carried from planning through distribution and release PR. ₩450,000 per song — below the ₩2,120,000 production line-item total, with album planning, tracklist curation, distribution and press outreach included. Different track counts are quoted at the per-song rate.',
        zh: '一张 EP 从策划到发行与宣传全程陪伴。每首 ₩450,000，低于 ₩2,120,000 的制作单项合计，且包含专辑策划、曲目编排、发行登记与新闻稿。曲目数不同时按每首单价报价。',
        es: 'Un EP completo acompañado desde la planificación hasta la distribución y la prensa. ₩450.000 por canción, por debajo de la suma de producción (₩2.120.000), con planificación del álbum, curaduría del tracklist, distribución y difusión a prensa incluidas. Otras cantidades se cotizan a la tarifa por canción.',
        vi: 'Một EP hoàn chỉnh được đồng hành từ lên kế hoạch đến phát hành và PR. ₩450.000/bài, thấp hơn tổng chi phí sản xuất ₩2.120.000, đã gồm lên kế hoạch album, sắp xếp tracklist, phát hành và gửi thông cáo báo chí. Số bài khác được báo giá theo đơn giá mỗi bài.',
        th: 'ดูแล EP หนึ่งชุดตั้งแต่การวางแผนจนถึงการจัดจำหน่ายและประชาสัมพันธ์ ₩450,000 ต่อเพลง ต่ำกว่าผลรวมค่าผลิต ₩2,120,000 และรวมการวางแผนอัลบั้ม คัดลำดับเพลง จัดจำหน่าย และส่งข่าว จำนวนเพลงอื่นคิดราคาต่อเพลง',
        uz: "To'liq EP rejalashtirishdan tarqatish va PRgacha birga olib boriladi. Har bir qo'shiq ₩450,000 — ishlab chiqarish yig'indisi ₩2,120,000 dan past, albom rejasi, treklist kuratsiyasi, tarqatish va matbuotga yuborish ham kiradi. Boshqa qo'shiq soni har bir qo'shiq narxi bo'yicha hisoblanadi."
      }),
      features: tArray(locale, {
        ko: ['앨범 기획 · 트랙리스트 큐레이션', '보컬 녹음 1프로 × 4곡 (곡당 3시간, 전담 엔지니어)', '믹싱 10트랙 이하 × 4곡 (곡당 수정 2회)', 'EP 마스터링 × 4곡 (앨범 톤·라우드니스 통일)', '디지털 유통 등록 (멜론·스포티파이·애플뮤직·유튜브뮤직)', '발매 홍보 — 국내 기자·평론가 + 해외 매체·라디오·플레이리스트 피칭', '개별 합계 212만원 대비 약 15% 할인', '11트랙 이상 편성은 믹싱 차액 별도'],
        en: ['Album planning & tracklist curation', 'Vocal Recording 1 Song × 4 (3h each, dedicated engineer)', 'Mixing ≤10 Tracks × 4 (2 revisions each)', 'EP Mastering × 4 (album-wide tone & loudness)', 'Digital distribution (Melon, Spotify, Apple Music, YouTube Music)', 'Release promotion — pitched to Korean journalists/critics and international media, radio & playlist curators', '~15% off the ₩2,120,000 line-item total', '11+ track arrangements billed at the mixing difference'],
        zh: ['专辑策划 · 曲目编排', '人声录音1首 × 4（各 3 小时，专属工程师）', '混音 ≤10轨 × 4（各含2次修改）', 'EP 母带 × 4（全专辑音色·响度统一）', '数字发行登记（Melon·Spotify·Apple Music·YouTube Music）', '撰写发行新闻稿并发送给音乐记者·乐评人', '比单项合计 ₩2,120,000 便宜约 15%', '11轨以上编制按混音差额另计'],
        es: ['Planificación del álbum y curaduría del tracklist', 'Grabación vocal 1 canción × 4 (3h cada una, ingeniero dedicado)', 'Mezcla ≤10 pistas × 4 (2 revisiones cada una)', 'Masterización EP × 4 (tono y loudness unificados)', 'Distribución digital (Melon, Spotify, Apple Music, YouTube Music)', 'Nota de prensa redactada y enviada a periodistas y críticos musicales', '~15% de descuento sobre ₩2.120.000', 'Arreglos de 11+ pistas se facturan por la diferencia de mezcla'],
        vi: ['Lên kế hoạch album & sắp xếp tracklist', 'Thu âm vocal 1 bài × 4 (3h mỗi bài, kỹ sư chuyên trách)', 'Mixing ≤10 track × 4 (2 lần chỉnh sửa mỗi bài)', 'Mastering EP × 4 (đồng nhất tone & loudness)', 'Đăng ký phát hành số (Melon, Spotify, Apple Music, YouTube Music)', 'Viết thông cáo phát hành & gửi tới nhà báo, nhà phê bình âm nhạc', 'Giảm ~15% so với tổng ₩2.120.000', 'Phối khí 11+ track tính thêm phần chênh mixing'],
        th: ['วางแผนอัลบั้มและคัดเลือกลำดับเพลง', 'อัดเสียงร้อง 1 เพลง × 4 (เพลงละ 3 ชม. วิศวกรประจำ)', 'มิกซ์ ≤10 แทร็ก × 4 (แก้ไขเพลงละ 2 ครั้ง)', 'มาสเตอริ่ง EP × 4 (โทนและความดังทั้งอัลบั้ม)', 'ลงทะเบียนจัดจำหน่ายดิจิทัล (Melon, Spotify, Apple Music, YouTube Music)', 'เขียนข่าวประชาสัมพันธ์และส่งถึงนักข่าวและนักวิจารณ์ดนตรี', 'ลด ~15% จาก ₩2,120,000', 'การเรียบเรียง 11+ แทร็ก คิดส่วนต่างค่ามิกซ์'],
        uz: ['Albom rejasi va treklist kuratsiyasi', "Vokal yozuv 1 qo\'shiq × 4 (har biri 3 soat, maxsus muhandis)", 'Miks ≤10 trek × 4 (har biriga 2 tahrir)', 'EP mastering × 4 (albom bo\'yicha ton va balandlik)', 'Raqamli tarqatish (Melon, Spotify, Apple Music, YouTube Music)', 'Chiqarish uchun press-reliz yozilib, musiqa jurnalistlari va tanqidchilariga yuboriladi', "₩2,120,000 dan ~15% chegirma", '11+ trek aranjirovka miks farqi bo\'yicha hisoblanadi']
      }),
    },
    {
      id: 'package-album-bundle',
      title: t(locale, {
        ko: '정규 통합 패키지 (8곡 기준)',
        en: 'Album Bundle (8 Songs)',
        zh: '专辑套餐（8首）',
        es: 'Paquete de Álbum (8 Canciones)',
        vi: 'Gói Album (8 bài)',
        th: 'แพ็กเกจอัลบั้ม (8 เพลง)',
        uz: "Albom paketi (8 ta qo\'shiq)"
      }),
      subtitle: t(locale, {
        ko: '곡당 42.5만원 · 기획·제작·유통·홍보 (~20% 할인)',
        en: '₩425,000 per song · planning, production, distribution & PR (~20% off)',
        zh: '每首 ₩425,000 · 策划·制作·发行·宣传（约20%折扣）',
        es: '₩425.000 por canción · planificación, producción, distribución y prensa (~20% de descuento)',
        vi: '₩425.000/bài · lên kế hoạch, sản xuất, phát hành & PR (giảm ~20%)',
        th: '₩425,000 ต่อเพลง · วางแผน ผลิต จัดจำหน่าย ประชาสัมพันธ์ (ลด ~20%)',
        uz: "Har bir qo'shiq ₩425,000 · reja, ishlab chiqarish, tarqatish va PR (~20% chegirma)"
      }),
      priceDisplay: t(locale, { ko: '3,400,000원', en: '₩3,400,000', zh: '₩3,400,000', es: '₩3,400,000', vi: '₩3,400,000', th: '₩3,400,000', uz: '₩3,400,000' }),
      priceValue: ALBUM_BUNDLE_PRICE,
      unit: t(locale, { ko: '/ 8곡', en: '/ 8 songs', zh: '/ 8首', es: '/ 8 canciones', vi: '/ 8 bài', th: '/ 8 เพลง', uz: "/ 8 qo\'shiq" }),
      description: t(locale, {
        ko: '정규 앨범 한 장을 기획부터 유통·홍보까지 끝까지 함께 만듭니다. 곡당 42만 5천원으로 제작 단가 합계 424만원보다 싸면서, A&R 컨설팅·트랙리스트 설계와 유통 등록·보도자료가 함께 들어갑니다. 곡수가 다르면 곡당 단가로 견적합니다.',
        en: 'A full album carried from planning through distribution and release PR. ₩425,000 per song — below the ₩4,240,000 production line-item total, with A&R consulting, tracklist sequencing, distribution and press outreach included. Different track counts are quoted at the per-song rate.',
        zh: '一张专辑从策划到发行与宣传全程陪伴。每首 ₩425,000，低于 ₩4,240,000 的制作单项合计，且包含 A&R 咨询、曲序设计、发行登记与新闻稿。曲目数不同时按每首单价报价。',
        es: 'Un álbum completo acompañado desde la planificación hasta la distribución y la prensa. ₩425.000 por canción, por debajo de la suma de producción (₩4.240.000), con consultoría A&R, secuenciación del tracklist, distribución y difusión a prensa incluidas. Otras cantidades se cotizan a la tarifa por canción.',
        vi: 'Một album đầy đủ được đồng hành từ lên kế hoạch đến phát hành và PR. ₩425.000/bài, thấp hơn tổng chi phí sản xuất ₩4.240.000, đã gồm tư vấn A&R, thiết kế thứ tự tracklist, phát hành và gửi thông cáo báo chí. Số bài khác được báo giá theo đơn giá mỗi bài.',
        th: 'ดูแลอัลบั้มเต็มตั้งแต่การวางแผนจนถึงการจัดจำหน่ายและประชาสัมพันธ์ ₩425,000 ต่อเพลง ต่ำกว่าผลรวมค่าผลิต ₩4,240,000 และรวมที่ปรึกษา A&R ออกแบบลำดับเพลง จัดจำหน่าย และส่งข่าว จำนวนเพลงอื่นคิดราคาต่อเพลง',
        uz: "To'liq albom rejalashtirishdan tarqatish va PRgacha birga olib boriladi. Har bir qo'shiq ₩425,000 — ishlab chiqarish yig'indisi ₩4,240,000 dan past, A&R konsalting, treklist ketma-ketligi, tarqatish va matbuotga yuborish ham kiradi. Boshqa qo'shiq soni har bir qo'shiq narxi bo'yicha hisoblanadi."
      }),
      features: tArray(locale, {
        ko: ['A&R 컨설팅 · 트랙리스트 시퀀스 설계', '보컬 녹음 1프로 × 8곡 (곡당 3시간, 전담 엔지니어)', '믹싱 10트랙 이하 × 8곡 (곡당 수정 2회)', '정규 마스터링 × 8곡 (앨범 톤·라우드니스 통일)', '디지털 유통 등록 (멜론·스포티파이·애플뮤직·유튜브뮤직)', '발매 홍보 — 국내 기자·평론가 + 해외 매체·라디오·플레이리스트 피칭', '개별 합계 424만원 대비 약 20% 할인', '11트랙 이상 편성은 믹싱 차액 별도'],
        en: ['A&R consulting & tracklist sequencing', 'Vocal Recording 1 Song × 8 (3h each, dedicated engineer)', 'Mixing ≤10 Tracks × 8 (2 revisions each)', 'Album Mastering × 8 (album-wide tone & loudness)', 'Digital distribution (Melon, Spotify, Apple Music, YouTube Music)', 'Release promotion — pitched to Korean journalists/critics and international media, radio & playlist curators', '~20% off the ₩4,240,000 line-item total', '11+ track arrangements billed at the mixing difference'],
        zh: ['A&R 咨询 · 曲序设计', '人声录音1首 × 8（各 3 小时，专属工程师）', '混音 ≤10轨 × 8（各含2次修改）', '专辑母带 × 8（全专辑音色·响度统一）', '数字发行登记（Melon·Spotify·Apple Music·YouTube Music）', '撰写发行新闻稿并发送给音乐记者·乐评人', '比单项合计 ₩4,240,000 便宜约 20%', '11轨以上编制按混音差额另计'],
        es: ['Consultoría A&R y secuenciación del tracklist', 'Grabación vocal 1 canción × 8 (3h cada una, ingeniero dedicado)', 'Mezcla ≤10 pistas × 8 (2 revisiones cada una)', 'Masterización de álbum × 8 (tono y loudness unificados)', 'Distribución digital (Melon, Spotify, Apple Music, YouTube Music)', 'Nota de prensa redactada y enviada a periodistas y críticos musicales', '~20% de descuento sobre ₩4.240.000', 'Arreglos de 11+ pistas se facturan por la diferencia de mezcla'],
        vi: ['Tư vấn A&R & thiết kế thứ tự tracklist', 'Thu âm vocal 1 bài × 8 (3h mỗi bài, kỹ sư chuyên trách)', 'Mixing ≤10 track × 8 (2 lần chỉnh sửa mỗi bài)', 'Mastering album × 8 (đồng nhất tone & loudness)', 'Đăng ký phát hành số (Melon, Spotify, Apple Music, YouTube Music)', 'Viết thông cáo phát hành & gửi tới nhà báo, nhà phê bình âm nhạc', 'Giảm ~20% so với tổng ₩4.240.000', 'Phối khí 11+ track tính thêm phần chênh mixing'],
        th: ['ที่ปรึกษา A&R และออกแบบลำดับเพลง', 'อัดเสียงร้อง 1 เพลง × 8 (เพลงละ 3 ชม. วิศวกรประจำ)', 'มิกซ์ ≤10 แทร็ก × 8 (แก้ไขเพลงละ 2 ครั้ง)', 'มาสเตอริ่งอัลบั้ม × 8 (โทนและความดังทั้งอัลบั้ม)', 'ลงทะเบียนจัดจำหน่ายดิจิทัล (Melon, Spotify, Apple Music, YouTube Music)', 'เขียนข่าวประชาสัมพันธ์และส่งถึงนักข่าวและนักวิจารณ์ดนตรี', 'ลด ~20% จาก ₩4,240,000', 'การเรียบเรียง 11+ แทร็ก คิดส่วนต่างค่ามิกซ์'],
        uz: ['A&R konsalting va treklist ketma-ketligi', "Vokal yozuv 1 qo\'shiq × 8 (har biri 3 soat, maxsus muhandis)", 'Miks ≤10 trek × 8 (har biriga 2 tahrir)', "Albom mastering × 8 (albom bo\'yicha ton va balandlik)", 'Raqamli tarqatish (Melon, Spotify, Apple Music, YouTube Music)', 'Chiqarish uchun press-reliz yozilib, musiqa jurnalistlari va tanqidchilariga yuboriladi', "₩4,240,000 dan ~20% chegirma", '11+ trek aranjirovka miks farqi bo\'yicha hisoblanadi']
      }),
    },
    {
      id: 'package-wedding',
      title: t(locale, { ko: '축가/이벤트 녹음 (전담 엔지니어 진행)', en: 'Event & Wedding Recording', zh: '婚礼/活动录音', es: 'Grabación de Bodas y Eventos', vi: 'Thu âm sự kiện & nhạc cưới', th: 'บันทึกเสียงงานอีเวนต์/งานแต่ง', uz: 'Tadbir/to"y yozuvi' }),
      subtitle: t(locale, { ko: '올인원, 당일 보정본 가능', en: 'All-in-one, same-day draft available', zh: '一站式, 当天可出初步修音版', es: 'Todo en uno, versión preliminar el mismo día', vi: 'Trọn gói, bản chỉnh sơ bộ trong ngày', th: 'ครบวงจร, ไฟล์ปรับเบื้องต้นภายในวัน', uz: "To'liq, shu kuni dastlabki versiya" }),
      priceDisplay: t(locale, { ko: '350,000원', en: '₩350,000', zh: '₩350,000', es: '₩350,000', vi: '₩350,000', th: '₩350,000', uz: '₩350,000' }),
      priceValue: 350000,
      unit: t(locale, { ko: '/ 1곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '결혼식 축가, 프로포즈, 기념일 음원 제작을 위한 올인원 패키지입니다.',
        en: 'All-in-one package for wedding songs, proposals, or anniversaries.',
        zh: '用于婚礼祝歌、求婚、纪念日音源制作的一站式套餐。',
        es: 'Paquete todo en uno para canciones de boda, propuestas o aniversarios.',
        vi: 'Gói trọn gói cho nhạc cưới, cầu hôn hoặc kỷ niệm.',
        th: 'แพ็กเกจครบวงจรสำหรับเพลงงานแต่ง การขอแต่งงาน หรือวันครบรอบ',
        uz: 'To"y qo"shig"i, taklif yoki yubiley uchun all-in-one paket.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['녹음 2시간 (스튜디오 사용료 포함)', '정밀 보컬 튠 및 박자 보정', '전문 믹싱 & 마스터링', '당일 보정본 수령 가능 (사전 협의 시)'],
        en: ['2h recording (studio fee included)', 'Vocal tuning & timing correction', 'Professional mixing & mastering', 'Same-day delivery available'],
        zh: ['2小时录音（含录音棚使用费）', '精准人声音准及节奏校正', '专业混音 & 母带处理', '可当日取回成品（提前协商）'],
        es: ['2 horas de grabación (tarifa de estudio incluida)', 'Afinación vocal y corrección de tempo', 'Mezcla y masterización profesional', 'Entrega en el mismo día disponible (previa consulta)'],
        vi: ['Thu âm 2 giờ (đã gồm phí studio)', 'Chỉnh giọng & chỉnh nhịp chính xác', 'Mixing & mastering chuyên nghiệp', 'Có thể nhận bản trong ngày (thỏa thuận trước)'],
        th: ['อัด 2 ชม. (รวมค่าใช้สตูดิโอ)', 'ปรับจูนเสียงร้องและแก้จังหวะอย่างละเอียด', 'มิกซ์ & มาสเตอริ่งระดับมืออาชีพ', 'รับงานภายในวันได้ (ตกลงล่วงหน้า)'],
        uz: ['2 soat yozuv (studiya to"lovi kiritilgan)', 'Aniq vokal tuning va timing tuzatish', 'Professional miks & mastering', 'Kelishuv bo"lsa, shu kuni topshirish mumkin']
      }),
    },
    {
      id: 'package-voiceover',
      title: t(locale, { ko: '성우/나레이션 녹음', en: 'Voiceover & Narration', zh: '配音/旁白录音', es: 'Locución y Narración', vi: 'Voiceover & Narration', th: 'อัดเสียงพากย์/บรรยาย', uz: 'Voiceover/Narratsiya yozuvi' }),
      subtitle: t(locale, { ko: 'U87Ai, 유튜브·광고', en: 'U87Ai, YouTube & commercials', zh: 'U87Ai, YouTube·广告', es: 'U87Ai, YouTube y comerciales', vi: 'U87Ai, YouTube & quảng cáo', th: 'U87Ai, YouTube & โฆษณา', uz: 'U87Ai, YouTube va reklama' }),
      priceDisplay: t(locale, { ko: '100,000원', en: '₩100,000', zh: '₩100,000', es: '₩100,000', vi: '₩100,000', th: '₩100,000', uz: '₩100,000' }),
      priceValue: 100000,
      unit: t(locale, { ko: '/ 시간', en: '/ hour', zh: '/ 小时', es: '/ hora', vi: '/ giờ', th: '/ ชั่วโมง', uz: '/ soat' }),
      description: t(locale, {
        ko: '유튜브 나레이션, 오디오북, 광고 녹음 등 깨끗한 목소리 수음에 최적화되어 있습니다.',
        en: 'Optimized for YouTube narration, audiobooks, and commercials.',
        zh: '针对YouTube旁白、有声读物、广告录音等清晰人声收音进行了优化。',
        es: 'Optimizado para narración en YouTube, audiolibros y comerciales.',
        vi: 'Tối ưu cho narration YouTube, audiobook và quảng cáo.',
        th: 'เหมาะสำหรับเสียงบรรยาย YouTube, หนังสือเสียง และโฆษณา',
        uz: 'YouTube narration, audiokitob va reklama yozuvi uchun optimallashtirilgan.'
      }),
      features: tArray(locale, {
        ko: ['Neumann U87AI 등 하이엔드 마이크 사용', '노이즈 제어 및 톤 보정', '실시간 편집 지원', '성우 대기실 제공'],
        en: ['High-end mics (U87AI, etc.)', 'Noise control & tone correction', 'Real-time editing support', 'Voice actor waiting room'],
        zh: ['使用Neumann U87AI等高端麦克风', '噪音控制及音色调整', '支持实时剪辑', '提供配音演员休息室'],
        es: ['Micrófonos de alta gama (U87AI, etc.)', 'Control de ruido y corrección de tono', 'Soporte de edición en tiempo real', 'Sala de espera para actores de voz'],
        vi: ['Micro cao cấp (U87AI, v.v.)', 'Khử noise & chỉnh tone', 'Hỗ trợ chỉnh sửa thời gian thực', 'Có phòng chờ cho voice actor'],
        th: ['ไมค์ไฮเอนด์ (U87AI ฯลฯ)', 'ควบคุมเสียงรบกวนและปรับโทน', 'สนับสนุนการตัดต่อแบบเรียลไทม์', 'มีห้องพักรอสำหรับนักพากย์'],
        uz: ['Yuqori darajadagi mikrofonlar (U87AI va b.)', 'Shovqinni boshqarish va ton tuzatish', 'Real vaqt tahriri qo"llovi', 'Voice actor kutish xonasi']
      }),
    },
    {
      id: 'package-cover-video',
      title: t(locale, { ko: '커버 영상 촬영 올인원 패키지', en: 'Cover Video All-in-One Package', zh: '翻唱视频一站式套餐', es: 'Paquete Todo en Uno para Video Cover', vi: 'Gói Trọn Gói Quay Video Cover', th: 'แพ็กเกจ Cover Video ครบวงจร', uz: 'Cover Video All-in-One paketi' }),
      subtitle: t(locale, { ko: '촬영+작업 3시간, 4K MP4', en: 'Filming + session 3h, 4K MP4', zh: '拍摄+制作 3小时, 4K MP4', es: 'Filmación + sesión 3h, video 4K MP4', vi: 'Quay + làm việc 3 giờ, 4K MP4', th: 'ถ่าย + งาน 3 ชม., วิดีโอ 4K MP4', uz: 'Suratga olish + ish 3 soat, 4K MP4 video' }),
      priceDisplay: t(locale, { ko: '350,000원', en: '₩350,000', zh: '₩350,000', es: '₩350,000', vi: '₩350,000', th: '₩350,000', uz: '₩350,000' }),
      priceValue: 350000,
      unit: t(locale, { ko: '/ 1곡', en: '/ song', zh: '/ 首', es: '/ canción', vi: '/ bài', th: '/ เพลง', uz: '/ qo\'shiq' }),
      description: t(locale, {
        ko: '커버 영상 촬영과 음원 작업을 한 번에 — 촬영·믹싱·편집 올인원 패키지입니다.',
        en: 'Cover video filming and audio production in one session — filming, mixing, and editing all included.',
        zh: '翻唱视频拍摄与音源制作一次完成——拍摄、混音、剪辑一站式套餐。',
        es: 'Filmación de video cover y producción de audio en una sesión — filmación, mezcla y edición incluidas.',
        vi: 'Quay video cover và sản xuất âm nhạc trong một buổi — quay phim, mix và chỉnh sửa đều được bao gồm.',
        th: 'ถ่ายวิดีโอ cover และงานเสียงในครั้งเดียว — ถ่ายทำ มิกซ์ และตัดต่อครบในแพ็กเกจเดียว',
        uz: 'Cover video suratga olish va audio ishlab chiqarish bitta seansda — suratga olish, miks va montaj kiritilgan.'
      }),
      recommended: true,
      features: tArray(locale, {
        ko: ['촬영 + 작업 3시간 기준 (1곡)', '4K 카메라 1대 촬영 + 조명 포함', '전문 믹싱 포함', '4K MP4 영상 + WAV·MP3 제공'],
        en: ['3-hour session (1 song)', '4K camera + lighting included', 'Professional mixing included', '4K MP4 video + WAV & MP3 delivered'],
        zh: ['3小时拍摄+制作基准（1首）', '含4K摄像机1台+灯光', '含专业混音', '交付4K MP4视频+WAV·MP3'],
        es: ['Sesión de 3 horas (1 canción)', 'Cámara 4K + iluminación incluida', 'Mezcla profesional incluida', 'Entrega de video 4K MP4 + WAV y MP3'],
        vi: ['Buổi 3 giờ (1 bài)', 'Camera 4K + đèn chiếu sáng', 'Mix chuyên nghiệp', 'Giao 4K MP4 + WAV & MP3'],
        th: ['เซสชัน 3 ชั่วโมง (1 เพลง)', 'กล้อง 4K 1 ตัว + แสง', 'มิกซ์มืออาชีพ', 'ส่งวิดีโอ 4K MP4 + WAV & MP3'],
        uz: ['3 soatlik seans (1 qo\'shiq)', '4K kamera (1 ta) + yoritish', 'Professional miks kiritilgan', '4K MP4 video + WAV & MP3 taqdim etiladi']
      }),
    },
    {
      id: 'package-rental',
      title: t(locale, { ko: '유튜브/방송 촬영 대관', en: 'Studio Rental for Filming', zh: 'YouTube/广播拍摄租赁', es: 'Alquiler de Estudio para Filmación', vi: 'Thuê studio quay phim', th: 'เช่าสตูดิโอถ่ายทำ', uz: 'Suratga olish uchun studiya ijarasi' }),
      subtitle: t(locale, { ko: '조명 무료, 메인 부스 사용', en: 'Free lighting, main booth access', zh: '灯光免费, 主录音棚', es: 'Iluminación gratis, cabina principal', vi: 'Đèn miễn phí, booth chính', th: 'ไฟฟรี, บูธหลัก', uz: 'Bepul yorug\'lik, asosiy booth' }),
      priceDisplay: t(locale, { ko: '100,000원', en: '₩100,000', zh: '₩100,000', es: '₩100,000', vi: '₩100,000', th: '₩100,000', uz: '₩100,000' }),
      priceValue: 100000,
      unit: t(locale, { ko: '/ 시간', en: '/ hour', zh: '/ 小时', es: '/ hora', vi: '/ giờ', th: '/ ชั่วโมง', uz: '/ soat' }),
      description: t(locale, {
        ko: '뮤직비디오, 인터뷰, 라이브 영상 촬영을 위한 스튜디오 공간 대여입니다.',
        en: 'Studio rental for music videos, interviews, or live streaming.',
        zh: '用于MV、采访、直播视频拍摄的工作室空间租赁。',
        es: 'Alquiler de estudio para videos musicales, entrevistas o transmisión en vivo.',
        vi: 'Thuê không gian studio để quay MV, phỏng vấn hoặc livestream.',
        th: 'ให้เช่าพื้นที่สตูดิโอสำหรับ MV สัมภาษณ์ หรือไลฟ์สตรีม',
        uz: 'MV, intervyu yoki jonli translatsiya uchun studiya ijarasi.'
      }),
      features: tArray(locale, {
        ko: ['메인 부스 및 컨트롤 룸 전체 사용', '촬영용 조명(지속광) 무료 대여', '오디오 인터페이스 직접 연결 지원', '대기실 및 탈의실 사용'],
        en: ['Full access to booth & control room', 'Free lighting rental', 'Audio interface connection', 'Waiting & changing rooms'],
        zh: ['主录音棚及控制室全部开放使用', '拍摄用灯光（持续光）免费租借', '支持直接连接音频接口', '提供等候室及更衣室'],
        es: ['Acceso completo a la cabina y sala de control', 'Alquiler gratuito de iluminación (luz continua)', 'Conexión directa de interfaz de audio', 'Salas de espera y vestuario disponibles'],
        vi: ['Sử dụng toàn bộ booth và phòng điều khiển', 'Miễn phí thuê đèn quay (đèn liên tục)', 'Hỗ trợ kết nối audio interface', 'Có phòng chờ và phòng thay đồ'],
        th: ['ใช้บูธหลักและห้องคอนโทรลทั้งหมด', 'ให้เช่าไฟถ่ายทำฟรี (ไฟต่อเนื่อง)', 'รองรับการเชื่อมต่อออดิโออินเทอร์เฟซ', 'มีห้องพักรอและห้องเปลี่ยนเสื้อผ้า'],
        uz: ['Asosiy booth va control room to"liq foydalanish', 'Suratga olish chiroqlari (doimiy yorug"lik) bepul', 'Audio interfeysni ulashni qo"llab-quvvatlash', 'Kutish va kiyinish xonalari']
      }),
    },
  ];

  // 연습실 입주는 '녹음/믹싱'과 다른 상품군이라 오랫동안 이 가격표에 없었는데,
  // /pricing의 <title>·h1은 "연습실 월 36만원"을 선두에 약속하고 있었다. 약속만 하고
  // 도착지에 단가가 없으면 그 유입은 되돌아간다 — 요약표·상세 카드·JSON-LD에 실는다.
  // 시설·혜택 정본은 /practice-room이며 여기는 단가와 계약 조건만 다룬다.
  const practiceRoomOffers = [
    {
      id: 'practice-room-monthly',
      title: t(locale, {
        ko: '음악연습실 월세 입주 (24시간·보증금 0원)',
        en: 'Music Practice Room Monthly Residency (24/7, no deposit)',
        zh: '音乐练习室月租入住（24小时·免押金）',
        es: 'Sala de Práctica Musical por Mes (24h, sin depósito)',
        vi: 'Thuê phòng tập nhạc theo tháng (24/7, không đặt cọc)',
        th: 'ห้องซ้อมดนตรีรายเดือน (24 ชม. ไม่มีเงินมัดจำ)',
        uz: "Musiqa mashg'ulot xonasi oylik ijara (24/7, depozitsiz)"
      }),
      subtitle: t(locale, {
        ko: 'STC 60+ 방음, 24시간·숙식 가능',
        en: 'STC 60+ soundproof, 24/7, stay overnight',
        zh: 'STC 60+ 隔音, 24小时·可食宿',
        es: 'STC 60+ insonorizado, 24/7, pernocta',
        vi: 'STC 60+ cách âm, 24/7, ở lại qua đêm',
        th: 'STC 60+ กันเสียง, 24/7, พักค้างได้',
        uz: "STC 60+ shovqin izolyatsiya, 24/7, tunab qolish"
      }),
      priceDisplay: t(locale, {
        ko: `${formatPriceAmount(PRACTICE_ROOM_MONTHLY_PRICE)}원`,
        en: `\u20a9${formatPriceAmount(PRACTICE_ROOM_MONTHLY_PRICE)}`,
      }),
      priceValue: PRACTICE_ROOM_MONTHLY_PRICE,
      unit: t(locale, { ko: '/ 월', en: '/ month', zh: '/ 月', es: '/ mes', vi: '/ tháng', th: '/ เดือน', uz: '/ oy' }),
      description: t(locale, {
        ko: '연신내·불광역 도보 5분, STC 60+ 방음 음악연습실 월 단위 입주입니다. 보증금 없이 월 정액만 냅니다.',
        en: 'Monthly residency in an STC 60+ soundproof practice room, 5 minutes from Yeonsinnae and Bulgwang stations. No deposit — just the flat monthly rate.',
        zh: '连新内·佛光站步行5分钟，STC 60+隔音音乐练习室按月入住。无押金，仅需月定额。',
        es: 'Residencia mensual en una sala de práctica con aislamiento STC 60+, a 5 minutos de las estaciones Yeonsinnae y Bulgwang. Sin depósito: solo la tarifa mensual.',
        vi: 'Thuê theo tháng phòng tập cách âm STC 60+, cách ga Yeonsinnae và Bulgwang 5 phút đi bộ. Không đặt cọc, chỉ trả phí tháng.',
        th: 'เช่ารายเดือนห้องซ้อมกันเสียง STC 60+ ห่างจากสถานียอนชินแนและพุลกวัง 5 นาที ไม่มีเงินมัดจำ จ่ายเฉพาะค่าเช่ารายเดือน',
        uz: "Yeonsinnae va Bulgwang bekatlaridan 5 daqiqa masofadagi STC 60+ shovqin izolyatsiyali mashg'ulot xonasiga oylik ijara. Depozit yo'q — faqat oylik to'lov."
      }),
      features: tArray(locale, {
        ko: ['24시간 이용 · 숙식 가능(독립 샤워실)', '보증금 0원 · 관리비 포함 · 월 단위 계약', '1년 계약 시 첫 달 50% 할인', '입주자 녹음 할인 등 8가지 부가 혜택'],
        en: ['24/7 access, stay overnight (private shower)', 'No deposit, maintenance included, month-to-month', '50% off the first month on a 1-year contract', '8 resident perks including recording discounts'],
        zh: ['24小时使用·可食宿（独立淋浴间）', '免押金·含管理费·按月签约', '签约1年首月5折', '含录音折扣等8项入住福利'],
        es: ['Acceso 24/7, se puede pernoctar (ducha privada)', 'Sin depósito, mantenimiento incluido, mes a mes', '50% de descuento el primer mes con contrato anual', '8 beneficios para residentes, incluidos descuentos de grabación'],
        vi: ['Sử dụng 24/7, có thể ở lại (phòng tắm riêng)', 'Không đặt cọc, đã gồm phí quản lý, hợp đồng theo tháng', 'Giảm 50% tháng đầu khi ký hợp đồng 1 năm', '8 ưu đãi cho cư dân, gồm giảm giá thu âm'],
        th: ['ใช้ได้ 24 ชม. พักค้างได้ (ห้องอาบน้ำส่วนตัว)', 'ไม่มีเงินมัดจำ รวมค่าส่วนกลาง สัญญารายเดือน', 'ลด 50% เดือนแรกเมื่อทำสัญญา 1 ปี', 'สิทธิพิเศษผู้เช่า 8 อย่าง รวมส่วนลดค่าอัดเสียง'],
        uz: ["24/7 foydalanish, tunab qolish mumkin (alohida dush)", "Depozitsiz, xizmat haqi kiritilgan, oylik shartnoma", "1 yillik shartnomada birinchi oy 50% chegirma", "Yozuv chegirmasi kabi 8 ta rezident imtiyozi"]
      }),
    },
  ];

  return {
    VAT_NOTICE: vatNotice,
    recordingOffers,
    mixingOffers,
    masteringOffers,
    additionalServices,
    specialPackages,
    practiceRoomOffers,
    // 통합 가격표에는 아직 카드로 렌더하지 않지만, 교차판매·스키마 참조를 위해
    // 매출 라인 가격을 데이터로 노출한다(SSOT).
    lessonMonthlyPrice: LESSON_MONTHLY_PRICE,
    practiceRoomMonthlyPrice: PRACTICE_ROOM_MONTHLY_PRICE,
  };
};
