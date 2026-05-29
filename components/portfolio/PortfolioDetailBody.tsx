import React from 'react';
import Markdown from 'markdown-to-jsx';
import type { PortfolioItem } from '../../types/data';
import type { Locale } from '../../lib/i18n';

interface PortfolioDetailBodyProps {
  item: PortfolioItem;
  locale: Locale;
  labels: {
    productionNotesTitle: string;
    creditsTitle: string;
    creditsEngineer: string;
    creditsMusicians: string;
    creditsGear: string;
    trackListTitle: string;
    releaseDateLabel: string;
    labelLabel: string;
  };
}

const sectionWrapperClass =
  'mt-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 sm:p-8';

const sectionTitleClass =
  'typo-card-title mb-4 text-gray-900 dark:text-white';

const PortfolioDetailBody = ({ item, locale, labels }: PortfolioDetailBodyProps) => {
  // productionNotes는 사실 검증 전까지 UI 노출 비활성화 (AI 생성 가능성 — 작품별 사실 검증 후 재활성화)
  const notes: string | undefined = undefined;
  void item.productionNotes;
  void locale;
  const credits = item.credits;
  const trackList = item.trackList;
  const hasMeta = Boolean(item.releaseDate || item.label);

  if (!notes && !credits && !trackList?.length && !hasMeta) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {notes && (
        <section className={sectionWrapperClass} aria-labelledby="portfolio-production-notes">
          <h2 id="portfolio-production-notes" className={sectionTitleClass}>
            {labels.productionNotesTitle}
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0 [&>h2]:typo-card-subtitle [&>h2]:mt-6 [&>h2]:mb-3 [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>blockquote]:border-l-4 [&>blockquote]:border-primary [&>blockquote]:pl-4 [&>blockquote]:italic [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold">
            <Markdown
              options={{
                forceBlock: true,
                overrides: {
                  a: {
                    props: {
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    },
                  },
                },
              }}
            >
              {notes}
            </Markdown>
          </div>
        </section>
      )}

      {(credits || hasMeta) && (
        <section className={sectionWrapperClass} aria-labelledby="portfolio-credits">
          <h2 id="portfolio-credits" className={sectionTitleClass}>
            {labels.creditsTitle}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-gray-700 dark:text-gray-300">
            {item.releaseDate && (
              <div>
                <dt className="typo-card-meta font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {labels.releaseDateLabel}
                </dt>
                <dd className="typo-card-body">
                  <time dateTime={item.releaseDate}>{item.releaseDate}</time>
                </dd>
              </div>
            )}
            {item.label && (
              <div>
                <dt className="typo-card-meta font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {labels.labelLabel}
                </dt>
                <dd className="typo-card-body">{item.label}</dd>
              </div>
            )}
            {credits?.engineer && (
              <div>
                <dt className="typo-card-meta font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {labels.creditsEngineer}
                </dt>
                <dd className="typo-card-body">{credits.engineer}</dd>
              </div>
            )}
            {credits?.musicians && credits.musicians.length > 0 && (
              <div className="sm:col-span-3">
                <dt className="typo-card-meta font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {labels.creditsMusicians}
                </dt>
                <dd className="typo-card-body">
                  <ul className="flex flex-wrap gap-2">
                    {credits.musicians.map((name) => (
                      <li
                        key={name}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {credits?.gear && credits.gear.length > 0 && (
              <div className="sm:col-span-3">
                <dt className="typo-card-meta font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {labels.creditsGear}
                </dt>
                <dd className="typo-card-body">
                  <ul className="flex flex-wrap gap-2">
                    {credits.gear.map((g) => (
                      <li
                        key={g}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                      >
                        {g}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {trackList && trackList.length > 0 && (
        <section className={sectionWrapperClass} aria-labelledby="portfolio-tracklist">
          <h2 id="portfolio-tracklist" className={sectionTitleClass}>
            {labels.trackListTitle}
          </h2>
          <ol className="divide-y divide-gray-100 dark:divide-gray-700">
            {trackList.map((track) => (
              <li
                key={`${track.no}-${track.title}`}
                className="flex items-center justify-between py-3 text-gray-700 dark:text-gray-300"
              >
                <span className="flex items-baseline gap-3">
                  <span className="typo-card-meta tabular-nums w-8 text-gray-500 dark:text-gray-400">
                    {String(track.no).padStart(2, '0')}
                  </span>
                  <span className="typo-card-body">{track.title}</span>
                </span>
                {track.duration && (
                  <span className="typo-card-meta tabular-nums text-gray-500 dark:text-gray-400">
                    {track.duration}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};

export default PortfolioDetailBody;
