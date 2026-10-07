import type { ShowPerformer } from '../../lib/shows/structured';
import LineupCard from '../common/LineupCard';
import { showCopy, type ShowLocale } from '../../lib/shows/i18n';

/** 공연 출연진 — 펀딩 상세와 같은 카드(LineupCard)를 세로로 쌓는다. 사진·SNS는 공연 정의(DB)가 가진다. */
export default function ShowLineup({ performers, locale = 'ko' }: { performers: ShowPerformer[]; locale?: ShowLocale }) {
  if (performers.length === 0) return null;
  return (
    <ul className="mx-auto max-w-2xl space-y-3">
      {performers.map((p) => (
        <li key={p.name}>
          <LineupCard photo={p.photo ?? undefined} photoAlt={showCopy(locale).performerPhotoAlt(p.name)} href={p.sns ?? undefined} name={p.name} bio={p.bio} />
        </li>
      ))}
    </ul>
  );
}
