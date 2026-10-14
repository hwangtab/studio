/** @jest-environment node */
/** 상품 상세 — 소개가 빈 DB 상품(옛 저장분)도 500 없이 그려진다. 검색 요약은 부제·제목으로 대신한다. */
import { renderToStaticMarkup } from 'react-dom/server';

import type { ShopProduct } from '../../../data/shop/catalog';

jest.mock('next/router', () => ({ useRouter: () => ({ locale: 'ko', asPath: '/ko/shop/empty', pathname: '/[locale]/shop/[slug]', query: {}, push: jest.fn(), events: { on: jest.fn(), off: jest.fn() } }) }));
jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: unknown }) => <>{children}</> }));

/* eslint-disable import/first */
import ShopProductPage from '../../../pages/[locale]/shop/[slug]';
/* eslint-enable import/first */

const product: ShopProduct = {
  slug: 'empty', category: 'goods', title: '빈 소개 굿즈', description: [], images: [],
  skus: [{ id: 'db-aaaaaaaaaa', price: 10000 }], published: true, source: 'db',
};

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());

it('소개가 비어도 그려지고, 요약은 제목으로 대신한다', () => {
  const html = renderToStaticMarkup(
    <ShopProductPage product={product} others={[]} remaining={null} salesOpen={false} artist={null} titleFallbackFont={false} />,
  );
  expect(html).toContain('빈 소개 굿즈');
  expect(html).toContain('빈 소개 굿즈 — 스튜디오 놀 음반·굿즈');
});
