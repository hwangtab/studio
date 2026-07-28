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

import { CANONICAL_FACTS } from './factTokens';

/** 스캔 표면 분류: markdown=content/stories, locales=public/locales JSON, code=data·pages·components */
export type FactGuardSurface = 'markdown' | 'locales' | 'code';

export interface FactGuardRule {
  id: string;
  description: string;
  /** 위반 후보: 라인이 이 패턴에 걸리면 후보로 승격 */
  pattern: RegExp;
  /** 1인칭(스튜디오 자신) 맥락 한정 룰의 마커. 지정 시 같은 라인±1에 마커가 있어야 후보 */
  marker?: RegExp;
  /** 합법 문맥: 후보 직전 라인부터 allowWindow 라인 안에 이 패턴이 있으면 통과 */
  allow?: RegExp;
  /** allow 탐색 창(후보 라인 포함 라인 수). 기본 3 = 해당 라인 + 다음 2라인 */
  allowWindow?: number;
  /** 지정 시 해당 표면에만 적용. 생략하면 전 표면 적용 */
  surfaces?: FactGuardSurface[];
  /**
   * true면 frontmatter tags/keywords 면제를 무시하고 그 라인들도 검사.
   * SEO 키워드 타겟팅("연신내 보컬 레슨")은 면제가 맞지만, 전화번호 같은
   * 회전 사실은 태그에 있어도 메타로 렌더되므로 반드시 검사해야 한다.
   */
  includeExemptFrontmatter?: boolean;
}

export interface FactViolation {
  file: string;
  line: number;
  ruleId: string;
  excerpt: string;
}

// 현재 공식 번호의 하드코딩 탐지 패턴을 CANONICAL_FACTS에서 파생 — 번호를
// factTokens.js에서 바꾸면 이 가드가 자동으로 새 번호의 하드코딩을 추적한다
// (폐기 번호는 legacy-phone-0507처럼 정적 룰로 별도 등재할 것).
function currentPhoneHardcodePattern(): RegExp {
  const groups = (CANONICAL_FACTS.phone as string).split('-'); // 예: ['010','4255','7893']
  const sep = '[-\\s.]?';
  const intlFirstGroup = groups[0].replace(/^0/, ''); // '010' → '10' (+82 표기)
  return new RegExp(
    `(?:\\+82${sep}${intlFirstGroup}|${groups[0]})${sep}${groups.slice(1).join(sep)}`,
  );
}

export const FACT_GUARD_RULES: FactGuardRule[] = [
  {
    id: 'legacy-phone-0507',
    description:
      '폐기된 0507 안심번호 금지 — 공식 번호는 010-4255-7893 (wiki/entities/naver-place.md)',
    pattern: /(?:\+?82[-\s.]?)?0?507[-\s.]?1384[-\s.]?3144|050713843144/,
  },
  {
    // 마크다운 본문에는 %%phone%% / %%phone-intl%% 토큰만(lib/factTokens.js가 로드 시
    // 치환), 로케일 JSON·UI 카피에는 siteConfig.contact.phone 참조만 허용 — 하드코딩이
    // 다시 들어오면 다음 번호 변경 때 전수 스윕이 재발한다. 패턴을 CANONICAL_FACTS에서
    // 파생시키므로 번호가 바뀌면 가드도 자동으로 새 번호의 하드코딩을 쫓는다.
    id: 'phone-hardcoded-in-content',
    description:
      '본문·로케일에 전화번호 하드코딩 금지 — %%phone%% 토큰/siteConfig 참조 사용 (단일 소스: lib/factTokens.js)',
    pattern: currentPhoneHardcodePattern(),
    surfaces: ['markdown', 'locales'],
    includeExemptFrontmatter: true,
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
    // 2026-07-28: hubLocaleContentData(data/faq.ts)가 6개 언어로 "K-pop 보컬 테크닉·한국어
    // 발음·퍼포먼스 스타일링" 커리큘럼을 광고하고 있었다. 기존 vocal-lesson-claim-en은
    // "vocal lessons"라는 명사구만 잡아서 "vocal techniques"를 통과시켰고, 중국어·스페인어·
    // 베트남어·태국어 표기는 아예 커버되지 않았다. 언어별 '보컬/발성 지도' 표현을 직접 막는다.
    id: 'vocal-technique-teaching-multilang',
    description:
      '보컬·발성 지도는 미운영 — 어떤 언어로도 보컬 테크닉을 우리 커리큘럼으로 광고 금지',
    pattern:
      /vocal\s+techniques?|singing\s+techniques?|Korean\s+pronunciation\s+for\s+lyrics|声乐技巧|唱法技巧|Técnicas?\s+[Vv]ocal(?:es)?|Kỹ\s+thuật\s+Hát|เทคนิคการร้อง|vokal\s+texnikasi/i,
    // 보컬 테크닉을 설명하는 정보성 글(diaphragm1·posture1)과 성악 교육사 서술
    // (벨칸토·CVT·SLS 같은 고유 메서드명)은 정상 콘텐츠다. 막아야 하는 건 "우리 커리큘럼이
    // 그걸 가르친다"는 1인칭 교습 주장뿐이므로, 마커를 소유격 1인칭으로 좁힌다.
    marker:
      /our\s+curriculum|Nuestro\s+currículo|우리\s?(?:커리큘럼|레슨|수업)|저희\s?(?:커리큘럼|레슨|수업)|课程涵盖|chương\s+trình\s+(?:của\s+chúng\s+tôi|học)|หลักสูตรของเรา|Dasturimiz|\bwe\s+(?:teach|train)\b/i,
    allow: /않|없|미운영|미제공|외부|\bnot?\b|don'?t|doesn'?t|不提供|no\s+ofrecemos|không\s+cung\s+cấp|ไม่ให้บริการ/i,
  },
  {
    // 같은 블록에 있던 "C-4 아티스트 비자 안내", "KOMCA 등록 지원" — 스튜디오가 제공한
    // 적 없는 행정·법률 성격 서비스다. 잘못 믿고 온 외국인 아티스트에게 실질 피해가 간다.
    id: 'visa-komca-agency-claim',
    description: '비자 안내·저작권협회 등록 대행은 제공 서비스가 아님 — 1인칭 지원 단정 금지',
    // KOMCA 등록 절차를 설명하는 정보성 글(copyright1·distribution1 등)은 정상 콘텐츠이자
    // 이 사이트의 핵심 자산이다. 막아야 하는 건 "우리가 대신 처리해 준다"는 서비스 주장뿐이다.
    // 그래서 비자는 C-4 문맥에서만, KOMCA는 1인칭 지원 동사와 붙을 때만 잡는다.
    pattern:
      /C-4[^\n]{0,60}(?:visa|비자|签证)|(?:artist\s+visa|아티스트\s?비자|艺术家签证)|KOMCA\s+support|KOMCA[^\n]{0,30}(?:대행|등록을?\s?지원|가입\s?지원)/i,
    marker:
      /\bwe\s+(?:help|guide|assist|support|handle|navigate)\b|저희(?:가|는)?\s?(?:도와|지원|대행)|스튜디오\s?놀(?:이|에서)?\s?(?:도와|지원|대행)|Studio\s?NOL[^\n]{0,40}(?:help|support|assist)/i,
    allow: /않|없|미제공|대행하지|\bnot?\b|don'?t|doesn'?t|不提供/i,
  },
  {
    // 해외 결제 수단(PayPal·위챗페이·알리페이·은련) 주장. 2026-07-28 황경하 확인:
    // 전부 받지 않는다. 결제 조건 오안내는 실제 거래 분쟁으로 이어진다.
    id: 'foreign-payment-method-claim',
    description: 'PayPal·위챗페이·알리페이·은련카드 미지원 — 결제 수단으로 안내 금지',
    pattern: /PayPal|微信支付|微信付款|支付宝|银联|Alipay|WeChat\s+Pay|UnionPay/i,
    // "한국 스튜디오는 대체로 계좌이체·카드이고, 일부는 은련카드를 받기도 하니 미리 물어보라"는
    // 식의 시장 안내는 정상 콘텐츠다(zh 외국인 가이드). 막는 건 우리가 받는다는 단정뿐이다.
    allow:
      /않|없|미지원|불가|\bnot?\b|don'?t|doesn'?t|不支持|部分工作室|一定要提前问|建议提前|不是默认选项/i,
  },
  {
    // "中文工作人员常驻", "Experiencia en Estudio en Español" 계열 — 해당 언어 상주 인력·
    // 서면 자료 주장. 영어 응대(예약+원격 믹싱) 외에는 다국어 인력이 없다.
    id: 'non-english-staff-claim',
    description:
      '중국어·스페인어·베트남어·태국어 상주 인력/서면 자료 없음 — 영어 응대 외 다국어 지원 단정 금지',
    pattern:
      /中文工作人员|中文服务|中文版本|中文发票|中文设备|Estudio\s+en\s+Español|Studio\s+bằng\s+Tiếng\s+Việt|สตูดิโอภาษาไทย|hóa\s+đơn[^\n]{0,20}tiếng\s+Việt/i,
    allow: /않|없|미제공|\bnot?\b|不提供/i,
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
  options: { surface?: FactGuardSurface } = {},
): FactViolation[] {
  const surface: FactGuardSurface = options.surface ?? 'code';
  const lines = raw.split('\n');
  const exempt = surface === 'markdown' ? frontmatterExemptMask(lines) : null;
  const violations: FactViolation[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    for (const rule of FACT_GUARD_RULES) {
      if (rule.surfaces && !rule.surfaces.includes(surface)) continue;
      if (exempt?.[i] && !rule.includeExemptFrontmatter) continue;
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
