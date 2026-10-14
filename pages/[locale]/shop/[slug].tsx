import Link from 'next/link';
import { useState } from 'react';

import SEO from '../../../components/SEO';
import ResponsiveImage from '../../../components/ResponsiveImage';
import ShopOrderForm, { type RemainingStock } from '../../../components/shop/ShopOrderForm';
import { Section } from '../../../components/ui/Section';
import StatusBadge from '../../../components/ui/StatusBadge';
import { formatPriceAmount } from '../../../data/pricing';
import { SHOP_CATEGORY_LABELS, type ShopProduct } from '../../../data/shop/catalog';
import { SHOP_SALES_OPEN } from '../../../data/shop/policy';
import { withI18nServerProps } from '../../../lib/getStatic';
import { fitsDisplayFont } from '../../../lib/fonts/displayCoverage';
import { findShopArtistOfDbProduct, resolveShopArtist } from '../../../lib/shop/artists';
import { findShopProductAsync, listPublishedShopProducts } from '../../../lib/shop/repository';
import { getRemainingStock } from '../../../lib/shop/service';
import imageMetadata from '../../../utils/imageMetadata.json';

interface Props {
  product: ShopProduct;
  others: ShopProduct[];
  remaining: RemainingStock;
  salesOpen: boolean;
  /** 위탁 아티스트(상품의 artist). 이름·주소만 싣는다 — 세금 유형 등은 __NEXT_DATA__에 실리면 안 된다. */
  artist: { slug: string; name: string } | null;
  /** DB 상품 제목이 제목 서체 서브셋 밖 글자를 품으면 true — h1을 본문 서체로 그린다(글자만 섞이는 것보다 낫다). */
  titleFallbackFont: boolean;
}

const SITE_URL = 'https://studionol.co.kr';

const summarize = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 150 ? `${flat.slice(0, 147)}…` : flat;
};

export default function ShopProductPage({ product, others, remaining, salesOpen, artist, titleFallbackFont }: Props) {
  const path = `/ko/shop/${product.slug}`;
  const [active, setActive] = useState(0);
  const sellable = product.skus.filter((s) => !s.retired);
  const prices = sellable.map((s) => s.price);
  const low = Math.min(...prices);
  const cover = product.images[0];
  const coverSize = cover ? (imageMetadata as Record<string, { width: number; height: number } | undefined>)[cover] : undefined;

  // 상품 구조화 데이터 — SKU마다 Offer. 재고를 모르면(조회 실패) availability를 싣지 않는다.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: summarize(product.description[0]),
    image: product.images.map((i) => `${SITE_URL}${i}`),
    brand: { '@type': 'Brand', name: artist?.name ?? '스튜디오 놀' },
    offers: sellable.map((s) => ({
      '@type': 'Offer',
      ...(s.optionLabel ? { name: s.optionLabel } : {}),
      sku: s.id,
      price: s.price,
      priceCurrency: 'KRW',
      url: `${SITE_URL}${path}`,
      ...(remaining
        ? { availability: salesOpen && (remaining[s.id] ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }
        : {}),
    })),
  };

  return (
    <>
      <SEO
        title={`${product.title} | 음반·굿즈 | 스튜디오 놀`}
        description={summarize(product.description[0])}
        canonical={path}
        ogImage={cover}
        ogImageWidth={coverSize?.width}
        ogImageHeight={coverSize?.height}
        availableLocales={['ko']}
        robots={salesOpen ? undefined : 'noindex, follow'}
        includeSchema
        schema={schema}
        breadcrumbs={[
          { name: '홈', path: '/ko' },
          { name: '음반·굿즈', path: '/ko/shop' },
          { name: product.title, path },
        ]}
      />
      <Section>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            {product.images[active] && (
              <ResponsiveImage
                src={product.images[active]}
                alt={`${product.title} 사진 ${active + 1}`}
                containerClassName="relative block aspect-square w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800"
                className="object-contain"
                priority={active === 0}
              />
            )}
            {product.images.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="사진 고르기">
                {product.images.map((img, i) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={i === active}
                    aria-label={`사진 ${i + 1}`}
                    className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === active ? 'border-primary' : 'border-transparent'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70`}
                  >
                    <ResponsiveImage src={img} alt="" containerClassName="relative block h-full w-full" className="object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="typo-card-meta">
              <Link href={`/ko/shop?category=${product.category}`} className="underline">{SHOP_CATEGORY_LABELS[product.category]}</Link>
            </p>
            <h1 className={`typo-page-title mt-2 text-gray-900 dark:text-white${titleFallbackFont ? ' font-sans' : ''}`}>{product.title}</h1>
            {product.subtitle && <p className="typo-card-body mt-2">{product.subtitle}</p>}
            {artist && (
              <p className="typo-card-meta mt-2">
                <Link href={`/ko/shop/artist/${artist.slug}`} className="underline">{artist.name}의 다른 음반·굿즈</Link>
              </p>
            )}
            <p className="mt-4 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {formatPriceAmount(low)}원{new Set(prices).size > 1 ? '~' : ''}
            </p>
            {remaining && sellable.every((s) => (remaining[s.id] ?? 0) <= 0) && (
              <StatusBadge tone="neutral" className="mt-2">품절</StatusBadge>
            )}
            <div className="mt-6 space-y-4">
              {product.description.map((para, i) => (
                <p key={i} className="typo-card-body whitespace-pre-line">{para}</p>
              ))}
            </div>
            <div className="mt-8">
              <ShopOrderForm product={product} others={others} remaining={remaining} salesOpen={salesOpen} />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  if (params?.locale !== 'ko') return { redirect: { destination: `/ko/shop${/^[a-z0-9-]+$/.test(slug) ? `/${slug}` : ''}`, permanent: false } };
  const product = await findShopProductAsync(slug);
  if (!product) return { notFound: true };
  const others = (await listPublishedShopProducts()).filter((p) => p.slug !== product.slug);

  let remaining: RemainingStock = null;
  try {
    remaining = await getRemainingStock([product, ...others].flatMap((p) => p.skus.filter((s) => !s.retired).map((s) => s.id)), new Date());
  } catch (error) {
    console.error('[shop] 상세 재고 조회 실패', { slug, error });
  }
  // 남은 수량이 낡아도 되는 만큼만 CDN에 둔다 — 화면이 마운트 뒤 다시 읽고, 주문 생성이 최종 게이트다.
  res.setHeader('Cache-Control', remaining ? 'public, s-maxage=30, stale-while-revalidate=60' : 'no-store');
  // 파일 상품은 product.artist(data/artists slug), DB 상품은 올린 아티스트의 shop_artists slug로 /ko/shop/artist/<slug>에 잇는다.
  let artist: { slug: string; name: string } | null = null;
  try {
    if (product.artist) {
      const resolved = await resolveShopArtist(product.artist);
      artist = resolved ? { slug: resolved.slug, name: resolved.name } : null;
    } else if (product.source === 'db') {
      artist = await findShopArtistOfDbProduct(product.slug);
    }
  } catch (error) {
    console.error('[shop] 상세 아티스트 조회 실패', { slug, error });
  }
  return { props: { product, others, remaining, salesOpen: SHOP_SALES_OPEN, artist, titleFallbackFont: product.source === 'db' && !fitsDisplayFont(product.title) } };
});

// 디자인 판 — lib/designEdition.ts
ShopProductPage.designEdition = 'v2';
