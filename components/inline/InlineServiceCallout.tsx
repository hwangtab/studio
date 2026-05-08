import React from 'react';
import Link from 'next/link';
import { ArrowRight, Disc, GraduationCap, Heart, Mic, Speaker } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';

type ServiceType = 'wedding' | 'voice' | 'lesson' | 'recording' | 'practice';

interface InlineServiceCalloutProps {
  type: string;
  locale: Locale;
}

const SERVICE_PATHS: Record<ServiceType, string> = {
  wedding: '/wedding-song',
  voice: '/voice-acting',
  lesson: '/lesson',
  recording: '/pricing',
  practice: '/practice-room',
};

const SERVICE_ICONS: Record<ServiceType, React.ElementType> = {
  wedding: Heart,
  voice: Mic,
  lesson: GraduationCap,
  recording: Disc,
  practice: Speaker,
};

const SERVICE_LABEL_KEYS: Record<ServiceType, string> = {
  wedding: 'nav.weddingSong',
  voice: 'nav.voiceActing',
  lesson: 'nav.lesson',
  recording: 'nav.pricing',
  practice: 'nav.practiceRoom',
};

const isServiceType = (v: string): v is ServiceType =>
  v === 'wedding' || v === 'voice' || v === 'lesson' || v === 'recording' || v === 'practice';

/**
 * 본문 안 서비스 강조 박스. %%service:<type>%% short-code로 트리거.
 * type이 5종 외이면 null. siteConfig.contact.kakaoUrl 두 번째 CTA 동반.
 */
const InlineServiceCallout = ({ type, locale }: InlineServiceCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  if (!isServiceType(type)) return null;

  const Icon = SERVICE_ICONS[type];
  const path = SERVICE_PATHS[type];
  const label = t(SERVICE_LABEL_KEYS[type]);

  return (
    <aside
      data-inline-callout="service"
      aria-label={label}
      className="my-8 rounded-xl border border-secondary/30 bg-secondary/5 p-6"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-secondary/15" aria-hidden="true">
          <Icon className="text-secondary" size={20} />
        </div>
        <h4 className="typo-card-subtitle text-gray-900 dark:text-white">
          {label}
        </h4>
      </div>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {t(`stories.inline.serviceBody.${type}`, {
          defaultValue: t('stories.inline.serviceBodyDefault', { defaultValue: '연관 서비스 자세히 알아보기.' }),
        })}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}${path}`}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline min-h-[44px] touch-manipulation"
        >
          {label} <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:underline min-h-[44px] touch-manipulation"
        >
          {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
};

export default React.memo(InlineServiceCallout);
