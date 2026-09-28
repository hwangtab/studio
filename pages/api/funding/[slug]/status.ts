import type { NextApiRequest, NextApiResponse } from 'next';

import { computeProjectState } from '../../../../lib/funding/projects';
import { getFundingProjectAsync } from '../../../../lib/funding/repository';
import { buildPublicStatus } from '../../../../lib/funding/publicStatus';
import { expireStalePledges } from '../../../../lib/funding/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const project = await getFundingProjectAsync(slug);
  const now = new Date();
  const state = project ? computeProjectState(project, now) : null;
  if (!project || state === 'draft') return res.status(404).json({ ok: false });
  await expireStalePledges(now);
  // 조립은 buildPublicStatus 하나가 맡는다 — 정적 생성이 실어 보내는 초기값과 같은 모양이어야
  // 하고, 두 곳에서 각자 만들면 한쪽만 고쳤을 때 조용히 갈린다.
  const s = await buildPublicStatus(project, now);
  // 후원자 명단(운영자 숨김·공개 동의 철회)도 이 응답에 실린다 — s-maxage=60 +
  // stale-while-revalidate=300은 최악의 경우 6분 늦게 반영된다(3라운드 감사 낮음 항목).
  // CDN 오프로드 이점은 유지하되 창을 줄인다.
  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
  return res.status(200).json({ ok: true, ...s });
}
