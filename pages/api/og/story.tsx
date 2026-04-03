import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';

export const config = { runtime: 'edge' };

const WIDTH = 1200;
const HEIGHT = 630;

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title') || 'Studio NOL';
    const category = searchParams.get('category') || '';
    const date = searchParams.get('date') || '';

    const metaParts = [category, date].filter(Boolean).join('  ·  ');

    // Noto Sans KR 폰트 — Google Fonts에서 직접 fetch (CJK 포함)
    const fontRes = await fetch(
      'https://fonts.gstatic.com/s/notosanskr/v36/PbykFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLTq8H4hfeE.woff2'
    );
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
            fontFamily: '"Noto Sans KR"',
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
            studionol.co.kr
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
          {
            name: 'Noto Sans KR',
            data: fontData,
            style: 'normal',
            weight: 400,
          },
        ],
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
