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
  'mt-10 bg-canvas-soft border border-hairline shadow-card rounded-hero p-6 sm:p-8 dark:bg-surface-dark-elevated dark:border-white/10';

const sectionTitleClass =
  'text-title-md text-ink dark:text-on-dark mb-4';

const PortfolioDetailBody = ({ item, locale, labels }: PortfolioDetailBodyProps) => {
  const notes = item.productionNotes?.[locale];
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
          <div className="space-y-4 text-ink-muted-80 dark:text-on-dark-soft leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0 [&>h2]:text-title-sm [&>h2]:mt-6 [&>h2]:mb-3 [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>blockquote]:border-l-4 [&>blockquote]:border-hairline-strong [&>blockquote]:pl-4 [&>blockquote]:italic [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold">
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
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-ink-muted-80 dark:text-on-dark-soft">
            {item.releaseDate && (
              <div>
                <dt className="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-1">
                  {labels.releaseDateLabel}
                </dt>
                <dd className="text-body text-ink dark:text-on-dark">
                  <time dateTime={item.releaseDate}>{item.releaseDate}</time>
                </dd>
              </div>
            )}
            {item.label && (
              <div>
                <dt className="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-1">
                  {labels.labelLabel}
                </dt>
                <dd className="text-body text-ink dark:text-on-dark">{item.label}</dd>
              </div>
            )}
            {credits?.engineer && (
              <div>
                <dt className="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-1">
                  {labels.creditsEngineer}
                </dt>
                <dd className="text-body text-ink dark:text-on-dark">{credits.engineer}</dd>
              </div>
            )}
            {credits?.musicians && credits.musicians.length > 0 && (
              <div className="sm:col-span-3">
                <dt className="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-1">
                  {labels.creditsMusicians}
                </dt>
                <dd className="text-body">
                  <ul className="flex flex-wrap gap-2">
                    {credits.musicians.map((name) => (
                      <li
                        key={name}
                        className="px-3 py-1 bg-canvas-warm text-ink-muted-80 dark:text-on-dark-soft rounded-pill text-[13px] border border-hairline dark:border-white/10"
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
                <dt className="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-1">
                  {labels.creditsGear}
                </dt>
                <dd className="text-body">
                  <ul className="flex flex-wrap gap-2">
                    {credits.gear.map((g) => (
                      <li
                        key={g}
                        className="px-3 py-1 bg-canvas-warm text-ink-muted-80 dark:text-on-dark-soft rounded-pill text-[13px] border border-hairline dark:border-white/10"
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
          <ol className="divide-y divide-hairline dark:divide-white/10">
            {trackList.map((track) => (
              <li
                key={`${track.no}-${track.title}`}
                className="flex items-center justify-between py-3 text-ink dark:text-on-dark"
              >
                <span className="flex items-baseline gap-3">
                  <span className="text-caption tabular-nums w-8 text-ink-muted-40 dark:text-on-dark-soft">
                    {String(track.no).padStart(2, '0')}
                  </span>
                  <span className="text-body">{track.title}</span>
                </span>
                {track.duration && (
                  <span className="text-caption tabular-nums text-ink-muted-40 dark:text-on-dark-soft">
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
