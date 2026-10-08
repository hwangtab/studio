import { useState } from 'react';

import { Play } from '../../lib/lucide-icons';

interface Video {
  youtubeId: string;
  title: string;
  /** 영상 아래 한 줄(언제·어디서·누가 찍었나). */
  caption: string;
}

/**
 * `%%funding-video:<id>%%`로 불러오는 유튜브 영상.
 *
 * 마크다운 본문은 raw HTML을 못 써서(`disableParsingRawHTML`) iframe을 직접 못 넣는다 — 숏코드 컴포넌트로
 * 만든다(FundingAudioPlayer와 같은 이유). 영상 id는 여기 목록에 있는 것만 받는다. 개설자가 아무 id나 넣어
 * 우리 페이지에 임의 영상을 띄우지 못하게 하려는 것이고, 이 숏코드 자체도 개설자 글에서는 벗긴다
 * (lib/funding/creatorContent.ts).
 *
 * **누르기 전에는 유튜브를 부르지 않는다.** 썸네일 그림 한 장만 받고, 누르면 그때 youtube-nocookie
 * iframe을 연다 — 유튜브 플레이어는 열자마자 1MB 가까운 스크립트와 추적 쿠키를 싣기 때문이다.
 * CSP frame-src에 www.youtube-nocookie.com이 열려 있어야 한다(middleware.ts).
 */
const VIDEOS: Record<string, Video> = {
  // 경기아트콜렉티브가 찍어 올린 영상(youtu.be/F8JH5d9pOt8). 운영자가 펀딩에 넣어 달라고 준 링크(2026-10-08).
  'sabbaha-debt-shroud-live': {
    youtubeId: 'F8JH5d9pOt8',
    title: 'SABBAHA — Debt Shroud (2025.10.12 ACME STUDIO)',
    caption: '〈Debt Shroud〉 라이브 — 2025년 10월 12일 ACME Studio, 경기아트콜렉티브 촬영',
  },
};

export default function FundingVideo({ id }: { id: string }) {
  const video = VIDEOS[id];
  const [playing, setPlaying] = useState(false);
  if (!video) return null;

  return (
    <figure className="not-prose my-8">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-950 shadow-lg ring-1 ring-black/10 dark:ring-white/10">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&playsinline=1`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${video.title} 영상 재생`}
            className="group absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white focus-visible:ring-offset-black"
          >
            {/* 유튜브 썸네일 — 외부 그림이라 next/image 최적화를 거치지 않는다. 장식이 아니라 영상의 첫 화면이지만
                버튼에 이름이 있어 alt는 비운다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-black/30 transition-colors duration-fast group-hover:bg-black/20" />
            <span
              aria-hidden="true"
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-gray-950 shadow-lg md:h-20 md:w-20"
            >
              <Play size={28} className="translate-x-0.5" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 break-keep text-sm text-gray-600 dark:text-gray-400">{video.caption}</figcaption>
    </figure>
  );
}
