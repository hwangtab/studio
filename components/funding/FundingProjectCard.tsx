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
