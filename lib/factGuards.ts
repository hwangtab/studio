/**
 * 정본 사실(canonical facts) 가드 룰.
 *
 * 단일 진실 소스: docs/wiki/entities/services.md의 "서비스 범위 가드" 박스와
 * docs/wiki/entities/naver-place.md의 연락처·교통 정본. 이 파일의 룰은 그 정본을
 * 콘텐츠 표면(content/stories, public/locales, data, llms API)에 기계적으로 강제한다.
 * 정본이 바뀌면(전화번호 변경, 서비스 추가 등) 위키와 이 파일을 함께 수정할 것.
 *
 * 배경: 2026-06 한 달간 fix 커밋의 절반이 AI 생성 콘텐츠의 사실 오류 상환이었다
 * (보컬레슨 날조 정비 12커밋, 전화번호 0507→010 4스윕 180+파일, 연신내역 출구
 * 3번→4번 전수 정정). 이 게이트는 같은 계열의 허위·drift가 커밋을 통과하지
 * 못하게 하는 사전 차단막이다. content/factGuards.test.ts가 CI에서 전수 스캔한다.
 */

export interface FactGuardRule {
  id: string;
  description: string;
  /** 위반 후보: 라인이 이 패턴에 걸리면 후보로 승격 */
  pattern: RegExp;
  /** 1인칭(스튜디오 자신) 맥락 한정 룰의 마커. 지정 시 같은 라인에 마커가 있어야 후보 */
  marker?: RegExp;
  /** 합법 문맥: 후보 라인부터 allowWindow 라인 안에 이 패턴이 있으면 통과 */
  allow?: RegExp;
  /** allow 탐색 창(후보 라인 포함 라인 수). 기본 3 = 해당 라인 + 다음 2라인 */
  allowWindow?: number;
}

export interface FactViolation {
  file: string;
  line: number;
  ruleId: string;
  excerpt: string;
}

export const FACT_GUARD_RULES: FactGuardRule[] = [
  {
    id: 'legacy-phone-0507',
    description:
      '폐기된 0507 안심번호 금지 — 공식 번호는 010-4255-7893 (wiki/entities/naver-place.md)',
    pattern: /(?:\+?82[-\s.]?)?0?507[-\s.]?1384[-\s.]?3144|050713843144/,
  },
  {
    // 갭에서 '출'·'역'을 배제해 "연신내역 4번 출구 … 불광역 7번 출구"처럼
    // 다른 역·출구 표기를 건너뛰어 매칭하는 오탐을 차단한다.
    id: 'yeonsinnae-exit-number',
    description: '연신내역 출구는 4번 — 3번 등 다른 번호 표기 금지 (2026-06-14 전수 정정 재발 방지)',
    pattern: /연신내\s?역?[^\n출역]{0,20}?(?:[0-35-9]|\d{2,})\s?번\s?출구/,
  },
  {
    id: 'bulgwang-exit-number',
    description: '불광역 출구는 7번 — 다른 번호 표기 금지 (wiki/entities/services.md 접근 정보)',
    pattern: /불광\s?역?[^\n출역]{0,20}?(?:[0-68-9]|\d{2,})\s?번\s?출구/,
  },
  {
    // allow의 '레슨 선택/비교'는 외부 레슨 고르기 가이드 관용구만 면제한다 —
    // 단독 '선택'을 allow에 넣으면 "보컬 레슨을 선택하세요" 같은 판매 문구까지
    // 면제되므로 금지 (2026-07 리뷰에서 확인된 우회 경로).
    id: 'vocal-instrument-lesson-firstparty',
    description:
      '보컬·악기 레슨은 미운영 — 스튜디오 1인칭 맥락에서 부정·외부 안내 없이 언급 금지',
    pattern: /(?:보컬|악기|기타|드럼|피아노|건반)\s?레슨/,
    marker: /스튜디오\s?놀|Studio\s?NOL|저희|\(\/lesson\)|연신내/i,
    allow:
      /않|없|미운영|미제공|외부|학원|코치|트레이너|수강생|플랫폼|레슨\s?선택|선택\s?가이드|레슨\s?비교|비교\s?가이드|\bvs\b/,
  },
  {
    id: 'instrument-lesson-offer-verb',
    description: '보컬·악기류 레슨의 제공·모집 단정 금지 — 프로듀싱(작곡·믹싱·발매) 레슨만 운영',
    pattern:
      /(?:보컬|악기|기타|드럼|피아노|건반|바이올린|베이스)\s?레슨[^\n]{0,20}?(?:별도\s?문의|운영합|제공합|진행합|신청|모집|예약\s?가능|받을\s?수\s?있습)/,
    allow: /않|없|외부|학원|코치|트레이너/,
  },
  {
    id: 'english-engineer-claim',
    description:
      '영어 전담·상주 엔지니어 없음 — 영어 제공은 예약 응대 + 원격 믹싱뿐 (wiki 서비스 범위 가드)',
    pattern:
      /영어\s?(?:전담\s?|상주\s?)?엔지니어|영어[가는\s]{0,3}(?:가능|능통)[한\s]{0,2}엔지니어|english[-\s]speaking\s+(?:sound\s+|audio\s+)?engineer/i,
    allow: /없|않|아니|\bnot?\b/i,
    allowWindow: 2,
  },
  {
    id: 'english-chinese-lesson-fabrication',
    description: '영어·중국어 보컬/음악 레슨 날조 재발 금지 (2026-06-16 삭제된 페이지 계열)',
    pattern: /(?:english|chinese)[-\s]speaking\s+(?:vocal|singing|music)\s+lessons?/i,
    allow: /\bnot?\b|don'?t|doesn'?t|unavailable|않|없/i,
  },
  {
    // 마커에 1인칭 제공 동사(we offer/provide/teach)를 포함 — 스튜디오명 없이
    // "We offer vocal lessons"로 쓰는 날조가 실제 사고 패턴이었다.
    id: 'vocal-lesson-claim-en',
    description: '영문 표면에서 Studio NOL의 vocal/singing lesson 제공 단정 금지',
    pattern: /(?:vocal|singing)\s+lessons?/i,
    marker:
      /studio\s?nol|our\s+studio|\bwe\s+(?:offer|provide|teach|run)\b|\bour\s+(?:lessons?|vocal|singing)\b/i,
    allow: /\bnot?\b|don'?t|doesn'?t|do\s+not|external|instead|않|없/i,
  },
  {
    // 아티스트의 kosmart 소속·제작지원 서술은 합법(고객 이력) — 스튜디오의
    // 모조직 관계 주장(parent organization 류)만 금지한다. 어순 양방향
    // ("모기업 kosmart" / "kosmart는 …의 모기업") + subsidiary 표현 모두 커버.
    id: 'kosmart-parent-claim',
    description:
      'kosmart는 현재 Studio NOL의 모조직 아님 — parent/모기업 표기 금지 (설립 이력 서술은 허용)',
    pattern:
      /(?:parent\s+(?:organization|company)|모기업|모회사|모조직|상위\s?기관)[^\n]{0,40}(?:kosmart|한국스마트협동조합)|(?:kosmart|한국스마트협동조합)[^\n]{0,40}(?:모기업|모회사|모조직|parent\s+(?:organization|company))|(?:subsidiary|자회사|산하\s?기관)[^\n]{0,30}(?:kosmart|한국스마트협동조합)/i,
  },
  {
    // (1) allow에 단독 '가능'을 쓰면 금지 대상인 '불가능'이 자기 자신을 면제한다
    // ('불가능' ⊃ '가능') — 반드시 (?<!불) lookbehind를 유지할 것.
    // (2) "아파트에서 드럼 연습 불가능" 류는 방음 개인실의 셀링 포인트(합법)라
    // 1인칭 마커 + 주거·비유 문맥 allow로 스튜디오 자신의 배제 단정만 잡는다.
    id: 'drum-exclusion-claim',
    description: '드럼 녹음 배제 단정 금지 — 의뢰 시 가능이 정본 (wiki 서비스 범위 가드)',
    pattern:
      /드럼[^\n]{0,12}(?:불가|안\s?됩니다|받지\s?않|지원하지\s?않|제공하지\s?않|이용할?\s?수\s?없)/,
    marker: /스튜디오\s?놀|Studio\s?NOL|저희|연신내/i,
    allow: /의뢰|문의|(?<!불)가능|아파트|자택|가정|상가|단지|이웃|층간|예측/,
  },
];

const FRONTMATTER_EXEMPT_KEYS = new Set(['tags', 'keywords', 'category', 'categories']);

/**
 * 마크다운 raw 라인 중 스캔 제외 대상(frontmatter의 tags/keywords 블록) 마스크를 계산.
 * SEO 키워드 타겟팅(예: "연신내 보컬 레슨")은 검색 수요 포착용이라 사실 주장으로 보지 않는다.
 * 본문·title·summary·faq는 전부 스캔 대상.
 */
export function frontmatterExemptMask(lines: string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false);
  if (lines[0]?.trim() !== '---') return mask;

  let currentKey = '';
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const keyMatch = line.match(/^([A-Za-z_][\w-]*):/);
    if (keyMatch) currentKey = keyMatch[1];
    if (FRONTMATTER_EXEMPT_KEYS.has(currentKey)) mask[i] = true;
  }
  return mask;
}

export function findFactViolations(
  raw: string,
  file: string,
  options: { markdown?: boolean } = {},
): FactViolation[] {
  const lines = raw.split('\n');
  const exempt = options.markdown ? frontmatterExemptMask(lines) : null;
  const violations: FactViolation[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (exempt?.[i]) continue;
    const line = lines[i];

    for (const rule of FACT_GUARD_RULES) {
      if (!rule.pattern.test(line)) continue;
      // 마커는 앞뒤 1라인까지 본다 — "저희 스튜디오는 …\n보컬 레슨도 …"처럼
      // 마커와 주장이 줄바꿈으로 갈라진 문단 수준 주장을 잡기 위함.
      if (rule.marker) {
        const markerWindow = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
        if (!rule.marker.test(markerWindow)) continue;
      }
      // allow도 직전 라인을 포함 — 부정어가 문법상 앞 줄에 오는 합법 문맥의 오탐 방지.
      if (rule.allow) {
        const windowSize = rule.allowWindow ?? 3;
        const window = lines.slice(Math.max(0, i - 1), i + windowSize).join('\n');
        if (rule.allow.test(window)) continue;
      }
      violations.push({
        file,
        line: i + 1,
        ruleId: rule.id,
        excerpt: line.trim().slice(0, 160),
      });
    }
  }

  return violations;
}
