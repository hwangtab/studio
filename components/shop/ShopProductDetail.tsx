import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import ResponsiveImage from '../ResponsiveImage';
import StatusBadge from '../ui/StatusBadge';
import { formatPriceAmount } from '../../data/pricing';
import { SHOP_CATEGORY_LABELS, type ShopProduct } from '../../data/shop/catalog';
import { formatShipsOn, isPreorder } from '../../lib/shop/preorder';
import { cn } from '../../lib/utils';

/**
 * 상품 상세 본문(사진·제목·소개·가격) — 공개 상세(`pages/[locale]/shop/[slug].tsx`)·아티스트 콘솔 미리보기·관리자 심사가 같이 쓴다.
 * 주문 폼은 `children`으로 받는다(미리보기·심사에는 없다). `stack`은 좁은 자리(미리보기 패널)용 한 단 배치다.
 */

export type ShopRemaining = Record<string, number> | null;

interface Props {
  product: ShopProduct;
  /** 남은 수량. 모르면(조회 실패·미리보기) null — 품절 배지를 띄우지 않는다. */
  remaining?: ShopRemaining;
  /** 위탁 아티스트. 이름·주소만. */
  artist?: { slug: string; name: string } | null;
  /** DB 상품 제목이 제목 서체 서브셋 밖 글자를 품으면 true — h1을 본문 서체로 그린다. */
  titleFallbackFont?: boolean;
  layout?: 'split' | 'stack';
  /** 제목 태그. 공개 상세는 h1, 이미 h1이 있는 화면(콘솔 미리보기·관리자)에 끼울 때는 h2. */
  headingAs?: 'h1' | 'h2';
  children?: ReactNode;
}

export default function ShopProductDetail({ product, remaining = null, artist = null, titleFallbackFont = false, layout = 'split', headingAs: Heading = 'h1', children }: Props) {
  const [active, setActive] = useState(0);
  const sellable = product.skus.filter((s) => !s.retired);
  const prices = sellable.map((s) => s.price);
  const low = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <div className={cn('mx-auto grid max-w-6xl gap-10', layout === 'split' && 'lg:grid-cols-2')}>
      <div>
        {product.images[active] && (
          <ResponsiveImage
            src={product.images[active]}
            alt={`${product.title} 사진 ${active + 1}`}
            containerClassName="relative block aspect-square w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800"
            className="object-contain"
            priority={active === 0}
          />
        )}
        {product.images.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="사진 고르기">
            {product.images.map((img, i) => (
              <button
                key={img}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                aria-label={`사진 ${i + 1}`}
                className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === active ? 'border-primary' : 'border-transparent'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70`}
              >
                <ResponsiveImage src={img} alt="" containerClassName="relative block h-full w-full" className="object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="typo-card-meta">
          <Link href={`/ko/shop?category=${product.category}`} className="underline">{SHOP_CATEGORY_LABELS[product.category]}</Link>
        </p>
        <Heading className={`typo-page-title mt-2 text-gray-900 dark:text-white${titleFallbackFont ? ' font-sans' : ''}`}>{product.title}</Heading>
        {product.subtitle && <p className="typo-card-body mt-2">{product.subtitle}</p>}
        {artist && (
          <p className="typo-card-meta mt-2">
            <Link href={`/ko/shop/artist/${artist.slug}`} className="underline">{artist.name}의 다른 음반·굿즈</Link>
          </p>
        )}
        {low !== null && (
          <p className="mt-4 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
            {formatPriceAmount(low)}원{new Set(prices).size > 1 ? '~' : ''}
          </p>
        )}
        {product.shipsOn && isPreorder(product, new Date()) && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <StatusBadge tone="active">예약 판매</StatusBadge>
            <span>{formatShipsOn(product.shipsOn)} 발송 예정</span>
          </p>
        )}
        {product.kind === 'digital' && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <StatusBadge tone="active">디지털 상품</StatusBadge>
            <span>배송 없음 · 결제 뒤 주문 확인 페이지에서 내려받아요</span>
          </p>
        )}
        {product.shippedByArtist && product.kind !== 'digital' && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <StatusBadge tone="neutral">직접 발송</StatusBadge>
            <span>아티스트가 직접 보내요 · 판매와 문의는 스튜디오 놀이 맡아요</span>
          </p>
        )}
        {remaining && sellable.length > 0 && sellable.every((s) => (remaining[s.id] ?? 0) <= 0) && (
          <StatusBadge tone="neutral" className="mt-2">품절</StatusBadge>
        )}
        <div className="mt-6 space-y-4">
          {product.description.map((para, i) => (
            <p key={i} className="typo-card-body whitespace-pre-line">{para}</p>
          ))}
        </div>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}
