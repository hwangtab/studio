import fs from 'fs';
import path from 'path';
import { getPortfolioItems } from './portfolio';
import { pipelineCases, recentAlbumFundingStats, releasePipelineCopy } from './releasePipeline';
import { CROWDFUNDING_CASES } from './crowdfundingCases';
import { FUNDING_DESIGN_PRICE, formatPriceLabel } from './pricing';

describe('발매 파이프라인 데이터 (data/releasePipeline)', () => {
  it('사례 카드의 portfolioId가 전부 실제 포트폴리오 항목을 가리킨다', () => {
    const ids = new Set(getPortfolioItems('ko').map((item) => item.id));
    const cases = pipelineCases();
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) expect(ids.has(c.release.portfolioId)).toBe(true);
  });

  it('사례 카드의 storySlug는 실제 스토리 파일을 가리킨다', () => {
    for (const c of pipelineCases()) {
      if (!c.release.storySlug) continue;
      expect(fs.existsSync(path.join(process.cwd(), 'content/stories', `${c.release.storySlug}.md`))).toBe(true);
    }
  });

  it('사례는 성공한 음반 펀딩만, 최신순이다', () => {
    const cases = pipelineCases();
    for (const c of cases) {
      expect(c.kind).toBe('음반');
      expect(c.state).toBe('succeeded');
    }
    const periods = cases.map((c) => c.period);
    expect(periods).toEqual([...periods].sort().reverse());
  });

  it('모금 통계는 케이스 데이터에서 계산되고 성공 건만 센다', () => {
    const stats = recentAlbumFundingStats();
    const eligible = CROWDFUNDING_CASES.filter((c) => c.kind === '음반' && c.state === 'succeeded' && c.period >= stats.since);
    expect(stats.count).toBe(eligible.length);
    expect(stats.min).toBeLessThanOrEqual(stats.median);
    expect(stats.median).toBeLessThanOrEqual(stats.max);
  });

  it('카피가 폐지된 수수료 구조(성공 수수료·텀블벅 개설)를 말하지 않는다', () => {
    const text = JSON.stringify(releasePipelineCopy);
    expect(text).not.toMatch(/모금액의 \d+%/);
    expect(text).not.toMatch(/텀블벅/);
    expect(text).toContain(formatPriceLabel(FUNDING_DESIGN_PRICE, 'ko'));
  });
});
