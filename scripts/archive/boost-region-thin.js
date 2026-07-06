#!/usr/bin/env node
/**
 * boost-region-thin.js
 *
 * content/stories/ 내 category: 지역 가이드인 KO 파일 중 본문 공백 제외 자수가
 * 1,500자 미만(lib/stories.ts thin gate)인 파일에 "방문 전 체크리스트",
 * "연신내역 도착 후 동선", "녹음 후 음원 활용 가이드", "자주 받는 추가 질문"
 * 4개 sub-section(H3)을 자동 보강합니다.
 *
 * Usage:
 *   node scripts/boost-region-thin.js [--dry-run] [--limit N] [--rewrite-existing]
 *
 *   --dry-run            : 변경 없이 처리 대상만 출력
 *   --limit N            : 최대 N개 파일만 처리 (기본 무제한)
 *   --rewrite-existing   : 이미 AUTO-EXPAND-V1 마커가 있는 파일도 재처리
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');
const THIN_CHAR_THRESHOLD = 1500;
const MARKER_BEGIN = '<!-- AUTO-EXPAND-V1 -->';
const MARKER_END = '<!-- /AUTO-EXPAND-V1 -->';
const MARKER_RE = /<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/;

// ─────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { dryRun: false, limit: Infinity, rewriteExisting: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--rewrite-existing') args.rewriteExisting = true;
    else if (a === '--limit') {
      const n = parseInt(argv[++i], 10);
      if (!Number.isNaN(n) && n > 0) args.limit = n;
    } else if (a.startsWith('--limit=')) {
      const n = parseInt(a.split('=')[1], 10);
      if (!Number.isNaN(n) && n > 0) args.limit = n;
    }
  }
  return args;
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function isKoDefaultStory(filename) {
  if (!filename.endsWith('.md')) return false;
  return !/\.(en|zh|es|vi|th|uz)\.md$/.test(filename);
}

function countNonWhitespace(text) {
  return text.replace(/\s+/g, '').length;
}

function slugHash(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

// title / summary / 본문에서 지역명, 노선, 시간 추출
function extractMeta(frontmatter, body) {
  const title = typeof frontmatter.title === 'string' ? frontmatter.title : '';
  const summary = typeof frontmatter.summary === 'string' ? frontmatter.summary : '';

  // 지역명: title 앞부분에서 첫 한글 구역(공백/·/- 이전) 추출
  let region = '';
  const titleMatch = title.match(/^[\s]*([가-힣A-Za-z0-9]+(?:[·][가-힣A-Za-z0-9]+)*)/);
  if (titleMatch) {
    // 첫 단어만 사용 (예: "안산 고잔·단원·중앙동 ..." → "안산")
    region = titleMatch[1].split(/[·\s]/)[0];
    // 지역명 뒤 조사 제거 (예: "안성에서" → "안성")
    region = region.replace(/(에서|에는|에도|에게|으로|로서|로써|으로서|으로써|로|에|의|은|는|이|가|을|를|과|와|도|만|까지|부터|조차)$/u, '');
  }
  if (!region) region = '해당 지역';

  // 노선 추출
  const routeRe = /(1호선|2호선|3호선|4호선|5호선|6호선|7호선|8호선|9호선|중앙선|경의중앙선|공항철도|신분당선|GTX|KTX|광역버스|고속버스|경강선|수인분당선|우이신설선|서해선|신림선)/g;
  const routesInTitle = title.match(routeRe) || [];
  const routesInSummary = summary.match(routeRe) || [];
  const routes = [...new Set([...routesInTitle, ...routesInSummary])];
  const route = routes[0] || '지하철 또는 광역버스';

  // 분 추출: summary 또는 body에서 "약 X분" / "X분"
  const minRe = /약\s*([0-9]{2,3})\s*[~〜\-–—]?\s*([0-9]{2,3})?\s*분/;
  const joined = summary + '\n' + body;
  const minMatch = joined.match(minRe);
  let minutes = 60;
  if (minMatch) {
    const low = parseInt(minMatch[1], 10);
    const high = minMatch[2] ? parseInt(minMatch[2], 10) : low;
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      minutes = Math.round((low + high) / 2);
    } else if (!Number.isNaN(low)) {
      minutes = low;
    }
  }

  return { region, route, minutes };
}

// ─────────────────────────────────────────────────────────
// Sub-section 빌더 (5개 변형)
//   각 변형은 A/B/C/D 4개 sub-section 순서와 H3 제목, 도입문을 달리함.
// ─────────────────────────────────────────────────────────
function secChecklist(ctx, variant) {
  const titles = [
    '방문 전 체크리스트',
    '예약·준비 체크리스트',
    '세션 당일 준비물 체크',
    '방문 전에 꼭 확인할 사항',
    '녹음 전 준비 체크리스트',
  ];
  const intros = [
    '세션 당일 당황하지 않도록, 방문 전 다음 항목을 미리 준비해두시면 좋습니다.',
    '처음 방문하시는 분들이 자주 놓치는 항목을 정리했습니다.',
    '짧은 시간 안에 최상의 결과물을 얻기 위해 아래 준비물을 확인해주세요.',
    '당일 현장에서 보정이 어려운 항목 위주로 체크리스트를 정리했습니다.',
    '녹음 퀄리티는 준비에서 결정됩니다. 아래 항목을 출발 전에 훑어보세요.',
  ];
  const { region, minutes } = ctx;
  const lines = [
    `- **예약**: 카카오톡 채널 또는 contact 페이지로 사전 예약해주세요. 평일 오전~오후 시간대가 비교적 한산합니다.`,
    `- **MR 파일**: WAV 또는 고음질 MP3(320kbps 이상)를 권장합니다. USB 드라이브나 카카오톡으로 미리 전송 가능합니다.`,
    `- **가사**: 출력본을 지참하시거나 스마트폰에 PDF로 저장해두시면 세션 진행이 매끄럽습니다.`,
    `- **컨디션**: 전날 충분한 수면과 수분 섭취, 당일 음주·과식·찬 음료는 피해주세요.`,
    `- **이동 여유**: ${region}에서 출발하실 경우 약 ${minutes}분 + 준비 시간 15분, 총 ${minutes + 15}분 여유를 두시면 안정적입니다.`,
  ];
  return [
    `### ${titles[variant % titles.length]}`,
    '',
    intros[variant % intros.length],
    '',
    ...lines,
  ].join('\n');
}

function secRoute(ctx, variant) {
  const titles = [
    '연신내역 도착 후 동선',
    '연신내역 4번 출구에서 스튜디오까지',
    '연신내 도착 후 이동 안내',
    '연신내역에서 스튜디오 놀까지',
    '연신내 현지 동선 가이드',
  ];
  const intros = [
    `${ctx.region} 방향에서 도착하신 분들이 가장 많이 이용하는 경로입니다.`,
    '연신내역 주변은 환승 통로가 넓어 길 찾기는 어렵지 않지만, 첫 방문 시 참고하세요.',
    '연신내역 출구가 여러 개라 4번 출구 기준으로 동선을 정리했습니다.',
    `${ctx.region}에서 오신 분들이 자주 헷갈리는 출구 이슈를 먼저 짚어드립니다.`,
    '역사 안내 표지만 따라오셔도 충분하지만, 편의를 위해 동선을 미리 공유드립니다.',
  ];
  const lines = [
    `- **하차역**: 서울 지하철 6호선 연신내역 (3호선 환승역), 4번 출구에서 도보 약 5분 거리입니다.`,
    `- **현지 도보 경로**: ${ctx.region}에서 ${ctx.route}을(를) 이용해 도착하신 분들이 자주 이용하는 경로로, 출구에서 동명여고 방향으로 계속 직진 → 동명여고를 지나면 1층에 카센터가 있는 건물 3층입니다.`,
    `- **입구**: 스튜디오 입구는 역 인근 건물 내부에 위치하며, 방문 당일 안내된 동 호수 / 층 정보를 참고해주세요.`,
    `- **주변 인프라**: 도보 5분 이내에 카페, 편의점, 간단한 식사가 가능한 매장이 다수 있어 세션 전후 이용에 편리합니다.`,
    `- **야간 방문**: 6호선 연신내역은 새벽 시간대까지 운행되지만, 귀가 시 ${ctx.region} 방향 막차 시간을 미리 확인해주세요.`,
  ];
  return [
    `### ${titles[variant % titles.length]}`,
    '',
    intros[variant % intros.length],
    '',
    ...lines,
  ].join('\n');
}

function secAfterRec(ctx, variant) {
  const titles = [
    '녹음 후 음원 활용 가이드',
    '세션 이후 음원 후속 작업',
    '녹음 파일을 발매까지 연결하기',
    '녹음 이후 유통·발매 옵션',
    '완성된 음원을 유통하는 법',
  ];
  const intros = [
    `${ctx.region} 아티스트분들이 녹음 이후 가장 많이 물어보시는 후속 작업을 정리했습니다.`,
    '세션에서 받은 파일을 어떻게 활용할지에 따라 최종 결과물이 달라집니다.',
    '녹음 자체만큼 중요한 "이후 단계" 옵션을 간단히 안내합니다.',
    `${ctx.region} 지역 활동 계획이 있다면, 발매 단계까지 염두에 두고 녹음 포맷을 선택하시는 것을 권장합니다.`,
    '완성된 음원을 발매·유통하는 방법을 요약했습니다.',
  ];
  const lines = [
    `- **국내 발매 플랫폼**: 멜론, 지니, 바이브, 플로, 카카오뮤직 등에 유통할 수 있습니다.`,
    `- **글로벌 플랫폼**: 스포티파이, 애플뮤직, 아마존뮤직, 유튜브뮤직 등 해외 스트리밍으로 확장 가능합니다.`,
    `- **유통 대행사**: Distrokid, Tunecore, Amuse, LOEN(멜론뮤직), (주)포크라노스 등에서 발매 대행 서비스를 이용할 수 있습니다.`,
    `- **드라이 보컬만 반출**: 보컬 트랙만 WAV로 받아가서 외부 엔지니어에게 믹싱·마스터링을 의뢰하는 것도 가능합니다.`,
    `- **풀 패키지 의뢰**: 스튜디오 놀에서 녹음·편곡·믹싱·마스터링을 한 번에 진행하면 톤과 밸런스가 일관되게 유지됩니다.`,
    `- **${ctx.region} 활동 연결**: 지역 공연·콘텐츠 제작과 맞물려 발매 일정을 잡으면 홍보 효율이 높아집니다.`,
  ];
  return [
    `### ${titles[variant % titles.length]}`,
    '',
    intros[variant % intros.length],
    '',
    ...lines,
  ].join('\n');
}

function secFaq(ctx, variant) {
  const titles = [
    '자주 받는 추가 질문',
    '방문 전 자주 묻는 질문',
    '추가로 자주 받는 문의',
    '자주 있는 추가 질문 모음',
    '이 외에 자주 받는 질문',
  ];
  const intros = [
    '본문에 담지 못한 세부 문의를 모아두었습니다.',
    `${ctx.region} 및 인근 지역에서 오시는 분들이 자주 문의하시는 내용입니다.`,
    '처음 방문하시는 분들이 많이 묻는 추가 질문을 정리했습니다.',
    '녹음 외적인 실무 관련 문의를 모아두었습니다.',
    '방문 전 확인이 필요한 질문을 간단히 정리했습니다.',
  ];
  const lines = [
    `- **인접 지역에서도 방문 가능한가요?** → 네, ${ctx.region} 뿐 아니라 인근 시·군에서 오시는 분들도 많이 이용하고 계십니다.`,
    `- **단체 녹음이 가능한가요?** → 듀엣·트리오 단위 보컬 녹음은 가능하며, 밴드 합주 녹음은 사전 협의 후 별도 패키지로 안내드립니다.`,
    `- **결제 방식은 어떻게 되나요?** → 현금, 카드, 카카오페이, 계좌이체가 모두 가능합니다.`,
    `- **세금계산서·현금영수증 발급되나요?** → 네, 사전 요청 시 세금계산서 및 현금영수증 발급이 가능합니다.`,
    `- **세션 시간 조정이 가능한가요?** → ${ctx.region}에서 이동 시간이 길어질 수 있는 분들은 사전 협의 시 시작 시간을 유연하게 조정해드립니다.`,
  ];
  return [
    `### ${titles[variant % titles.length]}`,
    '',
    intros[variant % intros.length],
    '',
    ...lines,
  ].join('\n');
}

// 변형별 sub-section 순서: 0=ABCD, 1=BCAD, 2=CDAB, 3=DACB, 4=BADC
const VARIANT_ORDERS = [
  ['A', 'B', 'C', 'D'],
  ['B', 'C', 'A', 'D'],
  ['C', 'D', 'A', 'B'],
  ['D', 'A', 'C', 'B'],
  ['B', 'A', 'D', 'C'],
];

function buildExpansion(ctx, variant) {
  const builders = {
    A: secChecklist,
    B: secRoute,
    C: secAfterRec,
    D: secFaq,
  };
  const order = VARIANT_ORDERS[variant % VARIANT_ORDERS.length];
  const sections = order.map((k) => builders[k](ctx, variant));
  return [MARKER_BEGIN, '', ...sections.map((s) => s + '\n'), MARKER_END].join('\n');
}

// ─────────────────────────────────────────────────────────
// 본문에 보강 섹션 삽입 (마지막 내부링크 줄 직전)
// ─────────────────────────────────────────────────────────
function insertExpansion(rawContent, expansion, rewriteExisting) {
  // 기존 마커 영역이 있으면 교체 또는 skip
  if (MARKER_RE.test(rawContent)) {
    if (!rewriteExisting) return { content: rawContent, inserted: false, replaced: false };
    return {
      content: rawContent.replace(MARKER_RE, expansion),
      inserted: true,
      replaced: true,
    };
  }

  const lines = rawContent.split('\n');
  // 마지막 "](/stories/" 포함 줄 찾기
  let insertIdx = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('](/stories/')) {
      insertIdx = i;
      break;
    }
  }

  // 삽입 (마지막 내부링크 줄 직전)
  const before = lines.slice(0, insertIdx);
  const after = lines.slice(insertIdx);

  // 앞뒤 공백 정돈
  while (before.length > 0 && before[before.length - 1].trim() === '') {
    before.pop();
  }
  const merged = [...before, '', expansion, ''];
  if (after.length > 0) merged.push(...after);

  return {
    content: merged.join('\n'),
    inserted: true,
    replaced: false,
  };
}

// ─────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));

  const files = fs.readdirSync(STORIES_DIR).filter(isKoDefaultStory).sort();
  const candidates = [];

  for (const file of files) {
    const filePath = path.join(STORIES_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed;
    try {
      parsed = matter(raw);
    } catch {
      continue;
    }
    const category = parsed.data && parsed.data.category;
    if (category !== '지역 가이드') continue;

    const body = parsed.content;
    const chars = countNonWhitespace(body);
    const hasMarker = MARKER_RE.test(raw);

    // 1,500자 이상인데 마커 없음 → skip
    // 1,500자 미만 → 대상
    // 마커 있는데 rewrite-existing → 대상
    if (chars >= THIN_CHAR_THRESHOLD && !hasMarker) continue;
    if (hasMarker && !args.rewriteExisting) continue;

    candidates.push({ file, filePath, raw, parsed, chars, hasMarker });
  }

  console.log(`[boost-region-thin] 전체 KO 지역 가이드 후보 스캔 완료`);
  console.log(`[boost-region-thin] 처리 대상 파일: ${candidates.length}개`);
  if (args.dryRun) console.log(`[boost-region-thin] DRY-RUN 모드 (실제 쓰기 없음)`);
  if (args.limit !== Infinity) console.log(`[boost-region-thin] --limit ${args.limit} 적용`);

  const toProcess = candidates.slice(0, args.limit);
  let modified = 0;
  let skipped = 0;
  let warned = 0;

  for (const item of toProcess) {
    const { file, filePath, raw, parsed, chars, hasMarker } = item;
    const slug = file.replace(/\.md$/, '');
    const ctx = extractMeta(parsed.data, parsed.content);
    const variant = slugHash(slug) % VARIANT_ORDERS.length;
    const expansion = buildExpansion(ctx, variant);

    const { content: newContent, inserted, replaced } = insertExpansion(
      raw,
      expansion,
      args.rewriteExisting
    );

    if (!inserted) {
      skipped++;
      continue;
    }

    // 재검증
    let newChars = chars;
    try {
      const newParsed = matter(newContent);
      newChars = countNonWhitespace(newParsed.content);
    } catch {
      // ignore
    }

    const pass = newChars >= THIN_CHAR_THRESHOLD;
    const tag = args.dryRun ? 'DRY' : replaced ? 'REPL' : 'ADD ';
    const marker = pass ? 'OK ' : 'WARN';
    console.log(
      `  [${tag}][${marker}] ${slug.padEnd(40)} ${String(chars).padStart(5)} → ${String(newChars).padStart(5)} ` +
        `(v${variant}, ${ctx.region}/${ctx.route}/${ctx.minutes}분${hasMarker ? ', had-marker' : ''})`
    );
    if (!pass) warned++;

    if (!args.dryRun) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
    modified++;
  }

  console.log(`\n[boost-region-thin] 결과 요약`);
  console.log(`  처리됨: ${modified}개`);
  console.log(`  스킵  : ${skipped}개`);
  console.log(`  미달경고: ${warned}개`);
  if (args.dryRun) console.log(`  (DRY-RUN이므로 실제 파일은 수정되지 않음)`);
}

main();
