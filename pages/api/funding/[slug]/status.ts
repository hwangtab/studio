import type { NextApiRequest, NextApiResponse } from 'next';

import { computeProjectState, getFundingProject } from '../../../../lib/funding/projects';
import { aggregateProjectStatus, expireStalePledges } from '../../../../lib/funding/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const project = getFundingProject(slug);
  const now = new Date();
  const state = project ? computeProjectState(project, now) : null;
  if (!project || state === 'draft') return res.status(404).json({ ok: false });
  await expireStalePledges(now);
  const s = await aggregateProjectStatus(project, now);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({
    ok: true, state, goalAmount: project.goalAmount, endAt: project.endAt,
    raisedAmount: s.raisedAmount, backerCount: s.backerCount,
    percent: Math.floor((s.raisedAmount / project.goalAmount) * 100),
    remaining: s.remaining, publicBackers: s.publicBackers,
  });
}
