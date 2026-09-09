import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../../components/funding/PledgeWizard', () => function MockPledgeWizard() { return <div data-testid="wizard" />; });
jest.mock('../../../../components/funding/FundingTrustNotice', () => function MockFundingTrustNotice() { return null; });
jest.mock('../../../../utils/analytics', () => ({ trackMicroEvent: jest.fn() }));

// eslint-disable-next-line import/first
import PledgePage from '../../../../pages/[locale]/funding/[slug]/pledge';
// eslint-disable-next-line import/first
import { trackMicroEvent } from '../../../../utils/analytics';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
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

it('펀딩 위저드 페이지 마운트 시 funding_pledge_start를 발화한다(제출 성공 시가 아님)', () => {
  render(<PledgePage project={project} initialRewardId={null} remaining={{ mail: null }} />);
  expect(trackMicroEvent).toHaveBeenCalledTimes(1);
  expect(trackMicroEvent).toHaveBeenCalledWith('funding_pledge_start', { component: 'funding_pledge', landing_slug: 'demo' });
});
