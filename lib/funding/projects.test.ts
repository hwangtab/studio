/** @jest-environment node */
import fs from 'node:fs';

import { computeProjectState, findReward, getAllFundingProjects, getFundingProject, getListableFundingProjects, parseFundingProject } from './projects';

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
    expect(computeProjectState(p, new Date('2026-10-31T14:59:58Z'))).toBe('live');     // KST 23:59:58
    expect(computeProjectState(p, new Date('2026-10-31T14:59:59Z'))).toBe('closed');   // KST 23:59:59 = endAt
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

describe('content/funding 디렉터리 자체가 없을 때', () => {
  // 배포 번들에서 md가 빠지면 이 상태가 된다 — 조용히 "프로젝트 없음"으로 보이므로
  // 로그 한 줄이 유일한 단서다.
  it('빈 결과를 주되 원인을 로그로 남긴다', () => {
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(getAllFundingProjects()).toEqual([]);
    expect(getFundingProject('demo')).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
    expect(String(error.mock.calls[0][0])).toContain('content/funding 디렉터리 없음');
    exists.mockRestore();
    error.mockRestore();
  });
});

describe('status·hidden 엄격 검증', () => {
  // 이전에는 둘 다 조용한 폴백이었다 — 오타 난 status는 auto(=공개)로, 문자열 "true"인
  // hidden은 `=== true` 비교를 통과 못 해 false(=공개)로 떨어졌다. 화면에 아무 단서가 없다.
  it('status가 auto·draft·closed가 아니면 던진다', () => {
    expect(() => parseFundingProject(RAW.replace('rewards:', 'status: Draft\nrewards:'), 'demo'))
      .toThrow(/status은\(는\) auto \| draft \| closed 중 하나여야 합니다 \(받은 값: "Draft"\)/);
    expect(() => parseFundingProject(RAW.replace('rewards:', 'status: live\nrewards:'), 'demo')).toThrow(/status/);
    expect(() => parseFundingProject(RAW.replace('rewards:', 'status: true\nrewards:'), 'demo')).toThrow(/status/);
  });
  it('status가 없으면 auto, 있으면 그 값을 쓴다', () => {
    expect(parseFundingProject(RAW, 'demo').status).toBe('auto');
    for (const s of ['auto', 'draft', 'closed'] as const) {
      expect(parseFundingProject(RAW.replace('rewards:', `status: ${s}\nrewards:`), 'demo').status).toBe(s);
    }
  });
  it('hidden이 boolean이 아니면 던진다 — 문자열 "true" 포함', () => {
    expect(() => parseFundingProject(RAW.replace('rewards:', 'hidden: "true"\nrewards:'), 'demo'))
      .toThrow(/hidden은\(는\) boolean/);
    expect(() => parseFundingProject(RAW.replace('rewards:', 'hidden: 1\nrewards:'), 'demo')).toThrow(/hidden/);
  });
  it('hidden true·false는 그대로 통과한다', () => {
    expect(parseFundingProject(RAW.replace('rewards:', 'hidden: true\nrewards:'), 'demo').hidden).toBe(true);
    expect(parseFundingProject(RAW.replace('rewards:', 'hidden: false\nrewards:'), 'demo').hidden).toBe(false);
  });
  it('rewards[].requiresShipping도 같은 규칙이다 — 문자열이면 배송지를 조용히 안 받게 된다', () => {
    expect(() => parseFundingProject(RAW.replace('requiresShipping: true', 'requiresShipping: "true"'), 'demo'))
      .toThrow(/rewards\[0\]\.requiresShipping은\(는\) boolean/);
  });
});
