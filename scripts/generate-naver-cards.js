/**
 * Naver Smart Place — Series 1 Card News Generator
 * "입주자가 사랑하는 3가지 이유"
 *   1/5 표지        — 3가지 매력 통합 헤드라인
 *   2/5 방음 (1순위) — 국내 최고 수준 STC 차음
 *   3/5 부가혜택 (2순위) — 매월 받는 보너스 4개
 *   4/5 환경 (3순위) — 산소 공조 + 자연광 + 깨끗
 *   5/5 CTA          — 6개월 계약 시 첫 달 50% 할인
 *
 * Design system
 *   - 1080x1080 / 88px outer margin / 24px vertical rhythm / 20px box radius
 *   - Title font:  부크크명조 (Bookk Myungjo) Light
 *   - Body font:   Pretendard Variable
 *   - Palette:     warm beige + deep charcoal + brass gold
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'public/images');
const OUT = path.join(ROOT, 'naver-cards/series-1');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 1080;
const M = 88; // outer margin (uniform)

// Fonts (registered via fontconfig)
const F_TITLE = 'Bookk Myungjo';      // 부크크명조 — headlines (serif, warm)
const F_BODY  = 'Pretendard Variable'; // body, numbers, CTA (sans)

// Palette
const C = {
  beige:      '#F5EFE6',
  beigeDark:  '#EDE4D3',
  charcoal:   '#2B2118',
  charcoalSoft: '#3D2F22',
  gold:       '#C9A96E',
  goldDark:   '#A88748',
  white:      '#FFFFFF',
  gray:       '#9A9088',
  grayLight:  '#D9D2C7',
};

// =====================================================================
// Shared helpers
// =====================================================================

// Series indicator — small pill at top-right
function seriesIndicator(n, opts = {}) {
  const fill = opts.fill || C.charcoal;
  const text = opts.text || C.gold;
  return `
    <g transform="translate(${SIZE - M - 64}, ${M})">
      <rect x="0" y="0" width="64" height="32" rx="16" fill="${fill}" opacity="0.92"/>
      <text x="32" y="22" text-anchor="middle" font-family="${F_BODY}" font-size="18" font-weight="700" fill="${text}" letter-spacing="1">${n}/5</text>
    </g>`;
}

// Mini wordmark — bottom-left
function miniLogo(fill = C.charcoalSoft) {
  return `
    <g transform="translate(${M}, ${SIZE - M + 4})">
      <text x="0" y="0" font-family="${F_BODY}" font-size="20" font-weight="700" fill="${fill}" letter-spacing="3">STUDIO NOL</text>
    </g>`;
}

// Eyebrow pill (charcoal pill + gold text)
function eyebrowPill(x, y, text, opts = {}) {
  const padX = 22;
  const fontSize = 20;
  const approxWidth = text.length * (fontSize * 0.95) + padX * 2;
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${approxWidth}" height="40" rx="20" fill="${opts.bg || C.charcoal}"/>
      <text x="${approxWidth / 2}" y="28" text-anchor="middle" font-family="${F_BODY}" font-size="${fontSize}" font-weight="700" fill="${opts.fg || C.gold}" letter-spacing="2">${text}</text>
    </g>`;
}

// Rank badge — gold pill with "N순위" text
function rankBadge(x, y, n) {
  const w = 96, h = 40;
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" fill="${C.gold}"/>
      <text x="${w / 2}" y="28" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="800" fill="${C.charcoal}" letter-spacing="0">${n}순위</text>
    </g>`;
}

// Serif title — uses paint-order trick to fake-bold the Light-only Bookk Myungjo
function serifTitle(x, y, text, size, color, opts = {}) {
  const stroke = opts.stroke !== undefined ? opts.stroke : 1.0;
  const ls = opts.letterSpacing || -2;
  const anchor = opts.anchor || 'start';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${F_TITLE}" font-size="${size}" fill="${color}" stroke="${color}" stroke-width="${stroke}" paint-order="stroke fill" letter-spacing="${ls}">${text}</text>`;
}

// Thin gold accent line
function accentLine(x, y, length, opts = {}) {
  return `<line x1="${x}" y1="${y}" x2="${x + length}" y2="${y}" stroke="${opts.color || C.goldDark}" stroke-width="${opts.width || 2}" opacity="${opts.opacity || 1}"/>`;
}

// =====================================================================
// CARD 1 — COVER "입주자가 사랑하는 3가지 이유"
// =====================================================================
async function card1() {
  // Top 56% photo (room3), bottom 44% beige
  const photoH = 600;
  const photoTop = await sharp(path.join(IMG, 'room3.jpg'))
    .resize(SIZE, photoH, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 1.04, saturation: 0.92 })
    .toBuffer();

  const stacked = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  })
    .composite([{ input: photoTop, top: 0, left: 0 }])
    .jpeg()
    .toBuffer();

  // soft fade between photo and beige
  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="f1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.beige}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${C.beige}" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${photoH - 60}" width="${SIZE}" height="60" fill="url(#f1)"/>

      ${seriesIndicator(1)}

      <!-- Eyebrow pill, vertically aligned to top of beige zone -->
      ${eyebrowPill(M, photoH + 48, '은평구 음악연습실')}

      <!-- Headline 1 (serif) -->
      ${serifTitle(M, photoH + 168, '입주자가 사랑하는', 88, C.charcoal, { stroke: 0.8 })}

      <!-- Headline 2 (serif, gold accent on '3') -->
      <text x="${M}" y="${photoH + 288}" font-family="${F_TITLE}" font-size="124" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.2" paint-order="stroke fill" letter-spacing="-3">
        <tspan fill="${C.goldDark}" stroke="${C.goldDark}">3</tspan>가지 이유
      </text>

      <!-- Accent line -->
      ${accentLine(M, photoH + 322, 96)}

      <!-- Sub line (single concept summary; price comparison appears in CTA) -->
      <text x="${M}" y="${photoH + 374}" font-family="${F_BODY}" font-size="28" font-weight="700" fill="${C.charcoalSoft}" letter-spacing="3">방음 · 부가혜택 · 깨끗한 환경</text>

      <!-- Footer row: logo (left) + location (right) -->
      <text x="${M}" y="${SIZE - M + 4}" font-family="${F_BODY}" font-size="20" font-weight="700" fill="${C.charcoalSoft}" letter-spacing="3">STUDIO NOL</text>
      <text x="${SIZE - M}" y="${SIZE - M + 4}" text-anchor="end" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}" letter-spacing="1">은평구 · 연신내역 도보 5분</text>
    </svg>`;

  await sharp(stacked)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '01-cover.jpg'));

  console.log('✓ 1/5 표지 → 01-cover.jpg');
}

// =====================================================================
// CARD 2 — 방음 (1순위) "녹음실급 방음"
// =====================================================================
async function card2() {
  // Right 1/3 photo (full height), left 2/3 beige + text
  const photoW = 360;
  const photoRight = await sharp(path.join(IMG, 'bulgwang-mixing-club-2nd.webp'))
    .resize(photoW, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.95, saturation: 0.85 })
    .toBuffer();

  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  })
    .composite([{ input: photoRight, top: 0, left: SIZE - photoW }])
    .jpeg()
    .toBuffer();

  // Text area: x = M to (SIZE - photoW - 24)
  const textRight = SIZE - photoW - 24;
  const innerW = textRight - M;

  const bullet = (yy, label, sub) => `
    <g transform="translate(${M}, ${yy})">
      <circle cx="8" cy="14" r="6" fill="${C.gold}"/>
      <text x="28" y="22" font-family="${F_BODY}" font-size="26" font-weight="700" fill="${C.charcoal}">${label}</text>
      <text x="28" y="56" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.charcoalSoft}" opacity="0.85">${sub}</text>
    </g>`;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <!-- subtle photo edge soften -->
      <rect x="${SIZE - photoW}" y="0" width="2" height="${SIZE}" fill="${C.beigeDark}"/>

      ${seriesIndicator(2)}

      <!-- Rank badge -->
      ${rankBadge(M, M + 8, 1)}

      <!-- Eyebrow text aside the badge -->
      <text x="${M + 112}" y="${M + 38}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoalSoft}" letter-spacing="3">입주자가 사랑하는 매력</text>

      <!-- Headline (serif) -->
      ${serifTitle(M, M + 200, '녹음실급', 116, C.charcoal, { stroke: 1.0 })}
      ${serifTitle(M, M + 320, '방음 성능', 116, C.charcoal, { stroke: 1.0 })}

      <!-- Accent line -->
      ${accentLine(M, M + 360, 80)}

      <!-- Sub: scenario + library/whisper analogy (measurement appears once in bullet 1 only) -->
      <text x="${M}" y="${M + 410}" font-family="${F_BODY}" font-size="26" font-weight="600" fill="${C.charcoalSoft}">심야 보컬·미디 작업도</text>
      <text x="${M}" y="${M + 444}" font-family="${F_BODY}" font-size="26" font-weight="600" fill="${C.charcoalSoft}">옆방엔 <tspan fill="${C.goldDark}" font-weight="800">도서관 같은 정적</tspan></text>

      <!-- 3 bullets, 24px rhythm * 4 -->
      ${bullet(M + 504, '국제 표준 STC 차음 시스템', 'STC 55+ 등급 (실측 55dB+ 감쇄)')}
      ${bullet(M + 600, '벽 사이 공기 완충층', '저역·진동을 물리적으로 차단')}
      ${bullet(M + 696, '고밀도 미네랄울 흡음재', '녹음실급 데드한 잔향')}

      <!-- Footer -->
      <text x="${M}" y="${SIZE - M - 52}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoal}">새벽 3시도 OK · 옆방 소음 걱정 없음</text>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '02-soundproofing.jpg'));

  console.log('✓ 2/5 방음 → 02-soundproofing.jpg');
}

// =====================================================================
// CARD 3 — 부가혜택 (2순위) "매달 받는 보너스"
// =====================================================================
async function card3() {
  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  }).jpeg().toBuffer();

  // 2x2 benefit grid — each card 408x148, gap 16
  const cellW = 408, cellH = 148, gap = 16;
  const gridLeft = M;
  const gridTop  = M + 460;

  const cell = (col, row, no, label, sub) => {
    const x = gridLeft + col * (cellW + gap);
    const y = gridTop  + row * (cellH + gap);
    return `
      <g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="${cellW}" height="${cellH}" rx="20" fill="${C.beigeDark}"/>
        <rect x="0" y="0" width="${cellW}" height="${cellH}" rx="20" fill="none" stroke="${C.gold}" stroke-width="1.5" opacity="0.6"/>
        <text x="32" y="42" font-family="${F_BODY}" font-size="18" font-weight="800" fill="${C.goldDark}" letter-spacing="2">No.${no}</text>
        <text x="32" y="86" font-family="${F_BODY}" font-size="28" font-weight="800" fill="${C.charcoal}">${label}</text>
        <text x="32" y="120" font-family="${F_BODY}" font-size="19" font-weight="500" fill="${C.charcoalSoft}" opacity="0.9">${sub}</text>
      </g>`;
  };

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(3)}

      ${rankBadge(M, M + 8, 2)}
      <text x="${M + 112}" y="${M + 38}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoalSoft}" letter-spacing="3">입주자가 사랑하는 매력</text>

      ${serifTitle(M, M + 200, '매달 받는', 108, C.charcoal, { stroke: 1.0 })}
      <text x="${M}" y="${M + 312}" font-family="${F_TITLE}" font-size="108" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.2" paint-order="stroke fill" letter-spacing="-2">
        <tspan fill="${C.goldDark}" stroke="${C.goldDark}">보너스</tspan>
      </text>

      ${accentLine(M, M + 350, 80)}

      <text x="${M}" y="${M + 396}" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.charcoalSoft}">입주만 해도 누리는 8가지 혜택 중 대표 4가지</text>

      ${cell(0, 0, '1', '프로페셔널 녹음실 1시간', 'Neumann · SSL 풀세팅 · 매월 무료')}
      ${cell(1, 0, '2', '음원 발매', '국내외 플랫폼 무료 등록')}
      ${cell(0, 1, '3', '보도자료 제작', '언론사 배포까지 무료')}
      ${cell(1, 1, '4', '음향장비 대여', '버스킹·공연 현장 지원')}

      <text x="${M}" y="${SIZE - M - 60}" font-family="${F_BODY}" font-size="22" font-weight="700" fill="${C.charcoal}">▶ 그 외 4가지까지 <tspan fill="${C.goldDark}" font-weight="800">총 8가지 · 월 가치 약 45만원+</tspan></text>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '03-benefits.jpg'));

  console.log('✓ 3/5 부가혜택 → 03-benefits.jpg');
}

// =====================================================================
// CARD 4 — 환경 (3순위) "숨 쉬기 좋은 연습실"
// =====================================================================
async function card4() {
  // Left 1/2 photo (room5 — window light), right 1/2 beige + text
  const photoW = 480;
  const photoLeft = await sharp(path.join(IMG, 'room5.jpg'))
    .resize(photoW, SIZE, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 1.0, saturation: 0.95 })
    .toBuffer();

  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  })
    .composite([{ input: photoLeft, top: 0, left: 0 }])
    .jpeg()
    .toBuffer();

  // Text area: x = photoW + 32 to (SIZE - M)
  const textLeft = photoW + 32;

  const checkItem = (yy, text) => `
    <g transform="translate(${textLeft}, ${yy})">
      <circle cx="14" cy="14" r="14" fill="${C.gold}"/>
      <path d="M 8 14 L 12 18 L 20 10" stroke="${C.charcoal}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="40" y="22" font-family="${F_BODY}" font-size="24" font-weight="700" fill="${C.charcoal}">${text}</text>
    </g>`;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <!-- subtle photo edge -->
      <rect x="${photoW}" y="0" width="2" height="${SIZE}" fill="${C.beigeDark}"/>

      ${seriesIndicator(4)}

      ${rankBadge(textLeft, M + 8, 3)}
      <text x="${textLeft + 112}" y="${M + 38}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoalSoft}" letter-spacing="3">입주자가 사랑하는 매력</text>

      ${serifTitle(textLeft, M + 200, '숨 쉬기', 96, C.charcoal, { stroke: 0.9 })}
      ${serifTitle(textLeft, M + 304, '좋은 연습실', 96, C.charcoal, { stroke: 0.9 })}

      ${accentLine(textLeft, M + 344, 72)}

      <text x="${textLeft}" y="${M + 410}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoalSoft}">밀폐 공간이지만 답답하지 않은 이유</text>

      ${checkItem(M + 444, '산소 공조기 전 객실')}
      ${checkItem(M + 492, '시스템 냉난방·결로 차단')}
      ${checkItem(M + 540, '대형 이중 창문 자연광')}
      ${checkItem(M + 588, '밝고 깨끗한 인테리어')}
      ${checkItem(M + 636, '친환경 자재 · 환경호르몬 ZERO')}

      <text x="${textLeft}" y="${SIZE - M - 52}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoal}">장기 체류·숙식도 안심</text>

      <!-- mini logo placed in text area to avoid photo overlap -->
      <g transform="translate(${textLeft}, ${SIZE - M + 4})">
        <text x="0" y="0" font-family="${F_BODY}" font-size="20" font-weight="700" fill="${C.charcoalSoft}" letter-spacing="3">STUDIO NOL</text>
      </g>
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '04-environment.jpg'));

  console.log('✓ 4/5 환경 → 04-environment.jpg');
}

// =====================================================================
// CARD 5 — CTA "6개월 계약 시 첫 달 50% 할인"
// =====================================================================
async function card5() {
  // Background: room7 (Yamaha + cello), darkened with charcoal veil
  const bg = await sharp(path.join(IMG, 'room7.jpg'))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.45, saturation: 0.7 })
    .toBuffer();

  const boxX = M;
  const boxW = SIZE - M * 2;
  const boxY = 232;
  const boxH = 616;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <!-- Soft additional veil -->
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${C.charcoal}" opacity="0.25"/>

      ${seriesIndicator(5, { fill: C.gold, text: C.charcoal })}

      <!-- Center action box -->
      <g transform="translate(${boxX}, ${boxY})">
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="${C.charcoal}" opacity="0.9"/>
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="none" stroke="${C.gold}" stroke-width="1.5"/>

        <!-- Lead -->
        <text x="${boxW / 2}" y="100" text-anchor="middle" font-family="${F_BODY}" font-size="32" font-weight="500" fill="${C.beigeDark}" letter-spacing="2">신규 입주자 한정</text>

        <!-- Offer (serif headline) -->
        <text x="${boxW / 2}" y="232" text-anchor="middle" font-family="${F_TITLE}" font-size="116" fill="${C.gold}" stroke="${C.gold}" stroke-width="1.2" paint-order="stroke fill" letter-spacing="-3">첫 달 50% 할인</text>

        <text x="${boxW / 2}" y="296" text-anchor="middle" font-family="${F_BODY}" font-size="28" font-weight="600" fill="${C.beigeDark}" letter-spacing="2">6개월 이상 계약 시</text>

        <!-- Divider -->
        <line x1="${boxW / 2 - 100}" y1="356" x2="${boxW / 2 + 100}" y2="356" stroke="${C.gold}" stroke-width="1" opacity="0.5"/>

        <!-- CTA pointer -->
        <text x="${boxW / 2}" y="424" text-anchor="middle" font-family="${F_BODY}" font-size="32" font-weight="700" fill="${C.white}">아래 ↓ 톡톡 또는 전화 버튼</text>
        <text x="${boxW / 2}" y="468" text-anchor="middle" font-family="${F_BODY}" font-size="24" font-weight="500" fill="${C.beigeDark}">상담은 24시간 이내 친절하게</text>

        <!-- Sub note -->
        <text x="${boxW / 2}" y="540" text-anchor="middle" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gold}" opacity="0.85" letter-spacing="3">시세 45만원대 → 월 30만원대</text>
      </g>

      <!-- Footer -->
      <text x="${SIZE / 2}" y="${SIZE - M - 28}" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.gold}" letter-spacing="3">스튜디오 놀 · 연신내역 도보 5분</text>
    </svg>`;

  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '05-cta.jpg'));

  console.log('✓ 5/5 CTA → 05-cta.jpg');
}

(async () => {
  console.log('▶ Generating Series 1 cards (1080×1080)...\n');
  await card1();
  await card2();
  await card3();
  await card4();
  await card5();
  console.log('\n✅ All 5 cards saved to:', OUT);
})();
