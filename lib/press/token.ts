/**
 * 보도자료 수신거부 토큰의 검증.
 *
 * 발급은 music-promo(운영자 맥)가 하고 여기서는 읽기만 한다. 서명 함수를 두지
 * 않는 것은 의도다 — 이쪽이 토큰을 만들 이유가 없고, 만들 수 있는 코드가 있으면
 * 언젠가 쓰인다.
 *
 * 형식이 어긋나면 "발송은 되는데 수신거부 링크가 전부 죽은" 상태가 되고 그건
 * 기자가 눌러 봐야 드러난다. tests/press/press-token-vectors.json이 그걸 막는다.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type PressUnsubPayload = {
  v: 1;
  /** sha256(주소 + 솔트)의 앞 32자. 솔트는 운영자 맥에만 있어 이쪽은 주소를 모른다. */
  h: string;
  c: string;
  l: string;
  t: number;
};

export const verifyPressToken = (token: string, secret: string): PressUnsubPayload | null => {
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (given.includes('.')) return null;

  // 길이 차이가 실행 시간에 드러나지 않게 고정 길이화 후 비교 (lib/booking/token.ts와 동일).
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  if (!timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PressUnsubPayload;
    if (parsed?.v !== 1) return null;
    if (typeof parsed.h !== 'string' || !/^[0-9a-f]{32}$/.test(parsed.h)) return null;
    if (typeof parsed.c !== 'string' || !parsed.c) return null;
    if (typeof parsed.l !== 'string' || !parsed.l) return null;
    if (typeof parsed.t !== 'number' || !Number.isFinite(parsed.t)) return null;
    return { v: 1, h: parsed.h, c: parsed.c, l: parsed.l, t: parsed.t };
  } catch {
    return null;
  }
};
