import {
  COVER_VIDEO_PACKAGE_PRICE,
  DAY_LOCK_4H_HOURS,
  DAY_LOCK_4H_PRICE,
  DAY_LOCK_8H_HOURS,
  DAY_LOCK_8H_PRICE,
  PRACTICE_ROOM_HOURLY_PRICE_INCL,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';
import { splitInclusiveAmount } from './amounts';

/**
 * 'smoke-test'는 고객 상품이 아니라 운영자용 실결제 연동 검증 픽스처다.
 * 라우트는 /ko/booking/smoke-test 하나뿐이고, 서비스 4페이지의 CTA·productsForService에는
 * 절대 섞이지 않는다(amounts.test.ts가 고정). 검증 후 셀프 취소로 전액 환불하면 된다.
 */
export type BookingService =
  | 'recording' | 'voice-acting' | 'wedding-song' | 'cover-video' | 'practice-room' | 'smoke-test';

/** 스튜디오 기본 영업시간. 상품이 따로 정하지 않으면 이 값이다(slots.ts와 짝). */
export const DEFAULT_OPEN_HOUR = 10;
export const DEFAULT_CLOSE_HOUR = 22;

/**
 * 예약 상품이 점유하는 **자원**. 겹침 검사는 같은 자원끼리만 한다.
 *
 * - `studio` — 녹음실 하나. 녹음·성우·축가·커버영상이 전부 이걸 나눠 쓴다. 구글 캘린더
 *   (BOOKING_GCAL_ID)의 바쁨도 이 자원의 바쁨이다.
 * - `rooms` — 연습실 개별 방. 방마다 따로 점유한다. 캘린더는 연습실 전용
 *   (PRACTICE_ROOM_GCAL_ID)이고 그 바쁨은 방 전체에 걸린다. 스튜디오 캘린더와는 무관하다 —
 *   연습실 예약을 스튜디오 캘린더에 올리면 녹음 슬롯 조회(freeBusy)가 그걸 바쁨으로 읽어
 *   녹음 예약을 막는다. 두 자원 모두 자기 캘린더를 읽고 자기 캘린더에 쓴다(같은 기준).
 */
export type ResourceKind = 'studio' | 'rooms';

export interface SessionProduct {
  id: string;
  service: BookingService;
  nameKo: string;
  kind: 'package' | 'hourly';
  /** 패키지: 상품 전체가, 시간제: 시간당가. **공급가(VAT 별도)** — data/pricing.ts SSOT. */
  unitAmount: number;
  sessionHours?: number;
  minHours?: number;
  maxHours?: number;
  /** 예약 가능한 시작 시각 범위 [openHour, closeHour). 생략 시 스튜디오 영업시간. */
  openHour?: number;
  closeHour?: number;
  /**
   * 방 자원 상품이면 후보 방 목록. 순서대로 비어 있는 첫 방에 배정된다.
   * 비어 있거나 없으면 studio 자원이다.
   */
  rooms?: readonly string[];
}

/**
 * 시간제 연습실이 열리는 방. **현재 R02 하나.** R05를 더 열 때는 여기에 추가하면 된다
 * (2026-09-24 운영자: "R02가 현재 고정이고 추후 R05도 추가할 수 있음").
 * 월세 입주가 잡힌 방은 여기서 빼거나, 관리자 화면에서 그 방에 기간 블록을 건다.
 */
export const PRACTICE_ROOM_HOURLY_ROOMS = ['R02'] as const;

export const SESSION_PRODUCTS: readonly SessionProduct[] = [
  { id: 'recording-pro', service: 'recording', nameKo: '보컬 녹음 1프로', kind: 'package', unitAmount: VOCAL_PACKAGE_PRICE, sessionHours: 3 },
  { id: 'recording-hourly', service: 'recording', nameKo: '시간당 레코딩', kind: 'hourly', unitAmount: RECORDING_HOURLY_PRICE, minHours: 2, maxHours: 8 },
  // Day Lock — 긴 녹음을 묶은 고정 시간 패키지(2026-09-26 재편). 환불 규정은 service가 recording이라 녹음과 같다.
  { id: 'recording-daylock-4h', service: 'recording', nameKo: 'Day Lock 4시간', kind: 'package', unitAmount: DAY_LOCK_4H_PRICE, sessionHours: DAY_LOCK_4H_HOURS },
  { id: 'recording-daylock-8h', service: 'recording', nameKo: 'Day Lock 8시간', kind: 'package', unitAmount: DAY_LOCK_8H_PRICE, sessionHours: DAY_LOCK_8H_HOURS },
  { id: 'voice-acting-hourly', service: 'voice-acting', nameKo: '성우 녹음', kind: 'hourly', unitAmount: VOICEOVER_HOURLY_PRICE, minHours: 2, maxHours: 8 },
  { id: 'wedding-song', service: 'wedding-song', nameKo: '축가 녹음 패키지', kind: 'package', unitAmount: WEDDING_PACKAGE_PRICE, sessionHours: 2 },
  { id: 'cover-video', service: 'cover-video', nameKo: '커버 영상 패키지', kind: 'package', unitAmount: COVER_VIDEO_PACKAGE_PRICE, sessionHours: 3 },
  /**
   * 음악연습실 시간제 — 24시간, 1시간부터, 무인 셀프 이용. 소비자가는 VAT 포함 4,400원이라
   * 공급가는 splitInclusiveAmount로 갈라 4,000원(+400 VAT = 4,400 결제). 방 자원이라
   * 스튜디오 캘린더와 무관하고, 확정 메일에 입장 안내(문·방·와이파이 비밀번호)가 실린다.
   */
  {
    id: 'practice-room-hourly', service: 'practice-room', nameKo: '음악연습실 시간제', kind: 'hourly',
    unitAmount: splitInclusiveAmount(PRACTICE_ROOM_HOURLY_PRICE_INCL).itemAmount,
    minHours: 1, maxHours: 8, openHour: 0, closeHour: 24, rooms: PRACTICE_ROOM_HOURLY_ROOMS,
  },
  // 운영자 실결제 검증용 — 200원(+VAT 20원 = 220원 결제). 토스 계좌이체 최소 결제금액이 200원이라 그 위로 잡는다. 가격 SSOT 대상 상품이 아니다.
  { id: 'smoke-test', service: 'smoke-test', nameKo: '결제 연동 테스트 (운영자용)', kind: 'package', unitAmount: 200, sessionHours: 1 },
] as const;

export const getProduct = (id: string): SessionProduct | undefined =>
  SESSION_PRODUCTS.find((p) => p.id === id);

export const productsForService = (service: string): SessionProduct[] =>
  SESSION_PRODUCTS.filter((p) => p.service === service);

/** 상품이 예약을 받는 시각 범위. 없으면 스튜디오 영업시간. */
export const productHours = (product: SessionProduct): { openHour: number; closeHour: number } => ({
  openHour: product.openHour ?? DEFAULT_OPEN_HOUR,
  closeHour: product.closeHour ?? DEFAULT_CLOSE_HOUR,
});

export const resourceKindOf = (product: SessionProduct): ResourceKind =>
  product.rooms && product.rooms.length > 0 ? 'rooms' : 'studio';

/** 유효하지 않은 시간 요청은 null — 호출부가 400으로 바꾼다. */
export const resolveHours = (product: SessionProduct, requested?: number): number | null => {
  if (product.kind === 'package') return product.sessionHours ?? null;
  if (typeof requested !== 'number' || !Number.isInteger(requested)) return null;
  if (requested < (product.minHours ?? 1) || requested > (product.maxHours ?? 12)) return null;
  return requested;
};
