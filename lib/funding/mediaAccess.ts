/**
 * 업로드 이미지 하나를 **인증 없이** 내보내도 되는지 판정한다.
 *
 * 이 저장소의 업로드 이미지는 승인 전 프로젝트의 자료이기도 하다 — 초안·심사 중·반려·
 * 철회된 프로젝트의 그림과, 올렸다가 저장하지 않은 고아 파일까지 같은 접두사에 섞여 있다.
 * 그래서 "공개 페이지가 실제로 쓰는 그림"만 무인증으로 연다: **승인된 프로젝트가 참조하는
 * 키**. 나머지는 소유 개설자나 관리자만 본다(`pages/api/funding/media/[...path].ts`).
 *
 * 참조 범위가 `cover_url`·`funding_rewards.image_url`보다 넓다. 승인된 프로젝트의 공개
 * 상세는 본문(`content`)의 그림과 `og_image_url`·`hero_image_url`도 그대로 내보내므로,
 * 그 넷을 빼면 승인된 프로젝트의 본문 이미지가 방문자에게 404가 된다.
 *
 * **본문 갈래만 소유까지 본다.** `content`는 승인 뒤에도 개설자가 자유롭게 고치는 칸이고
 * 저장할 때 URL 문자열을 거르지 않는다(`stripTrustedDirectives`는 숏코드만 벗긴다).
 * `instr`는 렌더 결과가 아니라 문자열을 보므로, 코드펜스나 HTML 주석에 **남의** 키를 적어
 * 두기만 해도 그 키가 공개로 판정된다 — 한때 공개였다가 반려·철회로 닫힌 표지를 승인된
 * 개설자 누구나 되열 수 있다는 뜻이다. 그래서 본문 참조는 그 프로젝트 개설자 **자신의**
 * 업로드일 때만 인정한다. 나머지 넷은 업로드 경로를 거쳐 검증되거나 관리자가 채우는
 * 칸이라 그대로 둔다.
 */
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_MEDIA_URL_PREFIX } from './mediaPath';

/**
 * 이 파일명을 가리키는 **승인된** 프로젝트가 있는가.
 *
 * 조회가 실패하면 `false`다(fail-closed). 공개 페이지가 그림 하나를 잃는 쪽이 심사 전
 * 프로젝트의 자료가 새는 쪽보다 낫다 — 전자는 되돌릴 수 있고 후자는 되돌릴 수 없다.
 *
 * 문자열 비교는 `instr`로 한다. 주소에 치수 쿼리(`?w=&h=`)가 붙어 저장되고 본문에서는
 * 마크다운·HTML 안에 박혀 있어 완전 일치로는 못 찾는다. `LIKE`는 파일명에 흔한 `_`가
 * 한 글자 와일드카드라 판정이 필요 이상으로 느슨해진다.
 */
export const isApprovedFundingMedia = async (filename: string): Promise<boolean> => {
  const needle = `${FUNDING_MEDIA_URL_PREFIX}${filename}`;
  try {
    const rows = await getDb().all<{ one: number }>(sql`
      select 1 as one from funding_projects p
      where p.review_status = 'approved'
        and (
          instr(p.cover_url, ${needle}) > 0
          or instr(coalesce(p.og_image_url, ''), ${needle}) > 0
          or instr(coalesce(p.hero_image_url, ''), ${needle}) > 0
          or (
            instr(p.content, ${needle}) > 0
            -- 본문 참조는 그 개설자 자신의 업로드일 때만 (creatorId 접두사가 붙은 파일명).
            -- 옛 형식 키는 소유자를 알 수 없어 이 갈래로 공개되지 않는다.
            and substr(${filename}, 1, length(p.creator_id) + 1) = p.creator_id || '-'
          )
          or exists (
            select 1 from funding_rewards r
            where r.project_id = p.id and instr(coalesce(r.image_url, ''), ${needle}) > 0
          )
        )
      limit 1
    `);
    return rows.length > 0;
  } catch (error) {
    console.error('[funding/media] 공개 여부 조회 실패 — 비공개로 본다:', error);
    return false;
  }
};

/**
 * 파일명이 이 개설자의 것인가.
 *
 * 업로드가 `<creatorId>-<uuid>.webp`로 이름을 짓는다(`pages/api/funding/creator/upload.ts`).
 * 그 규칙이 도입되기 전의 옛 키는 uuid만이라 **소유자를 알 수 없다** — 옛 키는 이 판정을
 * 통과하지 못하고, 승인 참조(공개)나 관리자 경로로만 열린다.
 */
export const isOwnFundingMedia = (filename: string, creatorId: string): boolean =>
  creatorId !== '' && filename.startsWith(`${creatorId}-`);
