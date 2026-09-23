import { and, count, eq, gt, ne } from 'drizzle-orm';

import { encryptField, FieldCryptoError } from '../crypto/fieldCrypto';
import { getDb } from '../../db/client';
import {
  fundingCreators, fundingProjectPayouts, fundingProjects, fundingRewards,
  type FundingProjectRow, type FundingRewardRow,
} from '../../db/schema';
import { getFundingProject } from './projects';
import { canCreatorEditSection, type CreatorSectionName } from './reviewTransition';
import {
  CREATOR_LIMITS, isDefaultCreatorName, type BasicSection, type CreatorSection, type PayoutSection,
  type RewardInput, type StorySection,
} from './creatorValidation';
import { stripTrustedDirectives } from './creatorContent';
import { toKstDateString } from './creatorDateInput';

export type WriteResult =
  | {
      ok: true;
      /**
       * 사업자로 바꿔 저장했지만 주민등록번호를 **지우지 않고 남겼다.** 이미 원천징수한
       * 정산 기록이 있어 지급명세서 제출 의무가 남아 있을 때만 붙는다(`savePayoutSection`).
       * 화면이 "지워졌다"고 잘못 말하지 않으려면 이 사실이 응답에 있어야 한다.
       * **불리언 하나뿐이다** — 값도 암호문도 여기 실리지 않는다.
       */
      residentNumberRetained?: true;
    }
  | {
      ok: false;
      code: 'not_found' | 'locked' | 'not_editable' | 'duplicate_slug' | 'too_many' | 'duplicate_reward'
        | 'encryption_unavailable';
      message: string;
    };

const deny = (code: Exclude<WriteResult, { ok: true }>['code'], message: string): WriteResult => ({ ok: false, code, message });

export interface CreatorProjectDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  coverUrl: string;
  goalAmount: number;
  startAt: Date;
  endAt: Date;
  reviewStatus: string;
  status: string;
  reviewNote: string | null;
  creator: {
    name: string;
    /**
     * 심사 신청(`submit.ts`)이 `isDefaultCreatorName` 판정에 쓰려고만 필요하다 — 서버
     * 안에서만 돌아야 한다. 화면 props로 흘리지 않는다(`toEditorProject`가 이 필드를
     * 고르지 않는다. `tests/pages/funding/creator/edit.test.ts`가 누수를 고정한다).
     */
    email: string;
    contactName: string | null;
    phone: string | null;
    bio: string | null;
    links: string[] | null;
  };
  rewards: FundingRewardRow[];
}

/**
 * 소유·편집 가능 여부를 한 번에 본다.
 *
 * **모든 쓰기 함수가 이것을 먼저 부른다.** 함수마다 조건을 다시 쓰면 언젠가 한 곳이
 * 빠지고, 그 하나가 남의 프로젝트를 여는 문이 된다. 남의 것이면 'not_found'다 —
 * '권한 없음'이라고 답하면 그 id가 존재한다는 사실을 알려 주는 셈이다.
 *
 * `section`은 구획별로 다르다 — 승인 뒤에는 basic·story만 열리고 rewards는 통째로
 * 닫힌다(`reviewTransition.ts`의 `EDITABLE_SECTIONS`). 호출부마다 자신의 구획을 넘긴다.
 */
const guard = async (creatorId: string, projectId: string, section: CreatorSectionName) => {
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!row) return { row: null, denial: deny('not_found', '프로젝트를 찾을 수 없습니다.') };
  if (!canCreatorEditSection(row.reviewStatus, section)) {
    return { row, denial: deny('not_editable', '지금 상태에서는 이 항목을 고칠 수 없습니다.') };
  }
  return { row, denial: null };
};

export const createDraftProject = async (creatorId: string): Promise<{ id: string }> => {
  const [row] = await getDb().insert(fundingProjects).values({
    creatorId,
    // slug는 유니크 제약이 있어 빈 문자열로 여러 초안을 만들 수 없다 — 행 id를 임시 주소로 쓴다.
    // 개설자가 기본 정보 구획을 저장하는 순간 진짜 slug로 덮인다(saveBasicSection).
    slug: `draft-${crypto.randomUUID()}`,
    title: '',
    summary: '',
    content: '',
    coverUrl: '',
    goalAmount: CREATOR_LIMITS.goalMin,
    startAt: new Date(),
    endAt: new Date(),
  }).returning({ id: fundingProjects.id });
  return { id: row.id };
};

export const loadProjectForCreator = async (
  creatorId: string,
  projectId: string,
): Promise<CreatorProjectDetail | null> => {
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!row) return null;

  const [creator] = await getDb().select().from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  // sortOrder로 정렬한다 — ORDER BY 없이는 순서가 sqlite의 내부 저장 순서에 좌우돼,
  // 리워드를 지웠다 다시 만들면 화면의 카드 순서가 예고 없이 바뀔 수 있다(2026-09-17
  // 리뷰 지적). 순서를 바꾸는 쓰기 경로(mode: 'reorder')는 아직 없어 sortOrder는 지금
  // 전부 0(삽입 기본값)이지만, 그 경로가 생기면 이 조회가 바로 반영한다.
  const rewards = await getDb().select().from(fundingRewards)
    .where(eq(fundingRewards.projectId, projectId))
    .orderBy(fundingRewards.sortOrder);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    coverUrl: row.coverUrl,
    goalAmount: row.goalAmount,
    startAt: row.startAt,
    endAt: row.endAt,
    reviewStatus: row.reviewStatus,
    status: row.status,
    reviewNote: row.reviewNote,
    creator: {
      name: creator?.name ?? '',
      email: creator?.email ?? '',
      contactName: creator?.contactName ?? null,
      phone: creator?.phone ?? null,
      bio: creator?.bio ?? null,
      links: creator?.links ? (JSON.parse(creator.links) as string[]) : null,
    },
    rewards,
  };
};

/**
 * `basicLockedViolation`이 승인 뒤 잠그는 필드 이름.
 *
 * 이 배열은 아래 `basicLockedViolation`에서 파생된 값이 아니라 옆에 손으로 다시 적은
 * 리터럴이다 — 두 자리가 갈리지 않게 두 테스트가 각각 다른 절반을 지킨다:
 *
 * - `creatorProjectWrite.integration.test.ts`의 `BASIC_LOCKED_FIELD_NAMES` 구동 `it.each`가
 *   이 배열을 실제로 순회하며 각 필드를 하나씩 바꿔 `basicLockedViolation`이 정말 잠그는지
 *   확인한다(+ 배열 길이 단언으로 "원소가 조용히 빠지는 것"까지 잡는다) — **이 배열과
 *   서버 로직 본문 사이**를 지킨다.
 * - `components/funding/creator/basicLockedFields.test.tsx`가 `BasicSectionForm`을 렌더해
 *   DOM에서 실제로 비활성화된 입력 집합을 이 배열과 대조한다 — **이 배열과 화면
 *   배선(`disabled={readOnly || lockedFields}`) 사이**를 지킨다.
 *
 * 필드를 추가·제거하면 이 배열, 아래 `basicLockedViolation`의 조건, `BasicSectionForm.tsx`의
 * 배선을 셋 다 함께 고쳐야 두 테스트가 계속 초록이다.
 */
export const BASIC_LOCKED_FIELD_NAMES = ['slug', 'goalAmount', 'startAt', 'endAt'] as const;

/**
 * 승인된 프로젝트의 기본정보에서 바뀌면 안 되는 것.
 *
 * 구획 자체는 열려 있다(제목·요약·표지를 고칠 수 있어야 한다 — 잘못 올라간 표지가 영영
 * 남는 것을 막는다). 하지만 아래 셋은 후원자와의 약속이거나 이미 공개된 주소다.
 */
const basicLockedViolation = (
  existing: FundingProjectRow,
  next: BasicSection,
): string | null => {
  if (existing.reviewStatus !== 'approved') return null;
  if (existing.slug !== next.slug) {
    return '공개된 프로젝트의 주소는 바꿀 수 없습니다. 후원자가 후원 확인 페이지에서 이 주소로 프로젝트를 찾습니다.';
  }
  if (existing.goalAmount !== next.goalAmount) return '공개된 프로젝트의 목표 금액은 바꿀 수 없습니다.';
  if (existing.startAt.getTime() !== next.startAt.getTime()
    || existing.endAt.getTime() !== next.endAt.getTime()) {
    return '공개된 프로젝트의 모금 기간은 바꿀 수 없습니다.';
  }
  return null;
};

export const saveBasicSection = async (creatorId: string, projectId: string, value: BasicSection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId, 'basic');
  if (denial) return denial;

  const locked = basicLockedViolation(row!, value);
  if (locked) return deny('locked', locked);

  // 파일 프로젝트가 이긴다(lib/funding/repository.ts). 파일과 같은 slug로 승인되면
  // 그 DB 프로젝트는 어떤 주소로도 열리지 않는다 — 여기서 막는 편이 훨씬 싸다.
  if (getFundingProject(value.slug)) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  const [taken] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.slug, value.slug), ne(fundingProjects.id, projectId))).limit(1);
  if (taken) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  const now = new Date();
  // 승인된 뒤의 저장만 찍는다. updated_at으로는 알 수 없다 — 관리자 쓰기도 그 값을
  // 갱신하므로 운영자가 메모만 달아도 "개설자가 고쳤다"로 보인다.
  // 같은 조건에서 사이트맵 lastmod도 함께 찍는다 — 공개 필드(제목·요약·표지 등)가
  // 실제로 바뀌는 시점이 정확히 여기다.
  const editedAt = row!.reviewStatus === 'approved' ? { creatorEditedAt: now, lastmod: toKstDateString(now) } : {};

  await getDb().update(fundingProjects).set({
    title: value.title, summary: value.summary, slug: value.slug,
    goalAmount: value.goalAmount, startAt: value.startAt, endAt: value.endAt,
    coverUrl: value.coverUrl, updatedAt: now, ...editedAt,
  }).where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};

export const saveStorySection = async (creatorId: string, projectId: string, value: StorySection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId, 'story');
  if (denial) return denial;

  const now = new Date();
  const editedAt = row!.reviewStatus === 'approved' ? { creatorEditedAt: now, lastmod: toKstDateString(now) } : {};

  // 렌더 시점이 아니라 저장 시점에 벗긴다 — 렌더 경로가 여럿(상세·미리보기·OG·llms)이라
  // 한 곳을 빠뜨리면 그 경로로만 새어 나간다. 저장된 값 자체를 깨끗하게 둔다.
  await getDb().update(fundingProjects)
    .set({ content: stripTrustedDirectives(value.content), updatedAt: now, ...editedAt })
    .where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};

/**
 * 개설자 프로필(소개·연락처·링크)은 프로젝트가 아니라 **계정**(fundingCreators) 소속이다.
 *
 * `guard(creatorId, projectId)`를 타지 않는다 — 프로필은 그 개설자의 모든 프로젝트에
 * 공유되므로, 아무 프로젝트 하나(초안이든 뭐든)의 편집 가능 여부로 막는 것 자체가 잘못된
 * 조건이다. 개설자가 승인된 프로젝트 A와 초안 B를 함께 갖고 있을 때 B를 편집 중이라는
 * 이유로 A에서도 보이는 프로필을 심사 없이 바꿀 수 있으면 안 되는데, projectId를 받아
 * guard를 태우면 정확히 그 구멍이 생긴다.
 *
 * "프로필 변경이 이미 공개된 프로젝트 화면에 그대로 반영되는 것을 심사로 막을지"는 3차
 * (관리자 심사)에서 정했다: **이름만 잠근다.** Task 10이 공개 상세의 판매자 표시 옆에
 * `creator.name`을 그리기 시작하면서, 승인된 프로젝트를 가진 개설자가 이름을 아무
 * 문자열로 바꾸면 ISR 60초 안에 공개 페이지에 그대로 뜨게 됐다(심사도 알림도 없이). 그래서
 * 그 개설자에게 `approved` 프로젝트가 하나라도 있으면 이름 변경만 **무시한다**. `bio`·연락처·
 * `links`는 공개 화면에 실리지 않으므로 계속 자유롭게 고칠 수 있다. 새 컬럼 없이
 * `funding_projects`를 그때그때 조회해 판정한다.
 *
 * **거부가 아니라 무시인 이유.** 화면이 이름 칸을 `disabled`로 두므로(`nameLocked`) 개설자가
 * 이름을 직접 고쳐 보낼 길이 없다. 그래도 불일치는 생긴다 — 운영자가
 * `creatorAccountDecision.ts`로 이름을 A→B로 고치는 동안 개설자가 편집 화면을 열어 두고
 * 있으면, 그 화면은 계속 A를 들고 제출한다. 거부하면 개설자가 건드린 적 없는 칸 때문에
 * 소개·연락처·링크가 통째로 저장되지 않고, 화면 안내("소개·연락처·링크는 계속 고칠 수
 * 있습니다")와도 어긋난다. 잠금의 목적은 이름이 안 바뀌는 것이지 나머지 저장을 막는 것이
 * 아니므로, 들어온 이름을 버리고 기존 이름을 유지한 채 나머지를 저장한다.
 *
 * **예외: 지금 이름이 가입 시 채워진 기본값(이메일 로컬파트)이면 잠그지 않는다.** 설정한
 * 적 없는 값을 잠그는 것은 잠금이 아니라 사고다(`isDefaultCreatorName` 주석 참조). 기존에
 * 이미 로컬파트 이름으로 남아 있던 행도 이 예외로 스스로 풀린다.
 */
/** `saveCreatorSection`의 이름 잠금 조건과 `isCreatorNameLocked`가 공유하는 조회 — 승인된 프로젝트가 하나라도 있는지. */
const hasApprovedProject = async (creatorId: string): Promise<boolean> => {
  const [approvedProject] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.creatorId, creatorId), eq(fundingProjects.reviewStatus, 'approved'))).limit(1);
  return Boolean(approvedProject);
};

/**
 * 지금 이 개설자의 이름이 잠겨 있는지 — 편집 화면이 이름 칸을 비활성화하고 이유를
 * 보여줄지 판단하는 힌트다. 판정 조건은 `saveCreatorSection`이 실제로 이름 변경을 무시하는
 * 조건과 정확히 같아야 한다(`hasApprovedProject`를 함께 쓰는 이유) — 둘이 갈리면 화면은
 * 열려 있는데 이름이 저장되지 않거나, 화면은 잠겨 있는데 저장은 되는 모순이 생긴다.
 *
 * **이 힌트는 집행자가 아니다.** 서버는 여전히 `saveCreatorSection`이 유일하게 집행한다 —
 * 이 함수는 편집 화면 로드 시점에 한 번만 불러 안내 문구를 미리 보여주는 용도다.
 */
export const isCreatorNameLocked = async (creatorId: string): Promise<boolean> => {
  const [existing] = await getDb().select({ name: fundingCreators.name, email: fundingCreators.email })
    .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  if (!existing) return false;
  if (isDefaultCreatorName(existing.name, existing.email)) return false;
  return hasApprovedProject(creatorId);
};

export const saveCreatorSection = async (creatorId: string, value: CreatorSection): Promise<WriteResult> => {
  const [existing] = await getDb().select({ id: fundingCreators.id, name: fundingCreators.name, email: fundingCreators.email })
    .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  if (!existing) return deny('not_found', '개설자 계정을 찾을 수 없습니다.');

  // 잠겨 있으면 들어온 이름을 버리고 기존 이름을 그대로 쓴다(거부하지 않는다 — 위 주석).
  const nameLocked = value.name !== existing.name
    && !isDefaultCreatorName(existing.name, existing.email)
    && await hasApprovedProject(creatorId);

  await getDb().update(fundingCreators).set({
    name: nameLocked ? existing.name : value.name,
    contactName: value.contactName,
    phone: value.phone,
    bio: value.bio,
    links: value.links ? JSON.stringify(value.links) : null,
    updatedAt: new Date(),
  }).where(eq(fundingCreators.id, creatorId));
  return { ok: true };
};

/**
 * 정산 정보 구획이 화면에 돌려받는 **전부** — 등록 여부, 계좌번호 뒤 4자리, 세금 유형.
 *
 * 은행명·예금주·계좌번호 전체는 여기 없고, 앞으로도 넣으면 안 된다. 이 값은 편집 화면의
 * `getServerSideProps` props로 나가고, Pages Router는 props를 `__NEXT_DATA__` JSON으로
 * 페이지 HTML에 그대로 싣는다 — 담는 순간 계좌번호가 페이지 소스에 평문으로 박힌다.
 * **개설자 본인 화면이라는 것은 예외 사유가 아니다**(어깨너머·브라우저 캐시·화면 공유).
 * 같은 이유로 `lib/funding/dbProjects.ts`와 `lib/funding/adminProjects.ts`도 이 네 컬럼을
 * 일부러 빼고 있고, 각자의 integration 테스트가 그 사실을 고정한다.
 *
 * 그래서 개설자는 계좌를 "고치는" 것이 아니라 **다시 입력해 덮어쓴다.** 불편을 이유로
 * 값을 실어 보내고 싶어지면 이 주석이 그 이유를 말한다.
 */
export interface CreatorPayoutSummary {
  registered: boolean;
  accountLast4: string | null;
  taxType: PayoutSection['taxType'] | null;
  /**
   * 주민등록번호가 등록돼 있는가. **여기서 나가는 것은 이 불리언뿐이다** — 평문은 물론
   * 암호문도, 뒤 4자리 같은 조각도 넣지 않는다(계좌와 다르다). 암호문이 props로 나가면
   * 키가 유일한 방어가 된다.
   */
  residentNumberRegistered: boolean;
  /**
   * 이 개설자에게 **원천징수하고 기록한 정산이 하나라도 있는가**(`withholdingAmount > 0`).
   *
   * 화면 문구가 갈리는 자리다. 이 값이 참이면 세금 구분을 사업자로 바꿔 저장해도 주민등록
   * 번호가 지워지지 않는다 — 이미 떼어 간 세액의 지급명세서 제출 의무가 남아 있기 때문이다
   * (`savePayoutSection`). 거짓일 때만 "바꾸면 지워진다"가 사실이다.
   *
   * 여기서도 나가는 것은 불리언뿐이다 — 정산 금액·날짜는 이 구획이 알 이유가 없다.
   */
  withheldPayoutRecorded: boolean;
}

/**
 * 이 개설자의 프로젝트 중 **원천징수해 기록한 정산**이 있는가.
 *
 * 주민등록번호를 지울 수 있는지의 유일한 판정이다. 근거는 "지금 원천징수 대상인가"가
 * 아니라 **"이미 지급한 소득에 대한 지급명세서 제출 의무"**라, 지급이 한 번이라도
 * 일어났으면 그 뒤에 세금 구분을 바꿔도 의무는 남는다. `withholdingAmount === 0`인
 * 기록(사업자로 정산한 건)은 원천징수가 없었다는 뜻이므로 세지 않는다.
 *
 * `funding_project_payouts`는 프로젝트 단위인데 번호는 계정 단위라 프로젝트를 거쳐 조인한다.
 *
 * **경계: 세금 구분이 원천징수인데 계산된 세액이 0원인 정산은 여기서 세지 않는다.** 이 표에
 * 세금 구분 컬럼이 없어 그런 행과 "사업자로 정산한 건"을 기록만으로 가를 수 없기 때문이다.
 * 판단 근거 전문은 `lib/funding/retention.ts`의 `withheldPayouts` 주석에 있다 — 그쪽이 같은
 * `> 0` 기준으로 주민등록번호 자동 파기를 판정하므로 **둘은 함께 바꿔야 한다.**
 */
export const hasWithheldPayout = async (creatorId: string): Promise<boolean> => {
  const [row] = await getDb()
    .select({ id: fundingProjectPayouts.id })
    .from(fundingProjectPayouts)
    .innerJoin(fundingProjects, eq(fundingProjects.id, fundingProjectPayouts.projectId))
    .where(and(eq(fundingProjects.creatorId, creatorId), gt(fundingProjectPayouts.withholdingAmount, 0)))
    .limit(1);
  return Boolean(row);
};

/** 계좌번호에서 숫자만 남겨 뒤 4자리. 하이픈 위치가 은행마다 달라 자릿수부터 맞춘다. */
const accountLast4 = (account: string): string | null => {
  const digits = account.replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

/**
 * 편집 화면이 정산 구획을 그리는 데 필요한 것만 읽는다.
 *
 * `select()`(전 컬럼)를 쓰지 않는다 — 전 컬럼을 읽어 오면 호출부가 실수로 통째 스프레드할
 * 여지가 생긴다. 네 컬럼만 고르고, 그중 셋은 이 함수 안에서 불리언·뒤 4자리로 접혀 밖으로
 * 나가지 않는다.
 */
export const loadPayoutSummary = async (creatorId: string): Promise<CreatorPayoutSummary> => {
  const [row] = await getDb().select({
    taxType: fundingCreators.taxType,
    payoutBankName: fundingCreators.payoutBankName,
    payoutAccount: fundingCreators.payoutAccount,
    payoutHolder: fundingCreators.payoutHolder,
    residentNumberEnc: fundingCreators.residentNumberEnc,
  }).from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  if (!row) {
    return {
      registered: false, accountLast4: null, taxType: null,
      residentNumberRegistered: false, withheldPayoutRecorded: false,
    };
  }

  const account = row.payoutAccount?.trim() ?? '';
  // `recordFundingPayout`이 정산을 거부하는 조건(`hasPayoutAccount`, lib/funding/payout.ts)과
  // 같은 판정이어야 한다 — 갈리면 화면은 "등록됨"인데 정산은 no_payout_account로 막힌다.
  const registered = Boolean(row.payoutBankName?.trim() && account && row.payoutHolder?.trim());
  return {
    registered,
    accountLast4: registered ? accountLast4(account) : null,
    taxType: row.taxType ?? null,
    // 값도 암호문도 아니고 "있다/없다"뿐이다.
    residentNumberRegistered: Boolean(row.residentNumberEnc),
    withheldPayoutRecorded: await hasWithheldPayout(creatorId),
  };
};

/**
 * 정산 정보(세금 유형·계좌) 저장.
 *
 * `saveCreatorSection`과 같은 축이다 — 값이 `funding_creators`에 붙어 있으므로 프로젝트
 * 단위 `guard()`를 타지 않는다. 대신 **승인된 프로젝트가 하나라도 있을 때만** 받는다:
 * 반려될 신청서에 계좌 정보를 미리 받지 않는다는 것이 이 구획의 존재 조건이고(설계 스펙
 * §6.2), 값이 계정 소속인 이상 판정도 계정 단위여야 한다. 특정 프로젝트의 심사 상태로
 * 막으면, 승인된 프로젝트 A를 가진 개설자가 초안 B를 열어 둔 채로는 정산 계좌를 못 고치는
 * — 목적과 무관한 — 잠금이 된다.
 *
 * 화면 쪽 판정(`EDITABLE_SECTIONS`의 `payout`)은 지금 보고 있는 **그 프로젝트**가
 * 승인됐는지를 본다. 둘이 어긋나는 경우는 하나뿐이고(승인된 A + 초안 B를 함께 가진
 * 개설자가 B 화면을 볼 때) 그때 화면이 더 엄하다 — 정산이 실제로 일어나는 A의 화면에서
 * 고치면 된다. 반대 방향(화면은 열렸는데 서버가 막는 것)은 생기지 않는다.
 */
export const savePayoutSection = async (creatorId: string, value: PayoutSection): Promise<WriteResult> => {
  const [existing] = await getDb().select({ id: fundingCreators.id })
    .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  if (!existing) return deny('not_found', '개설자 계정을 찾을 수 없습니다.');

  if (!(await hasApprovedProject(creatorId))) {
    return deny('not_editable', '프로젝트가 승인된 뒤에 정산 정보를 넣을 수 있습니다.');
  }

  /**
   * 주민등록번호는 세 갈래다.
   *
   * 1. **사업자(`invoice`)로 저장하면 지운다 — 단, 원천징수한 정산 기록이 없을 때만.**
   *    우리가 이 번호를 갖는 근거는 소득세법상 지급명세서 제출 의무뿐이라, 원천징수 대상이
   *    아니게 되는 순간 근거가 사라진다. 그런데 **이미 원천징수해 기록한 정산이 있으면
   *    근거는 사라지지 않는다** — 그 의무는 "지금 원천징수 대상인가"가 아니라 "이미 지급한
   *    소득"에 붙기 때문이다. 정산 게이트(`lib/funding/payout.ts`)는 기록 시점에만 번호를
   *    보는데 이 구획은 승인된 뒤 계속 열려 있어, 지우고 나면 세액만 떼고 신고할 수단이
   *    없는 상태가 **복구 불가능하게** 남는다(암호문 자체가 사라진다). 그래서
   *    `hasWithheldPayout`이 참이면 값을 유지하고, 그 사실을 `residentNumberRetained`로
   *    응답에 실어 화면이 "지워졌다"고 잘못 말하지 않게 한다.
   * 2. **빈 값(`null`)이면 기존 값을 유지한다.** 계좌와 일부러 다르게 둔다. 계좌는 매번
   *    다시 입력해 덮어쓰게 하지만, 주민등록번호까지 그렇게 하면 은행명 한 글자를 고칠
   *    때마다 평문이 화면과 네트워크를 한 번 더 지난다. 지우는 수단은 세금 구분을
   *    사업자로 바꾸는 것 하나뿐이고, 그 사실은 화면이 말한다.
   * 3. 값이 오면 **암호화해서만** 넣는다. `encryptField`는 키가 없거나 형식이 틀리면
   *    던진다 — 그 예외를 여기서 삼켜 평문을 넣거나 그냥 넘어가면 안 된다. 저장 전체를
   *    거부하고 `encryption_unavailable`로 알린다.
   */
  let residentNumberEnc: string | null | undefined;
  let residentNumberRetained = false;
  if (value.taxType === 'invoice') {
    if (await hasWithheldPayout(creatorId)) {
      // undefined = SET 목록에서 빠진다(아래 주석). 지우지 않고 그대로 둔다.
      residentNumberEnc = undefined;
      residentNumberRetained = true;
    } else {
      residentNumberEnc = null;
    }
  } else if (value.residentNumber) {
    try {
      residentNumberEnc = encryptField(value.residentNumber);
    } catch (error) {
      if (error instanceof FieldCryptoError) {
        // 원본 메시지를 그대로 내보내지 않는다. 평문은 애초에 들어 있지 않지만, 키 설정
        // 상태를 화면에 적어 줄 이유도 없다. 서버에는 코드만 남긴다.
        console.error('[funding] resident number encryption failed', { code: error.code });
        return deny(
          'encryption_unavailable',
          '서버의 암호화 설정 문제로 주민등록번호를 저장할 수 없습니다. 이번 저장은 계좌를 포함해 '
            + '아무것도 반영되지 않았습니다. 개설자님이 고치실 수 있는 문제가 아니니 스튜디오 놀에 '
            + '알려 주세요.',
        );
      }
      throw error;
    }
  }

  await getDb().update(fundingCreators).set({
    taxType: value.taxType,
    payoutBankName: value.bankName,
    payoutAccount: value.account,
    payoutHolder: value.holder,
    // undefined면 drizzle이 SET 목록에서 빼므로 기존 값이 그대로 남는다(위 2번).
    ...(residentNumberEnc === undefined ? {} : { residentNumberEnc }),
    updatedAt: new Date(),
  }).where(eq(fundingCreators.id, creatorId));
  return residentNumberRetained ? { ok: true, residentNumberRetained: true } : { ok: true };
};

/**
 * 잠긴 리워드에서 바뀌면 안 되는 것.
 *
 * `rewardId`가 바뀌면 재고 집계 조건(`fp.reward_id = ?`)이 기존 후원을 세지 못해 한정
 * 100개짜리가 200개 팔린다. `amount`가 바뀌면 DB의 단가와 화면·CSV·환불 금액이 어긋난다.
 * 한정 여부가 바뀌면 재고 계산 자체가 다른 길로 간다. `requiresShipping`이 바뀌면 이미
 * 결제를 마친 후원자에게 사후로 배송지 제출 의무가 생기거나(반대로 배송 준비 중인 리워드가
 * 갑자기 배송 불필요로 바뀌거나) 하는 이행 조건 변경이 된다.
 *
 * 제목·설명·이미지·예상 전달 시기는 이 함수 안에서는 막지 않는다 — 다만 개설자는 이 코드에
 * 도달할 수 없다. `EDITABLE_SECTIONS`(reviewTransition.ts)가 `approved` 상태에서 'rewards'
 * 구획 자체를 막아 개설자 쪽 upsertReward 호출은 그 앞에서 이미 거부된다. 개설자 약관 제3조가
 * 실제로 약속하는 것도 "승인 뒤에는 어떤 항목도 고치거나 지울 수 없다"이다. 이 아래 필드별
 * 검사는 구획 가드를 우회할 수 있는 서비스 계층 직접 호출(관리자 스크립트 등)에 대한 2차
 * 방어선으로만 남겨 둔다.
 * 수량은 **늘리는 것만** 허용한다(재고 추가). 줄이면 이미 팔린 것보다 적어질 수 있다.
 */
const lockedViolation = (existing: FundingRewardRow, next: RewardInput): string | null => {
  if (!existing.lockedAt) return null;
  if (existing.amount !== next.amount) return '공개된 리워드의 금액은 바꿀 수 없습니다. 새 리워드를 추가해 주세요.';
  if ((existing.totalQuantity === null) !== (next.totalQuantity === null)) {
    return '공개된 리워드의 수량 제한 여부는 바꿀 수 없습니다.';
  }
  if (existing.totalQuantity !== null && next.totalQuantity !== null && next.totalQuantity < existing.totalQuantity) {
    return '수량은 늘릴 수만 있습니다.';
  }
  if (existing.requiresShipping !== next.requiresShipping) return '공개된 리워드의 배송 여부는 바꿀 수 없습니다.';
  return null;
};

export const upsertReward = async (
  creatorId: string,
  projectId: string,
  value: RewardInput,
  previousRewardId?: string,
): Promise<WriteResult> => {
  const { denial } = await guard(creatorId, projectId, 'rewards');
  if (denial) return denial;

  // 개명 경로. rewardId로만 기존 행을 찾으면 id를 바꿔 제출한 입력이 "없는 리워드"로
  // 보여 lockedViolation을 타지 않고 새 행이 insert된다 — 재고는 안 깨지지만(옛 행과 그
  // 후원이 그대로 남아서) 공개 화면에는 티어가 하나 더 생기고, 옛 id는 고칠 방법이 없어진다.
  if (previousRewardId !== undefined && previousRewardId !== value.rewardId) {
    const [previous] = await getDb().select().from(fundingRewards)
      .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, previousRewardId))).limit(1);
    if (!previous) return deny('not_found', '리워드를 찾을 수 없습니다.');
    if (previous.lockedAt) {
      return deny('locked', '공개된 리워드의 주소는 바꿀 수 없습니다. 새 리워드를 추가해 주세요.');
    }

    const [taken] = await getDb().select({ id: fundingRewards.id }).from(fundingRewards)
      .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, value.rewardId))).limit(1);
    if (taken) return deny('duplicate_reward', '이미 쓰고 있는 리워드 주소입니다.');

    await getDb().update(fundingRewards).set({
      rewardId: value.rewardId,
      title: value.title,
      description: value.description,
      amount: value.amount,
      totalQuantity: value.totalQuantity,
      requiresShipping: value.requiresShipping,
      estimatedDelivery: value.estimatedDelivery,
      imageUrl: value.imageUrl,
      updatedAt: new Date(),
    }).where(eq(fundingRewards.id, previous.id));
    return { ok: true };
  }

  const [existing] = await getDb().select().from(fundingRewards)
    .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, value.rewardId))).limit(1);

  if (existing) {
    const violation = lockedViolation(existing, value);
    if (violation) return deny('locked', violation);

    await getDb().update(fundingRewards).set({
      title: value.title,
      description: value.description,
      amount: value.amount,
      totalQuantity: value.totalQuantity,
      requiresShipping: value.requiresShipping,
      estimatedDelivery: value.estimatedDelivery,
      imageUrl: value.imageUrl,
      updatedAt: new Date(),
    }).where(eq(fundingRewards.id, existing.id));
    return { ok: true };
  }

  const [{ value: existingCount }] = await getDb().select({ value: count() }).from(fundingRewards)
    .where(eq(fundingRewards.projectId, projectId));
  if (existingCount >= CREATOR_LIMITS.rewardsMax) {
    return deny('too_many', `리워드는 최대 ${CREATOR_LIMITS.rewardsMax}개까지 만들 수 있습니다.`);
  }

  await getDb().insert(fundingRewards).values({
    projectId,
    rewardId: value.rewardId,
    title: value.title,
    description: value.description,
    amount: value.amount,
    totalQuantity: value.totalQuantity,
    requiresShipping: value.requiresShipping,
    estimatedDelivery: value.estimatedDelivery,
    imageUrl: value.imageUrl,
  });
  return { ok: true };
};

export const deleteReward = async (creatorId: string, projectId: string, rewardId: string): Promise<WriteResult> => {
  const { denial } = await guard(creatorId, projectId, 'rewards');
  if (denial) return denial;

  const [existing] = await getDb().select().from(fundingRewards)
    .where(and(eq(fundingRewards.projectId, projectId), eq(fundingRewards.rewardId, rewardId))).limit(1);
  if (!existing) return deny('not_found', '리워드를 찾을 수 없습니다.');
  if (existing.lockedAt) return deny('locked', '공개된 리워드는 지울 수 없습니다.');

  await getDb().delete(fundingRewards).where(eq(fundingRewards.id, existing.id));
  return { ok: true };
};
