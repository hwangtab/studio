import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { getRedisRestConfig, incrWithExpire } from '../../../lib/rate-limit/redisRest';

export const config = { runtime: 'edge' };

const WIDTH = 1200;
const HEIGHT = 630;
const OG_RATE_LIMIT = 10;
const OG_RATE_WINDOW = 60; // seconds

// slug 형식 검증 — 알파벳·숫자·하이픈·한글만 허용 (임의 파라미터 DoS 방지)
const VALID_SLUG_RE = /^[\wㄱ-힝-]{1,120}$/;

// 폰트는 배포마다 고정된 정적 파일인데도 예전에는 요청마다 자기 origin으로 다시 받아왔다.
// edge isolate는 인접 요청 사이에 재사용되므로, 한 번 받은 버퍼를 모듈 스코프에 남겨 두면
// CDN 캐시 미스 경로에서 왕복(최대 5초 타임아웃 × 2회)이 통째로 사라진다.
// 실패한 시도는 캐시하지 않는다 — 일시 장애가 isolate 수명 내내 굳으면 OG 생성이
// 계속 기본 이미지로 빠지기 때문에, reject된 promise는 지워 다음 요청이 다시 시도한다.
const fontCache = new Map<string, Promise<ArrayBuffer>>();

function fetchFont(origin: string, assetPath: string): Promise<ArrayBuffer> {
  const url = `${origin}${assetPath}`;
  const cached = fontCache.get(url);
  if (cached) return cached;

  const pending = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Font fetch failed: HTTP ${res.status} (${assetPath})`);
      return await res.arrayBuffer();
    } finally {
      clearTimeout(timeout);
    }
  })();

  fontCache.set(url, pending);
  pending.catch(() => {
    if (fontCache.get(url) === pending) fontCache.delete(url);
  });
  return pending;
}

async function checkOgRateLimit(ip: string): Promise<boolean> {
  const redisConfig = getRedisRestConfig();
  if (!redisConfig) return true;

  // OG 이미지는 SNS 크롤러용 부가 기능이라 rate limit은 best-effort로만 적용한다.
  // Redis REST 미설정/장애가 OG 생성 자체를 막지 않도록 fail-open 유지.
  try {
    const key = `og:rl:${ip}`;
    const count = await incrWithExpire({ key, windowSeconds: OG_RATE_WINDOW, config: redisConfig });
    return count <= OG_RATE_LIMIT;
  } catch {
    return true;
  }
}

export default async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  }

  // x-vercel-forwarded-for는 Vercel 프록시가 설정해 클라이언트가 위조할 수 없다.
  // 클라이언트가 임의로 붙일 수 있는 x-forwarded-for보다 우선해 rate-limit 키 스푸핑을 줄인다.
  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const allowed = await checkOgRateLimit(ip);
  if (!allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(OG_RATE_WINDOW) },
    });
  }
  try {
    const { searchParams } = new URL(req.url);

    // slug가 있으면 포맷 검증 후 거부 (없으면 통과 — 마케팅 OG 재사용 허용)
    const slug = searchParams.get('slug');
    if (slug && !VALID_SLUG_RE.test(slug)) {
      return new Response(null, { status: 400 });
    }

    const title = (searchParams.get('title') || 'Studio NOL').substring(0, 100);
    const category = (searchParams.get('category') || '').substring(0, 40);
    const date = (searchParams.get('date') || '').substring(0, 20);
    // locale 파라미터 — SNS 플랫폼이 언어별로 별도 OG 이미지를 캐시하도록 URL 구분
    const _locale = searchParams.get('locale') || 'ko';
    void _locale; // 현재는 URL 분리 목적, 향후 로케일별 렌더링 확장 가능
    const domain = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/^https?:\/\//, '');

    const metaParts = [category, date].filter(Boolean).join('  ·  ');

    // 자체 도메인의 Pretendard-Bold.otf(한글 지원)를 OG 이미지 생성에 사용.
    // @vercel/og 내부 satori는 OpenType(OTF/TTF)만 지원하고 woff2 시그니처를 거부
    // ('Unsupported OpenType signature wOF2'). 사이트 본문은 next/font/local의 Pretendard
    // Variable woff2로 통일됐지만 OG는 별도 OTF가 필요하므로 public/fonts/에 self-host.
    // next/font 빌드 산출물(_next/static/media)은 edge runtime에서 접근 불가, 외부 폰트
    // 서버 의존 시 장애로 OG 생성 실패 → SNS 크롤러 메타 전달 깨짐 위험이라 자체 호스팅.
    const origin = new URL(req.url).origin;
    const fontData = await fetchFont(origin, '/fonts/Pretendard-Bold.otf');

    // 태국어(U+0E00–0E7F) 폴백 — Pretendard는 태국 문자를 사실상 커버하지 않아
    // th 로케일 스토리 제목이 satori 렌더에 실패하면 catch에서 og-default로 빠졌다.
    // Noto Sans Thai Bold(OFL)를 같은 방식(public/fonts self-host)으로 추가 등록한다.
    // satori는 등록된 폰트 중 글리프를 커버하는 쪽을 자동 선택하므로 Pretendard를
    // 대체하지 않고 배열에 추가만 한다. 폴백 폰트 자체 조달 실패는 견제 대상 —
    // 못 받아도 Pretendard만으로 기존 동작(한글/라틴)은 유지되게 한다.
    let thaiFontData: ArrayBuffer | null = null;
    try {
      thaiFontData = await fetchFont(origin, '/fonts/NotoSansThai-Bold.ttf');
    } catch (thaiFontError) {
      console.error('Thai fallback font fetch failed (continuing without it):', thaiFontError);
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: WIDTH,
            height: HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            fontFamily: '"Pretendard", "Noto Sans Thai"',
            position: 'relative',
          }}
        >
          {/* 하단 accent 바 */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: WIDTH,
              height: 6,
              background: 'linear-gradient(90deg, #e94560, #ff6b6b)',
            }}
          />

          {/* 데코 원형 */}
          <div
            style={{
              position: 'absolute',
              top: 40,
              right: 100,
              width: 160,
              height: 160,
              borderRadius: '50%',
              border: '2px solid rgba(233,69,96,0.15)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 50,
              width: 240,
              height: 240,
              borderRadius: '50%',
              border: '2px solid rgba(233,69,96,0.08)',
            }}
          />

          {/* 로고 / 사이트명 */}
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: 80,
              color: 'white',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Studio NOL
          </div>

          {/* accent 바 */}
          <div
            style={{
              position: 'absolute',
              top: 230,
              left: 80,
              width: 60,
              height: 4,
              background: 'linear-gradient(90deg, #e94560, #ff6b6b)',
              borderRadius: 2,
            }}
          />

          {/* 제목 */}
          <div
            style={{
              position: 'absolute',
              top: 254,
              left: 80,
              right: 80,
              color: 'white',
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>

          {/* 카테고리 · 날짜 */}
          {metaParts && (
            <div
              style={{
                position: 'absolute',
                bottom: 50,
                left: 80,
                color: '#a0a0b0',
                fontSize: 22,
              }}
            >
              {metaParts}
            </div>
          )}

          {/* 도메인 */}
          <div
            style={{
              position: 'absolute',
              bottom: 28,
              right: 80,
              color: '#606070',
              fontSize: 16,
            }}
          >
            {domain}
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
          {
            name: 'Pretendard',
            data: fontData,
            style: 'normal',
            weight: 700,
          },
          ...(thaiFontData
            ? [
                {
                  name: 'Noto Sans Thai',
                  data: thaiFontData,
                  style: 'normal' as const,
                  weight: 700 as const,
                },
              ]
            : []),
        ],
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/images/og-default.webp',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
