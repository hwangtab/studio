import Link from 'next/link';

import SEO from '../../../../components/SEO';
import ShopProductCard from '../../../../components/shop/ShopProductCard';
import { PageHeader, PageShell } from '../../../../components/ui/PageHeader';
import type { ShopProduct } from '../../../../data/shop/catalog';
import { SHOP_SALES_OPEN } from '../../../../data/shop/policy';
import { fitsDisplayFont } from '../../../../lib/fonts/displayCoverage';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { SHOP_SLUG_PATTERN } from '../../../../lib/shop/catalog';
import { resolveShopArtist } from '../../../../lib/shop/artists';
import { listShopProductsByArtist } from '../../../../lib/shop/repository';
import { getRemainingStock } from '../../../../lib/shop/service';

interface Props {
  /** 공개해도 되는 값만 — 계정 id·이메일·연락처·세금 유형은 싣지 않는다. */
  artist: { slug: string; name: string; bio: string | null; links: string[]; profileImage: string | null; curatedSlug: string | null };
  products: ShopProduct[];
  soldOut: Record<string, boolean>;
  salesOpen: boolean;
  titleFallbackFont: boolean;
}

const gridColumns = (count: number): string => (count <= 1 ? 'max-w-sm' : 'sm:grid-cols-2');

const linkLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function ShopArtistPage({ artist, products, soldOut, salesOpen, titleFallbackFont }: Props) {
  const path = `/ko/shop/artist/${artist.slug}`;
  return (
    <>
      <SEO
        title={`${artist.name} | 음반·굿즈 | 스튜디오 놀`}
        description={`${artist.name}의 음반과 굿즈를 스튜디오 놀에서 주문해요.`}
        canonical={path}
        availableLocales={['ko']}
        robots={salesOpen ? undefined : 'noindex, follow'}
        breadcrumbs={[
          { name: '홈', path: '/ko' },
          { name: '음반·굿즈', path: '/ko/shop' },
          { name: artist.name, path },
        ]}
      />
      <PageShell width="wide">
        <PageHeader backHref="/ko/shop" backLabel="음반·굿즈" title={artist.name} titleFallbackFont={titleFallbackFont} />
        {(artist.profileImage || artist.bio || artist.links.length > 0) && (
          <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start">
            {artist.profileImage && (
              // 프로필 사진은 업로드 프록시 주소라 next/image 최적화 경로를 탈 이유가 없다.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.profileImage} alt="" width={112} height={112} className="h-28 w-28 shrink-0 rounded-full object-cover" />
            )}
            <div className="min-w-0">
              {artist.bio && <p className="typo-card-body whitespace-pre-line">{artist.bio}</p>}
              {artist.links.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {artist.links.map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noopener noreferrer" className="typo-card-meta underline underline-offset-2">{linkLabel(l)}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <div className={`grid items-stretch gap-6 ${gridColumns(products.length)}`}>
          {products.map((p) => <ShopProductCard key={p.slug} product={p} soldOut={soldOut[p.slug] === true} />)}
        </div>
        <p className="typo-card-meta mt-10">
          판매: 스튜디오 놀
          {artist.curatedSlug && (
            <>
              {' · '}
              <Link href={`/ko/artists/${artist.curatedSlug}`} className="underline underline-offset-2">아티스트 소개</Link>
            </>
          )}
        </p>
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  // 상점은 ko 전용이다(국내 배송만). 다른 로케일은 ko 주소로 보낸다.
  if (params?.locale !== 'ko') {
    return { redirect: { destination: SHOP_SLUG_PATTERN.test(slug) ? `/ko/shop/artist/${slug}` : '/ko/shop', permanent: false } };
  }
  const resolved = await resolveShopArtist(slug);
  if (!resolved) return { notFound: true };
  const products = await listShopProductsByArtist(resolved.slug);
  if (products.length === 0) return { notFound: true };

  let soldOut: Record<string, boolean> = {};
  try {
    const remaining = await getRemainingStock(products.flatMap((p) => p.skus.filter((s) => !s.retired).map((s) => s.id)), new Date());
    soldOut = Object.fromEntries(products.map((p) => [p.slug, p.skus.filter((s) => !s.retired).every((s) => (remaining[s.id] ?? 0) <= 0)]));
  } catch (error) {
    console.error('[shop] 아티스트 상점 재고 조회 실패', { slug, error });
  }
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  // creatorId는 서버 전용이라 props에 옮기지 않는다.
  const { slug: artistSlug, name, bio, links, profileImage, curatedSlug } = resolved;
  return {
    props: {
      artist: { slug: artistSlug, name, bio, links, profileImage, curatedSlug },
      products, soldOut, salesOpen: SHOP_SALES_OPEN, titleFallbackFont: !fitsDisplayFont(name),
    },
  };
});

// 디자인 판 — lib/designEdition.ts
ShopArtistPage.designEdition = 'v2';
