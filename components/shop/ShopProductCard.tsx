import ResponsiveImage from '../ResponsiveImage';
import BaseCard from '../ui/BaseCard';
import StatusBadge from '../ui/StatusBadge';
import { formatPriceAmount } from '../../data/pricing';
import { SHOP_CATEGORY_LABELS, type ShopProduct } from '../../data/shop/catalog';
import { isPreorder } from '../../lib/shop/preorder';

/**
 * 상점 목록 카드 — 공연 목록 카드(ShowCard)·펀딩 카드와 같은 구조: BaseCard(href) glass > 이미지 + 본문.
 * 카드 자체가 링크라 hover·포커스 링을 카드가 맡는다.
 */
export default function ShopProductCard({ product, soldOut }: { product: ShopProduct; soldOut: boolean }) {
  const prices = product.skus.filter((s) => !s.retired).map((s) => s.price);
  const low = prices.length ? Math.min(...prices) : null;
  const cover = product.images[0];
  const preorder = isPreorder(product, new Date());
  return (
    <BaseCard href={`/ko/shop/${product.slug}`} variant="glass" className="flex h-full flex-col overflow-hidden">
      {cover ? (
        <ResponsiveImage
          src={cover}
          alt=""
          containerClassName="relative block aspect-square w-full overflow-hidden"
          className="object-cover"
          // 상점 목록은 lg 3열(약 370px)이지만 아티스트 상점은 sm부터 2열이라 lg에서 약 600px까지 넓어진다 — 넓은 쪽에 맞춘다.
          sizes="(min-width: 1024px) 600px, (min-width: 640px) 50vw, 100vw"
          loading="lazy"
        />
      ) : (
        <div aria-hidden="true" className="aspect-square w-full bg-gray-100 dark:bg-gray-800" />
      )}
      <div className="flex flex-1 flex-col p-6">
        <StatusBadge tone={soldOut ? 'neutral' : 'active'}>{soldOut ? '품절' : preorder ? '예약 판매' : SHOP_CATEGORY_LABELS[product.category]}</StatusBadge>
        <h2 className="typo-card-title mt-3 text-gray-900 dark:text-white">{product.title}</h2>
        {product.subtitle && <p className="typo-card-meta mt-1">{product.subtitle}</p>}
        {low !== null && (
          <div className="mt-auto border-t border-gray-200/70 pt-3 dark:border-gray-700/70">
            <p className="typo-card-meta">
              <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatPriceAmount(low)}원</span>
              {new Set(prices).size > 1 ? '~' : ''}
            </p>
          </div>
        )}
      </div>
    </BaseCard>
  );
}
