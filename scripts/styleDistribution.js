#!/usr/bin/env node
'use strict';

/**
 * scripts/styleDistribution.js
 *
 * content/stories/ 의 한국어 원본 스토리를 문장 종결 어미(습니다체 vs
 * 어요체)로 분류해 분포를 "실행 시점에" 측정한다.
 *
 * 왜 이 스크립트가 존재하는가
 * ---------------------------
 * docs/content-guidelines.md §2에 "습니다 우세 1,194편(76%), 혼재 258편
 * (16%), 어요 우세 123편(8%)"라는 실측치가 박혀 있었다. 그 수치는
 * 재현되지 않았다 — 같은 방법(1.5배 우세 기준)을 다시 돌리면 다른 숫자가
 * 나오고, 어미 집합을 조금만 바꿔도 또 다른 숫자가 나온다. 이 프로젝트에서
 * "측정치를 문서에 박아 넣었다가 재현 안 되는" 사고가 이걸로 세 번째다
 * (diff-hunk 집계, 진단 결과 집계, 그리고 이 문체 분포). 패턴은 명확하다
 * — 문서에 박힌 숫자는 다시 검증할 방법이 없다. scripts/structureIntegrity.js가
 * "구조가 안 바뀌었다"를 문서 서술 대신 스크립트로 증명하는 것과 같은
 * 이유로, 이 스크립트는 "문체가 이렇게 분포한다"를 문서 서술 대신
 * 실행 결과로 증명한다. docs/content-guidelines.md는 이제 숫자를
 * 박지 않고 "이 스크립트를 돌려라"라고만 말한다.
 *
 * 분류 대상
 * ---------
 * content/stories/*.md 중 로케일 접미사(.en/.zh/.es/.vi/.th/.uz)가 없는
 * 한국어 원본만 대상으로 한다. scripts/proseSegments.js의 extractProse()로
 * 프론트매터·표·목록·제목·코드펜스·디렉티브·인용문을 먼저 걷어내고,
 * 순수 산문 블록에서만 어미를 센다 — 제목("~가 아니다" 같은 평서형 표제)이나
 * 표 셀 안의 텍스트가 문체 판정에 섞여 들어가는 걸 막기 위해서다.
 *
 * 어미 집합과 그 근거
 * --------------------
 * 습니다체(하십시오체) 판정: 리터럴 "니다" 서브스트링.
 *   "습니다"(먹습니다)와 "ㅂ니다"(합니다/됩니다/입니다) 두 활용형 모두
 *   표면 문자열에 "니다"를 포함하므로, 이 하나의 패턴으로 두 활용을 동시에
 *   잡는다 — 원래 가이드라인처럼 "습니다"만 리터럴로 찾으면 어간이 모음으로
 *   끝나는 동사(합니다/됩니다/입니다류, 이 코퍼스에서 가장 흔한 활용)를
 *   전부 놓친다.
 *   "니까"(습니까/ㅂ니까, 의문형)는 일부러 formal 집합에서 뺐다 —
 *   extractProse로 걸러낸 산문만 놓고 보면 "니까"는 205회 등장하는데,
 *   물음표로 끝나는(=진짜 의문형일 가능성이 있는) 경우는 0회다. 205회
 *   전부 "-(으)니까"(원인·이유를 뜻하는 연결어미, "바쁘니까 나중에")이고,
 *   이 연결어미는 문체와 무관하게 모든 등록(register)에서 똑같이 흔하다.
 *   그대로 넣으면 노이즈가 신호보다 훨씬 커진다.
 *   "니다"에는 두 가지 예외를 lookbehind로 뺐다(모두 산문 기준 실측치):
 *     - "아니다"(12회) — "아니-"+"-다"(평서형 종결, 이다/아니다 계열)로,
 *       하십시오체 어미 "-습니다/-ㅂ니다"와 표면상 같은 3음절로 끝나지만
 *       문법적으로 다른 형태소다. 그대로 두면 반말/평서체 문장("~가
 *       아니다.")이 습니다체로 잘못 집계된다.
 *     - 어간 "다니(다)"(2회, "공연을 다니다 보니") — 동사 "다니다"의
 *       사전형이 우연히 "다"+"니다"로 끝난다. 실제 형식 종결형(다닙니다/
 *       다녔습니다 등)은 다른 음절이 "니다" 앞에 오므로 이 예외로
 *       걸러지지 않는다 — 별도로 확인함(아래 테스트 참고).
 *   두 예외 모두 실제 코퍼스 검수("니다" 앞 글자 전수 분포)로 확인한
 *   것이며, 그 외의 모든 선행 음절(합/입/습/됩/집/옵/갑 등, 수십 종)은
 *   전부 정상적인 "-ㅂ니다/-습니다" 활용이었다.
 *
 * 어요체(해요체) 판정: 아요/어요/워요/여요/해요/에요/예요/거든요/네요/
 *   군요/세요/고요 중 하나. 이 중 "고요"가 유일하게 진짜 모호한 경우다 —
 *   "고요"는 연결형 종결 어미("그렇고요", "괜찮고요")로도 쓰이지만
 *   명사·형용사 "고요"(정적·조용함, "고요함", "고요하다")로도 쓰인다. 이
 *   사이트는 방음·연습실 콘텐츠가 많아 후자가 실제로 등장한다
 *   (practice-room-night1.md의 "고요함", session1.md의 "고요하기" 등).
 *   extractProse로 걸러낸 순수 산문만 놓고 전수 확인한 결과 "고요"는
 *   241회 등장했고, 그중 명사·형용사형(고요함 2회, 고요하다 활용형 1회)은
 *   3회뿐이었다 — 나머지 238회는 전부 앞에 오는 용언 어간에 바로 붙어
 *   문장·절을 끝내는 연결어미 용법이었다. 이 관찰을 바탕으로 다음 경계로
 *   명사·형용사형을 배제한다: 어미로 셀 때는 (a) "고요" 바로 앞에 공백
 *   없이 한글 음절이 와야 하고(=독립된 단어가 아니라 어간에 붙음),
 *   (b) "고요" 바로 뒤에 한글 음절이 오면 안 된다(=조사·활용 어미가 붙은
 *   명사·형용사형이 아님). 이 두 조건은 12개 어미 전부에 동일하게
 *   적용했다 — 한국어 종결/연결 어미는 다음 음절 없이 문장부호·공백·
 *   문서 끝으로 이어지는 반면, 조사·활용 어미가 붙은 명사·형용사형은
 *   다음 음절이 바로 이어지기 때문이다. 이 경계로 앞서 말한 명사·형용사형
 *   3회(고요함 2회, 고요하다 1회)와 괄호 뒤 명사형 1회("폭발→고요)")까지
 *   총 4회의 비-어미 용법이 전부 걸러졌다. 대가는 정확히 1건의 미탐지뿐
 *   이었다 — 인용부호 바로 뒤에 오는 "…같다"고요."처럼 앞 글자가
 *   한글이 아니라 닫는 인용부호인 극소수 사례. 즉 이 경계는 "고요" 241회
 *   중 노이즈 4회를 걸러내는 대가로 신호 1회를 놓치는 선택이며, 걸러내는
 *   쪽의 손실(오분류로 이어짐)이 훨씬 크므로 보수적으로 이 방향을 택했다.
 *
 * 우세 기준
 * ---------
 * 파일별 formal / colloquial 카운트 중 큰 쪽이 작은 쪽의
 * DOMINANCE_THRESHOLD(1.5)배 이상이면 그 문체가 "우세"하다고 본다.
 * 어느 쪽도 1.5배를 넘지 못하면 "혼재". 두 카운트를 합쳐도
 * MIN_TOTAL_FOR_CLASSIFICATION(3) 미만이면 표본이 너무 적어 "판별 불가"로
 * 둔다(산문이 극히 짧거나 표·목록 위주라 종결 어미 자체가 거의 없는 파일).
 * 1.5배는 원래 가이드라인 문서가 쓰던 기준을 그대로 유지했다 — "명백한
 * 우세"를 표현하는 데 무리 없는 값이고, 이 스크립트가 실제로 바꾼 것은
 * 임계값이 아니라 "어미를 무엇으로 셀지"와 "그 수를 어떻게 재현 가능하게
 * 만들지"이기 때문이다.
 *
 * 사용법
 * ------
 *   node scripts/styleDistribution.js            # 사람이 읽는 요약
 *   node scripts/styleDistribution.js --json      # 기계 판독용 JSON
 *   node scripts/styleDistribution.js --top=20    # 어요 우세 상위 N개(기본 10)
 *
 * 종료 코드는 항상 0이다 — 이건 게이트가 아니라 리포팅 도구다.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { extractProse } = require('./proseSegments');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');
const LOCALE_SUFFIX_RE = /\.(en|zh|es|vi|th|uz)\.md$/;

const DOMINANCE_THRESHOLD = 1.5;
const MIN_TOTAL_FOR_CLASSIFICATION = 3;
const DEFAULT_TOP_N = 10;

const HANGUL = '가-힣';

// "니다"(습니다/ㅂ니다) — "아니다"(평서형 이다/아니다 계열)와 "다니(다)"
// (동사 "다니다"의 사전형)는 표면만 같고 형태소가 다르므로 lookbehind로 제외.
const FORMAL_ENDING_RE = /(?<!아)(?<!다)니다(?![가-힣])/g;

// 해요체 어미. "고요"의 명사/어미 모호성 처리는 파일 상단 주석 참고.
const COLLOQUIAL_SUFFIXES = [
  '거든요', '잖아요', // (참고) '잖아요'는 '아요'로도 잡히지만 가독성을 위해 명시
  '에요', '예요', '네요', '군요', '세요',
  '아요', '어요', '워요', '여요', '해요', '고요',
].sort((a, b) => b.length - a.length);
const COLLOQUIAL_ENDING_RE = new RegExp(
  `(?<=[${HANGUL}])(?:${COLLOQUIAL_SUFFIXES.join('|')})(?![${HANGUL}])`,
  'g',
);

/** 순수 텍스트에서 formal/colloquial 어미 개수를 센다. */
function countEndings(proseText) {
  const formal = (proseText.match(FORMAL_ENDING_RE) || []).length;
  const colloquial = (proseText.match(COLLOQUIAL_ENDING_RE) || []).length;
  return { formal, colloquial };
}

/**
 * formal/colloquial 카운트로부터 카테고리를 정한다.
 * @returns {'formal-dominant'|'colloquial-dominant'|'mixed'|'undetermined'}
 */
function classifyByCounts(formal, colloquial) {
  const total = formal + colloquial;
  if (total < MIN_TOTAL_FOR_CLASSIFICATION) return 'undetermined';
  if (formal >= colloquial * DOMINANCE_THRESHOLD) return 'formal-dominant';
  if (colloquial >= formal * DOMINANCE_THRESHOLD) return 'colloquial-dominant';
  return 'mixed';
}

/**
 * 마크다운 원문(프론트매터 포함) 한 편을 분류한다.
 * 테스트는 이 함수를 직접 호출한다 — 셸 아웃하지 않는다.
 * @param {string} markdown
 * @returns {{formal:number, colloquial:number, category:string}}
 */
function classifyStoryText(markdown) {
  const { content } = matter(markdown);
  const { segments } = extractProse(content);
  const proseText = segments.map((s) => s.text).join('\n');
  const { formal, colloquial } = countEndings(proseText);
  return { formal, colloquial, category: classifyByCounts(formal, colloquial) };
}

function getKoreanOriginalFiles() {
  if (!fs.existsSync(STORIES_DIR)) return [];
  return fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md') && !LOCALE_SUFFIX_RE.test(f))
    .sort();
}

function analyze() {
  const files = getKoreanOriginalFiles();
  const results = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(STORIES_DIR, file), 'utf-8');
    const { formal, colloquial, category } = classifyStoryText(raw);
    return { slug, file, formal, colloquial, category };
  });

  const categories = {
    'formal-dominant': results.filter((r) => r.category === 'formal-dominant'),
    mixed: results.filter((r) => r.category === 'mixed'),
    'colloquial-dominant': results.filter((r) => r.category === 'colloquial-dominant'),
    undetermined: results.filter((r) => r.category === 'undetermined'),
  };

  return { results, categories, total: results.length };
}

function pct(count, total) {
  return total === 0 ? '0.0' : ((count / total) * 100).toFixed(1);
}

function printSummary(analysis, topN) {
  const { categories, total } = analysis;
  const CATEGORY_LABELS = {
    'formal-dominant': '습니다 우세',
    mixed: '혼재',
    'colloquial-dominant': '어요 우세',
    undetermined: '판별 불가',
  };

  console.log('\n=== 문체 분포 (습니다체 vs 어요체) ===\n');
  console.log(`대상: content/stories/ 한국어 원본 ${total}편`);
  console.log(`우세 기준: 큰 쪽이 작은 쪽의 ${DOMINANCE_THRESHOLD}배 이상 (표본 ${MIN_TOTAL_FOR_CLASSIFICATION}건 미만은 판별 불가)\n`);

  ['formal-dominant', 'mixed', 'colloquial-dominant', 'undetermined'].forEach((key) => {
    const list = categories[key];
    console.log(`  ${CATEGORY_LABELS[key]}: ${list.length}편 (${pct(list.length, total)}%)`);
  });

  const topColloquial = [...categories['colloquial-dominant']]
    .sort((a, b) => b.colloquial - a.colloquial)
    .slice(0, topN);

  if (topColloquial.length > 0) {
    console.log(`\n--- 어요 우세 상위 ${topColloquial.length}편 (원본 대조용) ---`);
    topColloquial.forEach((r) => {
      console.log(`  ${r.slug}  (습니다 ${r.formal} / 어요 ${r.colloquial})`);
    });
  }
  console.log();
}

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const topArg = args.find((a) => a.startsWith('--top='));
  const topN = topArg ? parseInt(topArg.split('=')[1], 10) || DEFAULT_TOP_N : DEFAULT_TOP_N;

  const analysis = analyze();

  if (jsonMode) {
    const { categories, total } = analysis;
    const summary = {};
    Object.entries(categories).forEach(([key, list]) => {
      summary[key] = { count: list.length, pct: Number(pct(list.length, total)) };
    });
    const topColloquial = [...categories['colloquial-dominant']]
      .sort((a, b) => b.colloquial - a.colloquial)
      .slice(0, topN)
      .map((r) => ({ slug: r.slug, formal: r.formal, colloquial: r.colloquial }));

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      total,
      dominanceThreshold: DOMINANCE_THRESHOLD,
      minTotalForClassification: MIN_TOTAL_FOR_CLASSIFICATION,
      summary,
      topColloquial,
    }, null, 2));
  } else {
    printSummary(analysis, topN);
  }

  process.exit(0);
}

module.exports = {
  countEndings,
  classifyByCounts,
  classifyStoryText,
  FORMAL_ENDING_RE,
  COLLOQUIAL_ENDING_RE,
  DOMINANCE_THRESHOLD,
  MIN_TOTAL_FOR_CLASSIFICATION,
};

if (require.main === module) {
  main();
}
