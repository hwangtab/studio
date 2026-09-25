/**
 * 펀딩 개설자 업로드 이미지를 내보낸다.
 *
 * 이 프로젝트의 Blob 저장소는 서명된 계약서 PDF를 담고 있어 private이고, 같은 저장소에
 * public 업로드를 섞을 수 없다. 그래서 업로드는 private으로 하고 `funding/` 접두사만 이
 * 라우트가 우리 도메인에서 대신 내보낸다(pages/api/social/media/[...path].ts와 같은 구조).
 *
 * 경로 판정은 lib/funding/mediaPath.ts에 있다(테스트가 붙어 있다). 여기서 직접 문자열을
 * 조립하지 말 것 — 접두사를 벗어나는 순간 계약서가 공개된다.
 *
 * **접근 판정은 Blob을 읽기 전에 한다.** 예전에는 인증이 아예 없어 "파일명이 무작위
 * UUID"인 것이 유일한 접근 제어였다. 그 상태에서는 초안·심사 중·반려·철회 프로젝트의
 * 이미지와, 저장하지 않고 올린 고아 파일까지 주소를 아는 사람에게 영구히 열려 있었다.
 * 지금은 세 갈래만 통과한다:
 *
 *   1. 승인된 프로젝트가 참조하는 키 — 무인증 공개. 검색엔진·카카오톡 미리보기 봇과
 *      OG 생성기가 쿠키 없이 가져가는 경로가 이것이다.
 *   2. 키가 `<creatorId>-<uuid>.webp`이고 개설자 세션의 creatorId와 같을 때 — 미리보기.
 *   3. 관리자 세션 — 심사 화면.
 *
 * 그 외는 404다(403이 아니다 — 키가 있는지 없는지를 응답으로 알려 주지 않는다).
 * 옛 형식 키(uuid만, creatorId 접두사 없음)는 소유자를 알 수 없어 1·3으로만 열린다.
 */
import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { readCreatorId, readCreatorSessionVersion, verifyCreatorSessionVersion } from '../../../../lib/funding/creatorAuth';
import { getCreatorSession } from '../../../../lib/funding/creatorSession';
import { isApprovedFundingMedia, isOwnFundingMedia } from '../../../../lib/funding/mediaAccess';
import { FUNDING_MEDIA_PREFIX, resolveFundingBlobPath } from '../../../../lib/funding/mediaPath';

/** 세션만 읽어 creatorId를 얻는다. 로그인하지 않았거나 판본이 어긋나면 null. */
const readSessionCreatorId = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
  try {
    const session = await getCreatorSession(req, res);
    const creatorId = readCreatorId(session);
    const version = readCreatorSessionVersion(session);
    if (!creatorId || version === null) return null;
    return (await verifyCreatorSessionVersion(creatorId, version)) ? creatorId : null;
  } catch (error) {
    console.error('[funding/media] 개설자 세션을 읽지 못했다:', error);
    return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const pathname = resolveFundingBlobPath(req.query.path);
  if (!pathname) return res.status(404).json({ message: 'Not found' });
  const filename = pathname.slice(FUNDING_MEDIA_PREFIX.length);

  const isPublic = await isApprovedFundingMedia(filename);
  let allowed = isPublic;

  if (!allowed) {
    const creatorId = await readSessionCreatorId(req, res);
    allowed = creatorId !== null && isOwnFundingMedia(filename, creatorId);
  }
  if (!allowed) {
    allowed = (await authenticateAdminApi(req, res)).ok;
  }
  if (!allowed) return res.status(404).json({ message: 'Not found' });

  try {
    const blob = await get(pathname, { access: 'private' });
    if (!blob?.stream) return res.status(404).json({ message: 'Not found' });

    res.setHeader('Content-Type', 'image/webp');
    // 공개 키는 파일명이 무작위 UUID라 같은 이름이 다른 내용을 가리키지 않는다. 승인 전
    // 이미지는 판정이 바뀔 수 있고(승인·반려) 세션에 따라 응답이 갈리므로 캐시하지 않는다.
    //
    // 한계: 공개 뒤에 판정이 닫혀도(반려·철회, 본문에서 그림 삭제) 우리 응답은 즉시
    // 바뀌지만 **이미 캐싱한 브라우저·CDN에는 그 사실이 닿지 않는다.** 한 번 공개된 키는
    // 그 사본이 만료될 때까지 계속 보일 수 있다 — 되돌려야 하는 상황이면 파일명을 바꾸는
    // 것이 유일한 수단이다(CLAUDE.md의 "그림을 바꾸면 파일명도 바꾼다"와 같은 이유).
    res.setHeader(
      'Cache-Control',
      isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store',
    );
    if (req.method === 'HEAD') return res.status(200).end();

    return res.status(200).send(Buffer.from(await new Response(blob.stream).arrayBuffer()));
  } catch (error: unknown) {
    console.error('[funding/media] 이미지를 읽지 못했다:', error);
    return res.status(404).json({ message: 'Not found' });
  }
}
