/**
 * 펀딩 개설자 업로드 이미지를 공개로 내보낸다.
 *
 * 검색엔진·카카오톡 미리보기 봇이 인증 없이 이 주소를 가져가야 하므로 이 라우트에는
 * 인증이 없다. 이 프로젝트의 Blob 저장소는 계약서 PDF를 담고 있어 private이고, 같은
 * 저장소에 public 업로드를 섞을 수 없다. 그래서 업로드는 private으로 하고 `funding/`
 * 접두사만 이 라우트가 우리 도메인에서 대신 내보낸다(pages/api/social/media/[...path].ts와
 * 같은 구조).
 *
 * 경로 판정은 lib/funding/mediaPath.ts에 있다(테스트가 붙어 있다). 여기서 직접 문자열을
 * 조립하지 말 것 — 접두사를 벗어나는 순간 계약서가 공개된다. 인증이 없는 만큼 파일명이
 * 무작위 UUID인 것 자체가 접근 제어다 — 승인 전 프로젝트의 이미지 주소를 아는 사람은 그
 * 이미지를 볼 수 있다(개설자가 미리보기 링크를 동료에게 보낼 수 있어야 하므로 의도된 동작).
 */
import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { resolveFundingBlobPath } from '../../../../lib/funding/mediaPath';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const pathname = resolveFundingBlobPath(req.query.path);
  if (!pathname) return res.status(404).json({ message: 'Not found' });

  try {
    const blob = await get(pathname, { access: 'private' });
    if (!blob?.stream) return res.status(404).json({ message: 'Not found' });

    res.setHeader('Content-Type', 'image/webp');
    // 파일명이 무작위 UUID라 같은 이름이 다른 내용을 가리키지 않는다.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (req.method === 'HEAD') return res.status(200).end();

    return res.status(200).send(Buffer.from(await new Response(blob.stream).arrayBuffer()));
  } catch (error: unknown) {
    console.error('[funding/media] 이미지를 읽지 못했다:', error);
    return res.status(404).json({ message: 'Not found' });
  }
}
