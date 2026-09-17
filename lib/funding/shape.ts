import { isSafeObjectKey } from './objectKey';

export interface FundingReward {
  id: string; title: string; description: string; amount: number;
  totalQuantity: number | null; requiresShipping: boolean; estimatedDelivery: string; image: string | null;
  /**
   * 디지털 리워드로 내려받을 파일들. 비어 있지 않으면 결제 확정 메일과 후원 확인 페이지에
   * 내려받기 줄이 붙는다(lib/funding/email.ts · pages/[locale]/funding/manage/[orderNo].tsx).
   *
   * **목록인 이유**: 예전엔 리워드당 주소가 하나였는데, 그러면 상위 티어가 상위 음질
   * *하나만* 받는다. 5만원을 낸 사람이 1.8GB짜리 24bit 원본만 받아 휴대폰에서는 들을 수가
   * 없었고, 3만원 티어는 설명이 "MP3에 더해 WAV"라고 약속해 놓고 WAV 하나만 줬다.
   * 상위 티어는 하위 티어가 주는 것을 전부 포함해야 한다.
   *
   * `label`은 메일과 화면에 그대로 보인다. 주소 세 줄을 이름 없이 늘어놓으면 어느 것이
   * 무엇인지 알 수 없다.
   *
   * `key`는 저장소(R2) 안의 객체 경로이지 주소가 아니다. **밖으로 나가는 것은 이 키뿐**이고,
   * 실제 내려받기 주소는 요청 시점에 서명해 만든다(lib/funding/r2.ts). 예전에 공개 주소를
   * 그대로 실어 보내던 시절에는 게이트를 건너뛰고 받을 수 있어, 파일을 전부 받은 뒤
   * 전액 셀프 환불이 성립했다.
   */
  downloads: FundingDownload[];
}

export interface FundingDownload {
  label: string;
  /** 저장소 객체 키. 주소가 아니다 — 서명 주소는 발급 시점에 만든다. */
  key: string;
}
export interface FundingProject {
  slug: string; title: string; summary: string; cover: string; ogImage: string | null;
  /**
   * 히어로 배경. 없으면 `cover`를 쓴다.
   *
   * `cover`는 목록 카드·OG 이미지가 함께 쓰는 16:9 표지라 **작품 표지에 맞춰** 고른다.
   * 히어로는 흰 글씨를 얹는 자리라 요구가 다르다 — 어둡고, 글씨가 앉는 쪽이 비어 있어야
   * 한다. 둘을 한 파일로 겸하면 한쪽이 반드시 진다.
   */
  heroImage: string | null;
  goalAmount: number; startAt: string; endAt: string; status: FundingStatus;
  hidden: boolean; lastmod: string; rewards: FundingReward[]; content: string;
}

/**
 * 공개 화면으로 내려보낼 프로젝트에서 **내려받기 주소를 벗긴다.**
 *
 * 리워드의 `downloads`는 후원자에게만 가야 하는 값이다. 그런데 상세·후원 화면은
 * 프로젝트 객체를 통째로 props로 직렬화해 내려보내므로, 벗기지 않으면 **페이지 소스에
 * 그대로 실린다** — 후원하지 않고도 원본을 받을 수 있고, 그 순간 리워드가 리워드가
 * 아니게 된다. 실제로 그렇게 배포됐다가 잡았다(2026-09-14).
 *
 * 후원자에게 닿는 경로는 이 함수를 쓰지 않는다 — 확정 메일(lib/funding/email.ts)과
 * 후원 확인 페이지는 서버에서 `getFundingProject`를 직접 읽어 원본 값을 본다.
 */
export const stripRewardDownloads = (project: FundingProject): FundingProject => ({
  ...project,
  rewards: project.rewards.map((r) => ({ ...r, downloads: [] })),
});

/**
 * 리워드별 남은 수량. 상태 API가 아직 안 왔으면(또는 폴링 자체가 없으면) 파일의 한정
 * 수량을 그대로 쓴다(/pledge 페이지·공개 상세·미리보기가 전부 같은 폴백을 쓴다).
 *
 * 공개 상세 페이지(리워드 모달용)와 `ProjectDetailView`(리워드 카드용)가 각자 이 계산을
 * 다시 적으면, 한쪽만 고쳤을 때 카드에 보이는 잔여 수량과 모달이 실제로 거는 제한이
 * 갈릴 수 있다 — 한 벌로 둔다.
 *
 * `lib/funding/projects.ts`가 아니라 여기(`shape.ts`)에 둔다 — `projects.ts`는 최상위에서
 * `node:fs`·`node:path`를 실행하는(`FUNDING_DIR`) 서버 전용 모듈이라, 클라이언트
 * 컴포넌트(`ProjectDetailView`)가 값을 가져오면 그 모듈 전체가 웹팩 클라이언트 번들에
 * 끌려 들어가 빌드가 깨진다(2026-09-17 재리뷰 지적 — 이 저장소의 다른 클라이언트
 * 컴포넌트는 전부 `projects.ts`에서 **타입만** 가져오던 관례를 이 함수가 처음 깼다).
 * `shape.ts`는 순수 함수·타입만 있는 리프 모듈이라 안전하다.
 */
export const mergeRewardRemaining = (
  rewards: FundingReward[],
  remaining?: Record<string, number | null>,
): Record<string, number | null> => {
  const fallback = Object.fromEntries(rewards.map((r) => [r.id, r.totalQuantity]));
  return { ...fallback, ...(remaining ?? {}) };
};

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`funding frontmatter: ${name}은(는) 비어 있지 않은 문자열이어야 합니다`);
  return v;
};
const posInt = (v: unknown, name: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) throw new Error(`funding frontmatter: ${name}은(는) 양의 정수여야 합니다`);
  return v;
};
const isoDate = (v: unknown, name: string): string => {
  const s = v instanceof Date ? v.toISOString() : str(v, name);
  if (Number.isNaN(new Date(s).getTime())) throw new Error(`funding frontmatter: ${name}이(가) 날짜가 아닙니다`);
  return s;
};

export const FUNDING_STATUSES = ['auto', 'draft', 'closed'] as const;
export type FundingStatus = (typeof FUNDING_STATUSES)[number];

/**
 * status·hidden은 오래 "조용한 폴백"이었다 — 오타 난 `status: Draft`는 auto로 떨어져 초안이
 * 공개되고, 따옴표가 붙은 `hidden: "true"`는 문자열이라 `=== true` 비교를 통과하지 못해
 * 숨김이 풀렸다. 둘 다 화면에 아무 표시를 남기지 않으므로 다른 필드처럼 던지게 한다.
 */
const enumValue = (v: unknown, name: string, allowed: readonly string[], fallback: string): string => {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string' || !allowed.includes(v)) {
    throw new Error(`funding frontmatter: ${name}은(는) ${allowed.join(' | ')} 중 하나여야 합니다 (받은 값: ${JSON.stringify(v)})`);
  }
  return v;
};
const bool = (v: unknown, name: string, fallback: boolean): boolean => {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') {
    throw new Error(`funding frontmatter: ${name}은(는) boolean(true | false)이어야 합니다 — 따옴표가 붙은 "true"는 문자열이라 거부합니다 (받은 값: ${JSON.stringify(v)})`);
  }
  return v;
};

const parseDownloads = (raw: unknown, where: string): FundingDownload[] => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`funding frontmatter: ${where}는 목록이어야 합니다`);
  return raw.map((entry, i) => {
    if (typeof entry !== 'object' || entry === null) throw new Error(`funding frontmatter: ${where}[${i}] 형식 오류`);
    const e = entry as Record<string, unknown>;
    const key = str(e.key, `${where}[${i}].key`);
    // 주소를 적어 두던 시절의 값이 남아 있으면 조용히 통과시키지 않는다 — 그대로 두면
    // 게이트가 매칭에 실패해 후원자가 리워드를 못 받는다.
    if (!isSafeObjectKey(key))
      throw new Error(`funding frontmatter: ${where}[${i}].key는 저장소 객체 키여야 합니다(주소가 아닙니다) — 받은 값: ${JSON.stringify(key)}`);
    return { label: str(e.label, `${where}[${i}].label`), key };
  });
};

const parseReward = (raw: unknown, index: number): FundingReward => {
  if (typeof raw !== 'object' || raw === null) throw new Error(`funding frontmatter: rewards[${index}] 형식 오류`);
  const r = raw as Record<string, unknown>;
  return {
    id: str(r.id, `rewards[${index}].id`),
    title: str(r.title, `rewards[${index}].title`),
    description: str(r.description, `rewards[${index}].description`),
    amount: posInt(r.amount, `rewards[${index}].amount`),
    totalQuantity: r.totalQuantity === undefined || r.totalQuantity === null ? null : posInt(r.totalQuantity, `rewards[${index}].totalQuantity`),
    requiresShipping: bool(r.requiresShipping, `rewards[${index}].requiresShipping`, false),
    estimatedDelivery: str(r.estimatedDelivery, `rewards[${index}].estimatedDelivery`),
    image: typeof r.image === 'string' && r.image !== '' ? r.image : null,
    downloads: parseDownloads(r.downloads, `rewards[${index}].downloads`),
  };
};

/**
 * 프로젝트 한 건의 형태 검증. **md frontmatter와 DB 행이 같은 함수를 탄다.**
 *
 * 예전에는 이 검증이 md 파서 안에만 있었다. 정본이 DB로 옮겨 가면 파서를 안 타는 입력이
 * 생기는데, 그때 검증이 파서에 묶여 있으면 DB 경로는 아무 검사 없이 공개된다 —
 * `status: 'Draft'` 오타가 초안을 공개하고 `hidden: "true"`가 숨김을 푸는, 이 파일이
 * 주석으로 적어 둔 그 사고가 새 경로에서 그대로 재현된다.
 *
 * `data`는 frontmatter이거나 DB 행을 frontmatter 모양으로 편 객체다. `content`는 본문
 * 마크다운이며 `data`에 들어 있지 않다(md는 matter가 떼어 주고, DB는 컬럼이 따로다).
 */
export const validateFundingProjectShape = (
  data: Record<string, unknown>,
  slug: string,
  content: string,
): FundingProject => {
  const d = data;
  if (str(d.slug, 'slug') !== slug) throw new Error(`funding frontmatter: slug(${d.slug})가 파일명(${slug})과 다릅니다`);
  const startAt = isoDate(d.startAt, 'startAt');
  const endAt = isoDate(d.endAt, 'endAt');
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) throw new Error('funding frontmatter: endAt은 startAt보다 뒤여야 합니다');
  const rewardsRaw = Array.isArray(d.rewards) ? d.rewards : [];
  if (rewardsRaw.length === 0) throw new Error('funding frontmatter: rewards가 1개 이상이어야 합니다');
  const rewards = rewardsRaw.map(parseReward);
  const ids = new Set<string>();
  for (const r of rewards) {
    if (ids.has(r.id)) throw new Error(`funding frontmatter: 리워드 id 중복 — ${r.id}`);
    ids.add(r.id);
  }
  const status = enumValue(d.status, 'status', FUNDING_STATUSES, 'auto') as FundingStatus;
  return {
    slug,
    title: str(d.title, 'title'),
    summary: str(d.summary, 'summary'),
    cover: str(d.cover, 'cover'),
    ogImage: typeof d.ogImage === 'string' && d.ogImage !== '' ? d.ogImage : null,
    heroImage: typeof d.heroImage === 'string' && d.heroImage !== '' ? d.heroImage : null,
    goalAmount: posInt(d.goalAmount, 'goalAmount'),
    startAt, endAt, status,
    hidden: bool(d.hidden, 'hidden', false),
    lastmod: d.lastmod instanceof Date ? d.lastmod.toISOString().slice(0, 10) : typeof d.lastmod === 'string' ? d.lastmod : startAt.slice(0, 10),
    rewards, content,
  };
};
