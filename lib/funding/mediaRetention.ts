/**
 * 아무도 참조하지 않는 개설자 업로드 이미지를 지운다.
 *
 * **`funding/` 접두사 밖은 나열도 삭제도 하지 않는다.** 이 Blob 저장소에는 서명된 계약서
 * PDF(`contracts/…`)가 함께 있어, 접두사 판정이 느슨해지는 순간 이 함수가 계약서를 지운다.
 * `list`에 접두사를 넘기고, 돌아온 항목마다 접두사를 **다시** 확인한다(방어가 두 겹인 이유는
 * `list`의 접두사 처리를 우리가 검증할 수 없기 때문이다).
 *
 * 왜 필요한가: 업로드는 프로젝트를 저장하기 전에 Blob에 파일을 올린다. 본문에서 그림을
 * 지우거나 저장하지 않고 창을 닫으면 파일만 남고, 저장소에는 삭제 경로가 없었다.
 * 장당 상한(`UPLOAD_LIMITS.maxPerProject`)은 저장된 것만 세므로 남은 파일은 계속 쌓인다.
 *
 * 동기 삭제(교체·반려 시점에 지우기)는 만들지 않는다. 이 청소가 다 덮고, 반려된 프로젝트의
 * 행은 기록이라 그 이미지도 참조로 본다.
 */
import { del, list } from '@vercel/blob';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_MEDIA_PREFIX, FUNDING_MEDIA_URL_PREFIX } from './mediaPath';

/**
 * 갓 올라온 파일을 고아로 오해하지 않기 위한 유예.
 *
 * 업로드와 저장 사이는 길어야 한 세션이다 — 개설자가 그림을 올리고 같은 화면에서 저장한다.
 * 일주일이 지나도 어느 프로젝트도 그 주소를 가리키지 않는다면 저장되지 않은 것이다.
 */
const ORPHAN_GRACE_DAYS = 7;

export interface MediaPurgeResult {
  scanned: number;
  deleted: number;
  skippedRecent: number;
  failed: number;
}

/**
 * DB가 참조하는 업로드 이미지 파일명 전부.
 *
 * **상태를 보지 않는다** — 초안·심사 중·반려 프로젝트의 참조도 참조다. 주소는 치수 쿼리가
 * 붙은 채(`?w=&h=`) 저장되고 본문에서는 마크다운·HTML 안에 박혀 있어, 문자열 비교가 아니라
 * 정규식으로 뽑아낸다.
 */
const referencedFilenames = async (): Promise<Set<string>> => {
  const db = getDb();
  const rows = await db.all<{ text: string | null }>(sql`
    select cover_url as text from funding_projects
    union all select og_image_url as text from funding_projects
    union all select hero_image_url as text from funding_projects
    union all select content as text from funding_projects
    union all select image_url as text from funding_rewards
  `);

  const pattern = new RegExp(`${FUNDING_MEDIA_URL_PREFIX}([A-Za-z0-9._-]+\\.webp)`, 'gi');
  const referenced = new Set<string>();
  for (const row of rows) {
    if (!row.text) continue;
    for (const match of row.text.matchAll(pattern)) referenced.add(match[1]);
  }
  return referenced;
};

export const purgeOrphanFundingMedia = async (
  now: Date = new Date(),
): Promise<MediaPurgeResult> => {
  const referenced = await referencedFilenames();
  const boundary = new Date(now.getTime() - ORPHAN_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const result: MediaPurgeResult = { scanned: 0, deleted: 0, skippedRecent: 0, failed: 0 };
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: FUNDING_MEDIA_PREFIX, cursor });
    for (const blob of page.blobs) {
      // 접두사 재확인 — 이 줄이 계약서를 지키는 마지막 방어선이다.
      if (!blob.pathname.startsWith(FUNDING_MEDIA_PREFIX)) continue;
      result.scanned += 1;

      if (new Date(blob.uploadedAt) >= boundary) {
        result.skippedRecent += 1;
        continue;
      }
      if (referenced.has(blob.pathname.slice(FUNDING_MEDIA_PREFIX.length))) continue;

      try {
        await del(blob.url);
        result.deleted += 1;
        // 파일명은 개설자 id + uuid라 개인정보가 아니다. 무엇이 사라졌는지는 남겨야 한다.
        console.info(`[funding/media-gc] 고아 이미지 삭제: ${blob.pathname}`);
      } catch (error: unknown) {
        // 한 파일 때문에 청소가 멈추면 안 된다. 다음 달 실행에서 다시 시도된다.
        result.failed += 1;
        console.error(`[funding/media-gc] 삭제 실패 ${blob.pathname}:`, error);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return result;
};
