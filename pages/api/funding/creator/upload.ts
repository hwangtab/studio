import { randomUUID } from 'node:crypto';

import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
import { loadProjectForCreator } from '../../../../lib/funding/creatorProjectWrite';
import { buildFundingMediaUrl, processCreatorImage, UPLOAD_LIMITS } from '../../../../lib/funding/creatorUpload';
import { FUNDING_MEDIA_PREFIX } from '../../../../lib/funding/mediaPath';
import { canCreatorEdit, type FundingReviewStatus } from '../../../../lib/funding/reviewTransition';

/**
 * 개설자 이미지 업로드.
 *
 * 원문 바이트를 그대로 받아야 해서(멀티파트를 새로 들이지 않는다 — 한 번에 파일 하나뿐이라
 * 필요 없다) Next의 JSON 바디 파서를 끈다. 클라이언트는
 * `fetch(url, { method: 'POST', body: file })`로 파일 본문만 보낸다.
 */
export const config = { api: { bodyParser: false } };

/**
 * 바디를 모으면서 상한을 확인한다.
 *
 * 끝까지 받은 뒤 크기를 재면 상한이 상한이 아니다 — 8MB 제한을 두고 500MB를 다 받아
 * 버리는 요청을 서버가 그대로 삼키게 된다. 누적이 넘는 순간 즉시 중단한다.
 */
const readBodyWithLimit = async (req: NextApiRequest, maxBytes: number): Promise<Buffer | null> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > maxBytes) return null;
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
};

/**
 * 프로젝트당 누적 업로드 장수.
 *
 * 별도 테이블을 두지 않는다 — 본문(`content`)과 대표 이미지(`coverUrl`)에 실제로 쓰이고
 * 있는 `/api/funding/media/` 주소 개수를 그때그때 센다. 저장하지 않고 지운 임시 업로드는
 * 세지 않으므로, 이 상한은 "실려 있는 이미지 수"이지 "업로드해 본 횟수"가 아니다.
 */
const MEDIA_URL_PATTERN = /\/api\/funding\/media\//g;
const countProjectMedia = (content: string, coverUrl: string): number =>
  ((content.match(MEDIA_URL_PATTERN) ?? []).length) + ((coverUrl.match(MEDIA_URL_PATTERN) ?? []).length);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });

  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
  const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
  if (!projectId || (kind !== 'cover' && kind !== 'body')) {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }

  // 남의 프로젝트면 '권한 없음'이 아니라 404다 — creatorProjectWrite.ts의 guard와 같은
  // 이유로, 존재 여부 자체를 알려 주지 않는다.
  const project = await loadProjectForCreator(auth.creatorId, projectId);
  if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });

  // 심사 중이거나 이미 판정 난 프로젝트는 saveStorySection 등 저장 경로가 guard로 막지만,
  // 업로드 자체(Blob에 파일이 쌓이는 것)는 그 검사를 타지 않아 계정만 있으면 편집 가능
  // 여부와 무관하게 저장소를 채울 수 있었다. 여기서 같은 조건을 본다.
  // CreatorProjectDetail.reviewStatus는 string으로 넓혀 있다(DB 컬럼은 enum이지만
  // loadProjectForCreator의 반환 타입이 좁히지 않는다) — canCreatorEdit이 기대하는
  // FundingReviewStatus로 다시 좁힌다.
  if (!canCreatorEdit(project.reviewStatus as FundingReviewStatus)) {
    return res.status(409).json({ ok: false, message: '심사 중이거나 이미 판정이 난 프로젝트에는 이미지를 올릴 수 없습니다.' });
  }

  // 로그인이 "처음 보는 이메일이면 계정 자동 생성"이라 메일 주소만 있으면 누구나 개설자
  // 계정을 만들 수 있다. creatorId 하나로만 제한하면 메일함 N개로 N배가 되므로,
  // login.ts(IP+이메일 두 겹)와 같은 이유로 IP 한 겹을 더한다.
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`creator_upload:ip:${ip}`, 120, 3600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (!(await consumeRateLimit(`creator_upload:${auth.creatorId}`, 60, 3600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  if (countProjectMedia(project.content, project.coverUrl) >= UPLOAD_LIMITS.maxPerProject) {
    return res.status(400).json({ ok: false, message: `이미지는 프로젝트당 최대 ${UPLOAD_LIMITS.maxPerProject}장까지 올릴 수 있습니다.` });
  }

  const body = await readBodyWithLimit(req, UPLOAD_LIMITS.maxBytes);
  if (body === null) return res.status(413).json({ ok: false, message: '파일이 너무 큽니다.' });
  if (body.length === 0) return res.status(400).json({ ok: false, message: '파일이 비어 있습니다.' });

  let processed: { buffer: Buffer; width: number; height: number };
  try {
    processed = await processCreatorImage(body, kind);
  } catch (error: unknown) {
    console.error('[funding/creator/upload] 이미지 처리 실패:', error);
    return res.status(400).json({ ok: false, message: '이미지 파일이 아닙니다.' });
  }

  const filename = `${randomUUID()}.webp`;
  try {
    await put(`${FUNDING_MEDIA_PREFIX}${filename}`, processed.buffer, {
      access: 'private',
      contentType: 'image/webp',
    });
  } catch (error: unknown) {
    // 다른 실패는 전부 { ok: false, message } JSON이다 — 여기서 throw를 그대로 흘리면
    // Next 기본 500 HTML이 나가 클라이언트 파싱 계약이 깨진다.
    console.error('[funding/creator/upload] Blob 저장 실패:', error);
    return res.status(500).json({ ok: false, message: '이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }

  return res.status(200).json({ ok: true, url: buildFundingMediaUrl(filename, processed.width, processed.height) });
}
