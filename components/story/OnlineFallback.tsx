import React from 'react';
import NextLink from 'next/link';
import { type Locale } from '../../lib/i18n';

interface OnlineFallbackProps {
  locale?: Locale;
}

const OnlineFallback: React.FC<OnlineFallbackProps> = ({ locale = 'ko' }) => {
  const href = `/${locale}/stories/onlinemix1`;

  return (
    <div className="my-8 rounded-card border border-hairline dark:border-white/10 bg-canvas-warm dark:bg-surface-dark-elevated px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 text-ink-muted-80 dark:text-on-dark-soft text-body-1 leading-relaxed">
        직접 방문이 어렵다면{' '}
        <NextLink
          href={href}
          className="font-semibold text-link hover:underline underline-offset-4 dark:text-link-on-dark"
        >
          온라인 파일 의뢰
        </NextLink>
        도 가능합니다. 녹음 파일을 전송하면 믹싱·마스터링 후 완성 파일로 납품합니다.
      </div>
      <NextLink
        href={href}
        className="inline-flex items-center justify-center shrink-0 px-4 py-2 rounded-pill bg-ink text-white text-sm font-medium hover:bg-ink/90 transition-colors dark:bg-on-dark dark:text-canvas-deep"
      >
        온라인 의뢰 안내 →
      </NextLink>
    </div>
  );
};

export default OnlineFallback;
