/**
 * Naver Smart Place — Series 2 Card News Generator
 * "음반사급 장비로 만드는 사운드"
 *   1/5 표지       — 사운드의 격을 결정하는 한 곳
 *   2/5 Neumann    — 시그니처 마이크 U87AI
 *   3/5 아날로그   — SSL Fusion · Tegeler · ProAc
 *   4/5 프로세스   — 기획부터 음원 발매까지 원스톱
 *   5/5 CTA        — 무료 견적, 시간당 10만원부터
 *
 * Design system (Series 2 — charcoal/gold inversion of Series 1)
 *   - 1080x1080 / 88px outer margin / 24px vertical rhythm / 20px box radius
 *   - Title font:  부크크명조 (Bookk Myungjo) — same as Series 1 (브랜드 일관성)
 *   - Body font:   Pretendard Variable
 *   - Palette:     charcoal base + gold accent + warm beige text (Series 1 inversion)
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'public/images');
const OUT = path.join(ROOT, 'naver-cards/series-2');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 1080;
const M = 88;

const F_TITLE = 'Bookk Myungjo';
const F_BODY  = 'Pretendard Variable';

// Series 2 palette — charcoal dominant
const C = {
  charcoal:     '#1F1812',     // deepest base (slightly darker than Series 1)
  charcoalSoft: '#2B2118',
  charcoalMid:  '#3D2F22',
  beige:        '#F5EFE6',
  beigeDark:    '#EDE4D3',
  gold:         '#C9A96E',
  goldBright:   '#E5C277',     // brighter accent for dark backgrounds
  goldDark:     '#A88748',
  white:        '#FFFFFF',
  gray:         '#9A9088',
  grayMid:      '#7A7068',
};

// =====================================================================
// Shared helpers
// =====================================================================

function seriesIndicator(n, opts = {}) {
  const fill = opts.fill || C.gold;
  const text = opts.text || C.charcoal;
  return `
    <g transform="translate(${SIZE - M - 64}, ${M})">
      <rect x="0" y="0" width="64" height="32" rx="16" fill="${fill}" opacity="0.95"/>
      <text x="32" y="22" text-anchor="middle" font-family="${F_BODY}" font-size="18" font-weight="700" fill="${text}" letter-spacing="1">${n}/5</text>
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
  const stroke = opts.stroke !== undefined ? opts.stroke : 0.8;
  const ls = opts.letterSpacing !== undefined ? opts.letterSpacing : -2;
  const anchor = opts.anchor || 'start';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${F_TITLE}" font-size="${size}" fill="${color}" stroke="${color}" stroke-width="${stroke}" paint-order="stroke fill" letter-spacing="${ls}">${text}</text>`;
}

function accentLine(x, y, length, opts = {}) {
  return `<line x1="${x}" y1="${y}" x2="${x + length}" y2="${y}" stroke="${opts.color || C.gold}" stroke-width="${opts.width || 2}" opacity="${opts.opacity || 1}"/>`;
}

// =====================================================================
// CARD 1/5 — COVER "사운드의 격을 결정하는 한 곳"
// =====================================================================
async function card1() {
  // Full-bleed studio1 photo, darkened with charcoal veil
  const bg = await sharp(path.join(IMG, 'studio1.jpg'))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.42, saturation: 0.75 })
    .toBuffer();

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.charcoal}" stop-opacity="0.35"/>
          <stop offset="50%" stop-color="${C.charcoal}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="${C.charcoal}" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#veil)"/>

      ${seriesIndicator(1)}

      ${eyebrowPill(M, 540, '프로페셔널 녹음실')}

      <!-- Headline (serif, beige on dark) -->
      ${serifTitle(M, 668, '사운드의 격을', 96, C.beige, { stroke: 0.9 })}
      <text x="${M}" y="788" font-family="${F_TITLE}" font-size="120" fill="${C.beige}" stroke="${C.beige}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-3">
        결정하는 <tspan fill="${C.goldBright}" stroke="${C.goldBright}">한 곳</tspan>
      </text>

      ${accentLine(M, 824, 96)}

      <!-- Sub line -->
      <text x="${M}" y="876" font-family="${F_BODY}" font-size="28" font-weight="600" fill="${C.beigeDark}" letter-spacing="2">10년 경력 엔지니어 · Neumann · SSL 풀세팅</text>

      <!-- Footer row: logo + location -->
      <text x="${M}" y="${SIZE - M + 4}" font-family="${F_BODY}" font-size="20" font-weight="700" fill="${C.gold}" letter-spacing="3">STUDIO NOL</text>
      <text x="${SIZE - M}" y="${SIZE - M + 4}" text-anchor="end" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}" letter-spacing="1">은평구 · 연신내역 도보 5분</text>
    </svg>`;

  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '01-cover.jpg'));
  console.log('✓ 1/5 표지 → series-2/01-cover.jpg');
}

// =====================================================================
// CARD 2/5 — NEUMANN U87AI
// =====================================================================
async function card2() {
  // Right 50% photo (Neumann mic), left 50% charcoal text
  const photoW = 540;
  const photoRight = await sharp(path.join(IMG, 'hardware3.jpg'))
    .resize(photoW, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.95, saturation: 0.95 })
    .toBuffer();

  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.charcoal },
  })
    .composite([{ input: photoRight, top: 0, left: SIZE - photoW }])
    .jpeg()
    .toBuffer();

  const textRight = SIZE - photoW - 32;
  const innerW = textRight - M;

  const bullet = (yy, label, sub) => `
    <g transform="translate(${M}, ${yy})">
      <circle cx="8" cy="14" r="6" fill="${C.gold}"/>
      <text x="28" y="22" font-family="${F_BODY}" font-size="24" font-weight="700" fill="${C.beige}">${label}</text>
      <text x="28" y="56" font-family="${F_BODY}" font-size="18" font-weight="500" fill="${C.beigeDark}" opacity="0.8">${sub}</text>
    </g>`;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(2)}

      ${eyebrowPill(M, M + 16, '시그니처 마이크')}

      <!-- Headline (serif) -->
      ${serifTitle(M, M + 200, 'Neumann', 84, C.beige, { stroke: 0.9 })}
      ${serifTitle(M, M + 296, 'U87AI', 96, C.goldBright, { stroke: 1.0 })}

      ${accentLine(M, M + 332, 80)}

      <text x="${M}" y="${M + 386}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.beigeDark}">전 세계 음반사 · 방송국이</text>
      <text x="${M}" y="${M + 416}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.beigeDark}">표준으로 쓰는 마이크</text>

      ${bullet(M + 478, '따뜻한 보컬 톤', '50년 검증된 사운드 시그니처')}
      ${bullet(M + 568, '디테일한 고역', '미세한 표정까지 포착')}
      ${bullet(M + 658, '풍부한 저역', '풍성한 입체감과 깊이')}

      <!-- Footer -->
      <text x="${M}" y="${SIZE - M - 52}" font-family="${F_BODY}" font-size="20" font-weight="600" fill="${C.gold}">놀의 보컬 녹음 시그니처</text>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '02-neumann.jpg'));
  console.log('✓ 2/5 Neumann → series-2/02-neumann.jpg');
}

// =====================================================================
// CARD 3/5 — ANALOG CONSOLE
// =====================================================================
async function card3() {
  // Top photo (Softube + ProAc), bottom charcoal text — photoH tuned to avoid logo overlap
  const photoH = 440;
  const photoTop = await sharp(path.join(IMG, 'hardware8.jpg'))
    .resize(SIZE, photoH, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.92, saturation: 0.95 })
    .toBuffer();

  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.charcoal },
  })
    .composite([{ input: photoTop, top: 0, left: 0 }])
    .jpeg()
    .toBuffer();

  const bullet = (yy, label, sub) => `
    <g transform="translate(${M}, ${yy})">
      <circle cx="8" cy="14" r="6" fill="${C.gold}"/>
      <text x="28" y="22" font-family="${F_BODY}" font-size="24" font-weight="700" fill="${C.beige}">${label}</text>
      <text x="28" y="56" font-family="${F_BODY}" font-size="18" font-weight="500" fill="${C.beigeDark}" opacity="0.8">${sub}</text>
    </g>`;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <!-- Soft transition -->
      <defs>
        <linearGradient id="f3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.charcoal}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${C.charcoal}" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${photoH - 60}" width="${SIZE}" height="60" fill="url(#f3)"/>

      ${seriesIndicator(3)}

      ${eyebrowPill(M, photoH + 32, '아날로그 하이브리드')}

      ${serifTitle(M, photoH + 152, '디지털만으론', 76, C.beige, { stroke: 0.8 })}
      <text x="${M}" y="${photoH + 246}" font-family="${F_TITLE}" font-size="92" fill="${C.beige}" stroke="${C.beige}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-2">
        못 만드는 <tspan fill="${C.goldBright}" stroke="${C.goldBright}">따뜻함</tspan>
      </text>

      ${accentLine(M, photoH + 282, 72)}

      ${bullet(photoH + 332, 'SSL Fusion', '음반사 색감을 그대로 — 풍부한 하모닉')}
      ${bullet(photoH + 408, 'Tegeler Audio', '빈티지 사운드 컬러 — 따뜻한 톤 시그니처')}
      ${bullet(photoH + 484, 'ProAc 모니터', '정확한 사운드 모니터링 — 마무리 신뢰성')}

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '03-analog.jpg'));
  console.log('✓ 3/5 아날로그 → series-2/03-analog.jpg');
}

// =====================================================================
// CARD 4/5 — PROCESS (원스톱)
// =====================================================================
async function card4() {
  // Solid charcoal with subtle hardware1 photo as 35% bg, then process flow on top
  const bgPhoto = await sharp(path.join(IMG, 'hardware1.jpg'))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.28, saturation: 0.5 })
    .blur(6)
    .toBuffer();

  // 4-step horizontal process flow with arrows
  const stepW = 200, stepH = 220, gap = 36;
  const totalW = stepW * 4 + gap * 3;  // 836
  const flowLeft = (SIZE - totalW) / 2;  // 122

  const step = (idx, label, sub) => {
    const x = flowLeft + idx * (stepW + gap);
    return `
      <g transform="translate(${x}, 600)">
        <rect x="0" y="0" width="${stepW}" height="${stepH}" rx="20" fill="${C.charcoalSoft}" stroke="${C.gold}" stroke-width="1.5" opacity="0.95"/>
        <circle cx="${stepW / 2}" cy="56" r="28" fill="${C.gold}"/>
        <text x="${stepW / 2}" y="66" text-anchor="middle" font-family="${F_BODY}" font-size="26" font-weight="900" fill="${C.charcoal}">${idx + 1}</text>
        <text x="${stepW / 2}" y="138" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="800" fill="${C.beige}">${label.split('\n')[0]}</text>
        <text x="${stepW / 2}" y="170" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="800" fill="${C.beige}">${label.split('\n')[1] || ''}</text>
        <text x="${stepW / 2}" y="200" text-anchor="middle" font-family="${F_BODY}" font-size="16" font-weight="500" fill="${C.beigeDark}" opacity="0.75">${sub}</text>
      </g>`;
  };

  const arrow = (idx) => {
    const x = flowLeft + (idx + 1) * stepW + idx * gap + gap / 2;
    return `
      <g transform="translate(${x}, ${600 + stepH / 2})">
        <path d="M -10 0 L 10 0 M 4 -6 L 10 0 L 4 6" stroke="${C.gold}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`;
  };

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(4)}

      ${eyebrowPill(M, M + 16, '원스톱 프로덕션')}

      ${serifTitle(M, M + 196, '기획부터', 96, C.beige, { stroke: 0.9 })}
      <text x="${M}" y="${M + 316}" font-family="${F_TITLE}" font-size="116" fill="${C.beige}" stroke="${C.beige}" stroke-width="1.1" paint-order="stroke fill" letter-spacing="-3">
        <tspan fill="${C.goldBright}" stroke="${C.goldBright}">음원 발매</tspan>까지
      </text>

      ${accentLine(M, M + 354, 80)}

      <text x="${M}" y="${M + 408}" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.beigeDark}">한 곳에서 모든 과정 — 패키지 결합 시 최대 30% 할인</text>

      ${step(0, '기획\n· 녹음', 'Neumann · SSL')}
      ${step(1, '튠\n· 에딧', '디테일 다듬기')}
      ${step(2, '믹싱\n· 마스터링', '아날로그 하이브리드')}
      ${step(3, '음원\n발매', '국내외 플랫폼')}

      ${arrow(0)}
      ${arrow(1)}
      ${arrow(2)}

      ${miniLogo()}
    </svg>`;

  await sharp(bgPhoto)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '04-process.jpg'));
  console.log('✓ 4/5 프로세스 → series-2/04-process.jpg');
}

// =====================================================================
// CARD 5/5 — CTA "당신의 음악을 완성해드립니다"
// =====================================================================
async function card5() {
  // Background: hardware2 (control room wide), heavily darkened
  const bg = await sharp(path.join(IMG, 'hardware2.jpg'))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.32, saturation: 0.6 })
    .toBuffer();

  const boxX = M;
  const boxW = SIZE - M * 2;
  const boxY = 232;
  const boxH = 616;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${C.charcoal}" opacity="0.35"/>

      ${seriesIndicator(5)}

      <!-- Center action box -->
      <g transform="translate(${boxX}, ${boxY})">
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="${C.charcoal}" opacity="0.92"/>
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="none" stroke="${C.gold}" stroke-width="1.5"/>

        <!-- Lead -->
        <text x="${boxW / 2}" y="100" text-anchor="middle" font-family="${F_BODY}" font-size="28" font-weight="500" fill="${C.beigeDark}" letter-spacing="3">10년 경력 엔지니어가</text>

        <!-- Headline (serif) -->
        <text x="${boxW / 2}" y="232" text-anchor="middle" font-family="${F_TITLE}" font-size="92" fill="${C.beige}" stroke="${C.beige}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-3">당신의 음악을</text>
        <text x="${boxW / 2}" y="324" text-anchor="middle" font-family="${F_TITLE}" font-size="92" fill="${C.goldBright}" stroke="${C.goldBright}" stroke-width="1.1" paint-order="stroke fill" letter-spacing="-3">완성해드립니다</text>

        <!-- Divider -->
        <line x1="${boxW / 2 - 100}" y1="378" x2="${boxW / 2 + 100}" y2="378" stroke="${C.gold}" stroke-width="1" opacity="0.5"/>

        <!-- Pricing — 3-tier (시간당 / 1프로 / Day Lock) -->
        <text x="${boxW / 2}" y="436" text-anchor="middle" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.beigeDark}">시간당 10만원 · 1프로(3시간) 20만원</text>
        <text x="${boxW / 2}" y="472" text-anchor="middle" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}">Day Lock(6시간) 50만원 · 패키지 결합 시 최대 30% 할인</text>

        <!-- CTA pointer -->
        <text x="${boxW / 2}" y="544" text-anchor="middle" font-family="${F_BODY}" font-size="28" font-weight="700" fill="${C.white}">아래 ↓ 톡톡 또는 전화로 무료 견적</text>
      </g>

      <text x="${SIZE / 2}" y="${SIZE - M - 28}" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.gold}" letter-spacing="3">스튜디오 놀 · 연신내역 도보 5분</text>
    </svg>`;

  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '05-cta.jpg'));
  console.log('✓ 5/5 CTA → series-2/05-cta.jpg');
}

(async () => {
  console.log('▶ Generating Series 2 cards (1080×1080, charcoal/gold)...\n');
  await card1();
  await card2();
  await card3();
  await card4();
  await card5();
  console.log('\n✅ All 5 cards saved to:', OUT);
})();
