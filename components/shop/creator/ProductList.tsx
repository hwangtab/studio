import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

import { Badge, type BadgeTone } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Notice } from '../../ui/Notice';
import { SHOP_STATUS_LABELS, type ShopReviewStatus } from '../../../lib/shop/productRules';
import type { CreatorProductSummary } from '../../../lib/shop/creatorProductWrite';
import { createShopProduct } from './api';

const STATUS_TONE: Record<ShopReviewStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'info',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'error',
};

/** 내 상품 목록 + 새 상품 버튼. 보완 요청·반려 사유(`review_note`)는 아티스트에게 그대로 보인다. */
export function ProductList({ products }: { products: CreatorProductSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const result = await createShopProduct();
    if (result.ok) {
      router.push(`/ko/funding/creator/shop/${result.id}`);
      return;
    }
    setError(result.message);
    setBusy(false);
  };

  return (
    <section aria-labelledby="shop-products-heading" className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="shop-products-heading" className="typo-card-title">내 상품</h2>
        <Button type="button" size="sm" onClick={create} disabled={busy}>{busy ? '만드는 중…' : '새 상품'}</Button>
      </div>
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}
      {products.length === 0 ? (
        <EmptyState title="아직 올린 상품이 없어요." description="새 상품을 만들고 심사를 신청하면 운영자가 확인해요." />
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/ko/funding/creator/shop/${p.id}`} prefetch={false} className="typo-body font-medium text-gray-900 underline-offset-2 hover:underline dark:text-white">
                  {p.title || '제목 없는 상품'}
                </Link>
                <span className="flex items-center gap-2">
                  {p.reviewStatus === 'approved' && !p.published && <Badge tone="neutral">비공개</Badge>}
                  <Badge tone={STATUS_TONE[p.reviewStatus]}>{SHOP_STATUS_LABELS[p.reviewStatus]}</Badge>
                </span>
              </div>
              {p.reviewNote && (p.reviewStatus === 'changes_requested' || p.reviewStatus === 'rejected') && (
                <Notice tone={p.reviewStatus === 'rejected' ? 'error' : 'warning'} title="운영자 메모" className="mt-3">
                  <span className="whitespace-pre-line">{p.reviewNote}</span>
                </Notice>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
