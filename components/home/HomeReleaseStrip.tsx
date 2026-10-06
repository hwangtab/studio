import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';
import CoverPlayButton from '../audio/CoverPlayButton';
import type { GlobalTrack } from '../audio/GlobalPlayerProvider';

export interface ReleaseCover {
  id: string;
  /** 포트폴리오 제목 — "아티스트 <앨범명>" 형식이라 alt로 그대로 쓴다. */
  title: string;
  image: string;
  releaseDate?: string;
  /** 30초 발췌(data/audioExcerpts.ts)가 있으면 커버 위에 재생 버튼이 붙는다 — 라이너 노트 §3-6 c. */
  excerpt?: GlobalTrack;
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
 *
 * 재생 버튼(CoverPlayButton)은 링크의 형제다 — <a> 안에 <button>을 넣으면 HTML이 깨진다. 커버 칸을
 * relative로 두고 그 위에 absolute로 얹는다. 발췌가 없는 커버에는 아무것도 붙지 않는다.
 */
const HomeReleaseStrip = ({ locale, covers, viewAllLabel }: HomeReleaseStripProps) => (
  <>
    {/* scroll-pl-4: scroll-snap-type이 있으면 브라우저가 초기 스크롤 위치를 snap
        기준으로 잡는데, scroll-padding 없이는 그 기준이 패딩을 무시한 테두리가 되어
        로드 직후 scrollLeft가 paddingLeft만큼(16px) 밀려 첫 카드의 왼쪽 여백이
        사라진다(실측 확인, 2026-10-01). sm 이상은 스크롤이 꺼지므로 0으로 되돌린다. */}
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto sm:overflow-visible snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-0 scrollbar-hide">
      <ul className="grid grid-flow-col auto-cols-[42%] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
        {covers.map((cover) => (
          <li key={cover.id} className="snap-start relative">
            <Link
              href={`/${locale}/portfolio/${cover.id}`}
              prefetch={false}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                <Image
                  src={cover.image}
                  alt={cover.title}
                  fill
                  sizes="(max-width: 640px) 42vw, (max-width: 1024px) 25vw, 200px"
                  className="object-cover"
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
            {cover.excerpt && (
              /* 커버 칸과 같은 정사각 오버레이(pointer-events 없음) 안에 버튼만 살린다 — 칸 아래 제목 줄 때문에
                 li 기준 bottom으로는 커버의 아래 모서리를 잡을 수 없어서. */
              <div aria-hidden={false} className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
                <CoverPlayButton track={cover.excerpt} className="pointer-events-auto absolute bottom-2 right-2" />
              </div>
            )}
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
