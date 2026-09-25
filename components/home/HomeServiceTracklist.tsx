import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';

export interface TracklistService {
  title: string;
  description: string;
  href: string;
}

interface HomeServiceTracklistProps {
  services: TracklistService[];
}

/**
 * 디자인 v2 홈의 서비스 목록 — 앨범 뒷면 트랙리스트 형식.
 *
 * v1은 원형 아이콘 + 상단 그라디언트 띠를 두른 같은 크기 카드 8장이었다. 카드가 전부
 * 같은 무게라 플래그십(발매 프로젝트)이 커버 영상 촬영과 나란히 읽혔고, 어느 업종에
 * 가져다 놓아도 되는 모양이었다. 트랙리스트는 순서가 곧 위계라 첫 줄이 대표 상품으로
 * 읽히고(homeServices 첫 항목이 발매 프로젝트), 음악 스튜디오라는 맥락도 형식이 말한다.
 *
 * 번호는 장식이라 스크린리더에서 숨긴다 — <ol>이 이미 순서를 전달한다.
 * 카드 컴포넌트(BaseCard·FeatureCard)를 쓰지 않는 이유는 그 둘이 다른 페이지의 전환 실험
 * 계측 지점과 얽혀 있어 v2 작업이 파일을 건드리지 않기로 했기 때문이다.
 */
const HomeServiceTracklist = ({ services }: HomeServiceTracklistProps) => (
  <ol className="border-t border-gray-200 dark:border-gray-800">
    {services.map((service, i) => (
      <li key={service.href} className="border-b border-gray-200 dark:border-gray-800">
        <Link
          href={service.href}
          prefetch={false}
          className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.35fr)_auto] items-baseline gap-x-4 md:gap-x-8 px-3 -mx-3 py-6 md:py-7 rounded-lg transition-colors duration-fast hover:bg-gray-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
        >
          <span aria-hidden="true" className="text-sm font-semibold tabular-nums text-primary dark:text-primary-lighter">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="font-title text-xl md:text-2xl font-bold leading-snug text-gray-950 dark:text-white break-keep">
            {service.title}
          </span>
          <span className="col-start-2 md:col-start-auto row-start-2 md:row-start-auto mt-2 md:mt-0 typo-card-body text-gray-600 dark:text-gray-300">
            {service.description}
          </span>
          <ArrowRight
            aria-hidden="true"
            // 화살표는 행·열을 둘 다 명시한다. 행만 명시하면 CSS 그리드가 명시된 항목을 먼저
            // 배치하면서 1행 1열을 차지해 번호·제목이 한 칸씩 밀린다.
            className="col-start-3 row-start-1 md:col-start-4 self-center text-gray-400 transition-transform duration-fast group-hover:translate-x-1"
            size={20}
          />
        </Link>
      </li>
    ))}
  </ol>
);

export default HomeServiceTracklist;
