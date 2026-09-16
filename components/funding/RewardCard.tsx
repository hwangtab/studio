import Link from 'next/link';
import type { MouseEvent } from 'react';
import BaseCard from '../ui/BaseCard';
import ResponsiveImage from '../ResponsiveImage';
import { formatPriceAmount } from '../../data/pricing';
import { imageAspectRatio } from '../../lib/funding/imageAspect';
import type { FundingReward } from '../../lib/funding/projects';

interface Props {
  reward: FundingReward;
  remaining: number | null;
  pledgeHref: string;
  canPledge: boolean;
  /**
   * 있으면 카드 클릭을 가로채 모달을 연다. 없으면(=JS가 꺼졌거나 아직 안 붙었으면) 카드는
   * 평범한 링크로 동작해 후원 페이지로 간다 — 그래서 모달이 있어도 `pledgeHref`는 **진짜
   * 주소**로 남겨 둔다. 새 탭으로 열기와 주소 복사도 그대로 된다.
   */
  onSelect?: (reward: FundingReward) => void;
}

export default function RewardCard({ reward, remaining, pledgeHref, canPledge, onSelect }: Props) {
  const soldOut = remaining !== null && remaining <= 0;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onSelect) return;
    // 새 탭·새 창 의도(수식 키)는 브라우저에 그대로 넘긴다.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(reward);
  };

  const body = (
    <>
      {/* 그림의 실제 비율을 그대로 쓴다 — 정사각 앨범 표지를 16:9로 자르면 위아래가 잘려
          무엇인지 알 수 없게 된다. 비율을 모르면 예전대로 16:9로 떨어진다. */}
      {reward.image && (
        <ResponsiveImage
          src={reward.image}
          alt=""
          containerClassName="relative mb-4 block w-full overflow-hidden rounded-lg"
          containerStyle={{ aspectRatio: imageAspectRatio(reward.image) ?? '16 / 9' }}
          className="object-cover"
          loading="lazy"
        />
      )}
      <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
        {formatPriceAmount(reward.amount)}원
      </p>
      <h3 className="typo-card-subtitle mt-1 text-gray-900 dark:text-white">{reward.title}</h3>
      <p className="typo-card-body mt-2 line-clamp-3 flex-1 whitespace-pre-line">{reward.description}</p>
      <p className="typo-card-meta mt-4 border-t border-gray-200/70 pt-3 dark:border-gray-700/70">
        예상 전달 {reward.estimatedDelivery}
        {reward.requiresShipping ? ' · 배송지 입력' : ''}
        {remaining !== null && !soldOut ? ` · ${remaining}개 남음` : ''}
      </p>
    </>
  );

  if (soldOut || !canPledge) {
    return (
      <BaseCard variant="glass" className="flex h-full flex-col p-5">
        {body}
        {soldOut && (
          <span className="mt-4 inline-flex w-fit items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            품절
          </span>
        )}
      </BaseCard>
    );
  }

  return (
    <BaseCard variant="glass" className="group h-full p-0">
      <Link
        href={pledgeHref}
        prefetch={false}
        onClick={handleClick}
        className="flex h-full flex-col rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-lighter/70 dark:focus-visible:ring-offset-gray-900"
      >
        {body}
        <span className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 font-semibold text-white shadow-md transition-colors group-hover:bg-primary-dark">
          이 리워드로 후원하기
        </span>
      </Link>
    </BaseCard>
  );
}
