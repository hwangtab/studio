/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 측정 스크립트 mount 게이팅(`lib/analytics/privatePaths.ts`)은 `router.asPath` 기준이라
 * **private 페이지가 클라이언트 전환으로 벗어나는 순간 무력해진다.** next/link로 공개
 * 페이지에 갔다가 뒤로가기를 누르면, 그 사이 mount된 gtag/Vercel Analytics가 살아 있는 채로
 * `?token=`·주문번호가 실린 URL로 돌아와 page_view를 보낸다. 그래서 이 페이지들의 이탈
 * 링크는 전부 문서 이동(`<a href>`)이어야 한다.
 *
 * next/link도 DOM에는 `<a>`를 렌더하므로 렌더 결과로는 구분할 수 없다 — 소스에서 본다.
 */
const PRIVATE_PAGES = [
  'pages/[locale]/funding/manage/[orderNo].tsx',
  'pages/[locale]/funding/deposit/[orderNo].tsx',
  'pages/[locale]/funding/success.tsx',
  'pages/[locale]/funding/fail.tsx',
  'pages/[locale]/booking/manage/[orderNo].tsx',
  'pages/[locale]/booking/success.tsx',
  'pages/[locale]/booking/fail.tsx',
];

describe('private 페이지의 이탈 링크는 문서 이동이어야 한다', () => {
  it.each(PRIVATE_PAGES)('%s 는 next/link를 쓰지 않는다', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf-8');
    expect(source).not.toContain("from 'next/link'");
    expect(source).not.toContain('<Link');
  });

  it.each(PRIVATE_PAGES)('%s 에는 이탈용 <a href>가 남아 있다', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf-8');
    expect(source).toMatch(/<a[\s\n]+href=/);
  });
});
