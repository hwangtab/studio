/**
 * 관리자 화면은 번역 사전을 받지 않는다(pages/_app.tsx의 isAdmin 분기) — 쓰지도 않는
 * ko/common.json 154KB를 받을 때까지 스피너만 내보내던 것을 끊은 결과다.
 *
 * 그 분기가 안전한 이유는 하나뿐이다: **관리자 화면에 번역을 쓰는 곳이 없다.** 누군가
 * 관리자 페이지에 useTranslation을 들이면 사전이 없는 채로 렌더되어 화면에 번역 키
 * 문자열('actions.foo')이 그대로 찍힌다. 조용히 깨지는 종류라 여기서 고정한다.
 *
 * Layout의 건너뛰기 링크만 예외인데, 그건 defaultValue를 들고 있어 사전 없이도 한국어가
 * 나온다(components/Layout.tsx skipLabel). 아래 layoutSkipLabel 테스트가 그것을 지킨다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'node:fs';

const ROOT = process.cwd();

const adminSourceFiles = (): string[] =>
  globSync('{pages/admin/**/*.{ts,tsx},components/admin/**/*.{ts,tsx}}', { cwd: ROOT })
    .filter((f) => !f.includes('.test.'));

it('관리자 페이지·컴포넌트는 번역(useTranslation·i18n.t)을 쓰지 않는다', () => {
  const offenders = adminSourceFiles().filter((file) => {
    const source = readFileSync(path.join(ROOT, file), 'utf-8');
    return /useTranslation|from ['"].*react-i18next|i18n\.t\(/.test(source);
  });

  expect(offenders).toEqual([]);
});

it('검사 대상 파일을 실제로 찾았다 — glob이 빗나가면 위 테스트가 늘 통과한다', () => {
  const files = adminSourceFiles();
  expect(files.length).toBeGreaterThan(10);
  expect(files).toContain('pages/admin/bookings/index.tsx');
});

it('건너뛰기 링크는 사전 없이도 한국어를 낸다 — 관리자 화면의 유일한 번역 호출', () => {
  const layout = readFileSync(path.join(ROOT, 'components/Layout.tsx'), 'utf-8');
  expect(layout).toContain("t('actions.skipToContent', { defaultValue: '본문 바로가기' })");
});
