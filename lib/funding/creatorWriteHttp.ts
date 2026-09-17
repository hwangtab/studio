import type { NextApiResponse } from 'next';

import type { WriteResult } from './creatorProjectWrite';

/**
 * `WriteResult.code` → HTTP 상태.
 *
 * `projects/[id].ts`와 `projects/[id]/rewards.ts`가 함께 쓴다. 예전엔 두 라우트에
 * 글자 그대로 복제돼 있었다 — `WriteResult.code`에 항목이 늘 때마다 두 곳을 고쳐야 했고,
 * 하나를 빠뜨리면 그 라우트만 매핑에 없는 코드를 만나 `undefined` 상태 코드로 응답이
 * 터진다. 한 벌만 두고 양쪽이 가져다 쓴다.
 */
const STATUS_BY_CODE: Record<Exclude<WriteResult, { ok: true }>['code'], number> = {
  not_found: 404,
  locked: 409,
  not_editable: 409,
  duplicate_slug: 400,
  duplicate_reward: 400,
  too_many: 400,
};

export const respondWriteResult = (res: NextApiResponse, result: WriteResult) => {
  if (result.ok) return res.status(200).json({ ok: true });
  return res.status(STATUS_BY_CODE[result.code]).json({ ok: false, message: result.message });
};
