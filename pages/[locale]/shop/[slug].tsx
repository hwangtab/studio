import SEO from '../../../components/SEO';
import ShopOrderForm, { type RemainingStock } from '../../../components/shop/ShopOrderForm';
import ShopProductDetail from '../../../components/shop/ShopProductDetail';
import { Section } from '../../../components/ui/Section';
import type { ShopProduct } from '../../../data/shop/catalog';
import { SHOP_SALES_OPEN } from '../../../data/shop/policy';
import { withI18nServerProps } from '../../../lib/getStatic';
import { fitsDisplayFont } from '../../../lib/fonts/displayCoverage';
import { findShopArtistOfDbProduct, resolveShopArtist } from '../../../lib/shop/artists';
import { findShopProductAsync, listPublishedShopProducts } from '../../../lib/shop/repository';
import { getRemainingStock } from '../../../lib/shop/service';
import { canShareOrder } from '../../../lib/shop/shipper';
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

const summarize = (text: string | undefined): string => {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > 150 ? `${flat.slice(0, 147)}…` : flat;
};

/** 검색 요약·공유 카드 설명 — 첫 문단. DB 상품은 소개가 비어 들어올 수 있어(옛 저장분) 부제·제목으로 대신한다. */
const summaryOf = (product: ShopProduct): string =>
  summarize(product.description[0]) || summarize(product.subtitle) || `${product.title} — 스튜디오 놀 음반·굿즈`;

export default function ShopProductPage({ product, others, remaining, salesOpen, artist, titleFallbackFont }: Props) {
  const path = `/ko/shop/${product.slug}`;
  const sellable = product.skus.filter((s) => !s.retired);
  const cover = product.images[0];
  const coverSize = cover ? (imageMetadata as Record<string, { width: number; height: number } | undefined>)[cover] : undefined;

  // 상품 구조화 데이터 — SKU마다 Offer. 재고를 모르면(조회 실패) availability를 싣지 않는다.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: summaryOf(product),
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
        description={summaryOf(product)}
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
        <ShopProductDetail product={product} remaining={remaining} artist={artist} titleFallbackFont={titleFallbackFont}>
          <ShopOrderForm product={product} others={others} remaining={remaining} salesOpen={salesOpen} />
        </ShopProductDetail>
      </Section>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  if (params?.locale !== 'ko') return { redirect: { destination: `/ko/shop${/^[a-z0-9-]+$/.test(slug) ? `/${slug}` : ''}`, permanent: false } };
  const product = await findShopProductAsync(slug);
  if (!product) return { notFound: true };
  // 함께 담을 수 있는 상품만 — 한 주문은 한 발송 주체만 담는다(아티스트가 직접 보내는 상품은 같은 아티스트끼리만).
  const others = (await listPublishedShopProducts()).filter((p) => p.slug !== product.slug && canShareOrder(product, p));

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
