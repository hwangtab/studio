/**
 * Naver Smart Place — Series 4 Card News Generator
 * "셀프 축가, 프로 사운드로" — 축가 패키지 짧은 시리즈 (3장)
 *   1/3 표지       — 당신의 노래로 잊지 못할 결혼식
 *   2/3 패키지     — 35만원에 다 포함됩니다
 *   3/3 CTA        — 급한 일정도 가능, 무료 상담
 *
 * Design system (same as Series 2 — charcoal/gold)
 *   - 1080x1080 / 88px outer margin / 24px vertical rhythm / 20px box radius
 *   - Title font: 부크크명조 / Body: Pretendard
 *   - Palette: charcoal base + gold accent (recording studio category consistency)
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'public/images');
const OUT = path.join(ROOT, 'naver-cards/series-4');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 1080;
const M = 88;

const F_TITLE = 'Bookk Myungjo';
const F_BODY  = 'Pretendard Variable';

const C = {
  charcoal:     '#1F1812',
  charcoalSoft: '#2B2118',
  charcoalMid:  '#3D2F22',
  beige:        '#F5EFE6',
  beigeDark:    '#EDE4D3',
  gold:         '#C9A96E',
  goldBright:   '#E5C277',
  goldDark:     '#A88748',
  white:        '#FFFFFF',
  gray:         '#9A9088',
};

function seriesIndicator(n, total = 3) {
  return `
    <g transform="translate(${SIZE - M - 64}, ${M})">
      <rect x="0" y="0" width="64" height="32" rx="16" fill="${C.gold}" opacity="0.95"/>
      <text x="32" y="22" text-anchor="middle" font-family="${F_BODY}" font-size="18" font-weight="700" fill="${C.charcoal}" letter-spacing="1">${n}/${total}</text>
    </g>`;
}

function miniLogo(fill = C.gold) {
  return `
    <g transform="translate(${M}, ${SIZE - M + 4})">
      <text x="0" y="0" font-family="${F_BODY}" font-size="20" font-weight="700" fill="${fill}" letter-spacing="3">STUDIO NOL</text>
    </g>`;
}

function eyebrowPill(x, y, text, opts = {}) {
  const padX = 22;
  const fontSize = 20;
  const w = text.length * (fontSize * 0.95) + padX * 2;
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${w}" height="40" rx="20" fill="${opts.bg || C.gold}"/>
      <text x="${w / 2}" y="28" text-anchor="middle" font-family="${F_BODY}" font-size="${fontSize}" font-weight="700" fill="${opts.fg || C.charcoal}" letter-spacing="2">${text}</text>
    </g>`;
}

function serifTitle(x, y, text, size, color, opts = {}) {
  const stroke = opts.stroke !== undefined ? opts.stroke : 0.9;
  const ls = opts.letterSpacing !== undefined ? opts.letterSpacing : -2;
  const anchor = opts.anchor || 'start';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${F_TITLE}" font-size="${size}" fill="${color}" stroke="${color}" stroke-width="${stroke}" paint-order="stroke fill" letter-spacing="${ls}">${text}</text>`;
}

function accentLine(x, y, length, opts = {}) {
  return `<line x1="${x}" y1="${y}" x2="${x + length}" y2="${y}" stroke="${opts.color || C.gold}" stroke-width="${opts.width || 2}" opacity="${opts.opacity || 1}"/>`;
}

// =====================================================================
// CARD 1/3 — COVER "당신의 노래로 잊지 못할 결혼식"
// =====================================================================
async function card1() {
  const bg = await sharp(path.join(IMG, 'recording5.webp'))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.55, saturation: 0.85 })
    .toBuffer();

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.charcoal}" stop-opacity="0.25"/>
          <stop offset="55%" stop-color="${C.charcoal}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="${C.charcoal}" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#veil)"/>

      ${seriesIndicator(1)}

      ${eyebrowPill(M, 540, '셀프 축가 패키지 35만원')}

      ${serifTitle(M, 668, '당신의 노래로', 92, C.beige, { stroke: 0.9 })}
      <text x="${M}" y="780" font-family="${F_TITLE}" font-size="116" fill="${C.beige}" stroke="${C.beige}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-3">
        잊지 못할 <tspan fill="${C.goldBright}" stroke="${C.goldBright}">결혼식</tspan>
      </text>

      ${accentLine(M, 818, 96)}

      <text x="${M}" y="872" font-family="${F_BODY}" font-size="26" font-weight="600" fill="${C.beigeDark}" letter-spacing="2">신랑·신부 본인이 부르는 축가</text>
      <text x="${M}" y="906" font-family="${F_BODY}" font-size="26" font-weight="600" fill="${C.beigeDark}" letter-spacing="2">프로 사운드로 완성해드립니다</text>

      <text x="${M}" y="${SIZE - M + 4}" font-family="${F_BODY}" font-size="20" font-weight="700" fill="${C.gold}" letter-spacing="3">STUDIO NOL</text>
      <text x="${SIZE - M}" y="${SIZE - M + 4}" text-anchor="end" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}" letter-spacing="1">연신내역 도보 5분</text>
    </svg>`;

  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '01-cover.jpg'));
  console.log('✓ 1/3 표지 → series-4/01-cover.jpg');
}

// =====================================================================
// CARD 2/3 — PACKAGE CONTENTS
// =====================================================================
async function card2() {
  const photoW = 460;
  const photoRight = await sharp(path.join(IMG, 'hardware3.jpg'))
    .resize(photoW, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.92, saturation: 0.95 })
    .toBuffer();

  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.charcoal },
  })
    .composite([{ input: photoRight, top: 0, left: SIZE - photoW }])
    .jpeg()
    .toBuffer();

  const textRight = SIZE - photoW - 32;

  const item = (yy, no, label, sub) => `
    <g transform="translate(${M}, ${yy})">
      <rect x="0" y="0" width="32" height="32" rx="16" fill="${C.gold}"/>
      <text x="16" y="22" text-anchor="middle" font-family="${F_BODY}" font-size="18" font-weight="900" fill="${C.charcoal}">${no}</text>
      <text x="48" y="24" font-family="${F_BODY}" font-size="22" font-weight="700" fill="${C.beige}">${label}</text>
      <text x="48" y="54" font-family="${F_BODY}" font-size="18" font-weight="500" fill="${C.beigeDark}" opacity="0.85">${sub}</text>
    </g>`;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(2)}

      ${eyebrowPill(M, M + 16, '축가 패키지 35만원')}

      ${serifTitle(M, M + 200, '이 가격에', 92, C.beige, { stroke: 0.9 })}
      <text x="${M}" y="${M + 308}" font-family="${F_TITLE}" font-size="100" fill="${C.beige}" stroke="${C.beige}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-3">
        <tspan fill="${C.goldBright}" stroke="${C.goldBright}">다 포함</tspan>됩니다
      </text>

      ${accentLine(M, M + 344, 80)}

      <text x="${M}" y="${M + 396}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.beigeDark}">셀프 축가 1곡 완성, 4가지 풀패키지</text>

      ${item(M + 472, 1, '2시간 녹음', 'Neumann U87AI 시그니처 마이크')}
      ${item(M + 552, 2, '보컬 튠·에딧', '음정·박자 정밀 보정')}
      ${item(M + 632, 3, '믹싱·마스터링', '아날로그 하이브리드 작업')}
      ${item(M + 712, 4, 'WAV/MP3 완성본', '결혼식 당일 바로 사용')}

      <text x="${M}" y="${SIZE - M - 52}" font-family="${F_BODY}" font-size="20" font-weight="600" fill="${C.gold}">시간당 환산 약 87,500원 · 음반 작업 1/3 가격</text>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '02-package.jpg'));
  console.log('✓ 2/3 패키지 → series-4/02-package.jpg');
}

// =====================================================================
// CARD 3/3 — CTA
// =====================================================================
async function card3() {
  const bg = await sharp(path.join(IMG, 'recording15.webp'))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.42, saturation: 0.7 })
    .toBuffer();

  const boxX = M;
  const boxW = SIZE - M * 2;
  const boxY = 216;
  const boxH = 656;

  const step = (yy, no, label) => `
    <g transform="translate(${boxW / 2 - 200}, ${yy})">
      <circle cx="20" cy="20" r="20" fill="${C.gold}"/>
      <text x="20" y="28" text-anchor="middle" font-family="${F_BODY}" font-size="18" font-weight="900" fill="${C.charcoal}">${no}</text>
      <text x="56" y="28" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.beige}">${label}</text>
    </g>`;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${C.charcoal}" opacity="0.3"/>

      ${seriesIndicator(3)}

      <g transform="translate(${boxX}, ${boxY})">
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="${C.charcoal}" opacity="0.92"/>
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="none" stroke="${C.gold}" stroke-width="1.5"/>

        <text x="${boxW / 2}" y="92" text-anchor="middle" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.beigeDark}" letter-spacing="3">D-Day 임박해도 OK</text>

        <text x="${boxW / 2}" y="216" text-anchor="middle" font-family="${F_TITLE}" font-size="92" fill="${C.beige}" stroke="${C.beige}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-3">3단계로 끝나는</text>
        <text x="${boxW / 2}" y="312" text-anchor="middle" font-family="${F_TITLE}" font-size="92" fill="${C.goldBright}" stroke="${C.goldBright}" stroke-width="1.1" paint-order="stroke fill" letter-spacing="-3">셀프 축가 작업</text>

        <line x1="${boxW / 2 - 100}" y1="358" x2="${boxW / 2 + 100}" y2="358" stroke="${C.gold}" stroke-width="1" opacity="0.5"/>

        ${step(388, 1, '곡 결정 + 무료 상담')}
        ${step(444, 2, '스튜디오에서 2시간 녹음')}
        ${step(500, 3, '후반작업 + 완성본 전달')}

        <text x="${boxW / 2}" y="608" text-anchor="middle" font-family="${F_BODY}" font-size="26" font-weight="700" fill="${C.white}">아래 ↓ 톡톡 또는 전화로 무료 상담</text>
      </g>

      <text x="${SIZE / 2}" y="${SIZE - M - 28}" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.gold}" letter-spacing="3">스튜디오 놀 · 연신내역 도보 5분</text>
    </svg>`;

  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '03-cta.jpg'));
  console.log('✓ 3/3 CTA → series-4/03-cta.jpg');
}

(async () => {
  console.log('▶ Generating Series 4 cards (1080×1080, 셀프 축가)...\n');
  await card1();
  await card2();
  await card3();
  console.log('\n✅ All 3 cards saved to:', OUT);
})();
