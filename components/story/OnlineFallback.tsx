import React from 'react';
import NextLink from 'next/link';
import { type Locale } from '../../lib/i18n';
import { Notice } from '../ui/Notice';
import { Button } from '../ui/Button';

interface OnlineFallbackProps {
  locale?: Locale;
}

/**
 * 방문이 어려운 독자에게 온라인 파일 의뢰 경로를 알리는 본문 안내. 구조가 "본문 + 행동 하나"라
 * `Notice tone="brand"`를 그대로 쓴다(손으로 짠 primary/5 박스·rounded-lg 버튼을 걷었다, 2026-10-05).
 */
const OnlineFallback: React.FC<OnlineFallbackProps> = ({ locale = 'ko' }) => {
  const href = `/${locale}/stories/onlinemix1`;

  return (
    <Notice
      tone="brand"
      icon={false}
      className="my-8"
      actions={
        <Button asChild variant="solid" shape="block" size="sm">
          <NextLink href={href} prefetch={false}>
            온라인 의뢰 안내 →
          </NextLink>
        </Button>
      }
    >
      <p className="text-body-1 leading-relaxed">
        직접 방문이 어렵다면{' '}
        <NextLink href={href} className="font-semibold text-primary dark:text-primary-lighter underline-offset-4">
          온라인 파일 의뢰
        </NextLink>
        도 가능합니다. 녹음 파일을 전송하면 믹싱·마스터링 후 완성 파일로 납품합니다.
      </p>
    </Notice>
  );
};

export default OnlineFallback;
