import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { validateBasicSection, validateCreatorSection, validateStorySection } from '../../../../../lib/funding/creatorValidation';
import { saveBasicSection, saveCreatorSection, saveStorySection, type WriteResult } from '../../../../../lib/funding/creatorProjectWrite';

/** WriteResult.code → HTTP 상태. 네 라우트가 공유하는 매핑(형제 라우트 관례). */
const STATUS_BY_CODE: Record<Exclude<WriteResult, { ok: true }>['code'], number> = {
  not_found: 404,
  locked: 409,
  not_editable: 409,
  duplicate_slug: 400,
  duplicate_reward: 400,
  too_many: 400,
};

const respondWriteResult = (res: NextApiResponse, result: WriteResult) => {
  if (result.ok) return res.status(200).json({ ok: true });
  return res.status(STATUS_BY_CODE[result.code]).json({ ok: false, message: result.message });
};

/**
 * 구획별 저장 — 기본정보·스토리·개설자 프로필 세 구획을 한 라우트가 받는다.
 *
 * `section: 'creator'`는 URL의 프로젝트 id를 쓰지 않는다. 개설자 프로필(이름·소개·연락처·
 * 링크)은 프로젝트가 아니라 계정 소속이라 `saveCreatorSection`이 projectId를 받지 않기
 * 때문이다(lib/funding/creatorProjectWrite.ts 주석). 화면은 프로젝트 편집 페이지 안에서
 * 프로필 탭도 같은 주소로 저장하도록 두되, 서버는 그 id로 프로젝트 소유·편집 가능 여부를
 * 검사하지 않는다 — 아무 프로젝트 하나의 잠금 상태로 계정 전체에 걸리는 프로필을 막는 것
 * 자체가 잘못된 조건이기 때문이다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });

  const projectId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!projectId) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const section = req.body?.section;
  if (section !== 'basic' && section !== 'story' && section !== 'creator') {
    return res.status(400).json({ ok: false, message: '구획을 확인해 주세요.' });
  }

  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  if (section === 'basic') {
    const validated = validateBasicSection(req.body?.value, new Date());
    if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
    return respondWriteResult(res, await saveBasicSection(auth.creatorId, projectId, validated.value));
  }

  if (section === 'story') {
    const validated = validateStorySection(req.body?.value);
    if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
    return respondWriteResult(res, await saveStorySection(auth.creatorId, projectId, validated.value));
  }

  const validated = validateCreatorSection(req.body?.value);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
  return respondWriteResult(res, await saveCreatorSection(auth.creatorId, validated.value));
}
