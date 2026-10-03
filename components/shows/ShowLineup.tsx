import { SHOW_PERFORMER_PHOTOS } from '../../data/shows/performerPhotos';
import type { ShowPerformer } from '../../lib/shows/content';
import LineupCard from '../common/LineupCard';

/** 공연 출연진 — 펀딩 상세와 같은 카드(LineupCard)를 세로로 쌓는다. */
export default function ShowLineup({ slug, performers }: { slug: string; performers: ShowPerformer[] }) {
  if (performers.length === 0) return null;
  const photos = SHOW_PERFORMER_PHOTOS[slug] ?? {};
  return (
    <ul className="mx-auto max-w-2xl space-y-3">
      {performers.map((p) => (
        <li key={p.name}>
          <LineupCard photo={photos[p.name]} photoAlt={`${p.name} 프로필 사진`} name={p.name} bio={p.bio} />
        </li>
      ))}
    </ul>
  );
}
