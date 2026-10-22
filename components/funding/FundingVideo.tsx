import YouTubeFacade from '../media/YouTubeFacade';

interface Video {
  youtubeId: string;
  title: string;
  /** 영상 아래 한 줄(언제·어디서·누가 찍었나). */
  caption: string;
  captionEn: string;
}

/**
 * `%%funding-video:<id>%%`로 불러오는 유튜브 영상.
 *
 * 마크다운 본문은 raw HTML을 못 써서(`disableParsingRawHTML`) iframe을 직접 못 넣는다 — 숏코드 컴포넌트로
 * 만든다(FundingAudioPlayer와 같은 이유). 영상 id는 여기 목록에 있는 것만 받는다. 개설자가 아무 id나 넣어
 * 우리 페이지에 임의 영상을 띄우지 못하게 하려는 것이고, 이 숏코드 자체도 개설자 글에서는 벗긴다
 * (lib/funding/creatorContent.ts).
 *
 * **누르기 전에는 유튜브를 부르지 않는다** — 칸 자체는 공용 YouTubeFacade(영상 제작 페이지와 같다).
 */
const VIDEOS: Record<string, Video> = {
  // 경기아트콜렉티브가 찍어 올린 영상(youtu.be/F8JH5d9pOt8). 운영자가 펀딩에 넣어 달라고 준 링크(2026-10-08).
  'sabbaha-debt-shroud-live': {
    youtubeId: 'F8JH5d9pOt8',
    title: 'SABBAHA — Debt Shroud (2025.10.12 ACME STUDIO)',
    caption: '〈Debt Shroud〉 라이브 — 2025년 10월 12일 ACME Studio, 경기아트콜렉티브 촬영',
    captionEn: '“Debt Shroud” live at ACME Studio, 12 October 2025. Filmed by the Gyeonggi Art Collective.',
  },
};

export default function FundingVideo({ id, locale = 'ko' }: { id: string; locale?: string }) {
  const video = VIDEOS[id];
  const en = locale === 'en';
  if (!video) return null;

  return (
    <figure className="not-prose my-8">
      <YouTubeFacade
        youtubeId={video.youtubeId}
        title={video.title}
        thumbnail="maxres"
        playLabel={en ? `Play video: ${video.title}` : `${video.title} 영상 재생`}
      />
      <figcaption className="mt-3 break-keep text-sm text-gray-600 dark:text-gray-400">{en ? video.captionEn : video.caption}</figcaption>
    </figure>
  );
}
