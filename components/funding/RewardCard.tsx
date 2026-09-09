import Link from 'next/link';
import BaseCard from '../ui/BaseCard';
import ResponsiveImage from '../ResponsiveImage';
import { formatPriceAmount } from '../../data/pricing';
import type { FundingReward } from '../../lib/funding/projects';

interface Props {
  reward: FundingReward;
  remaining: number | null;
  pledgeHref: string;
  canPledge: boolean;
}

export default function RewardCard({ reward, remaining, pledgeHref, canPledge }: Props) {
  const soldOut = remaining !== null && remaining <= 0;
  return (
    <BaseCard variant="glass" className="flex h-full flex-col p-6">
      {reward.image && (
        <ResponsiveImage
          src={reward.image}
          alt=""
          containerClassName="relative mb-4 block aspect-[4/3] w-full overflow-hidden rounded-lg"
          className="object-cover"
          loading="lazy"
        />
      )}
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPriceAmount(reward.amount)}원</p>
      <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{reward.title}</h3>
      <p className="mt-2 flex-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{reward.description}</p>
      <ul className="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <li>예상 전달: {reward.estimatedDelivery}</li>
        <li>{reward.requiresShipping ? '배송 리워드 (배송지 입력)' : '배송 없음'}</li>
        {remaining !== null && !soldOut && <li>{remaining}개 남음 / 한정 {reward.totalQuantity}개</li>}
      </ul>
      <div className="mt-5">
        {soldOut ? (
          <span className="inline-block rounded-full bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            품절
          </span>
        ) : canPledge ? (
          <Link
            href={pledgeHref}
            prefetch={false}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 font-medium text-white hover:bg-primary-dark"
          >
            이 리워드로 후원하기
          </Link>
        ) : null}
      </div>
    </BaseCard>
  );
}
