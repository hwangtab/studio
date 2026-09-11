/** @jest-environment node */

import { fundingStatusLine } from '../../pages/api/llms';
import type { FundingProject } from '../../lib/funding/projects';

jest.mock('../../lib/funding/projects', () => {
  const actual = jest.requireActual('../../lib/funding/projects');
  return { ...actual, getListableFundingProjects: jest.fn() };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getListableFundingProjects } = require('../../lib/funding/projects') as {
  getListableFundingProjects: jest.Mock;
};

/**
 * llms.txt는 AI 답변 채널이 그대로 인용하는 문서다. 예전엔 "진행 중인 프로젝트: /ko/funding"
 * 한 줄이 조건 없이 나가서, 진행 중 프로젝트가 0건일 때도 "진행 중"이라 말했다 —
 * 사실과 다른 안내가 우리가 통제하지 못하는 곳에서 재생산된다.
 */

const SITE = 'https://studionol.co.kr';
const NOW = new Date('2026-10-15T12:00:00+09:00');

const project = (over: Partial<FundingProject>): FundingProject => ({
  slug: 'demo', title: '데모 1집', summary: '요약', cover: '/c.webp', ogImage: null,
  goalAmount: 3_000_000,
  startAt: '2026-10-01T00:00:00+09:00', endAt: '2026-11-01T00:00:00+09:00',
  status: 'auto', hidden: false, lastmod: '2026-10-01', rewards: [], content: '',
  ...over,
});

describe('llms.txt 펀딩 안내', () => {
  afterEach(() => getListableFundingProjects.mockReset());

  it('진행 중(live)이 없으면 "없음"이라고 말한다', () => {
    getListableFundingProjects.mockReturnValue([]);
    const line = fundingStatusLine(SITE, NOW);
    expect(line).toContain('현재 진행 중인 프로젝트는 없습니다');
    expect(line).not.toContain('진행 중인 프로젝트 1건');
  });

  it('진행 중이 있으면 제목·목표액·상세 URL을 싣는다', () => {
    getListableFundingProjects.mockReturnValue([project({})]);
    const line = fundingStatusLine(SITE, NOW);
    expect(line).toContain('데모 1집');
    expect(line).toContain('3,000,000원');
    expect(line).toContain(`${SITE}/ko/funding/demo`);
    expect(line).not.toContain('현재 진행 중인 프로젝트는 없습니다');
  });

  // getListableFundingProjects는 공개 목록이라 upcoming·closed도 담는다. 그대로 쓰면
  // 마감된 프로젝트가 "진행 중"으로 나간다.
  it('upcoming·closed는 진행 중으로 세지 않는다', () => {
    getListableFundingProjects.mockReturnValue([
      project({ slug: 'soon', startAt: '2026-12-01T00:00:00+09:00', endAt: '2026-12-31T00:00:00+09:00' }),
      project({ slug: 'done', startAt: '2026-01-01T00:00:00+09:00', endAt: '2026-02-01T00:00:00+09:00' }),
    ]);
    const line = fundingStatusLine(SITE, NOW);
    expect(line).toContain('현재 진행 중인 프로젝트는 없습니다');
    expect(line).not.toContain('/ko/funding/soon');
  });

  it('파싱이 실패해도 llms.txt를 죽이지 않고, 없다고 단언하지도 않는다', () => {
    getListableFundingProjects.mockImplementation(() => { throw new Error('frontmatter 오류'); });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const line = fundingStatusLine(SITE, NOW);
    warn.mockRestore();
    expect(line).toContain(`${SITE}/ko/funding`);
    expect(line).not.toContain('현재 진행 중인 프로젝트는 없습니다');
  });
});
