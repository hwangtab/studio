import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import BookingWizard from '../../../components/booking/BookingWizard';
import MixingOrderWizard from '../../../components/booking/MixingOrderWizard';
import { getMixingProduct } from '../../../lib/booking/mixing-products';
import { productsForService, type SessionProduct } from '../../../lib/booking/products';

type BookingPageProps =
  | { service: string; kind: 'session'; products: SessionProduct[] }
  | { service: string; kind: 'mixing'; initialProductId?: string };

export default function BookingPage(props: BookingPageProps) {
  if (props.kind === 'mixing') {
    return (
      <>
        <Head>
          <title>온라인 주문 — 믹싱·마스터링 | 스튜디오 놀</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <MixingOrderWizard initialProductId={props.initialProductId} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`온라인 예약 — ${props.products[0].nameKo.split(' ')[0]} | 스튜디오 놀`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <BookingWizard service={props.service} products={props.products} />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<BookingPageProps> = async ({ params, query }) => {
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  const service = typeof params?.service === 'string' ? params.service : '';

  // 믹싱·마스터링은 슬롯이 없는 주문형 결제라 productsForService(SESSION_PRODUCTS 대상)가
  // 빈 배열을 돌려준다 — 세션 상품 없음(notFound)으로 처리되기 전에 먼저 분기해야 한다.
  if (service === 'mixing-mastering') {
    const productParam = typeof query?.product === 'string' ? query.product : undefined;
    const initialProductId = productParam && getMixingProduct(productParam) ? productParam : undefined;
    return { props: { service, kind: 'mixing', ...(initialProductId ? { initialProductId } : {}) } };
  }

  const products = productsForService(service);
  if (products.length === 0) return { notFound: true };
  return { props: { service, kind: 'session', products } };
};
