/**
 * Naver Smart Place — Series 3 Card News Generator
 * "이런 분께 잘 맞아요" — Persona Series
 *   1/5 표지       — 4가지 페르소나 미리보기
 *   2/5 페르소나 1 — 실용음악 입시생
 *   3/5 페르소나 2 — 직장인 보컬·미디 작업자
 *   4/5 페르소나 3 — 지방 합숙 입주자
 *   5/5 페르소나 4 + CTA — 음원 발매 준비 독립 뮤지션
 *
 * Design system
 *   - Series 1 palette (warm beige) — practice room category consistency
 *   - Layout: alternating photo position (L/R/L/R) for visual rhythm
 *   - 88px grid · 부크크명조 headlines · Pretendard body
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'public/images');
const OUT = path.join(ROOT, 'naver-cards/series-3');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = 1080;
const M = 88;

const F_TITLE = 'Bookk Myungjo';
const F_BODY  = 'Pretendard Variable';

// Series 3 palette — warm beige (Series 1 family, practice room consistency)
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
  grayLight:    '#D9D2C7',
};

// Shared helpers
function seriesIndicator(n) {
  return `
    <g transform="translate(${SIZE - M - 64}, ${M})">
      <rect x="0" y="0" width="64" height="32" rx="16" fill="${C.charcoal}" opacity="0.92"/>
      <text x="32" y="22" text-anchor="middle" font-family="${F_BODY}" font-size="18" font-weight="700" fill="${C.gold}" letter-spacing="1">${n}/5</text>
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

function personaNumber(x, y, n) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="76" height="40" rx="20" fill="${C.gold}"/>
      <text x="38" y="28" text-anchor="middle" font-family="${F_BODY}" font-size="20" font-weight="800" fill="${C.charcoal}" letter-spacing="1">No.${n}</text>
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

// Persona thumbnail tile (used on cover) — icon symbol + label
function personaTile(x, y, w, h, no, label, sub) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="20" fill="${C.beigeDark}"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="20" fill="none" stroke="${C.gold}" stroke-width="1.5" opacity="0.6"/>
      <text x="32" y="48" font-family="${F_BODY}" font-size="18" font-weight="800" fill="${C.goldDark}" letter-spacing="2">No.${no}</text>
      <text x="32" y="92" font-family="${F_BODY}" font-size="26" font-weight="800" fill="${C.charcoal}">${label}</text>
      <text x="32" y="124" font-family="${F_BODY}" font-size="18" font-weight="500" fill="${C.charcoalSoft}" opacity="0.85">${sub}</text>
    </g>`;
}

// =====================================================================
// CARD 1/5 — COVER "이런 분께 잘 맞아요"
// =====================================================================
async function card1() {
  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  }).jpeg().toBuffer();

  // 2x2 persona grid — each tile 408x148, gap 16
  const tileW = 408, tileH = 148, gap = 16;
  const gridLeft = M;
  const gridTop  = M + 460;

  const t = (col, row, no, label, sub) => personaTile(
    gridLeft + col * (tileW + gap),
    gridTop  + row * (tileH + gap),
    tileW, tileH, no, label, sub
  );

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${seriesIndicator(1)}

      ${eyebrowPill(M, M + 16, '스튜디오 놀 입주자')}

      ${serifTitle(M, M + 200, '이런 분께', 116, C.charcoal, { stroke: 1.0 })}
      <text x="${M}" y="${M + 320}" font-family="${F_TITLE}" font-size="124" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="1.2" paint-order="stroke fill" letter-spacing="-3">
        <tspan fill="${C.goldDark}" stroke="${C.goldDark}">잘 맞아요</tspan>
      </text>

      ${accentLine(M, M + 358, 96)}

      <text x="${M}" y="${M + 408}" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.charcoalSoft}">월 30만원대 입주, 24시간, 숙식 가능 — 4가지 대표 페르소나</text>

      ${t(0, 0, '1', '실용음악 입시생', '24시간 풀데이 실기 연습')}
      ${t(1, 0, '2', '직장인 보컬·미디', '퇴근 후 새벽까지 작업')}
      ${t(0, 1, '3', '지방 합숙 입주자', '서울 작업 + 숙식 한 곳')}
      ${t(1, 1, '4', '독립 뮤지션', '음원 발매까지 한 번에')}

      <text x="${M}" y="${SIZE - M - 24}" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gray}" letter-spacing="2">은평구 · 연신내역 도보 5분</text>

      ${miniLogo()}
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '01-cover.jpg'));
  console.log('✓ 1/5 표지 → series-3/01-cover.jpg');
}

// =====================================================================
// Persona card factory — left photo, right text
// =====================================================================
async function personaCard({ idx, photoFile, eyebrow, headline1, headline2, headline2Highlight, sub1, sub2, scenarios, footer, photoSide = 'left', outFile }) {
  const photoW = 480;

  const photoBuf = await sharp(path.join(IMG, photoFile))
    .resize(photoW, SIZE, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.96, saturation: 0.92 })
    .toBuffer();

  const composed = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: C.beige },
  })
    .composite([{ input: photoBuf, top: 0, left: photoSide === 'left' ? 0 : SIZE - photoW }])
    .jpeg()
    .toBuffer();

  const textLeft = photoSide === 'left' ? photoW + 32 : M;
  const photoEdgeX = photoSide === 'left' ? photoW : SIZE - photoW;

  const bullet = (yy, text) => `
    <g transform="translate(${textLeft}, ${yy})">
      <circle cx="8" cy="13" r="6" fill="${C.gold}"/>
      <text x="28" y="22" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoal}">${text}</text>
    </g>`;

  // Optional gold-highlight tspan in headline 2
  const h2 = headline2Highlight
    ? `<text x="${textLeft}" y="${M + 304}" font-family="${F_TITLE}" font-size="92" fill="${C.charcoal}" stroke="${C.charcoal}" stroke-width="0.9" paint-order="stroke fill" letter-spacing="-2">${headline2.replace(headline2Highlight, `<tspan fill="${C.goldDark}" stroke="${C.goldDark}">${headline2Highlight}</tspan>`)}</text>`
    : serifTitle(textLeft, M + 304, headline2, 92, C.charcoal, { stroke: 0.9 });

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${photoEdgeX}" y="0" width="2" height="${SIZE}" fill="${C.beigeDark}"/>

      ${seriesIndicator(idx)}

      ${personaNumber(textLeft, M + 8, idx - 1)}
      <text x="${textLeft + 92}" y="${M + 36}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoalSoft}" letter-spacing="3">${eyebrow}</text>

      ${serifTitle(textLeft, M + 200, headline1, 92, C.charcoal, { stroke: 0.9 })}
      ${h2}

      ${accentLine(textLeft, M + 344, 72)}

      <text x="${textLeft}" y="${M + 396}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoalSoft}">${sub1}</text>
      ${sub2 ? `<text x="${textLeft}" y="${M + 426}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoalSoft}">${sub2}</text>` : ''}

      ${scenarios.map((s, i) => bullet(M + 484 + i * 56, s)).join('\n')}

      <text x="${textLeft}" y="${SIZE - M - 52}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.charcoal}">${footer}</text>

      <!-- mini logo placed in text area to avoid photo overlap -->
      <g transform="translate(${textLeft}, ${SIZE - M + 4})">
        <text x="0" y="0" font-family="${F_BODY}" font-size="20" font-weight="700" fill="${C.charcoalSoft}" letter-spacing="3">STUDIO NOL</text>
      </g>
    </svg>`;

  await sharp(composed)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, outFile));
  console.log(`✓ ${idx}/5 → series-3/${outFile}`);
}

// =====================================================================
// CARD 5/5 — Persona 4 + CTA
// =====================================================================
async function card5() {
  // Background: room7 (Yamaha + cello — emotional), darkened
  const bg = await sharp(path.join(IMG, 'room7.jpg'))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.45, saturation: 0.7 })
    .toBuffer();

  const boxX = M;
  const boxW = SIZE - M * 2;
  const boxY = 200;
  const boxH = 680;

  const svg = `
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${C.charcoal}" opacity="0.3"/>

      ${seriesIndicator(5)}

      <g transform="translate(${boxX}, ${boxY})">
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="${C.charcoal}" opacity="0.92"/>
        <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="20" fill="none" stroke="${C.gold}" stroke-width="1.5"/>

        <!-- Persona No.4 badge -->
        <g transform="translate(${boxW / 2 - 38}, 60)">
          <rect x="0" y="0" width="76" height="40" rx="20" fill="${C.gold}"/>
          <text x="38" y="28" text-anchor="middle" font-family="${F_BODY}" font-size="20" font-weight="800" fill="${C.charcoal}">No.4</text>
        </g>

        <text x="${boxW / 2}" y="156" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.beigeDark}" letter-spacing="3">독립 뮤지션</text>

        <!-- Headline (serif) -->
        <text x="${boxW / 2}" y="280" text-anchor="middle" font-family="${F_TITLE}" font-size="84" fill="${C.beige}" stroke="${C.beige}" stroke-width="0.9" paint-order="stroke fill" letter-spacing="-2">음원 발매를 향해</text>
        <text x="${boxW / 2}" y="368" text-anchor="middle" font-family="${F_TITLE}" font-size="84" fill="${C.gold}" stroke="${C.gold}" stroke-width="1.0" paint-order="stroke fill" letter-spacing="-2">기획부터 한 번에</text>

        <line x1="${boxW / 2 - 100}" y1="416" x2="${boxW / 2 + 100}" y2="416" stroke="${C.gold}" stroke-width="1" opacity="0.5"/>

        <!-- Sub -->
        <text x="${boxW / 2}" y="468" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="500" fill="${C.beigeDark}">월 30만원대 입주만 해도</text>
        <text x="${boxW / 2}" y="500" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="500" fill="${C.beigeDark}">녹음실·음원 발매·보도자료까지 8가지 부가 혜택</text>

        <!-- CTA -->
        <text x="${boxW / 2}" y="588" text-anchor="middle" font-family="${F_BODY}" font-size="28" font-weight="700" fill="${C.white}">아래 ↓ 톡톡 또는 전화로 무료 상담</text>
        <text x="${boxW / 2}" y="624" text-anchor="middle" font-family="${F_BODY}" font-size="20" font-weight="500" fill="${C.gold}">6개월 계약 시 첫 달 50% 할인</text>
      </g>

      <text x="${SIZE / 2}" y="${SIZE - M - 28}" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.gold}" letter-spacing="3">스튜디오 놀 · 연신내역 도보 5분</text>
    </svg>`;

  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, '05-cta.jpg'));
  console.log('✓ 5/5 CTA → series-3/05-cta.jpg');
}

(async () => {
  console.log('▶ Generating Series 3 cards (1080×1080, persona)...\n');

  await card1();

  await personaCard({
    idx: 2,
    photoFile: 'room3.jpg',
    eyebrow: '실용음악 입시생',
    headline1: '곧 입시 시즌',
    headline2: '24시간 풀데이',
    headline2Highlight: '풀데이',
    sub1: '실기 시험을 코앞에 두고',
    sub2: '몰입할 시간이 절실한 분',
    scenarios: [
      '평일 야간 + 주말 풀타임 무제한',
      '실기 곡 반복 연습, 옆방 신경 X',
      '피아노 보유 · 보컬·세션·미디 모두',
    ],
    footer: '입시 합격 후에도 작업실로 그대로',
    photoSide: 'left',
    outFile: '02-persona-1.jpg',
  });

  await personaCard({
    idx: 3,
    photoFile: 'room5.jpg',
    eyebrow: '직장인 보컬·미디 작업자',
    headline1: '낮엔 회사,',
    headline2: '밤엔 음악',
    headline2Highlight: '밤엔 음악',
    sub1: '퇴근 후 작업실로 직행하는',
    sub2: '음악이 본업인 사람',
    scenarios: [
      '평일 22시 ~ 새벽까지 무제한 이용',
      '심야 보컬 작업도 옆방엔 도서관 정적',
      '공조기 + 자연광으로 머리 맑게',
    ],
    footer: '주말엔 풀타임 몰입 작업',
    photoSide: 'right',
    outFile: '03-persona-2.jpg',
  });

  await personaCard({
    idx: 4,
    photoFile: 'room4.jpg',
    eyebrow: '지방 합숙 입주자',
    headline1: '월 1~2주,',
    headline2: '서울 작업',
    headline2Highlight: '서울 작업',
    sub1: '지방에서 올라와 단기 몰입할',
    sub2: '작업실 + 숙소 한 번에',
    scenarios: [
      '독립 샤워실 24시간 · 숙식 OK',
      '월 단위 계약, 1개월부터 부담 없이',
      '연신내역 도보 5분, 인근 식당 多',
    ],
    footer: '숙소비 따로 안 들어 가성비 최고',
    photoSide: 'left',
    outFile: '04-persona-3.jpg',
  });

  await card5();

  console.log('\n✅ All 5 cards saved to:', OUT);
})();
