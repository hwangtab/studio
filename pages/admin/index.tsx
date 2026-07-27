import type { GetServerSideProps } from 'next';

/** /admin은 계약 관리로 보낸다. 인증 여부는 이동한 페이지에서 판정한다. */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/admin/contracts', permanent: false },
});

export default function AdminIndexPage() {
  return null;
}
