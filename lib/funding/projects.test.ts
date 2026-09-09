/** @jest-environment node */
import { computeProjectState, findReward, getFundingProject, getListableFundingProjects, parseFundingProject } from './projects';

const RAW = `---
slug: demo
title: 데모
summary: 요약
cover: /images/funding/demo/cover.webp
goalAmount: 1000000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: CD
    description: 설명
    amount: 30000
    totalQuantity: 10
    requiresShipping: true
    estimatedDelivery: 2026-12
---
본문`;

describe('parseFundingProject', () => {
  it('frontmatter를 파싱하고 기본값을 채운다', () => {
    const p = parseFundingProject(RAW, 'demo');
    expect(p.status).toBe('auto');
    expect(p.hidden).toBe(false);
    expect(p.rewards[0]).toMatchObject({ id: 'cd', totalQuantity: 10, requiresShipping: true, image: null });
    expect(p.content.trim()).toBe('본문');
  });
  it('slug가 파일명과 다르면 던진다', () => {
    expect(() => parseFundingProject(RAW, 'other')).toThrow(/slug/);
  });
  it('리워드 id가 중복이면 던진다', () => {
    const dup = RAW.replace('rewards:', 'rewards:\n  - id: cd\n    title: X\n    description: d\n    amount: 1000\n    requiresShipping: false\n    estimatedDelivery: 2026-12');
    expect(() => parseFundingProject(dup, 'demo')).toThrow(/중복/);
  });
  it('리워드가 없거나 startAt ≥ endAt이면 던진다', () => {
    expect(() => parseFundingProject(RAW.replace(/rewards:[\s\S]*---\n본문/, '---\n본문'), 'demo')).toThrow();
    expect(() => parseFundingProject(RAW.replace('2026-10-31', '2026-09-30'), 'demo')).toThrow(/endAt/);
  });
});

describe('computeProjectState', () => {
  const p = { status: 'auto' as const, startAt: '2026-10-01T10:00:00+09:00', endAt: '2026-10-31T23:59:59+09:00' };
  it('시작 전 upcoming, 기간 중 live, 종료 후 closed', () => {
    expect(computeProjectState(p, new Date('2026-10-01T00:59:59Z'))).toBe('upcoming'); // KST 09:59
    expect(computeProjectState(p, new Date('2026-10-01T01:00:00Z'))).toBe('live');     // KST 10:00
    expect(computeProjectState(p, new Date('2026-10-31T14:59:59Z'))).toBe('live');     // KST 23:59:59
    expect(computeProjectState(p, new Date('2026-10-31T15:00:00Z'))).toBe('closed');   // KST 24:00
  });
  it('status 덮어쓰기', () => {
    expect(computeProjectState({ ...p, status: 'draft' }, new Date('2026-10-15T00:00:00Z'))).toBe('draft');
    expect(computeProjectState({ ...p, status: 'closed' }, new Date('2026-10-15T00:00:00Z'))).toBe('closed');
  });
});

describe('파일 로더', () => {
  it('smoke-test 프로젝트를 읽고, 목록에서는 뺀다', () => {
    const p = getFundingProject('smoke-test');
    expect(p?.hidden).toBe(true);
    expect(findReward(p!, 'thanks')?.amount).toBe(1000);
    expect(getListableFundingProjects().some((x) => x.slug === 'smoke-test')).toBe(false);
    expect(getFundingProject('없는-슬러그')).toBeNull();
  });
});
