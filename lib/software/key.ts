import { randomBytes } from 'crypto';

/**
 * 라이선스 키 `NOL-XXXXX-XXXXX-XXXXX-XXXXX` — Crockford base32(0·1과 헷갈리는 I·L·O, 그리고 U를 뺀 32자).
 * 20자 × 5비트 = 100비트라 추측으로 맞힐 수 없다. 활성화 API의 레이트리밋은 그 위의 두 번째 벽이다.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 4;
const GROUP_LEN = 5;
const PREFIX = 'NOL';

export const generateLicenseKey = (): string => {
  const bytes = randomBytes(GROUPS * GROUP_LEN);
  // 바이트 하나(0~255)를 32로 나눈 나머지 — 256이 32의 배수라 치우침이 없다.
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]);
  const groups = Array.from({ length: GROUPS }, (_, i) => chars.slice(i * GROUP_LEN, (i + 1) * GROUP_LEN).join(''));
  return [PREFIX, ...groups].join('-');
};

/**
 * 고객이 친 키를 저장 형태로. 대소문자·하이픈·공백을 무시하고, Crockford 규칙대로 O→0, I·L→1로 읽는다.
 * 형식이 아니면 null — 호출부는 "없는 키"와 같은 응답을 준다.
 */
export const normalizeLicenseKey = (input: unknown): string | null => {
  if (typeof input !== 'string' || input.length > 64) return null;
  let s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== GROUPS * GROUP_LEN || [...s].some((c) => !ALPHABET.includes(c))) return null;
  const groups = Array.from({ length: GROUPS }, (_, i) => s.slice(i * GROUP_LEN, (i + 1) * GROUP_LEN));
  return [PREFIX, ...groups].join('-');
};

/** 화면·서명 파일에 싣는 키 끝부분(마지막 묶음). */
export const licenseKeyHint = (key: string): string => key.slice(-GROUP_LEN);
