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
    const fontController = new AbortController();
    const fontTimeout = setTimeout(() => fontController.abort(), 5000);
    const fontRes = await fetch(`${origin}/fonts/Pretendard-Bold.otf`, {
      signal: fontController.signal,
    });
    clearTimeout(fontTimeout);
    if (!fontRes.ok) throw new Error(`Font fetch failed: HTTP ${fontRes.status}`);
    const fontData = await fontRes.arrayBuffer();

    return new ImageResponse(
      (
        <div
          style={{
            width: WIDTH,
            height: HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            fontFamily: '"Pretendard"',
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
      headers: { Location: '/images/og-default.webp' },
    });
  }
}
