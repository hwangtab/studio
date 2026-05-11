import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';

export const config = { runtime: 'edge' };

const WIDTH = 1200;
const HEIGHT = 630;

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
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
    const fontRes = await fetch(`${origin}/fonts/Pretendard-Bold.otf`);
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
