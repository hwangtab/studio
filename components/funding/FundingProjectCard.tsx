import Link from 'next/link';
import BaseCard from '../ui/BaseCard';
import ResponsiveImage from '../ResponsiveImage';
import { formatPriceAmount } from '../../data/pricing';
import type { ProjectState } from '../../lib/funding/projects';

const STATE_LABEL: Record<ProjectState, string> = { live: '진행 중', upcoming: '오픈 예정', closed: '마감', draft: '' };

interface Props {
  slug: string;
  title: string;
  summary: string;
  cover: string;
  goalAmount: number;
  state: ProjectState;
}

export default function FundingProjectCard({ slug, title, summary, cover, goalAmount, state }: Props) {
  return (
    <Link href={`/ko/funding/${slug}`} prefetch={false} className="block">
      <BaseCard variant="glass" className="overflow-hidden">
        <ResponsiveImage
          src={cover}
          alt=""
          containerClassName="relative block aspect-[16/9] w-full overflow-hidden"
          className="object-cover"
          loading="lazy"
        />
        <div className="p-5">
          <span className={`text-xs font-semibold ${state === 'live' ? 'text-primary dark:text-accent' : 'text-gray-500'}`}>
            {STATE_LABEL[state]}
          </span>
          <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{summary}</p>
          <p className="mt-3 text-xs text-gray-500">목표 {formatPriceAmount(goalAmount)}원</p>
        </div>
      </BaseCard>
    </Link>
  );
}
