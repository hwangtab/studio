import React from 'react';
import { useTranslation } from 'react-i18next';

import CategoryFilter from '../CategoryFilter';
import YouTubeFacade from '../media/YouTubeFacade';
import { Badge } from '../ui/Badge';
import { centeredGrid } from '../ui/centeredGrid';
import { VIDEO_WORKS, VIDEO_WORK_KINDS, type VideoWorkKind } from '../../data/videoPortfolio';
import type { Locale } from '../../lib/i18n';

const GRID = centeredGrid({ md: 2, lg: 3, gap: 6 });

/**
 * 영상 제작 페이지의 작업 영상 격자 — 종류 필터 + 누르기 전엔 썸네일만 받는 칸.
 * 한 번에 하나만 재생한다: 다른 칸을 누르면 앞 칸은 썸네일로 돌아간다(소리 두 개가 겹치지 않게).
 */
export default function VideoPortfolioGrid({ locale }: { locale: Locale }) {
  const { t } = useTranslation('common', { lng: locale });
  const isKo = locale === 'ko';
  const [kind, setKind] = React.useState<'all' | VideoWorkKind>('all');
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  const categories = React.useMemo(
    () => VIDEO_WORK_KINDS.map((k) => ({ id: k, label: t(`musicVideo.portfolio.kinds.${k}`) })),
    [t]
  );
  const works = kind === 'all' ? VIDEO_WORKS : VIDEO_WORKS.filter((w) => w.kind === kind);

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <CategoryFilter
          locale={locale}
          activeCategory={kind}
          setActiveCategory={(id) => setKind(id as 'all' | VideoWorkKind)}
          categories={categories}
          allLabel={t('musicVideo.portfolio.kinds.all')}
          buttonSize="sm"
        />
      </div>
      <ul className={`${GRID.container} max-w-6xl mx-auto`}>
        {works.map((w) => {
          const artist = isKo ? w.artist : w.artistEn;
          const title = isKo ? w.title : w.titleEn;
          const note = isKo ? w.note : w.noteEn;
          const name = `${artist} — ${title}`;
          return (
            <li key={w.youtubeId} className={GRID.item}>
              <YouTubeFacade
                youtubeId={w.youtubeId}
                title={name}
                playLabel={t('musicVideo.portfolio.play', { name })}
                playing={playingId === w.youtubeId}
                onPlay={() => setPlayingId(w.youtubeId)}
              />
              <div className="mt-3">
                <Badge tone="brand" className="mb-1.5">
                  {t(`musicVideo.portfolio.kinds.${w.kind}`)}
                </Badge>
                <p className="typo-card-subtitle text-base break-keep">
                  {artist} <span className="font-normal text-gray-600 dark:text-gray-400">— {title}</span>
                </p>
                {note && <p className="typo-card-meta mt-0.5 break-keep">{note}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
