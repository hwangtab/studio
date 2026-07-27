import crypto from 'crypto';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';

/** 서명 URL에 실리는 인증 토큰. 재발송 시 새로 발급해 이전 링크를 무효화한다. */
export const generateSignToken = (): string => crypto.randomBytes(32).toString('hex');

export const buildSignUrl = (contractId: string, signToken: string, locale = 'ko'): string =>
  `${SITE_URL}/${locale}/contracts/${contractId}/sign?token=${signToken}`;
