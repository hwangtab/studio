import Link from 'next/link';

import SEO from '../../../components/SEO';
import ImageHero, { HERO_SCRIM_STRONG } from '../../../components/common/ImageHero';
import ShopProductCard from '../../../components/shop/ShopProductCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Section } from '../../../components/ui/Section';
import { SHOP_CATEGORY_LABELS, type ShopCategory, type ShopProduct } from '../../../data/shop/catalog';
import { SHOP_SALES_OPEN } from '../../../data/shop/policy';
import { withI18nServerProps } from '../../../lib/getStatic';
import { listPublishedShopProducts } from '../../../lib/shop/repository';
import { getRemainingStock } from '../../../lib/shop/service';
import { SHOW_HERO_IMAGE } from '../../../lib/shows/copy';

interface Props {
  products: ShopProduct[];
  category: ShopCategory | null;
  /** 상품 slug → 전 SKU 품절 여부. 조회 실패면 빈 객체(배지를 품절로 띄우지 않는다). */
  soldOut: Record<string, boolean>;
  indexable: boolean;
}

const CATEGORIES: ShopCategory[] = ['album', 'goods'];

/** 1장이면 한 칸, 2장이면 두 칸까지만 벌린다(공연·펀딩 목록과 같다). */
const gridColumns = (count: number): string =>
  count <= 1 ? 'max-w-sm' : count === 2 ? 'max-w-3xl md:grid-cols-2' : 'max-w-6xl md:grid-cols-2 lg:grid-cols-3';

const filterLinkClass = (active: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium ${active
    ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
    : 'border-gray-300 text-gray-700 hover:border-gray-500 dark:border-gray-600 dark:text-gray-200'}`;

export default function ShopIndexPage({ products, category, soldOut, indexable }: Props) {
  const shown = category ? products.filter((p) => p.category === category) : products;
  return (
    <>
      <SEO
        title="음반·굿즈 | 스튜디오 놀"
        description="스튜디오 놀과 아티스트들의 음반·굿즈·디지털 음원을 사이트에서 바로 주문해요. 카드·간편결제·계좌이체로 결제하고, 실물은 택배로 받고 디지털 상품은 바로 내려받아요."
        canonical="/ko/shop"
        availableLocales={['ko']}
        robots={indexable ? undefined : 'noindex, follow'}
        breadcrumbs={[
          { name: '홈', path: '/ko' },
          { name: '음반·굿즈', path: '/ko/shop' },
        ]}
      />
      <ImageHero
        locale="ko"
        priority
        backgroundImage={products[0]?.images[0] ?? SHOW_HERO_IMAGE}
        overlayGradient={HERO_SCRIM_STRONG}
        imageAlt=""
        title="음반·굿즈"
        subtitle="스튜디오 놀과 아티스트들의 음반·굿즈예요. 실물은 택배로 받고, 디지털 상품은 바로 내려받아요."
      />
      <Section>
        {products.length > 0 && (
          <nav aria-label="분류" className="mx-auto mb-8 flex max-w-6xl flex-wrap justify-center gap-2">
            <Link href="/ko/shop" className={filterLinkClass(category === null)} aria-current={category === null ? 'page' : undefined}>전체</Link>
            {CATEGORIES.map((c) => (
              <Link key={c} href={`/ko/shop?category=${c}`} className={filterLinkClass(category === c)} aria-current={category === c ? 'page' : undefined}>
                {SHOP_CATEGORY_LABELS[c]}
              </Link>
            ))}
          </nav>
        )}
        {shown.length === 0 ? (
          <EmptyState
            className="mx-auto max-w-xl"
            titleAs="h2"
            title={products.length === 0 ? '준비 중이에요' : '이 분류의 상품이 아직 없어요'}
            description={products.length === 0 ? '음반과 굿즈를 곧 올릴게요.' : undefined}
          />
        ) : (
          <div className={`mx-auto grid items-stretch gap-6 ${gridColumns(shown.length)}`}>
            {shown.map((p) => <ShopProductCard key={p.slug} product={p} soldOut={soldOut[p.slug] === true} />)}
          </div>
        )}
      </Section>
    </>
  );
}

ShopIndexPage.hasHero = true;

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, query, res }) => {
  // 상점은 ko 전용이다(국내 배송만). 다른 로케일은 ko로 보낸다.
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/shop', permanent: false } };
  const products = await listPublishedShopProducts();
  const category = query.category === 'album' || query.category === 'goods' ? query.category : null;

  let soldOut: Record<string, boolean> = {};
  try {
    const remaining = await getRemainingStock(products.flatMap((p) => p.skus.filter((s) => !s.retired).map((s) => s.id)), new Date());
    soldOut = Object.fromEntries(products.map((p) => [p.slug, p.skus.filter((s) => !s.retired).every((s) => (remaining[s.id] ?? 0) <= 0)]));
  } catch (error) {
    // 재고 조회 실패(마이그레이션 0052 전 포함)에 500을 내지 않는다 — 배지 없이 목록만 보인다.
    console.error('[shop] 목록 재고 조회 실패', error);
  }
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  // 팔고 있을 때만 색인한다 — 준비 중인 빈 페이지가 검색에 잡히지 않게.
  return { props: { products, category, soldOut, indexable: SHOP_SALES_OPEN && products.length > 0 } };
});

// 디자인 판 — lib/designEdition.ts
ShopIndexPage.designEdition = 'v2';
