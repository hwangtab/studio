import { and, eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../../db/client';
import { fundingProjects, fundingRewards } from '../../../../../../db/schema';
import { consumeRateLimit } from '../../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../../lib/funding/creatorAuth';
import { validateRewardInput } from '../../../../../../lib/funding/creatorValidation';
import { deleteReward, loadProjectForCreator, upsertReward } from '../../../../../../lib/funding/creatorProjectWrite';
import { respondWriteResult } from '../../../../../../lib/funding/creatorWriteHttp';

/**
 * 리워드 생성·수정·삭제.
 *
 * `mode: 'update'`는 `previousRewardId`를 **필수**로 받는다. `upsertReward`는 그 인자가
 * 없으면 "새 리워드 추가"로 해석한다(lib/funding/creatorProjectWrite.ts) — 화면이 리워드
 * id를 고치는 폼에서 이 값을 빠뜨리면, 개설자가 오타를 고칠 때마다 옛 리워드는 그대로 남고
 * 새 리워드가 하나씩 늘어난다. 함수 시그니처만으로는 "빠뜨림"과 "새로 추가"를 구분할 수
 * 없으므로(둘 다 유효한 4번째 인자 생략이다) 여기 라우트 스키마가 강제한다.
 *
 * 거울상으로, `mode: 'create'`도 그 id가 이미 있으면 막는다. `upsertReward`를
 * `previousRewardId` 없이 부르면 서비스는 "새로 추가"로 해석하지만, 실제로는 같은
 * `(projectId, rewardId)` 행이 있으면 **UPDATE로 빠진다**(존재하면 갱신, 없으면 삽입 —
 * upsert라는 이름 그대로). 개설자가 "새 리워드 추가" 폼에서 이미 쓰는 id를 실수로 다시
 * 적으면 새 티어가 느는 대신 기존 티어의 제목·설명·금액이 조용히 덮인다 — 초안(잠기지
 * 않음)이라 lockedViolation도 안 걸리고 오류도 안 나 개설자는 추가된 줄 안다. 여기서
 * 미리 조회해 막는다(서비스 쪽에 `expectNew` 같은 플래그를 새로 얹는 대신 라우트에서
 * 선조회하는 쪽을 골랐다 — upsertReward의 존재 확인 쿼리를 그대로 한 번 더 타는
 * 비용뿐이고, 서비스 시그니처를 안 늘려도 된다).
 *
 * 조회는 `fundingProjects.creatorId = auth.creatorId`까지 조인해서 본다 — projectId만
 * 보고 판정하면, 남의 프로젝트 id에 이미 쓰는 rewardId를 붙여 호출했을 때 (서비스의
 * 소유 guard가 돌기도 전에) "이미 있다"는 사실을 알려 주는 조회기가 된다. 조인해 두면
 * 남의 프로젝트에는 항상 "일치 없음"으로 보여 아래 upsertReward의 not_found(404)로
 * 자연스럽게 넘어간다.
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
    const rewardId = typeof req.body?.rewardId === 'string' ? req.body.rewardId.trim() : '';
    if (!rewardId) return res.status(400).json({ ok: false, message: '리워드를 확인해 주세요.' });
    return respondWriteResult(res, await deleteReward(auth.creatorId, projectId, rewardId));
  }

  /**
   * 이미 이 프로젝트에 저장된 리워드 이미지는 그대로 다시 보내와도 통과시킨다 — 개설자
   * id를 업로드 키에 넣기 전에 올라간 이미지가 설명만 고치려던 저장을 막으면 안 된다.
   * 소유는 `loadProjectForCreator`가 SQL로 대조하므로 남의 프로젝트 값은 섞일 수 없다.
   */
  const existingProject = await loadProjectForCreator(auth.creatorId, projectId);
  const validated = validateRewardInput(req.body?.value, {
    creatorId: auth.creatorId,
    existing: (existingProject?.rewards ?? []).map((reward) => reward.imageUrl),
  });
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  if (mode === 'update') {
    // 개명 경로 계약 — 위 주석 참조. previousRewardId가 없으면 무엇을 고치려는 요청인지
    // 알 수 없으므로 400으로 끊는다(서비스에 빈 값을 흘려 "새 리워드"로 오인시키지 않는다).
    const previousRewardId = typeof req.body?.previousRewardId === 'string' ? req.body.previousRewardId.trim() : '';
    if (!previousRewardId) {
      return res.status(400).json({ ok: false, message: '고치려는 리워드를 확인해 주세요.' });
    }
    return respondWriteResult(res, await upsertReward(auth.creatorId, projectId, validated.value, previousRewardId));
  }

  // mode === 'create' — 위 주석 참조. 같은 id가 이미 이 개설자의 이 프로젝트에 있으면
  // upsertReward가 "새로 추가"로 오인해 조용히 덮어쓰기 전에 막는다.
  const [duplicate] = await getDb()
    .select({ id: fundingRewards.id })
    .from(fundingRewards)
    .innerJoin(fundingProjects, eq(fundingRewards.projectId, fundingProjects.id))
    .where(
      and(
        eq(fundingRewards.projectId, projectId),
        eq(fundingRewards.rewardId, validated.value.rewardId),
        eq(fundingProjects.creatorId, auth.creatorId),
      ),
    )
    .limit(1);
  if (duplicate) return res.status(400).json({ ok: false, message: '이미 쓰고 있는 리워드 주소입니다.' });

  return respondWriteResult(res, await upsertReward(auth.creatorId, projectId, validated.value));
}
