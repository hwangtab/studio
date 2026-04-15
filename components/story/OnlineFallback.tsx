import React from 'react';
import NextLink from 'next/link';
import { type Locale } from '../../lib/i18n';

interface OnlineFallbackProps {
  locale?: Locale;
}

const OnlineFallback: React.FC<OnlineFallbackProps> = ({ locale = 'ko' }) => {
  const href = `/${locale}/stories/onlinemix1`;

  return (
    <div className="my-8 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 text-gray-800 dark:text-gray-200 text-body-1 leading-relaxed">
        직접 방문이 어렵다면{' '}
        <NextLink
          href={href}
          className="font-semibold text-primary hover:underline underline-offset-4"
        >
          온라인 파일 의뢰
        </NextLink>
        도 가능합니다. 녹음 파일을 전송하면 믹싱·마스터링 후 완성 파일로 납품합니다.
      </div>
      <NextLink
        href={href}
        className="inline-flex items-center justify-center shrink-0 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        온라인 의뢰 안내 →
      </NextLink>
    </div>
  );
};

export default OnlineFallback;
