import { formatPriceAmount } from '../../data/pricing';
import { daysUntilKst } from '../../lib/booking/kst';
import type { ProjectState } from '../../lib/funding/projects';

interface Props {
  goalAmount: number;
  endAt: string;
  now: Date;
  data: { raisedAmount: number; backerCount: number; percent: number; state: ProjectState } | null;
}

export default function FundingProgress({ goalAmount, endAt, now, data }: Props) {
  const days = daysUntilKst(now, new Date(endAt));
  const state = data?.state;
  const dday = state === 'closed' ? '마감' : days <= 0 ? 'D-DAY' : `D-${days}`;
  const percent = data ? Math.min(100, data.percent) : 0;
  return (
    <div className="min-h-[120px]" aria-live="polite">
      {data ? (
        <>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatPriceAmount(data.raisedAmount)}원</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            목표 {formatPriceAmount(goalAmount)}원 · <span className="font-semibold text-primary dark:text-accent">{data.percent}%</span> · {data.backerCount}명 후원 · {dday}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-500">모금 현황 집계 중… · {dday}</p>
      )}
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-label="펀딩 달성률"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
