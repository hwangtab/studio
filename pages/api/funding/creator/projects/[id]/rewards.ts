import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { validateRewardInput } from '../../../../../../lib/funding/creatorValidation';
import { deleteReward, upsertReward, type WriteResult } from '../../../../../../lib/funding/creatorProjectWrite';

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
 * 리워드 생성·수정·삭제.
 *
 * `mode: 'update'`는 `previousRewardId`를 **필수**로 받는다. `upsertReward`는 그 인자가
 * 없으면 "새 리워드 추가"로 해석한다(lib/funding/creatorProjectWrite.ts) — 화면이 리워드
 * id를 고치는 폼에서 이 값을 빠뜨리면, 개설자가 오타를 고칠 때마다 옛 리워드는 그대로 남고
 * 새 리워드가 하나씩 늘어난다. 함수 시그니처만으로는 "빠뜨림"과 "새로 추가"를 구분할 수
 * 없으므로(둘 다 유효한 4번째 인자 생략이다) 여기 라우트 스키마가 강제한다.
 *
 * `mode: 'reorder'`는 두지 않는다 — creatorProjectWrite.ts에 순서를 바꾸는 함수가 없고
 * (rewards.sortOrder는 스키마에 있지만 쓰는 쓰기 경로가 없다), 브리프도 순서 변경을
 * 요구하지 않는다. 없는 기능의 자리만 파 두면 다음 사람이 "이미 있는 줄 알고" 호출하는
 * 죽은 분기가 된다.
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

  const mode = req.body?.mode;
  if (mode !== 'create' && mode !== 'update' && mode !== 'delete') {
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }

  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }

  if (mode === 'delete') {
    const rewardId = typeof req.body?.rewardId === 'string' ? req.body.rewardId : '';
    if (!rewardId) return res.status(400).json({ ok: false, message: '리워드를 확인해 주세요.' });
    return respondWriteResult(res, await deleteReward(auth.creatorId, projectId, rewardId));
  }

  const validated = validateRewardInput(req.body?.value);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  if (mode === 'update') {
    // 개명 경로 계약 — 위 주석 참조. previousRewardId가 없으면 무엇을 고치려는 요청인지
    // 알 수 없으므로 400으로 끊는다(서비스에 빈 값을 흘려 "새 리워드"로 오인시키지 않는다).
    const previousRewardId = typeof req.body?.previousRewardId === 'string' ? req.body.previousRewardId : '';
    if (!previousRewardId) {
      return res.status(400).json({ ok: false, message: 'previousRewardId가 필요합니다.' });
    }
    return respondWriteResult(res, await upsertReward(auth.creatorId, projectId, validated.value, previousRewardId));
  }

  return respondWriteResult(res, await upsertReward(auth.creatorId, projectId, validated.value));
}
