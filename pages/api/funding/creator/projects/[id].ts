import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { validateBasicSection, validateCreatorSection, validatePayoutSection, validateStorySection } from '../../../../../lib/funding/creatorValidation';
import {
  loadProjectForCreator, saveBasicSection, saveCreatorSection, savePayoutSection, saveStorySection,
} from '../../../../../lib/funding/creatorProjectWrite';
import { respondWriteResult } from '../../../../../lib/funding/creatorWriteHttp';
import { loadProjectForAdmin } from '../../../../../lib/funding/adminProjects';
import { sendCreatorEditedNotice } from '../../../../../lib/funding/reviewEmail';

/**
 * 구획별 저장 — 기본정보·스토리·개설자 프로필·정산 정보 네 구획을 한 라우트가 받는다.
 *
 * `section: 'creator'`와 `section: 'payout'`은 URL의 프로젝트 id를 쓰지 않는다. 개설자 프로필(이름·소개·연락처·
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
  if (section !== 'basic' && section !== 'story' && section !== 'creator' && section !== 'payout') {
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
  // 메일 실패(또는 예기치 않은 예외)가 이미 성공한 저장 응답까지 끌고 내려가면 안 된다 —
  // 저장은 커밋됐는데 핸들러가 던져 500이 나가는 것은 이 라우트가 막으려던 바로 그 종류의
  // 상태 불일치다(리뷰 지적, 2026-09-21).
  const notifyIfApprovedEdit = async (wasApproved: boolean): Promise<void> => {
    if (!wasApproved) return;
    try {
      if (!(await consumeRateLimit(`funding_creator_edit:${projectId}`, 1, 3600))) return;
      const detail = await loadProjectForAdmin(projectId);
      if (!detail) return;
      const error = await sendCreatorEditedNotice(detail);
      if (error) console.error('[funding] 개설자 수정 알림 실패:', error);
    } catch (error: unknown) {
      console.error('[funding] 개설자 수정 알림 처리 중 오류:', error);
    }
  };

  if (section === 'basic') {
    // wasApproved는 저장 전 상태를 봐야 한다 — saveBasicSection이 상태를 바꾸지는 않지만
    // 읽는 순서를 분명히 해 둔다. 검증보다 먼저 읽는 이유는 아래 참조.
    const before = await loadProjectForCreator(auth.creatorId, projectId);
    const wasApproved = before?.reviewStatus === 'approved';

    /**
     * 승인된 프로젝트는 모금 기간이 후원자와의 약속이라 바꿀 수 없다
     * (`creatorProjectWrite.ts`의 `basicLockedViolation`). 그런데 화면(`BasicSectionForm`)은
     * 잠긴 날짜 필드도 폼 값에 실어 **매번 함께** 보낸다 — 저장 자체를 막는 것이 아니라
     * 입력을 비활성화만 해 두었기 때문이다. `validateBasicSection`은 상태와 무관하게
     * `startAt >= now + leadDays`를 요구하므로, 모금이 이미 시작된(startAt이 과거인)
     * 승인 프로젝트는 이 검증에서 **항상** 400을 받는다 — `guard()`도 `basicLockedViolation`도
     * 닿기 전에 막힌다. 리뷰에서 재현된 회귀다(2026-09-21): 승인 뒤에는 기본정보를 영원히
     * 저장할 수 없었다.
     *
     * 그래서 검증기에 잠긴 날짜를 **Date 그대로** 넘긴다(`lockedDates`). 검증기는 입력의
     * 날짜를 보지 않고 이 값을 결과에 싣고, 리드타임·기간 검사도 건너뛴다 — 이미 승인된
     * 값이라 다시 볼 이유가 없다. 이후 `basicLockedViolation`도 항상 무위반이다.
     *
     * **왜 bare `YYYY-MM-DD`로 치환하지 않는가** — 그건 손실 왕복이다. DB의 `start_at`이
     * 정확히 KST 자정이 아닌 행(2026-09-17 이전에 서버 로컬 자정으로 저장된 것)에서는
     * 치환값이 원래 순간으로 돌아오지 않아, 제목 한 글자만 고쳐도 "모금 기간은 바꿀 수
     * 없습니다"로 거부됐다. `saveBasicSection`의 `basicLockedViolation`은 그대로 둔다 —
     * 서비스 계층을 직접 부르는 경로(예: 다른 API·스크립트)에 대한 방어가 남아야 한다.
     */
    const rawValue = (req.body?.value ?? {}) as Record<string, unknown>;
    const lockedDates = wasApproved && before
      ? { startAt: before.startAt, endAt: before.endAt }
      : undefined;

    const validated = validateBasicSection(rawValue, new Date(), lockedDates);
    if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
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

  if (section === 'payout') {
    // 응답은 `respondWriteResult`의 `{ ok: true }` 한 벌이다 — 저장한 계좌를 되돌려
    // 보내지 않는다. 화면은 자기가 입력한 값을 이미 들고 있고, 응답에 실으면 그 JSON이
    // 브라우저 캐시·개발자도구 네트워크 탭·프록시 로그에 그대로 남는다.
    const validatedPayout = validatePayoutSection(req.body?.value);
    if (!validatedPayout.ok) return res.status(400).json({ ok: false, message: validatedPayout.message });
    return respondWriteResult(res, await savePayoutSection(auth.creatorId, validatedPayout.value));
  }

  const validated = validateCreatorSection(req.body?.value);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
  return respondWriteResult(res, await saveCreatorSection(auth.creatorId, validated.value));
}
