/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PRIVATE_PAGE_ROUTES, isPrivateAnalyticsPath } from '../../lib/analytics/privatePaths';

/**
 * private 페이지(URL에 관리 토큰·paymentKey·주문번호가 실린다)의 이탈 링크 규칙 두 가지를
 * 소스에서 단언한다. next/link도 DOM에는 `<a>`를 렌더하므로 렌더 결과로는 구분할 수 없고,
 * "왜 이렇게 써야 하는지"를 잊고 되돌리는 것을 막으려면 소스를 봐야 한다.
 *
 * 1. **문서 이동(`<a href>`)** — 측정 스크립트 mount 게이팅은 `router.asPath` 기준이라,
 *    next/link 클라 전환으로 공개 페이지에 나갔다 뒤로가기를 누르면 그 사이 mount된 gtag가
 *    살아 있는 채로 비밀값이 붙은 URL에 돌아와 page_view를 보낸다.
 * 2. **공개 목적지에는 `rel="noreferrer"`** — 사이트 Referrer-Policy가
 *    `strict-origin-when-cross-origin`인데 이 정책은 **동일 출처 이동에 전체 URL**을 보낸다.
 *    없으면 도착지에서 gtag가 `page_referrer`에 토큰·paymentKey를 그대로 실어 보낸다.
 *    private → private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 붙이지 않는다.
 */
const PRIVATE_PAGE_FILES = [
  'pages/[locale]/funding/manage/[orderNo].tsx',
  'pages/[locale]/funding/deposit/[orderNo].tsx',
  'pages/[locale]/funding/success.tsx',
  'pages/[locale]/funding/fail.tsx',
  'pages/[locale]/booking/manage/[orderNo].tsx',
  'pages/[locale]/booking/success.tsx',
  'pages/[locale]/booking/fail.tsx',
];

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf-8');

/**
 * `<a ...>` 여는 태그만 뽑는다(속성이 여러 줄에 걸쳐 있어도 된다).
 * `href=` 뒤에 실제 값(`"` 또는 `{`)이 오는 것만 센다 — 이 파일들의 설명 주석이
 * 규칙을 인용하느라 `<a href>`라는 문자열을 품고 있어서, 그걸 앵커로 세면 안 된다.
 */
const openingAnchorTags = (source: string): string[] => source.match(/<a[\s\n][^>]*href=["{][^>]*>/g) ?? [];

/** rel="noreferrer"가 필요 없는 앵커: private 목적지, 그리고 자기 rel을 갖는 외부 링크. */
const needsNoReferrer = (tag: string) =>
  !/href=\{(p\.)?(manageUrl|depositUrl)\}/.test(tag) && !/href=\{kakaoUrl\}/.test(tag);

describe('private 페이지의 이탈 링크', () => {
  it.each(PRIVATE_PAGE_FILES)('%s 는 next/link를 쓰지 않는다', (file) => {
    const source = read(file);
    expect(source).not.toContain("from 'next/link'");
    expect(source).not.toContain('<Link');
  });

  it.each(PRIVATE_PAGE_FILES)('%s 에는 이탈용 <a href>가 남아 있다', (file) => {
    expect(openingAnchorTags(read(file)).length).toBeGreaterThan(0);
  });

  it.each(PRIVATE_PAGE_FILES)('%s 의 공개 목적지 앵커에는 rel="noreferrer"가 붙어 있다', (file) => {
    const publicAnchors = openingAnchorTags(read(file)).filter(needsNoReferrer);
    expect(publicAnchors.length).toBeGreaterThan(0);
    for (const tag of publicAnchors) expect(tag).toContain('rel="noreferrer"');
  });

  /**
   * `Layout`이 껍데기를 벗기는 라우트 목록과 측정 제외 판정이 같은 집합을 가리키는지 본다.
   * 한쪽만 늘어나면 헤더 로고·푸터(전부 next/link)로 위 1번 유출이 그대로 재현된다.
   */
  it('Layout이 bare로 두는 라우트는 전부 측정 제외 경로다', () => {
    for (const route of PRIVATE_PAGE_ROUTES) {
      const asPath = route.replace('[locale]', 'ko').replace('[orderNo]', 'FND-20261015-ABCD1234');
      expect(isPrivateAnalyticsPath(asPath)).toBe(true);
    }
  });

  it('bare 라우트 목록과 위 페이지 파일 목록이 같은 페이지를 가리킨다', () => {
    const fromFiles = PRIVATE_PAGE_FILES.map((f) => `/${f.replace(/^pages\//, '').replace(/\.tsx$/, '')}`);
    expect([...PRIVATE_PAGE_ROUTES].sort()).toEqual(fromFiles.sort());
  });
});
