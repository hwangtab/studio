import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';

export interface ReleaseCover {
  id: string;
  /** 포트폴리오 제목 — "아티스트 <앨범명>" 형식이라 alt로 그대로 쓴다. */
  title: string;
  image: string;
  releaseDate?: string;
}

interface HomeReleaseStripProps {
  locale: string;
  covers: ReleaseCover[];
  viewAllLabel: string;
}

/**
 * 디자인 v2 홈 — 실제 발매작 커버 그리드.
 *
 * 파형·VU 미터 같은 장식 모티프보다 실제 커버 열두 장이 "여기서 음반이 나온다"를 더
 * 직접 증명한다(디자인 회의 아트 디렉터 안). 발매 파이프라인이 사업의 핵심 강점인데
 * v1 홈에는 발매작이 한 장도 없었다.
 *
 * 모바일은 가로 스크롤 한 줄(스냅), sm 이상은 그리드. 이미지는 전부 지연 로딩이고
 * 정사각 칸으로 자리를 먼저 잡아 CLS가 없다. alt를 비우지 않는다 — 커버는 장식이
 * 아니라 "이 작품"을 가리키는 정보다.
 */
const HomeReleaseStrip = ({ locale, covers, viewAllLabel }: HomeReleaseStripProps) => (
  <>
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto sm:overflow-visible snap-x snap-mandatory scrollbar-hide">
      <ul className="grid grid-flow-col auto-cols-[42%] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
        {covers.map((cover) => (
          <li key={cover.id} className="snap-start">
            <Link
              href={`/${locale}/portfolio/${cover.id}`}
              prefetch={false}
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
            >
              <div className="relative aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                <Image
                  src={cover.image}
                  alt={cover.title}
                  fill
                  sizes="(max-width: 640px) 42vw, (max-width: 1024px) 25vw, 200px"
                  className="object-cover transition-transform duration-slow group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-3 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 break-keep">
                {cover.title}
              </p>
              {cover.releaseDate && (
                <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {cover.releaseDate.slice(0, 4)}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
    <Link
      href={`/${locale}/portfolio`}
      prefetch={false}
      className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
    >
      {viewAllLabel}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  </>
);

export default HomeReleaseStrip;
