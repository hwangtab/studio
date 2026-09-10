import { formatPriceAmount } from '../../data/pricing';
import { daysUntilKst } from '../../lib/booking/kst';
import type { ProjectState } from '../../lib/funding/projects';

interface Props {
  goalAmount: number;
  endAt: string;
  now: Date | null;
  data: { raisedAmount: number; backerCount: number; percent: number; state: ProjectState } | null;
}

export default function FundingProgress({ goalAmount, endAt, now, data }: Props) {
  // now가 null이면(마운트 전) D-day를 비운다 — 서버/클라이언트 시계 차이로 인한 하이드레이션
  // 불일치를 피하려는 것이고, 컨테이너 min-height가 높이를 예약하고 있어 레이아웃은 안 흔들린다.
  const days = now ? daysUntilKst(now, new Date(endAt)) : 0;
  const state = data?.state;
  const dday = !now ? '' : state === 'closed' ? '마감' : days <= 0 ? 'D-DAY' : `D-${days}`;
  const percent = data ? Math.min(100, data.percent) : 0;
  return (
    <div className="min-h-[120px]" aria-live="polite">
      {data ? (
        <>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">{formatPriceAmount(data.raisedAmount)}원</p>
          <p className="typo-card-meta mt-2">
            목표 {formatPriceAmount(goalAmount)}원 · <span className="font-semibold text-primary dark:text-violet-300">{data.percent}%</span> · {data.backerCount}명 후원{dday ? ` · ${dday}` : ''}
          </p>
        </>
      ) : (
        <p className="typo-card-meta">모금 현황 집계 중…{dday ? ` · ${dday}` : ''}</p>
      )}
      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
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
