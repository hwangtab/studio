import { and, eq, ne, notInArray } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';

/**
 * slug를 **놓아주는** 심사 상태 — 반려뿐이다.
 *
 * 예전엔 중복 검사가 심사 상태를 아예 보지 않았고 `slug` 컬럼에 전 행 UNIQUE가 걸려 있어서,
 * 한 번 반려된 프로젝트가 그 주소를 영구히 붙들고 있었다 — `delete(fundingProjects)` 경로가
 * 저장소에 없으므로 개설자도 운영자도 되찾는 길이 DB 직접 수정뿐이었다. 반려된 행 자체는
 * 기록으로 그대로 둔다(slug를 개명하면 그 기록을 고치는 것이다). 점유로 세지 않기만 한다.
 *
 * 나머지 넷(`draft`·`submitted`·`changes_requested`·`approved`)은 점유한다.
 * `changes_requested`가 특히 그렇다 — 재제출을 기다리는 살아 있는 신청서라, 그 사이 주소를
 * 빼앗기면 개설자가 지적받은 것을 고쳐 낼 수가 없다.
 *
 * **이 목록은 DB의 부분 유니크 인덱스와 같아야 한다**
 * (`funding_projects_slug_live_unique`, `db/schema.ts`의 `review_status <> 'rejected'`).
 * 여기가 사람에게 이유를 말해 주는 바깥쪽 층이고, 인덱스가 검사와 쓰기 사이의 경합을 막는
 * 최종 방어선이다. 한쪽만 바꾸면 한쪽은 통과시키는데 다른 쪽이 SQLITE_CONSTRAINT로 터진다.
 */
export const SLUG_RELEASING_REVIEW_STATUSES = ['rejected'] as const;

/**
 * 다른 DB 프로젝트가 이 slug를 점유하고 있는가. `exceptProjectId`는 자기 자신을 뺀다.
 *
 * 파일 프로젝트(`content/funding/*.md`)와의 충돌은 이 함수가 보지 않는다 — 호출부가
 * `getFundingProject(slug)`로 따로 본다(파일이 이기므로 메시지도 다르다).
 */
export const isFundingSlugTaken = async (slug: string, exceptProjectId: string): Promise<boolean> => {
  const [row] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(
      eq(fundingProjects.slug, slug),
      ne(fundingProjects.id, exceptProjectId),
      notInArray(fundingProjects.reviewStatus, [...SLUG_RELEASING_REVIEW_STATUSES]),
    )).limit(1);
  return Boolean(row);
};

/**
 * 승인 시점의 마지막 확인 — 같은 slug로 **이미 승인된** 다른 프로젝트가 있는가.
 *
 * `isFundingSlugTaken`이 이미 approved를 점유로 세므로 보통은 중복이다. 그래도 남겨 둔다:
 * 두 공개 프로젝트가 같은 주소를 갖는 상태는 `repository.ts`의 "파일이 이긴다" 규칙 밖의,
 * 어느 쪽이 열릴지 알 수 없는 상태이고 승인은 그것을 만드는 유일한 경로다.
 */
export const hasApprovedFundingSlug = async (slug: string, exceptProjectId: string): Promise<boolean> => {
  const [row] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(
      eq(fundingProjects.slug, slug),
      ne(fundingProjects.id, exceptProjectId),
      eq(fundingProjects.reviewStatus, 'approved'),
    )).limit(1);
  return Boolean(row);
};

/**
 * 부분 유니크 인덱스가 막아 낸 경합인가 — `creatorAccountDecision.ts`의
 * `isEmailConflictError`와 같은 모양이다.
 *
 * 같은 slug의 반려 행 둘이 **동시에** 재신청·승인되면 위 두 검사는 양쪽 다 통과한다(둘 다
 * 그 순간 rejected다). 인덱스가 뒤에서 한쪽을 떨어뜨리는데, 그 예외를 그대로 흘리면 운영자는
 * 500이나 원문 SQL을 본다. 여기서 사람이 읽을 409로 바꾼다.
 *
 * **`cause`까지 따라간다.** 드라이버가 메시지를 싣는 자리가 경로마다 다르다 — `db.batch`는
 * `LibsqlBatchError.message`에 sqlite 원문을 그대로 담지만, 단일 문장 쿼리는 drizzle이
 * "Failed query: …"로 감싸고 sqlite 원문을 `cause`에 넣는다. `message`만 보면 후자를 놓쳐
 * 운영자가 원문 SQL이 박힌 500을 받는다.
 */
const SLUG_CONFLICT = /UNIQUE constraint failed: funding_projects\.slug/i;

export const isSlugConflictError = (error: unknown): boolean => {
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth += 1) {
    if (SLUG_CONFLICT.test(e.message)) return true;
  }
  return false;
};
