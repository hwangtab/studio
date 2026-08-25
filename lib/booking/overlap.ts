/**
 * 순수 함수만 — service.ts(DB·node:crypto 의존)에서 분리했다. slots.ts가 이 함수를
 * service.ts에서 가져오면, validation.ts → slots.ts → service.ts 체인을 타고
 * 클라이언트 번들(BookingWizard 등)까지 서버 전용 모듈(db/client, node:crypto)이
 * 끌려 들어가 webpack이 "node:crypto is not handled by plugins"로 빌드 실패한다.
 */
export const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && bStart < aEnd;
