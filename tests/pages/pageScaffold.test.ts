/** @jest-environment node */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 새 페이지의 뼈대 가드 — docs/design-system.md §3(거래 화면 뼈대)·§8(새 화면 체크리스트)·§10(v2).
 *
 * 2026-10-08: 기획자 현황 화면(`shows/report/[token]`)을 이웃 파일(입장 스캔 화면)을 본떠 만들었더니
 * v2 미설정·자체 `<main>`·회색 고정 바탕·손조립 박스가 그대로 따라왔다. uiPatterns.baseline.test.ts는
 * 정해진 7가지 패턴만 봐서 아무것도 잡지 못했고, 운영자가 "디자인 규칙을 따랐나"를 물어서야 드러났다.
 * 이웃 파일이 규칙 밖이면 본뜬 새 파일도 규칙 밖이 된다 — 그래서 **페이지 단위의 뼈대**를 여기서 막는다.
 *
 * 1. 모든 페이지는 `designEdition = 'v2'`다(§10 "사이트의 모든 페이지가 v2다").
 * 2. 페이지는 `<main>`을 만들지 않는다 — Layout이 `<main id="main-content">`를 이미 준다(겹치면 랜드마크가
 *    두 개가 된다). 히어로 없는 화면의 틀은 `PageShell`+`PageHeader`(components/ui/PageHeader.tsx).
 * 3. 페이지는 `min-h-screen`으로 자기 바탕을 깔지 않는다 — 바탕(`bg-paper dark:bg-gray-900`)과 높이는
 *    Layout이 가진다. 페이지가 `bg-gray-100` 같은 바탕을 깔면 다크 모드에서 글자가 사라진다.
 *
 * 아래 목록은 **이유가 있는 예외**와 **아직 못 고친 기존 부채**다. 부채 목록은 줄기만 한다 — 고친 파일이
 * 목록에 남아 있으면 실패해 목록을 지우게 한다. 새 페이지를 여기 넣지 말고 규칙대로 만들 것.
 * 본뜰 화면이 필요하면 `pages/[locale]/booking/manage/[orderNo].tsx`(PageShell·PageHeader·glass-card·Badge)를 본다.
 */

const ROOT = path.resolve(__dirname, '../..');
const PAGES = path.join(ROOT, 'pages');

const walk = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx') && !/\.test\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
};

const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

/** 페이지 뼈대 규칙의 대상 — 관리자 백오피스(AdminShell이 따로 있다)·API·`_app`/`_document`는 뺀다. */
const PAGE_FILES = walk(PAGES)
  .map(rel)
  .filter((f) => !f.startsWith('pages/api/') && !f.startsWith('pages/admin/') && !/^pages\/_/.test(path.basename(f)) && !/\/_[a-z]+\.tsx$/.test(f))
  .sort();

const read = (f: string) => readFileSync(path.join(ROOT, f), 'utf-8');

/** 규칙별 예외 — 값은 이유. "부채"로 시작하면 고쳐서 지울 대상이다. */
const V2_EXEMPT: Record<string, string> = {
  'pages/[locale]/shows/scan/[token].tsx': '현장 스태프용 입장 스캔 도구 — 고객·외부인이 보는 화면이 아니다',
  'pages/[locale]/press/sabbaha-slung.tsx': '비공개 감상실 — Layout이 isPressRoom으로 껍데기를 벗기고 앨범 디자인을 따로 그린다',
};

const MAIN_EXEMPT: Record<string, string> = {
  'pages/[locale]/shows/scan/[token].tsx': '현장 스태프용 입장 스캔 도구',
  'pages/[locale]/press/sabbaha-slung.tsx': '비공개 감상실(자기 머리·꼬리를 그린다)',
  'pages/[locale]/contracts/[id]/sign.tsx': '계약 서명 — 라이트 고정 법적 문서 화면(design-system §1)',
  'pages/[locale]/contracts/[id]/complete.tsx': '계약 완료 — 라이트 고정 법적 문서 화면(design-system §1)',
  'pages/[locale]/shows/success.tsx': '부채 — PageShell로 옮길 것',
  'pages/[locale]/shows/fail.tsx': '부채 — PageShell로 옮길 것',
  'pages/[locale]/shows/manage/[orderNo].tsx': '부채 — PageShell로 옮길 것',
  'pages/[locale]/funding/[slug]/pledge.tsx': '부채 — PageShell로 옮길 것',
  'pages/[locale]/funding/creator/[id]/preview.tsx': '부채 — PageShell로 옮길 것',
};

const MIN_H_SCREEN_EXEMPT: Record<string, string> = {
  'pages/[locale]/shows/scan/[token].tsx': '현장 스태프용 입장 스캔 도구',
  'pages/[locale]/press/sabbaha-slung.tsx': '비공개 감상실(자기 바탕을 그린다)',
  'pages/[locale]/contracts/[id]/sign.tsx': '계약 서명 — 종이처럼 보이는 라이트 고정 바탕(design-system §1)',
  'pages/[locale]/contracts/[id]/complete.tsx': '계약 완료 — 종이처럼 보이는 라이트 고정 바탕(design-system §1)',
};

const hasV2 = (src: string) => /\.designEdition\s*=\s*'v2'/.test(src);
/** JSX의 `<main` 여는 태그만 — 주석 속 낱말은 세지 않는다. */
const hasMain = (src: string) => src.split('\n').some((l) => /<main[\s>]/.test(l) && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l));
const hasMinHScreen = (src: string) => /\bmin-h-screen\b/.test(src);

const HOW = '규칙: docs/design-system.md §3·§8·§10. 본보기: pages/[locale]/booking/manage/[orderNo].tsx';

describe('페이지 뼈대', () => {
  it('대상 페이지를 찾는다(스캔이 비어 조용히 통과하지 않게)', () => {
    expect(PAGE_FILES.length).toBeGreaterThan(50);
  });

  it("모든 페이지는 designEdition = 'v2'다", () => {
    const missing = PAGE_FILES.filter((f) => !V2_EXEMPT[f] && !hasV2(read(f)));
    if (missing.length) throw new Error(`v2가 아닌 페이지:\n  ${missing.join('\n  ')}\n페이지 끝에 \`Page.designEdition = 'v2';\`를 단다. ${HOW}`);
  });

  it('페이지는 <main>을 만들지 않는다(Layout이 준다 — PageShell을 쓴다)', () => {
    const found = PAGE_FILES.filter((f) => !MAIN_EXEMPT[f] && hasMain(read(f)));
    if (found.length) throw new Error(`<main>을 직접 만든 페이지:\n  ${found.join('\n  ')}\n\`PageShell\`+\`PageHeader\`로 바꾼다. ${HOW}`);
  });

  it('페이지는 min-h-screen으로 자기 바탕을 깔지 않는다(Layout이 바탕을 가진다)', () => {
    const found = PAGE_FILES.filter((f) => !MIN_H_SCREEN_EXEMPT[f] && hasMinHScreen(read(f)));
    if (found.length) throw new Error(`자기 바탕을 깐 페이지:\n  ${found.join('\n  ')}\n바탕·높이는 Layout 몫이다. 다크 짝 없는 바탕은 다크 모드에서 글자를 지운다. ${HOW}`);
  });

  it('예외 목록에 남은 파일은 실제로 그 예외가 필요하다(고쳤으면 목록에서 지운다)', () => {
    const stale = [
      ...Object.keys(V2_EXEMPT).filter((f) => !existsSync(path.join(ROOT, f)) || hasV2(read(f))).map((f) => `V2_EXEMPT ${f}`),
      ...Object.keys(MAIN_EXEMPT).filter((f) => !existsSync(path.join(ROOT, f)) || !hasMain(read(f))).map((f) => `MAIN_EXEMPT ${f}`),
      ...Object.keys(MIN_H_SCREEN_EXEMPT).filter((f) => !existsSync(path.join(ROOT, f)) || !hasMinHScreen(read(f))).map((f) => `MIN_H_SCREEN_EXEMPT ${f}`),
    ];
    expect(stale).toEqual([]);
  });
});
