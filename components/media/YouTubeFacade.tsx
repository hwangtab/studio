import { useState } from 'react';

import { Play } from '../../lib/lucide-icons';

interface YouTubeFacadeProps {
  youtubeId: string;
  /** iframe title·버튼 이름에 쓰는 영상 제목. */
  title: string;
  /** 재생 버튼의 접근성 이름(로케일별). */
  playLabel: string;
  /**
   * 썸네일 크기. maxres는 없는 영상이 있어 그때 유튜브가 120×90 회색 그림을 돌려준다 —
   * 큰 칸 하나에만 쓰고, 격자 칸은 hq(480×360, 모든 영상에 있다)를 쓴다.
   */
  thumbnail?: 'maxres' | 'hq';
  /**
   * 바깥에서 재생 상태를 쥘 때(격자에서 한 번에 하나만 재생). 없으면 스스로 쥔다.
   */
  playing?: boolean;
  onPlay?: () => void;
  className?: string;
}

/**
 * 누르기 전에는 유튜브를 부르지 않는 영상 칸.
 *
 * 썸네일 그림 한 장만 받고, 누르면 그때 youtube-nocookie iframe을 연다 — 유튜브 플레이어는
 * 열자마자 1MB 가까운 스크립트와 추적 쿠키를 싣기 때문이다(영상 여러 개를 늘어놓는 서비스
 * 페이지에서 특히). CSP frame-src에 www.youtube-nocookie.com이 열려 있어야 한다(middleware.ts).
 * 펀딩 본문 숏코드(FundingVideo)와 영상 제작 페이지 포트폴리오가 같이 쓴다.
 */
export default function YouTubeFacade({
  youtubeId,
  title,
  playLabel,
  thumbnail = 'hq',
  playing: controlledPlaying,
  onPlay,
  className = '',
}: YouTubeFacadeProps) {
  const [selfPlaying, setSelfPlaying] = useState(false);
  const playing = controlledPlaying ?? selfPlaying;

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-2xl bg-gray-950 shadow-lg ring-1 ring-black/10 dark:ring-white/10 ${className}`}
    >
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setSelfPlaying(true);
            onPlay?.();
          }}
          aria-label={playLabel}
          className="group absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white focus-visible:ring-offset-black"
        >
          {/* 유튜브 썸네일 — 외부 그림이라 next/image 최적화를 거치지 않는다. 버튼에 이름이 있어 alt는 비운다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${youtubeId}/${thumbnail === 'maxres' ? 'maxresdefault' : 'hqdefault'}.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span aria-hidden="true" className="absolute inset-0 bg-black/30 transition-colors duration-fast group-hover:bg-black/20" />
          <span
            aria-hidden="true"
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-950 shadow-lg md:h-16 md:w-16"
          >
            <Play size={24} className="translate-x-0.5" />
          </span>
        </button>
      )}
    </div>
  );
}
