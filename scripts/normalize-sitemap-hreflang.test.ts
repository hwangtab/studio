/** @jest-environment node */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * postbuild가 사이트맵 생성 실패를 삼키고 "초록 빌드"로 넘어가던 것을 막는 가드.
 *
 * postbuild = `rm -f public/sitemap*.xml public/robots.txt && next-sitemap && node <이 스크립트>`.
 * next-sitemap은 내부 오류를 `.catch(Logger.error)`로 삼켜 exit 0으로 끝나고, 이 스크립트는
 * 예전엔 파일이 없으면 조용히 no-op이었다 — 사이트맵과 robots.txt가 지워진 채 배포될 수 있었다.
 * 아래 두 케이스가 그 상태를 실패로 고정한다.
 */

const SCRIPT = path.join(process.cwd(), 'scripts/normalize-sitemap-hreflang.js');

const run = (cwd: string) =>
  spawnSync('node', [SCRIPT], { cwd, encoding: 'utf8' });

const withPublic = (build: (publicDir: string) => void) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-guard-'));
  const publicDir = path.join(dir, 'public');
  fs.mkdirSync(publicDir);
  build(publicDir);
  return { dir, publicDir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
};

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>https://studionol.co.kr/ko</loc>
<xhtml:link rel="alternate" hreflang="uz_Latn_UZ" href="https://studionol.co.kr/uz"/>
</url></urlset>`;

describe('normalize-sitemap-hreflang 가드', () => {
  it('sitemap*.xml이 하나도 없으면 원인을 말하며 exit 1', () => {
    const { cwd, cleanup } = (() => {
      const t = withPublic(() => {});
      return { cwd: t.dir, cleanup: t.cleanup };
    })();
    const result = run(cwd);
    cleanup();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('sitemap*.xml이 하나도 없다');
    // 왜 이전 산출물도 안 남는지(rm 선행)와 왜 초록 빌드가 되는지(exit 0 삼킴)를 말해야 한다.
    expect(result.stderr).toContain('rm -f public/sitemap*.xml');
    expect(result.stderr).toMatch(/exit 0/);
  });

  it('sitemap은 있는데 robots.txt가 없으면 exit 1', () => {
    const t = withPublic((p) => fs.writeFileSync(path.join(p, 'sitemap.xml'), SITEMAP));
    const result = run(t.dir);
    t.cleanup();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('robots.txt가 없다');
  });

  it('정상 산출물이면 통과하고 uz_Latn_UZ를 하이픈으로 고친다', () => {
    const t = withPublic((p) => {
      fs.writeFileSync(path.join(p, 'sitemap.xml'), SITEMAP);
      fs.writeFileSync(path.join(p, 'sitemap-0.xml'), SITEMAP);
      fs.writeFileSync(path.join(p, 'robots.txt'), 'User-agent: *\n');
    });
    const result = run(t.dir);
    const rewritten = fs.readFileSync(path.join(t.publicDir, 'sitemap-0.xml'), 'utf8');
    t.cleanup();

    expect(result.status).toBe(0);
    expect(rewritten).toContain('uz-Latn-UZ');
    expect(rewritten).not.toContain('uz_Latn_UZ');
    // 두 번째 파일도 함께 처리돼야 한다 — /g 정규식의 lastIndex 때문에 두 번째 파일이 건너뛰어지던 버그가 있었다.
    expect(result.stdout).toContain('2 file(s) verified, hreflang normalized in 2');
  });
});
