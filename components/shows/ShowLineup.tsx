import type { ShowPerformer } from '../../lib/shows/content';

/** 출연진 카드 — 이름을 크게, 소개는 읽기 좋은 폭으로. 출연이 둘 이하면 열을 줄여 한쪽으로 몰리지 않게 한다. */
export default function ShowLineup({ performers }: { performers: ShowPerformer[] }) {
  if (performers.length === 0) return null;
  const cols = performers.length === 1 ? 'max-w-md' : performers.length === 2 ? 'max-w-3xl md:grid-cols-2' : 'max-w-5xl md:grid-cols-3';
  return (
    <ul className={`mx-auto grid gap-4 ${cols}`}>
      {performers.map((p) => (
        <li
          key={p.name}
          className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="typo-card-title text-gray-900 dark:text-white">{p.name}</h3>
          {p.bio && <p className="mt-3 break-keep typo-card-body leading-7 text-gray-700 dark:text-gray-300">{p.bio}</p>}
        </li>
      ))}
    </ul>
  );
}
