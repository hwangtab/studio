import { and, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects } from '../../db/schema';
import { normalizeCreatorEmail } from './creatorToken';
import { isUniqueConflictError } from './slugOccupancy';
import { CREATOR_LIMITS } from './creatorValidation';

/**
 * 운영자가 개설자 계정(이름·이메일)을 고치는 판정.
 *
 * `fundingCreators`에 쓰는 경로는 가입(`creatorToken.ts`)과 본인 저장
 * (`creatorProjectWrite.ts`의 `saveCreatorSection`) 둘뿐이었다. 그래서 두 자리가
 * 막다른 길이었다.
 *
 * - **이름**: 잘못 저장한 채 승인되면 `saveCreatorSection`의 잠금이 영구히 거부한다.
 *   그 이름은 공개 상세에 "개설자 ○○ · 판매자 스튜디오 놀"로 박힌다
 *   (`components/funding/ProjectDetailView.tsx`).
 * - **이메일**: 개설자가 그 주소의 접근을 잃으면 매직링크가 유일한 인증 수단이라
 *   로그인할 길이 사라진다.
 *
 * **개설자 본인의 잠금(`saveCreatorSection`)은 그대로 둔다.** 이 경로는 그 잠금을
 * 우회하라고 만든 것이 아니라, 잠겨서 아무도 못 고치는 상태를 운영자가 푸는 유일한
 * 수단이다 — 그래서 이름 변경은 승인 여부와 무관하게 된다.
 *
 * 사유(`reason`)는 필수지만 **어느 컬럼에도 저장하지 않는다.** `reviewNote`는 개설자에게
 * 보이는 프로젝트 단위 심사 메모라 계정 변경 기록의 축이 아니고, 새 컬럼은 마이그레이션이
 * 필요하다. 사유는 호출부가 메일 본문과 서버 로그에 남긴다.
 */
export type CreatorAccountAction = 'set_creator_name' | 'set_creator_email';

export interface CreatorAccountSuccess {
  ok: true;
  action: CreatorAccountAction;
  creatorId: string;
  /** 변경이 반영된 뒤의 이름·이메일. 알림 메일의 인사말과 수신자가 이 값을 쓴다. */
  creatorName: string;
  creatorEmail: string;
  /** 바꾸기 전 값. 이메일 변경이면 옛 주소로도 알려야 하므로 호출부가 이 값을 수신자로 쓴다. */
  previousValue: string;
  /**
   * 다시 만들어야 하는 공개 페이지의 slug — 이 개설자의 **승인된 프로젝트 전부**다.
   * 이름이 공개 상세에 박히므로 지금 보고 있는 프로젝트 하나만 재검증하면 나머지는
   * 최대 60초 동안 옛 이름을 보여 준다. 이메일 변경은 공개 화면에 드러나지 않아 빈 배열.
   */
  revalidateSlugs: string[];
  /**
   * 이메일 변경으로 지운 로그인 토큰 **행** 수. DELETE는 `creator_id`만 보므로 아직 쓸 수
   * 있는 링크뿐 아니라 이미 만료·소진된 행까지 함께 센다 — "살아 있는 링크가 몇 개였다"로
   * 읽으면 안 된다. 이름 변경이면 0.
   */
  revokedTokens: number;
}

export type CreatorAccountResult =
  | CreatorAccountSuccess
  | {
      ok: false;
      code: 'not_found' | 'invalid' | 'incomplete' | 'conflict' | 'duplicate_email';
      message: string;
    };

const deny = (
  code: Exclude<CreatorAccountResult, { ok: true }>['code'],
  message: string,
): CreatorAccountResult => ({ ok: false, code, message });

/**
 * libSQL/SQLite가 실제로 던지는 문구 — slug 경합 판정과 **같은 함수**를 쓴다
 * (`lib/funding/slugOccupancy.ts`의 `isUniqueConflictError`).
 *
 * 예전엔 여기서 `error.message`만 봤다. 이 자리는 `db.batch`라 원문이 message에 실려
 * 동작했지만, 단일 문장 쿼리에서는 drizzle이 "Failed query: …"로 감싸고 원문을 `cause`에
 * 넣는다 — 같은 모양이라고 주석에 적어 놓고 실제로는 달랐고, 이 함수를 그런 경로에
 * 재사용하면 조용히 500이 된다. 공유 함수가 `cause` 사슬까지 따라간다.
 */
const isEmailConflictError = (error: unknown): boolean =>
  isUniqueConflictError(error, 'funding_creators.email');

export const decideCreatorAccount = async (
  projectId: string,
  action: CreatorAccountAction,
  input: { value: string; reason: string },
  now: Date = new Date(),
): Promise<CreatorAccountResult> => {
  // 입구가 프로젝트인 이유: 운영자가 개설자를 찾는 화면이 심사 상세다(별도 개설자 관리
  // 화면을 만들지 않는다). 계정은 프로젝트가 아니라 개설자에 속하므로, 여기서 한 번
  // 프로젝트 → 개설자로 건너간 뒤로는 프로젝트를 다시 보지 않는다.
  const [row] = await getDb()
    .select({ creator: fundingCreators })
    .from(fundingProjects)
    .innerJoin(fundingCreators, eq(fundingProjects.creatorId, fundingCreators.id))
    .where(eq(fundingProjects.id, projectId))
    .limit(1);
  if (!row) return deny('not_found', '프로젝트를 찾을 수 없습니다.');
  const creator = row.creator;

  const reason = input.reason?.trim() ?? '';
  // 남의 계정 정보를 바꾸는 일이라 사유를 강제한다. 저장하지는 않지만(위 주석) 메일과
  // 서버 로그로 남으므로, 비어 있으면 그 두 곳 모두 "왜 바꿨는지"가 사라진다.
  if (!reason) return deny('incomplete', '계정 변경에는 사유가 필요합니다.');

  const epoch = Math.floor(now.getTime() / 1000);
  const db = getDb();

  if (action === 'set_creator_name') {
    const name = input.value?.trim() ?? '';
    if (!name || name.length > CREATOR_LIMITS.nameMax) {
      return deny('invalid', `개설자 이름은 1~${CREATOR_LIMITS.nameMax}자로 적어 주세요.`);
    }
    if (name === creator.name) return deny('invalid', '지금 저장된 이름과 같습니다.');

    // 낙관적 잠금: WHERE에 바꾸기 전 이름을 건다 — 그 사이 개설자 본인이(아직 잠기지 않은
    // 계정이면 가능하다) 또는 다른 운영자가 먼저 바꿨으면 0행이라 진 쪽이 409를 받는다.
    const updated = await db
      .update(fundingCreators)
      .set({ name, updatedAt: now })
      .where(and(eq(fundingCreators.id, creator.id), eq(fundingCreators.name, creator.name)));
    if (Number(updated.rowsAffected) === 0) {
      return deny('conflict', '그 사이 개설자 이름이 바뀌었습니다. 새로고침 후 다시 확인해 주세요.');
    }

    const approved = await db
      .select({ slug: fundingProjects.slug })
      .from(fundingProjects)
      .where(and(eq(fundingProjects.creatorId, creator.id), eq(fundingProjects.reviewStatus, 'approved')));

    return {
      ok: true,
      action,
      creatorId: creator.id,
      creatorName: name,
      creatorEmail: creator.email,
      previousValue: creator.name,
      revalidateSlugs: approved.map((p) => p.slug),
      revokedTokens: 0,
    };
  }

  const email = normalizeCreatorEmail(input.value ?? '');
  if (!email) return deny('invalid', '이메일 형식이 올바르지 않습니다.');
  if (email === creator.email) return deny('invalid', '지금 저장된 이메일과 같습니다.');

  // 선검사. 여기서 걸리면 사람이 읽을 메시지를 준다 — 아래 UPDATE가 unique 제약으로
  // 터지는 것에만 기대면 운영자는 500이나 원문 SQL 오류를 보게 된다.
  const [taken] = await db
    .select({ id: fundingCreators.id })
    .from(fundingCreators)
    .where(and(eq(fundingCreators.email, email), ne(fundingCreators.id, creator.id)))
    .limit(1);
  if (taken) {
    return deny('duplicate_email', '이미 다른 개설자가 쓰고 있는 이메일입니다. 다른 주소를 적어 주세요.');
  }

  /**
   * 주소 변경과 토큰 무효화를 한 배치로 묶는다.
   *
   * 옛 주소로 발급된 매직링크가 살아 있으면 주소를 바꾼 의미가 없다 — 옛 메일함을 가진
   * 쪽이 그대로 들어온다. 그래서 그 개설자의 로그인 토큰을 전부 지운다.
   *
   * DELETE에 EXISTS를 다는 이유는 `reviewDecision.ts`의 리워드 잠금과 같다: 배치는 통째로
   * 롤백되지만, UPDATE가 **경합으로 0행**이어도 DELETE 자체는 유효한 SQL이라 성공한다 —
   * 그러면 주소는 안 바뀌었는데 개설자의 로그인 링크만 죽는다. `updated_at = epoch`까지
   * 요구해 "이 호출이 방금 쓴 그 행"일 때만 토큰을 지운다.
   *
   * `session_version`도 같이 올린다. 토큰만 지우면 **이미 발급된 쿠키**가 7일 더 남는다 —
   * 탈취자가 주소 변경 전에 한 번 로그인해 뒀다면 그 쿠키로 정산 계좌와 배송 CSV에 계속
   * 닿는다. 판본이 오르면 `authenticateCreator*`의 대조가 어긋나 그 쿠키가 즉시 죽는다.
   * 이름 변경은 로그인 수단이 아니므로 올리지 않는다.
   */
  let batchResult;
  try {
    batchResult = await db.batch([
      db
        .update(fundingCreators)
        .set({ email, sessionVersion: sql`session_version + 1`, updatedAt: now })
        .where(and(eq(fundingCreators.id, creator.id), eq(fundingCreators.email, creator.email))),
      db.run(sql`
        DELETE FROM funding_creator_tokens
        WHERE creator_id = ${creator.id}
          AND EXISTS (
            SELECT 1 FROM funding_creators c
            WHERE c.id = ${creator.id} AND c.email = ${email} AND c.updated_at = ${epoch}
          )
      `),
    ]);
  } catch (error: unknown) {
    // 선검사와 실제 쓰기 사이에 같은 주소가 다른 계정에 들어간 경우. 데이터는 안전하다
    // (배치가 롤백된다) — 메시지는 선검사와 같은 것을 준다.
    if (isEmailConflictError(error)) {
      return deny('duplicate_email', '그 사이 다른 개설자가 같은 이메일을 쓰기 시작했습니다. 다른 주소를 적어 주세요.');
    }
    throw error;
  }

  if (Number(batchResult[0].rowsAffected) === 0) {
    return deny('conflict', '그 사이 개설자 이메일이 바뀌었습니다. 새로고침 후 다시 확인해 주세요.');
  }

  return {
    ok: true,
    action,
    creatorId: creator.id,
    creatorName: creator.name,
    creatorEmail: email,
    previousValue: creator.email,
    revalidateSlugs: [],
    revokedTokens: Number(batchResult[1].rowsAffected),
  };
};
