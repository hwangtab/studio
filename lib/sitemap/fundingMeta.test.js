/** @jest-environment node */
const fs = require('node:fs');
const path = require('node:path');

const { fundingDir, readFundingProjects } = require('./fundingMeta');
const { getAllFundingProjects, computeProjectState } = require('../funding/projects');

/**
 * 사이트맵·IndexNow(readFundingProjects)와 앱(lib/funding/projects.ts)이 같은 frontmatter를
 * 다르게 판정하면, 앱은 404인데 사이트맵은 그 URL을 제출하는 상태가 된다. 예전 정규식 파싱은
 * 따옴표·들여쓰기·본문 코드블록에 따라 앱과 갈렸다. 지금은 양쪽 모두 gray-matter를 쓴다.
 */
describe('readFundingProjects', () => {
  it('draft·hidden 판정이 앱(projects.ts)과 일치한다', () => {
    const meta = new Map(readFundingProjects().map((p) => [p.slug, p]));
    const apps = getAllFundingProjects();
    expect(apps.length).toBeGreaterThan(0);
    expect(meta.size).toBe(apps.length);
    for (const app of apps) {
      const m = meta.get(app.slug);
      expect(m).toBeDefined();
      expect(m.hidden).toBe(app.hidden);
      // draft 판정 = 앱의 상태 판정(status: draft). 사이트맵 등재 제외 기준이 이 값이다.
      expect(m.draft).toBe(computeProjectState(app, new Date()) === 'draft' && app.status === 'draft');
      expect(m.lastmod).toBe(`${app.lastmod}T00:00:00+09:00`);
    }
  });

  it('content/funding이 없으면 빈 배열', () => {
    const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(readFundingProjects()).toEqual([]);
    spy.mockRestore();
  });

  it('정규식이 아니라 frontmatter를 파싱한다 — 본문 코드블록의 status·hidden 줄에 속지 않는다', () => {
    const raw = [
      '---', 'slug: demo', 'status: auto', 'hidden: false', 'lastmod: 2026-09-01', '---',
      '```yaml', 'status: draft', 'hidden: true', '```',
    ].join('\n');
    withFakeDir({ 'demo.md': raw }, () => {
      expect(readFundingProjects()).toEqual([{ slug: 'demo', draft: false, hidden: false, lastmod: '2026-09-01T00:00:00+09:00' }]);
    });
  });

  it('따옴표가 붙은 status: "draft"도 앱과 같게 draft로 읽는다', () => {
    withFakeDir({ 'demo.md': '---\nslug: demo\nstatus: "draft"\nlastmod: "2026-09-01"\n---\n본문' }, () => {
      expect(readFundingProjects()[0]).toMatchObject({ draft: true, lastmod: '2026-09-01T00:00:00+09:00' });
    });
  });

  it('알 수 없는 status·문자열 hidden은 던진다 — 앱과 같은 규칙', () => {
    withFakeDir({ 'demo.md': '---\nslug: demo\nstatus: Draft\n---\n본문' }, () => {
      expect(() => readFundingProjects()).toThrow(/status은\(는\) auto \| draft \| closed/);
    });
    withFakeDir({ 'demo.md': '---\nslug: demo\nhidden: "true"\n---\n본문' }, () => {
      expect(() => readFundingProjects()).toThrow(/hidden은\(는\) boolean/);
    });
  });
});

// fundingDir는 모듈 로드 시 process.cwd()로 고정되므로, fs 레이어를 갈아 끼워 가짜 파일을 준다.
function withFakeDir(files, fn) {
  const spies = [
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => p === fundingDir),
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => Object.keys(files)),
    jest.spyOn(fs, 'readFileSync').mockImplementation((p) => files[path.basename(p)]),
  ];
  try { fn(); } finally { spies.forEach((s) => s.mockRestore()); }
}
