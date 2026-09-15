import { useEffect, useState } from 'react';
import Link from 'next/link';
import BaseCard from '../ui/BaseCard';
import ResponsiveImage from '../ResponsiveImage';
import { formatPriceAmount } from '../../data/pricing';
import { daysUntilKst } from '../../lib/booking/kst';
import { computeProjectState, type ProjectState } from '../../lib/funding/projectState';
import { useFundingStatus } from './useFundingStatus';

const STATE_LABEL: Record<ProjectState, string> = { live: '진행 중', upcoming: '오픈 예정', closed: '마감', draft: '' };

interface Props {
  slug: string;
  title: string;
  summary: string;
  cover: string;
  goalAmount: number;
  state: ProjectState;
  status: 'auto' | 'draft' | 'closed';
  startAt: string;
  endAt: string;
}

export default function FundingProjectCard({ slug, title, summary, cover, goalAmount, state: initialState, status, startAt, endAt }: Props) {
  // 목록은 정적 생성이라 서버가 계산한 배지가 빌드 시각에 고정된다 — 마감이 지난 프로젝트가
  // 며칠씩 '진행 중'으로 보인다. 초기 렌더는 서버 값을 그대로 써(하이드레이션 불일치 방지)
  // 마운트 후 브라우저 시계로 다시 판정한다. 정렬은 서버 순서를 유지한다.
  const [state, setState] = useState(initialState);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setState(computeProjectState({ status, startAt, endAt }, new Date()));
    setNow(new Date());
  }, [status, startAt, endAt]);

  // 목록에서도 모금 현황을 보여준다. 목표액만 있으면 "얼마나 모였나"를 보려고
  // 상세로 들어가야 하는데, 그 숫자가 후원을 결정하는 정보다.
  // 상세와 같은 훅·같은 API(s-maxage=60 CDN 캐시)라 카드가 늘어도 부담이 작다.
  const { data } = useFundingStatus(slug, initialState, { status, startAt, endAt });
  // 마운트 전에는 D-day를 비운다 — 서버/클라이언트 시계 차이로 인한 하이드레이션 불일치 방지.
  const days = now ? daysUntilKst(now, new Date(endAt)) : 0;
  const dday = !now || state === 'closed' ? '' : days <= 0 ? 'D-DAY' : `D-${days}`;
  // 후원이 0건일 때는 현황 대신 목표액을 그대로 둔다. "0원 · 0% · 0건"은 정직하지만
  // 사회적 증거를 거꾸로 세운다 — 첫 후원자가 가장 망설이는 자리에서 "아무도 안 했다"를
  // 먼저 읽히게 할 이유가 없다. 첫 건이 들어오면 그때부터 숫자가 일한다.
  const showProgress = Boolean(data && data.backerCount > 0);
  const percent = showProgress && data ? Math.min(100, data.percent) : 0;
  return (
    <Link href={`/ko/funding/${slug}`} prefetch={false} className="block h-full">
      <BaseCard variant="glass" className="flex h-full flex-col overflow-hidden">
        <ResponsiveImage
          src={cover}
          alt=""
          containerClassName="relative block aspect-[16/9] w-full overflow-hidden"
          className="object-cover"
          loading="lazy"
        />
        <div className="flex flex-1 flex-col p-6">
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              state === 'live'
                ? 'bg-primary/10 text-primary dark:bg-primary-light/15 dark:text-violet-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {STATE_LABEL[state]}
          </span>
          <h2 className="typo-card-title mt-3 text-gray-900 dark:text-white">{title}</h2>
          <p className="typo-card-body mt-2 flex-1">{summary}</p>
          <div className="mt-4 border-t border-gray-200/70 pt-3 dark:border-gray-700/70">
            {showProgress && (
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              role="progressbar"
              aria-label={`${title} 달성률`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            )}
            {/* 후원자 수가 아니라 건수다 — 집계가 COUNT(*)라 한 사람이 두 번 후원하면 2가 된다
                (FundingProgress와 같은 이유). 집계를 바꾸지 말고 라벨을 맞춘다. */}
            <p className={`typo-card-meta ${showProgress ? 'mt-2' : ''}`} aria-live="polite">
              {showProgress && data ? (
                <>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatPriceAmount(data.raisedAmount)}원
                  </span>
                  {' · '}
                  <span className="font-semibold text-primary dark:text-violet-300">{data.percent}%</span>
                  {` · ${data.backerCount}건`}
                </>
              ) : (
                <>목표 {formatPriceAmount(goalAmount)}원</>
              )}
              {dday ? ` · ${dday}` : ''}
            </p>
          </div>
        </div>
      </BaseCard>
    </Link>
  );
}
