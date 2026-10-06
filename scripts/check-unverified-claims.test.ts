/** @jest-environment node */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * 검증 필요 후보 게이트(check-unverified-claims)의 판정을 고정한다.
 * 기준선 대비 "늘어난 후보"만 실패시키고, 기존 후보·후기·번역본은 건드리지 않는다.
 */

const SCRIPT = path.join(process.cwd(), 'scripts/check-unverified-claims.mjs');

const withRepo = (
  stories: Record<string, string>,
  baseline: Record<string, Record<string, number>> | null,
  run: (cwd: string) => void,
) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-gate-'));
  fs.mkdirSync(path.join(dir, 'content/stories'), { recursive: true });
  for (const [name, body] of Object.entries(stories)) {
    fs.writeFileSync(path.join(dir, 'content/stories', name), body);
  }
  if (baseline) {
    fs.writeFileSync(
      path.join(dir, 'content/unverified-claims.baseline.json'),
      JSON.stringify({ files: baseline }),
    );
  }
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const exec = (cwd: string, ...args: string[]) =>
  spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });

const FM = '---\ntitle: t\ncategory: 가이드\n---\n';
const CLEAN = `${FM}## 본문\n\n마이크는 입에서 10cm 떨어뜨립니다.\n`;
const QUOTE = `${FM}## 본문\n\nBon Iver가 "음악은 고독 속에서 찾아온다"고 했듯 혼자 칩니다.\n`;
const FIRST = `${FM}## 본문\n\n이 장비는 최초의 디지털 리미터입니다.\n`;

describe('check-unverified-claims', () => {
  it('후보가 없으면 통과한다', () => {
    withRepo({ 'a1.md': CLEAN }, null, (cwd) => {
      expect(exec(cwd).status).toBe(0);
    });
  });

  it('새 글에 인물 인용문이 있으면 실패하고 문장을 보여준다', () => {
    withRepo({ 'a1.md': QUOTE }, {}, (cwd) => {
      const r = exec(cwd);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('a1.md');
      expect(r.stderr).toContain('음악은 고독 속에서 찾아온다');
    });
  });

  it('"최초" 주장이 새로 생기면 실패한다', () => {
    withRepo({ 'a1.md': FIRST }, {}, (cwd) => {
      expect(exec(cwd).status).toBe(1);
    });
  });

  it('기준선에 이미 있는 후보는 통과한다', () => {
    withRepo({ 'a1.md': QUOTE }, { a1: { 'attributed-quote': 1 } }, (cwd) => {
      expect(exec(cwd).status).toBe(0);
    });
  });

  it('기준선보다 후보가 늘면 실패한다', () => {
    withRepo({ 'a1.md': QUOTE + QUOTE.replace(FM, '') }, { a1: { 'attributed-quote': 1 } }, (cwd) => {
      expect(exec(cwd).status).toBe(1);
    });
  });

  it('후기·번역본은 검사하지 않는다', () => {
    withRepo(
      {
        'r1.md': `---\ntitle: t\ncategory: 후기\n---\n${QUOTE.replace(FM, '')}`,
        'a1.en.md': QUOTE,
      },
      {},
      (cwd) => {
        expect(exec(cwd).status).toBe(0);
      },
    );
  });

  it('--update는 현재 후보를 기준선으로 고정한다', () => {
    withRepo({ 'a1.md': QUOTE }, null, (cwd) => {
      expect(exec(cwd, '--update').status).toBe(0);
      expect(exec(cwd).status).toBe(0);
    });
  });
});
