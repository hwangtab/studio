import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Disc, GraduationCap, Heart, Mic, Speaker } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

type ServiceType = 'wedding' | 'voice' | 'lesson' | 'recording' | 'practice';

interface InlineServiceCalloutProps {
  type: string;
  locale: Locale;
}

const SERVICE_PATHS: Record<ServiceType, string> = {
  wedding: '/wedding-song',
  voice: '/voice-acting',
  lesson: '/lesson',
  recording: '/recording',
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
  recording: 'nav.recording',
  practice: 'nav.practiceRoom',
};

// 한국어 풍부 콘텐츠. 다른 locale은 fallback (제목만 + generic body, features 없음).
const KO_CONTENT: Record<ServiceType, { title: string; description: string; features: string[] }> = {
  lesson: {
    title: '1:1 음악 레슨',
    description: '엔지니어와 함께 본인 곡을 단계별로 뜯어보며 개선합니다. 보컬·믹싱·마스터링 멘토링.',
    features: [
      '월 35만원 정액제 (주 1회 60분)',
      '본인 곡 기준 1:1 진행',
      '믹싱·마스터링 단계 멘토 효과 큼',
      '첫 상담 무료',
    ],
  },
  wedding: {
    title: '축가·이벤트 녹음',
    description: '결혼식 축가·프로포즈·기념일 음원 제작 올인원 패키지.',
    features: [
      '녹음 2시간 + 보컬 튠 + 믹싱·마스터링',
      '올인원 35만원 / 1곡',
      '당일 보정본 수령 가능 (사전 협의)',
      '결혼식·프로포즈 전용 진행 노하우',
    ],
  },
  voice: {
    title: '성우·내레이션 녹음',
    description: '유튜브 내레이션·오디오북·광고 등 깨끗한 목소리 수음에 최적화.',
    features: [
      'Neumann U87AI 등 하이엔드 마이크',
      '노이즈 제어 및 톤 보정',
      '실시간 편집 지원',
      '시간당 10만원 (최소 2시간)',
    ],
  },
  recording: {
    title: '보컬 녹음',
    description: '전담 엔지니어와 함께 단곡부터 앨범까지. 디렉팅·마이크 포지셔닝 포함.',
    features: [
      '보컬 1프로 25만원 (3시간 기준)',
      '시간당 10만원 · 6시간 Day Lock 50만원',
      '전담 엔지니어 디렉팅 포함',
      'Neumann U87AI 메인 마이크',
    ],
  },
  practice: {
    title: '음악연습실',
    description: '월세 입주형 개인·보컬·키보드·작곡 연습실. 녹음실과 같은 건물.',
    features: [
      '월 36만원부터 (1년 계약 첫 달 50% 할인)',
      '보컬·키보드·작곡 개인 부스',
      '같은 건물에서 녹음 연계 가능',
      '시간 대여·합주실은 운영하지 않음',
    ],
  },
};

const isServiceType = (v: string): v is ServiceType =>
  v === 'wedding' || v === 'voice' || v === 'lesson' || v === 'recording' || v === 'practice';

/**
 * 본문 안 서비스 강조 박스. %%service:<type>%% short-code로 트리거.
 * 한국어 본문은 KO_CONTENT의 제목·설명·features를 사용. 다른 locale은 nav 라벨 + 일반 안내로 폴백.
 * 1차 CTA: 카카오톡 solid · 2차 CTA: 서비스 상세 페이지 텍스트 링크.
 */
const InlineServiceCallout = ({ type, locale }: InlineServiceCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  if (!isServiceType(type)) return null;

  const Icon = SERVICE_ICONS[type];
  const path = SERVICE_PATHS[type];
  const categoryLabel = t(SERVICE_LABEL_KEYS[type]);
  const koContent = KO_CONTENT[type];
  const isKo = locale === 'ko';

  const title = isKo ? koContent.title : categoryLabel;
  const description = isKo
    ? koContent.description
    : t(`stories.inline.serviceBody.${type}`, {
        defaultValue: t('stories.inline.serviceBodyDefault', { defaultValue: '연관 서비스 자세히 알아보기.' }),
      });
  const features = isKo ? koContent.features : [];

  return (
    <aside
      data-inline-callout="service"
      aria-label={categoryLabel}
      className="my-8 rounded-xl border border-secondary/30 bg-secondary/5 p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="inline-flex items-center justify-center p-1.5 rounded-full bg-secondary/15"
          aria-hidden="true"
        >
          <Icon className="text-secondary dark:text-secondary-light" size={14} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-secondary dark:text-secondary-light">
          {categoryLabel}
        </span>
      </div>

      <h4 className="typo-card-subtitle text-gray-900 dark:text-white mb-2">
        {title}
      </h4>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {description}
      </p>

      {features.length > 0 && (
        <ul className="space-y-1.5 mb-5">
          {features.map((f, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <CheckCircle2
                className="flex-shrink-0 mt-0.5 text-secondary dark:text-secondary-light"
                size={16}
                aria-hidden="true"
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackLeadEvent('lead_click_kakao', {
              locale,
              component: 'InlineServiceCallout',
              cta_id: `inline_service_${type}_kakao`,
              service_type: type,
            })
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:bg-secondary-dark transition-colors min-h-[44px] touch-manipulation"
        >
          {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
        <Link
          href={`/${locale}${path}`}
          prefetch={false}
          onClick={() =>
            trackMicroEvent('micro_click_service', {
              locale,
              component: 'InlineServiceCallout',
              cta_id: `inline_service_${type}_detail`,
              service_type: type,
            })
          }
          className="inline-flex items-center gap-1 text-sm font-semibold text-secondary dark:text-secondary-light hover:underline min-h-[44px] touch-manipulation"
        >
          {t('stories.inline.serviceDetail', { defaultValue: '서비스 자세히 보기' })}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
};

export default React.memo(InlineServiceCallout);
