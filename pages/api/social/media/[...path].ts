/**
 * 소셜 발행용 이미지를 공개로 내보낸다.
 *
 * Instagram·Threads는 이미지를 URL로만 받고, 그 URL이 **인증 없이** 열려야 한다(Meta 서버가
 * 직접 가져간다). 이 프로젝트의 Blob 저장소는 계약서 PDF를 담고 있어 private이고, 같은
 * 저장소에 public 업로드를 섞을 수 없다. 그래서 업로드는 private으로 하고 `social/`
 * 접두사만 이 라우트가 우리 도메인에서 대신 내보낸다.
 *
 * 경로 판정은 lib/social/mediaPath.ts에 있다(테스트가 붙어 있다). 여기서 직접 문자열을
 * 조립하지 말 것 — 접두사를 벗어나는 순간 계약서가 공개된다.
 */
import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { resolveSocialBlobPath } from '../../../../lib/social/mediaPath';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const pathname = resolveSocialBlobPath(req.query.path);
  if (!pathname) return res.status(404).json({ message: 'Not found' });

  try {
    const blob = await get(pathname, { access: 'private' });
    if (!blob?.stream) return res.status(404).json({ message: 'Not found' });

    res.setHeader('Content-Type', 'image/jpeg');
    // 파일명에 무작위 접미사가 붙으므로 같은 이름이 다른 내용을 가리키지 않는다.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (req.method === 'HEAD') return res.status(200).end();

    return res.status(200).send(Buffer.from(await new Response(blob.stream).arrayBuffer()));
  } catch (error: unknown) {
    console.error('[social/media] 이미지를 읽지 못했다:', error);
    return res.status(404).json({ message: 'Not found' });
  }
}
