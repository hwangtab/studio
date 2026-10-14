import Head from 'next/head';

import { ProductForm } from '../../../../../components/shop/creator/ProductForm';
import { PageHeader, PageShell } from '../../../../../components/ui/PageHeader';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { fitsDisplayFont } from '../../../../../lib/fonts/displayCoverage';
import { withI18nServerProps } from '../../../../../lib/getStatic';
import { loadProductForCreator, type CreatorProductDetail } from '../../../../../lib/shop/creatorProductWrite';

interface Props {
  product: CreatorProductDetail;
  titleFallbackFont: boolean;
}

export default function CreatorShopProductPage({ product, titleFallbackFont }: Props) {
  return (
    <>
      <Head>
        <title>상품 편집 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageShell width="wide">
        <PageHeader
          title={product.title || '새 상품'}
          titleFallbackFont={titleFallbackFont}
          backHref="/ko/funding/creator/shop"
          backLabel="내 상점"
        />
        <ProductForm initial={product} />
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  // 개설자 콘솔은 ko 전용 — 세션 쿠키가 path=/라 로케일을 안 가려서 막지 않으면 같은 화면이 7개 URL로 존재한다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: `/ko/funding/creator/shop${/^[a-z0-9]+$/.test(id) ? `/${id}` : ''}`, permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };

  let product: CreatorProductDetail | null = null;
  try {
    product = await loadProductForCreator(auth.creatorId, id);
  } catch (error: unknown) {
    console.error('[funding] 개설자 상품 조회 실패:', error);
    return { redirect: { destination: '/ko/funding/creator/shop', permanent: false } };
  }
  // 남의 상품이면 '없다'다 — 존재 여부를 알려 주지 않는다.
  if (!product) return { notFound: true };
  return { props: { product, titleFallbackFont: product.title !== '' && !fitsDisplayFont(product.title) } };
});

// 디자인 판 — lib/designEdition.ts
CreatorShopProductPage.designEdition = 'v2';
