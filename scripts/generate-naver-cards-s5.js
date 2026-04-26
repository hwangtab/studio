/**
 * Naver Smart Place — Series 5 Card News Generator
 * "오시는 길" — 위치·랜드마크·주차 정보 (3장)
 *   1/3 두 역 안내   — 연신내역 도보 5분, 불광역 도보 7분
 *   2/3 랜드마크     — 동명여고 정문 옆, 1층 카센터 건물 3층
 *   3/3 주차·CTA    — KT은평빌딩 유료 + 대중교통 권장
 *
 * Design system (Series 1 family — beige + charcoal + gold)
 *   - 1080x1080 / 88px outer margin / 24px vertical rhythm / 20px box radius
 *   - 다이어그램·인포그래픽 위주 (사진 의존 최소)
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'public/images');
const OUT = path.join(ROOT, 'naver-cards/series-5');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 1080;
const M = 88;

const F_TITLE = 'Bookk Myungjo';
const F_BODY  = 'Pretendard Variable';

const C = {
  beige:        '#F5EFE6',
  beigeDark:    '#EDE4D3',
  beigeMid:     '#E0D5C2',
  charcoal:     '#2B2118',
  charcoalSoft: '#3D2F22',
  gold:         '#C9A96E',
  goldDark:     '#A88748',
  white:        '#FFFFFF',
  gray:         '#9A9088',
  lineGreen:    '#558B41',  // 3호선 색
  lineBrown:    '#8E764E',  // 6호선 색
};

function seriesIndicator(n, total = 3) {
  return `
    <g transform="translate(${SIZE - M - 64}, ${M})">
      <rect x="0" y="0" width="64" height="32" rx="16" fill="${C.charcoal}" opacity="0.92"/>
      <text x="32" y="22" text-anchor="middle" font-family="${F_BODY}" font-size="18" font-weight="700" fill="${C.gold}" letter-spacing="1">${n}/${total}</text>
    </g>`;
}

function miniLogo(fill = C.charcoalSoft) {
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
      <rect x="0" y="0" width="${w}" height="40" rx="20" fill="${opts.bg || C.charcoal}"/>
      <text x="${w / 2}" y="28" text-anchor="middle" font-family="${F_BODY}" font-size="${fontSize}" font-weight="700" fill="${opts.fg || C.gold}" letter-spacing="2">${text}</text>
    </g>`;
}

function serifTitle(x, y, text, size, color, opts = {}) {
  const stroke = opts.stroke !== undefined ? opts.stroke : 0.9;
  const ls = opts.letterSpacing !== undefined ? opts.letterSpacing : -2;
  const anchor = opts.anchor || 'start';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${F_TITLE}" font-size="${size}" fill="${color}" stroke="${color}" stroke-width="${stroke}" paint-order="stroke fill" letter-spacing="${ls}">${text}</text>`;
}

function accentLine(x, y, length, opts = {}) {
  return `<line x1="${x}" y1="${y}" x2="${x + length}" y2="${y}" stroke="${opts.color || C.goldDark}" stroke-width="${opts.width || 2}" opacity="${opts.opacity || 1}"/>`;
}

// 지하철 호선 마크 (원 + 호선 번호)
function subwayLine(x, y, num, color) {
  return `
    <g transform="translate(${x}, ${y})">
      <circle cx="0" cy="0" r="22" fill="${color}"/>
      <text x="0" y="8" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="900" fill="${C.white}">${num}</text>
    </g>`;
}

// =====================================================================
// CARD 1/3 — 두 역 안내 "연신내역 도보 5분"
// =====================================================================
async function card1() {
  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  }).jpeg().toBuffer();

  // Station card: 좌측에 호선 마크들 + 우측에 역명/도보 시간
  const stationCard = (yy, lines, name, walk, primary = false) => {
    const w = 904, h = 140;
    return `
      <g transform="translate(${M}, ${yy})">
        <rect x="0" y="0" width="${w}" height="${h}" rx="20" fill="${primary ? C.charcoal : C.beigeDark}"/>
        ${primary ? `<rect x="0" y="0" width="${w}" height="${h}" rx="20" fill="none" stroke="${C.gold}" stroke-width="2"/>` : ''}
        ${lines.map((l, i) => subwayLine(60 + i * 56, 70, l.num, l.color)).join('\n')}
        <text x="${lines.length * 56 + 64}" y="62" font-family="${F_BODY}" font-size="32" font-weight="800" fill="${primary ? C.beige : C.charcoal}">${name}</text>
        <text x="${lines.length * 56 + 64}" y="100" font-family="${F_BODY}" font-size="22" font-weight="500" fill="${primary ? C.beigeDark : C.charcoalSoft}" opacity="0.9">${walk}</text>
        <text x="${w - 60}" y="86" text-anchor="end" font-family="${F_TITLE}" font-size="56" fill="${primary ? C.gold : C.charcoal}" stroke="${primary ? C.gold : C.charcoal}" stroke-width="0.8" paint-order="stroke fill">도보</text>
      </g>`;
  };

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(1)}

      ${eyebrowPill(M, M + 16, '오시는 길')}

      ${serifTitle(M, M + 200, '연신내역', 92, C.charcoal, { stroke: 0.9 })}
      <text x="${M}" y="${M + 320}" font-family="${F_TITLE}" font-size="148" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.2" paint-order="stroke fill" letter-spacing="-3">
        도보 <tspan fill="${C.goldDark}" stroke="${C.goldDark}">5분</tspan>
      </text>

      ${accentLine(M, M + 360, 96)}

      <text x="${M}" y="${M + 412}" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.charcoalSoft}">두 개 호선, 두 개 역에서 도보 5~7분</text>

      ${stationCard(M + 460, [
        { num: 3, color: C.lineGreen },
        { num: 6, color: C.lineBrown },
      ], '연신내역', '환승역 · 더 가까운 역', true)}

      ${stationCard(M + 620, [
        { num: 6, color: C.lineBrown },
      ], '불광역 7번 출구', '도보 7분', false)}

      <text x="${M}" y="${SIZE - M - 24}" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}" letter-spacing="2">서울특별시 은평구 통일로71길 2-1, 3층</text>

      ${miniLogo()}
    </svg>`;

  // Adjust station card text to show '5분' / '7분' on right
  const svg2 = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(1)}

      ${eyebrowPill(M, M + 16, '오시는 길')}

      ${serifTitle(M, M + 200, '연신내역', 92, C.charcoal, { stroke: 0.9 })}
      <text x="${M}" y="${M + 320}" font-family="${F_TITLE}" font-size="148" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.2" paint-order="stroke fill" letter-spacing="-3">
        도보 <tspan fill="${C.goldDark}" stroke="${C.goldDark}">5분</tspan>
      </text>

      ${accentLine(M, M + 360, 96)}

      <text x="${M}" y="${M + 412}" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.charcoalSoft}">두 개 호선, 두 개 역에서 도보 5~7분</text>

      <!-- Station 1: 연신내역 (primary) -->
      <g transform="translate(${M}, ${M + 460})">
        <rect x="0" y="0" width="904" height="140" rx="20" fill="${C.charcoal}"/>
        <rect x="0" y="0" width="904" height="140" rx="20" fill="none" stroke="${C.gold}" stroke-width="2"/>
        ${subwayLine(60, 70, 3, C.lineGreen)}
        ${subwayLine(116, 70, 6, C.lineBrown)}
        <text x="172" y="62" font-family="${F_BODY}" font-size="34" font-weight="800" fill="${C.beige}">연신내역</text>
        <text x="172" y="98" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.beigeDark}" opacity="0.85">3·6호선 환승역 · 가장 빠른 길</text>
        <text x="844" y="86" text-anchor="end" font-family="${F_TITLE}" font-size="60" fill="${C.gold}" stroke="${C.gold}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-2">도보 5분</text>
      </g>

      <!-- Station 2: 불광역 -->
      <g transform="translate(${M}, ${M + 620})">
        <rect x="0" y="0" width="904" height="140" rx="20" fill="${C.beigeDark}"/>
        ${subwayLine(60, 70, 6, C.lineBrown)}
        <text x="116" y="62" font-family="${F_BODY}" font-size="34" font-weight="800" fill="${C.charcoal}">불광역 7번 출구</text>
        <text x="116" y="98" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.charcoalSoft}" opacity="0.85">6호선 단독 · 7번 출구로 직행</text>
        <text x="844" y="86" text-anchor="end" font-family="${F_TITLE}" font-size="60" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-2">도보 7분</text>
      </g>

      <text x="${M}" y="${SIZE - M - 24}" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}" letter-spacing="1">서울특별시 은평구 통일로71길 2-1, 3층</text>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg2), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '01-stations.jpg'));
  console.log('✓ 1/3 두 역 → series-5/01-stations.jpg');
}

// =====================================================================
// CARD 2/3 — 랜드마크 "1층 카센터 건물 3층"
// =====================================================================
async function card2() {
  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  }).jpeg().toBuffer();

  // Building floor diagram (3 floors)
  const floor = (yy, num, label, sub, highlight = false) => {
    const w = 380, h = 120;
    return `
      <g transform="translate(${(SIZE - w) / 2}, ${yy})">
        <rect x="0" y="0" width="${w}" height="${h}" rx="16" fill="${highlight ? C.charcoal : C.beigeDark}"/>
        ${highlight ? `<rect x="0" y="0" width="${w}" height="${h}" rx="16" fill="none" stroke="${C.gold}" stroke-width="2"/>` : ''}
        <text x="32" y="56" font-family="${F_BODY}" font-size="36" font-weight="900" fill="${highlight ? C.gold : C.gray}">${num}</text>
        <text x="100" y="52" font-family="${F_BODY}" font-size="26" font-weight="800" fill="${highlight ? C.beige : C.charcoal}">${label}</text>
        <text x="100" y="86" font-family="${F_BODY}" font-size="18" font-weight="500" fill="${highlight ? C.beigeDark : C.charcoalSoft}" opacity="0.85">${sub}</text>
      </g>`;
  };

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(2)}

      ${eyebrowPill(M, M + 16, '한눈에 찾기 쉬워요')}

      ${serifTitle(M, M + 200, '동명여고', 92, C.charcoal, { stroke: 0.9 })}
      <text x="${M}" y="${M + 312}" font-family="${F_TITLE}" font-size="100" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-2">
        정문 <tspan fill="${C.goldDark}" stroke="${C.goldDark}">바로 옆</tspan>
      </text>

      ${accentLine(M, M + 350, 80)}

      <text x="${SIZE / 2}" y="${M + 408}" text-anchor="middle" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.charcoalSoft}">1층 카센터 간판이 보이면 도착</text>

      ${floor(M + 460, '3F', 'STUDIO NOL', '음악연습실 · 녹음실', true)}
      ${floor(M + 596, '2F', '일반 사무실', '', false)}
      ${floor(M + 712, '1F', '카센터', '한눈에 보이는 간판', false)}

      <text x="${SIZE / 2}" y="${SIZE - M - 24}" text-anchor="middle" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}" letter-spacing="1">서울특별시 은평구 통일로71길 2-1, 3층</text>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '02-landmark.jpg'));
  console.log('✓ 2/3 랜드마크 → series-5/02-landmark.jpg');
}

// =====================================================================
// CARD 3/3 — 주차·접근 + CTA
// =====================================================================
async function card3() {
  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  }).jpeg().toBuffer();

  const item = (yy, icon, label, sub) => `
    <g transform="translate(${M}, ${yy})">
      <circle cx="22" cy="22" r="22" fill="${C.gold}"/>
      <text x="22" y="32" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="900" fill="${C.charcoal}">${icon}</text>
      <text x="64" y="22" font-family="${F_BODY}" font-size="22" font-weight="700" fill="${C.charcoal}">${label}</text>
      <text x="64" y="54" font-family="${F_BODY}" font-size="18" font-weight="500" fill="${C.charcoalSoft}" opacity="0.85">${sub}</text>
    </g>`;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(3)}

      ${eyebrowPill(M, M + 16, '도착하시기 전에')}

      ${serifTitle(M, M + 200, '주차 · 접근', 96, C.charcoal, { stroke: 0.9 })}
      <text x="${M}" y="${M + 312}" font-family="${F_TITLE}" font-size="100" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-2">
        <tspan fill="${C.goldDark}" stroke="${C.goldDark}">대중교통</tspan> 권장
      </text>

      ${accentLine(M, M + 350, 80)}

      ${item(M + 416, 'P', '인근 KT은평빌딩 주차장', '유료 이용 가능 (도보 1분)')}
      ${item(M + 504, '🚇', '대중교통 적극 권장', '연신내역 도보 5분 · 불광역 도보 7분')}
      ${item(M + 592, '🍴', '인근 식당·편의점 多', '식사·간식·필수품 모두 도보 3분')}
      ${item(M + 680, '💬', '도착 어려우시면 톡톡', '입주 상담 시 1층까지 안내 가능')}

      <!-- CTA box -->
      <g transform="translate(${M}, ${M + 776})">
        <rect x="0" y="0" width="904" height="92" rx="16" fill="${C.charcoal}"/>
        <text x="452" y="38" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.beigeDark}" letter-spacing="2">방음·시설 무료 투어 가능</text>
        <text x="452" y="74" text-anchor="middle" font-family="${F_BODY}" font-size="26" font-weight="700" fill="${C.gold}">아래 ↓ 톡톡 또는 전화로 무료 상담</text>
      </g>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '03-parking-cta.jpg'));
  console.log('✓ 3/3 주차·CTA → series-5/03-parking-cta.jpg');
}

(async () => {
  console.log('▶ Generating Series 5 cards (1080×1080, 오시는 길)...\n');
  await card1();
  await card2();
  await card3();
  console.log('\n✅ All 3 cards saved to:', OUT);
})();
