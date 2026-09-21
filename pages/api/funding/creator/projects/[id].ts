import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { validateBasicSection, validateCreatorSection, validateStorySection } from '../../../../../lib/funding/creatorValidation';
import { loadProjectForCreator, saveBasicSection, saveCreatorSection, saveStorySection } from '../../../../../lib/funding/creatorProjectWrite';
import { respondWriteResult } from '../../../../../lib/funding/creatorWriteHttp';
import { loadProjectForAdmin } from '../../../../../lib/funding/adminProjects';
import { sendCreatorEditedNotice } from '../../../../../lib/funding/reviewEmail';

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

  /**
   * 승인된 프로젝트가 저장으로 고쳐졌을 때 운영자에게 알린다.
   *
   * 매 저장마다 보내면 메일이 쏟아진다. 창 안의 나머지 저장은 보내지 않는다 — 합쳐서
   * 보내는 것이 아니라 억제한다. 운영자가 놓치면 안 되는 것은 메일이 아니라 심사 화면의
   * "승인 뒤 수정됨" 표시이고, 메일은 그 화면을 보러 가라는 신호일 뿐이다.
   *
   * `loadProjectForAdmin`은 관리자 조회라 정산 필드(`taxType` 등)와 `internalNote`를
   * 담고 있다 — 그 결과를 이 라우트의 응답에 싣지 않는다. 메일 함수에만 넘긴다.
   */
  const notifyIfApprovedEdit = async (wasApproved: boolean): Promise<void> => {
    if (!wasApproved) return;
    if (!(await consumeRateLimit(`funding_creator_edit:${projectId}`, 1, 3600))) return;
    const detail = await loadProjectForAdmin(projectId);
    if (!detail) return;
    const error = await sendCreatorEditedNotice(detail);
    if (error) console.error('[funding] 개설자 수정 알림 실패:', error);
  };

  if (section === 'basic') {
    const validated = validateBasicSection(req.body?.value, new Date());
    if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
    // wasApproved는 저장 전 상태를 봐야 한다 — saveBasicSection이 상태를 바꾸지는 않지만
    // 읽는 순서를 분명히 해 둔다.
    const before = await loadProjectForCreator(auth.creatorId, projectId);
    const wasApproved = before?.reviewStatus === 'approved';
    const result = await saveBasicSection(auth.creatorId, projectId, validated.value);
    if (result.ok) await notifyIfApprovedEdit(wasApproved);
    return respondWriteResult(res, result);
  }

  if (section === 'story') {
    const validated = validateStorySection(req.body?.value);
    if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
    const before = await loadProjectForCreator(auth.creatorId, projectId);
    const wasApproved = before?.reviewStatus === 'approved';
    const result = await saveStorySection(auth.creatorId, projectId, validated.value);
    if (result.ok) await notifyIfApprovedEdit(wasApproved);
    return respondWriteResult(res, result);
  }

  const validated = validateCreatorSection(req.body?.value);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
  return respondWriteResult(res, await saveCreatorSection(auth.creatorId, validated.value));
}
