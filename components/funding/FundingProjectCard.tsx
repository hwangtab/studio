import { useEffect, useState } from 'react';
import Link from 'next/link';
import BaseCard from '../ui/BaseCard';
import ResponsiveImage from '../ResponsiveImage';
import { formatPriceAmount } from '../../data/pricing';
import { computeProjectState, type ProjectState } from '../../lib/funding/projectState';

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
  useEffect(() => {
    setState(computeProjectState({ status, startAt, endAt }, new Date()));
  }, [status, startAt, endAt]);
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
                ? 'bg-primary/10 text-primary dark:bg-primary-light/15 dark:text-primary-light'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {STATE_LABEL[state]}
          </span>
          <h2 className="typo-card-title mt-3 text-gray-900 dark:text-white">{title}</h2>
          <p className="typo-card-body mt-2 flex-1">{summary}</p>
          <p className="typo-card-meta mt-4 border-t border-gray-200/70 pt-3 dark:border-gray-700/70">
            목표 {formatPriceAmount(goalAmount)}원
          </p>
        </div>
      </BaseCard>
    </Link>
  );
}
