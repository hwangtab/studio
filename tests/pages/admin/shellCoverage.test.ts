/**
 * 모든 관리자 화면이 공통 셸을 쓴다 — 나가는 길을 페이지가 아니라 셸이 책임지기 때문이다.
 *
 * 이 규칙이 없던 동안 실제로 막다른 화면이 여섯이었다: 상세 네 곳(예약·계약·펀딩·구독)은
 * '목록으로' 하나뿐이었고, 계약 작성·수정 화면은 링크가 아예 없어 브라우저 뒤로가기 말고는
 * 빠져나갈 길이 없었다. 새 관리자 페이지를 만들 때 셸을 빠뜨리면 같은 일이 조용히 되돌아온다.
 *
 * 로그인 화면만 예외다 — 세션이 없어 이동할 곳도 로그아웃할 것도 없다.
 */
import { readFileSync, globSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXEMPT = ['pages/admin/login.tsx'];

const adminPages = (): string[] =>
  globSync('pages/admin/**/*.tsx', { cwd: ROOT })
    .filter((f) => !f.includes('.test.'))
    .filter((f) => !EXEMPT.includes(f))
    .sort();

it('로그인을 뺀 모든 관리자 페이지가 AdminShell을 쓴다', () => {
  const missing = adminPages().filter((file) => {
    const source = readFileSync(path.join(ROOT, file), 'utf-8');
    return !/<AdminShell[\s>]/.test(source);
  });

  expect(missing).toEqual([]);
});

it('관리자 페이지가 자기 로그아웃 버튼을 따로 두지 않는다 — 셸의 것 하나만 있어야 한다', () => {
  const offenders = adminPages().filter((file) =>
    /logoutAdmin/.test(readFileSync(path.join(ROOT, file), 'utf-8')),
  );

  expect(offenders).toEqual([]);
});

it('검사 대상을 실제로 찾았다 — glob이 빗나가면 위 테스트가 늘 통과한다', () => {
  const pages = adminPages();
  expect(pages.length).toBeGreaterThanOrEqual(11);
  expect(pages).toContain('pages/admin/index.tsx');
  expect(pages).toContain('pages/admin/contracts/new.tsx');
  expect(pages).not.toContain('pages/admin/login.tsx');
});
