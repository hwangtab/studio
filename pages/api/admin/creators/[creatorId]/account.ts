import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import {
  decideCreatorAccountByCreatorId,
  type CreatorAccountAction,
  type CreatorAccountResult,
} from '../../../../../lib/funding/creatorAccountDecision';
import {
  sendCreatorAccountOperatorFallback,
  sendCreatorEmailChangedEmails,
  sendCreatorNameChangedEmail,
} from '../../../../../lib/funding/creatorEmail';
import { revalidateFundingPaths } from '../../../../../lib/funding/revalidate';

/**
 * POST `{ action: 'set_creator_name' | 'set_creator_email', value, reason }` — 개설자 계정(이름·로그인 이메일) 수정.
 * 개설자 단위판이다.
 *
 * 펀딩 프로젝트 단위 경로(`../../funding/projects/[id].ts`의 개설자 계정 분기)는 프로젝트 id로 개설자를 찾으므로,
 * 공연·상점으로만 들어온 개설자는 메일함을 잃거나 이름을 잘못 적어도 고칠 길이 없었다. 이 경로가 그 자리다 —
 * 판정(이메일 중복 거절·로그인 토큰 삭제·`session_version` 증가·낙관적 잠금)은 같은 모듈을 지난다.
 *
 * 사유는 어느 컬럼에도 저장하지 않는다(프로젝트 단위 경로와 같다). 남는 곳은 개설자에게 가는 알림 메일과 아래 서버 로그뿐이다.
 * `privacy_access_logs`는 개인정보를 **열어 본** 기록이라 계정 변경은 담지 않는다.
 */
const HTTP: Record<Exclude<CreatorAccountResult, { ok: true }>['code'], number> = {
  not_found: 404,
  invalid: 400,
  incomplete: 400,
  conflict: 409,
  duplicate_email: 400,
};

const ACTIONS: readonly CreatorAccountAction[] = ['set_creator_name', 'set_creator_email'];
const isAction = (value: unknown): value is CreatorAccountAction =>
  typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const creatorId = typeof req.query.creatorId === 'string' ? req.query.creatorId : '';
  if (!creatorId) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });

  const b = (req.body ?? {}) as Record<string, unknown>;
  if (!isAction(b.action)) return res.status(400).json({ ok: false, message: '잘못된 요청입니다.' });
  const action = b.action;
  const value = typeof b.value === 'string' ? b.value : '';
  const reason = typeof b.reason === 'string' ? b.reason : '';

  let result: CreatorAccountResult;
  try {
    result = await decideCreatorAccountByCreatorId(creatorId, action, { value, reason });
  } catch (error: unknown) {
    console.error(`[admin/creators] 계정 변경 예외 (creatorId=${creatorId}, action=${action}):`, error);
    return res.status(500).json({ ok: false, message: '처리 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (!result.ok) return res.status(HTTP[result.code]).json({ ok: false, message: result.message });

  // 계정 변경의 유일한 영속 기록(프로젝트 단위 경로와 같다). 값을 바꾼 뒤에 남긴다.
  const next = action === 'set_creator_name' ? result.creatorName : result.creatorEmail;
  console.warn(
    `[admin/creators] 개설자 계정 변경 (creatorId=${result.creatorId}, action=${action}, by=${auth.actor}): ` +
      `"${result.previousValue}" → "${next}" / 사유: ${reason.trim()}`,
  );

  const warnings: string[] = [];
  try {
    // 이름은 공개 상세에 박히므로 승인된 펀딩 프로젝트 전부를 다시 만든다(없으면 빈 배열).
    for (const slug of result.revalidateSlugs) {
      const revalidateError = await revalidateFundingPaths(res, slug);
      if (revalidateError) warnings.push(revalidateError);
    }
    const mailError =
      action === 'set_creator_name'
        ? await sendCreatorNameChangedEmail(result.creatorEmail, result.previousValue, result.creatorName, reason.trim())
        : await sendCreatorEmailChangedEmails(result.previousValue, result.creatorEmail, reason.trim());
    if (mailError) {
      warnings.push(mailError);
      const fallbackError = await sendCreatorAccountOperatorFallback(
        action === 'set_creator_name' ? '이름' : '로그인 이메일',
        result.creatorEmail,
        result.previousValue,
        next,
        reason.trim(),
        mailError,
      );
      if (fallbackError) warnings.push(`운영자 폴백 알림도 실패했습니다: ${fallbackError}`);
    }
  } catch (error: unknown) {
    console.error(`[admin/creators] 계정 변경 후속 처리 실패 (creatorId=${creatorId}, action=${action}):`, error);
    warnings.push('계정 변경 후 재검증·메일 처리 중 오류가 발생했습니다. 상태를 직접 확인해 주세요.');
  }

  return res.status(200).json({
    ok: true,
    creatorName: result.creatorName,
    creatorEmail: result.creatorEmail,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
