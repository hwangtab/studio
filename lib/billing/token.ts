/**
 * 구독 토큰은 예약과 같은 물건이다 — 계정 없는 고객이 링크만으로 자기 건을 여는 수단.
 * 별도 구현을 두면 timing-safe 비교나 orderNo의 KST 규칙 같은 사고 이력이 한쪽에만
 * 반영된다. 그대로 재export하고, 여기서만 필요한 규칙은 아래에 덧붙인다.
 */
export { generateManageToken, generateOrderNo, isTokenMatch } from '../booking/token';

import { randomBytes, randomUUID } from 'node:crypto';

/** 카드 등록 링크 토큰. 만료·1회성은 service.ts가 관리한다. */
export const generateSetupToken = (): string => randomBytes(24).toString('base64url');

/** 토스 customerKey — 예측 불가해야 한다는 규격이라 구독 id가 아닌 별도 난수를 쓴다. */
export const generateCustomerKey = (): string => `sub_${randomUUID().replace(/-/g, '')}`;

/** 카드 등록 링크 유효기간 7일 (스펙 §9). */
export const SETUP_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
