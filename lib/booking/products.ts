import {
  COVER_VIDEO_PACKAGE_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

export type BookingService = 'recording' | 'voice-acting' | 'wedding-song' | 'cover-video';

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
