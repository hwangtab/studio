import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * 결제 결과·후원 확인 화면은 내비게이션을 걷어낸 자리다(Layout의 isBareLayout). 그런데 그
 * 결과가 '흰 바탕에 카드 하나'라, 결제를 막 마친 사람에게 **결제대행사 페이지처럼 보여**
 * 그대로 닫고 나가게 된다 — 걷어내려던 이탈을 오히려 부른다. 내비게이션은 계속 두지 않고
 * 브랜드만 되돌렸고, 그 범위를 여기서 고정한다.
 */

let pathname = '/[locale]/contact';
jest.mock('next/router', () => ({ useRouter: () => ({ pathname }) }));
jest.mock('next/dynamic', () => () => function Noop() { return null; });
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: jest.fn() },
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('./layout/Header', () => ({
  Header: React.forwardRef<HTMLElement>(function MockHeader(_p, ref) {
    return <header ref={ref}>Header</header>;
  }),
}));
jest.mock('./layout/Footer', () => ({ Footer: () => <footer>Footer</footer> }));

// eslint-disable-next-line import/first
import Layout from './Layout';

const at = (p: string) => {
  pathname = p;
  return render(<Layout locale="ko">본문</Layout>);
};
const brandBar = (c: HTMLElement) => c.querySelector('a[href="/ko"][rel="noreferrer"]');

describe('결제 화면의 브랜드 바', () => {
  afterEach(() => { document.documentElement.className = ''; });

  it.each([
    ['/[locale]/funding/success'],
    ['/[locale]/funding/fail'],
    ['/[locale]/funding/manage/[orderNo]'],
    ['/[locale]/booking/success'],
  ])('%s 에는 브랜드 바가 뜬다', (p) => {
    const { container } = at(p);
    expect(brandBar(container)).not.toBeNull();
    // 사이트 헤더는 여전히 두르지 않는다 — 내비게이션을 되살린 것이 아니다.
    expect(container.querySelector('header')).toBeNull();
  });

  it('평범한 페이지에는 브랜드 바가 아니라 사이트 헤더가 뜬다', () => {
    const { container } = at('/[locale]/contact');
    expect(brandBar(container)).toBeNull();
    expect(container.querySelector('header')).not.toBeNull();
  });

  it('브랜드 링크는 평범한 a다 — 토큰이 실린 URL에서 클라이언트 전환을 하면 안 된다', () => {
    const src = fs.readFileSync(path.join(__dirname, 'layout/PaymentBrandBar.tsx'), 'utf8');
    expect(src).not.toContain("from 'next/link'");
    expect(src).toContain('rel="noreferrer"');
  });
});
