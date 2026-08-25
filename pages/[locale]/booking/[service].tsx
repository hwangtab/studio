import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import BookingWizard from '../../../components/booking/BookingWizard';
import { productsForService, type SessionProduct } from '../../../lib/booking/products';

interface BookingPageProps { service: string; products: SessionProduct[] }

export default function BookingPage({ service, products }: BookingPageProps) {
  return (
    <>
      <Head>
        <title>{`온라인 예약 — ${products[0].nameKo.split(' ')[0]} | 스튜디오 놀`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <BookingWizard service={service} products={products} />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<BookingPageProps> = async ({ params }) => {
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  const service = typeof params?.service === 'string' ? params.service : '';
  const products = productsForService(service);
  if (products.length === 0) return { notFound: true };
  return { props: { service, products } };
};
