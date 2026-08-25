import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { logoutAdmin } from '../../components/admin/contractActions';
import { Button } from '../../components/ui/Button';
import { authenticateAdminRequest } from '../../lib/contracts/admin-auth';

/** /admin은 이제 계약·예약 두 영역으로 갈라져 무조건 리다이렉트하지 않고 탭 링크를 보여준다. */
export const getServerSideProps: GetServerSideProps = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }
  return { props: {} };
};

export default function AdminIndexPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutAdmin();
    await router.replace('/admin/login');
  };

  return (
    <>
      <Head>
        <title>관리자 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">관리자</h1>
          <div className="flex flex-col gap-3">
            <Link href="/admin/contracts" passHref>
              <Button fullWidth size="lg">
                계약 관리
              </Button>
            </Link>
            <Link href="/admin/bookings" passHref>
              <Button fullWidth size="lg" variant="secondary">
                예약 관리
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
