import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../../components/admin/AdminShell';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { listShopProductsForAdmin, type AdminShopProductSummary } from '../../../../lib/shop/adminProducts';
import { SHOP_STATUS_LABELS, type ShopReviewStatus } from '../../../../lib/shop/productRules';
import { buttonVariants } from '../../../../components/ui/Button';
import { Notice } from '../../../../components/ui/Notice';
import { formatAdminDateTimeFromSeconds } from '../../../../lib/admin/displayDate';

interface Props {
  products: AdminShopProductSummary[];
  error?: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  try {
    return { props: { products: await listShopProductsForAdmin() } };
  } catch (error: unknown) {
    console.error('[admin/shop/products] 조회 실패:', error);
    return { props: { products: [], error: '상품을 불러오지 못했습니다. 운영 DB에 마이그레이션 0053이 적용됐는지 확인해 주세요.' } };
  }
};

const BADGE: Record<ShopReviewStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-amber-100 text-amber-800',
  changes_requested: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const kst = (sec: number) => formatAdminDateTimeFromSeconds(sec);

export default function AdminShopProductsPage({ products, error }: Props) {
  return (
    <>
      <Head>
        <title>상품 심사 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AdminShell title="상품 심사" description="아티스트가 올린 상품을 검토하고 승인·보완 요청·반려합니다. 제출된 것이 위에 옵니다." backHref="/admin/shop" backLabel="상점" width="wide" actions={(
        <Link href="/admin/shop/products/new" className={buttonVariants({ variant: 'solid', size: 'sm', light: true })}>상품 등록</Link>
      )}>
        {error && <Notice tone="error" light className="mb-4">{error}</Notice>}
        <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
          {products.length === 0 ? (
            <p className="text-gray-600">올라온 상품이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table w-full text-left">
                <thead className="text-xs text-gray-500">
                  <tr><th className="py-2 pr-3">상품</th><th className="py-2 pr-3">아티스트</th><th className="py-2 pr-3">상태</th><th className="py-2 pr-3">제출</th><th className="py-2">확인할 것</th></tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 align-top">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/shop/products/${p.id}`} className="font-medium text-primary hover:underline">{p.title || '제목 없음'}</Link>
                        <span className="block text-xs text-gray-500">{p.slug.startsWith('draft-') ? '주소 미정' : p.slug}{p.reviewStatus === 'approved' && !p.published ? ' · 비공개' : ''}</span>
                      </td>
                      <td data-label="아티스트" className="py-2 pr-3">{p.creatorName}</td>
                      <td data-label="상태" className="py-2 pr-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[p.reviewStatus]}`}>{SHOP_STATUS_LABELS[p.reviewStatus]}</span></td>
                      <td data-label="제출" className="py-2 pr-3 whitespace-nowrap">{p.submittedAt ? kst(p.submittedAt) : '—'}</td>
                      <td data-label="확인할 것" className="py-2 text-xs">
                        {p.shadowedByFileSlug && <span className="block text-red-700">사이트 상품이 같은 주소(slug)를 쓰고 있어 이 상품은 열리지 않습니다.</span>}
                        {p.reviewStatus === 'approved' && p.unlockedSkuCount > 0 && <span className="block text-amber-800">승인 대기 옵션 {p.unlockedSkuCount}개</span>}
                        {p.reviewStatus === 'approved' && p.creatorEditedAt && <span className="block text-gray-600">승인 뒤 수정 {kst(p.creatorEditedAt)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AdminShell>
    </>
  );
}
