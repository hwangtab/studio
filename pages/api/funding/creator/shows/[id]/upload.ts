import { randomUUID } from 'node:crypto';

import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { getClientIp } from '../../../../../../lib/contracts/client-ip';
import { buildFundingMediaUrl, processCreatorImage, UPLOAD_LIMITS } from '../../../../../../lib/funding/creatorUpload';
import { FUNDING_MEDIA_PREFIX } from '../../../../../../lib/funding/mediaPath';
import { canCreatorEdit } from '../../../../../../lib/funding/reviewTransition';
import { readBodyWithLimit } from '../../../../../../lib/funding/uploadBody';
import { SHOW_DRAFT_LIMITS, type ShowSubmissionDraft } from '../../../../../../lib/shows/organizer/draft';
import { guardOrganizerRequest, queryId } from '../../../../../../lib/shows/organizer/http';
import { loadSubmissionForCreator } from '../../../../../../lib/shows/organizer/submissions';

/** 원문 바이트를 그대로 받는다(펀딩 upload.ts와 같다). */
export const config = { api: { bodyParser: false } };

/** 신청서 하나에 실려 있는 이미지 수 — 포스터 1 + 출연진 사진. 저장 안 한 임시 업로드는 세지 않는다. */
const countDraftImages = (d: ShowSubmissionDraft): number =>
  (d.posterUrl ? 1 : 0) + d.performers.filter((p) => p.photoUrl).length;

const MAX_IMAGES_PER_SUBMISSION = 1 + SHOW_DRAFT_LIMITS.performers;

/** 공연 포스터·출연진 사진 업로드. `?kind=poster|photo`, body는 파일 원문. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const creatorId = await guardOrganizerRequest(req, res, ['POST']);
  if (!creatorId) return;

  const id = queryId(req);
  const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
  if (!id || (kind !== 'poster' && kind !== 'photo')) {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });
  }

  const submission = await loadSubmissionForCreator(creatorId, id);
  if (!submission) return res.status(404).json({ ok: false, message: '찾을 수 없어요.' });
  if (!canCreatorEdit(submission.reviewStatus)) {
    return res.status(409).json({ ok: false, message: '심사 중이거나 이미 판정이 난 신청서에는 이미지를 올릴 수 없어요.' });
  }

  const ip = getClientIp(req) ?? 'unknown';
  if (
    !(await consumeRateLimit(`creator_upload:ip:${ip}`, 120, 3600))
    || !(await consumeRateLimit(`creator_upload:${creatorId}`, 60, 3600))
  ) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  // 꽉 찬 신청서(포스터 1 + 사진 12)에서 올리는 것은 교체뿐이다 — 저장(normalizeDraftInput)이 포스터 1장·출연진 12명을 넘는 초안을
  // 거절하므로 저장본이 상한을 넘을 수 없다(이 검사는 안전망). 상한에서 막으면 교체까지 막힌다. 남발은 위 요청 한도가 막는다.
  if (countDraftImages(submission.draft) > MAX_IMAGES_PER_SUBMISSION) {
    return res.status(400).json({ ok: false, message: `이미지는 신청서당 최대 ${MAX_IMAGES_PER_SUBMISSION}장까지 올릴 수 있어요.` });
  }

  const body = await readBodyWithLimit(req, UPLOAD_LIMITS.maxBytes);
  if (body === null) return res.status(413).json({ ok: false, message: '파일이 너무 커요.' });
  if (body.length === 0) return res.status(400).json({ ok: false, message: '파일이 비어 있어요.' });

  let processed: { buffer: Buffer; width: number; height: number };
  try {
    // 포스터·사진 모두 비율을 유지한다(가로 1600 이하).
    processed = await processCreatorImage(body, 'body');
  } catch (error: unknown) {
    console.error('[funding/creator/shows/upload] 이미지 처리 실패:', error);
    return res.status(400).json({ ok: false, message: '이미지 파일이 아니에요.' });
  }

  // 키에 개설자 id를 박는다 — draft.ts의 ownImage가 이 접두사로 "내 업로드인가"를 판정한다.
  const filename = `${creatorId}-${randomUUID()}.webp`;
  try {
    await put(`${FUNDING_MEDIA_PREFIX}${filename}`, processed.buffer, { access: 'private', contentType: 'image/webp' });
  } catch (error: unknown) {
    console.error('[funding/creator/shows/upload] Blob 저장 실패:', error);
    return res.status(500).json({ ok: false, message: '이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
  return res.status(200).json({ ok: true, url: buildFundingMediaUrl(filename, processed.width, processed.height) });
}
