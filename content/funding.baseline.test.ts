/** @jest-environment node */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { computeFundingBaseline, diffFundingBaseline, formatViolations, readBaseline } from '../scripts/funding-baseline';

/**
 * 펀딩 콘텐츠 불변식 게이트 — 프로젝트 slug·리워드 id는 DB의 project_slug·reward_id와
 * 문자열로 결합돼 있어 파일만 고치면 조용히 깨진다(재고 리셋·모금액 0원·후원자 이탈).
 * 의도한 변경이면 `npm run check:funding-baseline -- --update` 후 같은 커밋에 이유를 적을 것.
 * 배경: CLAUDE.md "펀딩 프로젝트 파일은 DB와 결합돼 있다",
 * docs/superpowers/specs/2026-09-08-funding-design.md §3.1.
 */
describe('funding content baseline', () => {
  it('matches content/funding.baseline.json', () => {
    const violations = diffFundingBaseline(readBaseline(), computeFundingBaseline());
    expect(violations.length === 0 ? '' : formatViolations(violations)).toBe('');
  });
});

describe('diffFundingBaseline', () => {
  const base = {
    album: { rewards: { cd: { amount: 30000, limited: true }, thanks: { amount: 1000, limited: false } } },
    demo: { rewards: { cd: { amount: 30000, limited: false } } },
  };

  it('리워드 id 변경을 제거+추가로 잡고, 재고 리셋 위험을 설명한다', () => {
    const now = { ...base, album: { rewards: { 'cd-v2': { amount: 30000, limited: true }, thanks: { amount: 1000, limited: false } } } };
    const v = diffFundingBaseline(base, now);
    expect(v).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'reward-removed', slug: 'album', rewardId: 'cd' }),
      expect.objectContaining({ kind: 'reward-added', slug: 'album', rewardId: 'cd-v2' }),
    ]));
    expect(formatViolations(v)).toMatch(/재고 집계에서 빠져 한정 수량이 0으로 리셋/);
  });

  it('slug 개명을 잡고, 모금액 0원·후원자 이탈을 설명한다', () => {
    const now = { 'album-2026': base.album, demo: base.demo };
    const v = diffFundingBaseline(base, now);
    expect(v.map((x) => x.kind).sort()).toEqual(['project-added', 'project-removed']);
    expect(formatViolations(v)).toMatch(/모금액이 0원/);
  });

  it('프로젝트 삭제를 잡는다', () => {
    const v = diffFundingBaseline(base, { album: base.album });
    expect(v).toEqual([expect.objectContaining({ kind: 'project-removed', slug: 'demo' })]);
  });

  it('totalQuantity 유무가 바뀌면 잡는다', () => {
    const now = { ...base, demo: { rewards: { cd: { amount: 30000, limited: true } } } };
    expect(diffFundingBaseline(base, now)).toEqual([
      expect.objectContaining({ kind: 'reward-limit-changed', slug: 'demo', rewardId: 'cd' }),
    ]);
  });

  it('리워드 순서·수량 값만 바뀐 것은 통과한다', () => {
    expect(diffFundingBaseline(base, { demo: base.demo, album: { rewards: { thanks: { amount: 1000, limited: false }, cd: { amount: 30000, limited: true } } } })).toEqual([]);
  });

  // 이 케이스가 예전엔 통째로 통과했다 — 기준선이 { limited }만 실어서 금액을 안 봤다.
  it('금액 변경을 잡고, 기존 후원 기록의 단가와 어긋난다고 설명한다', () => {
    const now = { ...base, album: { rewards: { cd: { amount: 35000, limited: true }, thanks: { amount: 1000, limited: false } } } };
    const v = diffFundingBaseline(base, now);
    expect(v).toEqual([
      expect.objectContaining({ kind: 'reward-amount-changed', slug: 'album', rewardId: 'cd', detail: expect.stringContaining('30,000원 → 35,000원') }),
    ]);
    expect(formatViolations(v)).toMatch(/기존 후원 기록의 단가/);
    expect(formatViolations(v)).toMatch(/새 id로 티어를 추가/);
  });

  it('금액과 한정 여부가 함께 바뀌면 두 건을 각각 보고한다', () => {
    const now = { ...base, demo: { rewards: { cd: { amount: 40000, limited: true } } } };
    expect(diffFundingBaseline(base, now).map((x) => x.kind).sort()).toEqual(['reward-amount-changed', 'reward-limit-changed']);
  });

  // amount 없는 2026-09-11 이전 기준선과 대조하면 예전엔 TypeError 스택트레이스만 나왔다.
  it('구 포맷(amount 없는) 기준선은 포맷이 오래됐다고 안내한다', () => {
    const legacy = { album: { rewards: { cd: { limited: true } } } } as unknown as typeof base;
    expect(() => diffFundingBaseline(legacy, base)).toThrow(/기준선 포맷이 오래됐다/);
    expect(() => diffFundingBaseline(legacy, base)).toThrow(/check:funding-baseline -- --update/);
  });

  it('실패 메시지는 --update와 "이유를 적으라"를 안내한다', () => {
    const msg = formatViolations(diffFundingBaseline(base, { album: base.album }));
    expect(msg).toContain('npm run check:funding-baseline -- --update');
    expect(msg).toMatch(/같은 커밋에/);
  });
});

describe('computeFundingBaseline', () => {
  it('md 파일에서 slug × 리워드 id × 단가 × 한정 여부만 뽑는다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'funding-baseline-'));
    fs.writeFileSync(path.join(dir, 'demo.md'), `---
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
  - id: thanks
    title: 감사 메일
    description: 설명
    amount: 1000
    requiresShipping: false
    estimatedDelivery: 2026-12
---
본문`);
    expect(computeFundingBaseline(dir)).toEqual({
      demo: { rewards: { cd: { amount: 30000, limited: true }, thanks: { amount: 1000, limited: false } } },
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
