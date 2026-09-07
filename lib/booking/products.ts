import {
  COVER_VIDEO_PACKAGE_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

/**
 * 'smoke-test'는 고객 상품이 아니라 운영자용 실결제 연동 검증 픽스처다.
 * 라우트는 /ko/booking/smoke-test 하나뿐이고, 서비스 4페이지의 CTA·productsForService에는
 * 절대 섞이지 않는다(amounts.test.ts가 고정). 검증 후 셀프 취소로 전액 환불하면 된다.
 */
export type BookingService = 'recording' | 'voice-acting' | 'wedding-song' | 'cover-video' | 'smoke-test';

export interface SessionProduct {
  id: string;
  service: BookingService;
  nameKo: string;
  kind: 'package' | 'hourly';
  /** 패키지: 상품 전체가, 시간제: 시간당가. 전부 VAT 별도 — data/pricing.ts SSOT. */
  unitAmount: number;
  sessionHours?: number;
  minHours?: number;
  maxHours?: number;
}

export const SESSION_PRODUCTS: readonly SessionProduct[] = [
  { id: 'recording-pro', service: 'recording', nameKo: '보컬 녹음 1프로', kind: 'package', unitAmount: VOCAL_PACKAGE_PRICE, sessionHours: 3 },
  { id: 'recording-hourly', service: 'recording', nameKo: '시간당 레코딩', kind: 'hourly', unitAmount: RECORDING_HOURLY_PRICE, minHours: 2, maxHours: 8 },
  { id: 'voice-acting-hourly', service: 'voice-acting', nameKo: '성우 녹음', kind: 'hourly', unitAmount: VOICEOVER_HOURLY_PRICE, minHours: 2, maxHours: 8 },
  { id: 'wedding-song', service: 'wedding-song', nameKo: '축가 녹음 패키지', kind: 'package', unitAmount: WEDDING_PACKAGE_PRICE, sessionHours: 2 },
  { id: 'cover-video', service: 'cover-video', nameKo: '커버 영상 패키지', kind: 'package', unitAmount: COVER_VIDEO_PACKAGE_PRICE, sessionHours: 3 },
  // 운영자 실결제 검증용 — 100원(+VAT 10원 = 110원 결제). 가격 SSOT 대상 상품이 아니다.
  { id: 'smoke-test', service: 'smoke-test', nameKo: '결제 연동 테스트 (운영자용)', kind: 'package', unitAmount: 100, sessionHours: 1 },
] as const;

export const getProduct = (id: string): SessionProduct | undefined =>
  SESSION_PRODUCTS.find((p) => p.id === id);

export const productsForService = (service: string): SessionProduct[] =>
  SESSION_PRODUCTS.filter((p) => p.service === service);

/** 유효하지 않은 시간 요청은 null — 호출부가 400으로 바꾼다. */
export const resolveHours = (product: SessionProduct, requested?: number): number | null => {
  if (product.kind === 'package') return product.sessionHours ?? null;
  if (typeof requested !== 'number' || !Number.isInteger(requested)) return null;
  if (requested < (product.minHours ?? 1) || requested > (product.maxHours ?? 12)) return null;
  return requested;
};
