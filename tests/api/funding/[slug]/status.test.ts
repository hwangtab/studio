/** @jest-environment node */
jest.mock('../../../../lib/funding/service', () => ({
  aggregateProjectStatus: jest.fn(), expireStalePledges: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../../lib/funding/projects', () => ({
  ...jest.requireActual('../../../../lib/funding/projects'),
  getFundingProject: jest.fn(),
}));
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/funding/[slug]/status';
import { aggregateProjectStatus, expireStalePledges } from '../../../../lib/funding/service';
import { getFundingProject, parseFundingProject } from '../../../../lib/funding/projects';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2020-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

const draftProject = parseFundingProject(`---
slug: draft
title: 초안
summary: s
cover: /c.webp
goalAmount: 1000
status: draft
startAt: 2020-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'draft');

const call = async (slug: string) => {
  const setHeader = jest.fn();
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method: 'GET', query: { slug }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0], setHeader };
};

beforeEach(() => jest.clearAllMocks());

it('프로젝트 없음 → 404', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(null);
  const r = await call('nope');
  expect(r.status).toBe(404);
});

it('draft 상태 → 404', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(draftProject);
  const r = await call('draft');
  expect(r.status).toBe(404);
});

it('정상 → 200, state·percent·publicBackers·remaining·Cache-Control·expireStalePledges 호출', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(project);
  (aggregateProjectStatus as jest.Mock).mockResolvedValue({
    raisedAmount: 999, backerCount: 3, remaining: { mail: 7 }, publicBackers: ['김', '이'],
  });
  const r = await call('demo');
  expect(r.status).toBe(200);
  expect(r.body.state).toBe('live');
  expect(r.body.percent).toBe(99);
  expect(r.body.publicBackers).toEqual(['김', '이']);
  expect(r.body.remaining).toEqual({ mail: 7 });
  expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  expect(expireStalePledges).toHaveBeenCalled();
});
