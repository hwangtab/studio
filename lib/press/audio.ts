/**
 * 감상실 음원의 **만료되는 재생 주소**를 만든다.
 *
 * 음원은 Vercel Blob에 private으로 있다(scripts/press/build-sabbaha-slung.mjs). 서명 없는 주소는
 * 403이고, 여기서 곡마다 읽기 전용 위임 토큰을 받아 그 경로 하나에만 듣는 주소를 만든다 —
 * 저장소 전체(`*`) 토큰을 쓰지 않는 것은 이 저장소에 계약서 PDF가 함께 있어서다.
 *
 * 주소는 브라우저가 Range 요청으로 직접 받는다(함수를 거치지 않으므로 4.5MB 응답 한도와 무관).
 * Blob은 `access-control-allow-origin: *`를 주므로 `crossOrigin="anonymous"`로 받으면 스펙트럼
 * 분석기(AnalyserNode)도 동작한다. 페이지 CSP의 media-src에 저장소 호스트가 열려 있어야 한다(middleware.ts).
 */
import { issueSignedToken, presignUrl } from '@vercel/blob';

/** 앨범 하나(98분)를 두 번 듣고도 남는 시간. 만료되면 플레이어가 새 주소를 받아 같은 위치에서 잇는다. */
export const PRESS_AUDIO_TTL_MS = 6 * 60 * 60 * 1000;
/** 캐시한 토큰을 이만큼 남았을 때 새로 받는다 — 막 만료될 주소를 내주지 않게. */
const REFRESH_MARGIN_MS = 2 * 60 * 60 * 1000;

const tokenCache = new Map<string, { delegationToken: string; clientSigningToken: string; validUntil: number }>();

const signedTokenFor = async (pathname: string, now: number) => {
  const cached = tokenCache.get(pathname);
  if (cached && cached.validUntil - now > REFRESH_MARGIN_MS) return cached;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil: now + PRESS_AUDIO_TTL_MS });
  tokenCache.set(pathname, token);
  return token;
};

export const presignPressAudio = async (pathnames: readonly string[], now = Date.now()) => {
  const urls = await Promise.all(
    pathnames.map(async (pathname) => {
      const token = await signedTokenFor(pathname, now);
      const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private' });
      return { url: presignedUrl, validUntil: token.validUntil };
    }),
  );
  return { urls: urls.map((u) => u.url), validUntil: Math.min(...urls.map((u) => u.validUntil)) };
};
