import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Disc, GraduationCap, HandCoins, Heart, Megaphone, Mic, SlidersHorizontal, Speaker, Sparkles, Video } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import {
  ALBUM_BUNDLE_PRICE,
  COVER_VIDEO_PACKAGE_PRICE,
  DAY_LOCK_4H_PRICE,
  DAY_LOCK_8H_PRICE,
  EP_BUNDLE_PRICE,
  formatPriceAmount,
  formatPriceLabel,
  FUNDING_DESIGN_PRICE,
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  LESSON_MONTHLY_PRICE,
  MASTERING_PACKAGE_PRICE,
  MASTERING_SINGLE_PRICE,
  MIXING_LEVEL1_PRICE,
  PRACTICE_ROOM_HOURLY_PRICE_INCL,
  PRACTICE_ROOM_MONTHLY_PRICE,
  RECORDING_HOURLY_PRICE,
  RELEASE_PRESS_INTRO_ENDS_ON,
  RELEASE_PRESS_INTRO_PRICE,
  RELEASE_PRESS_PRICE,
  SINGLE_BUNDLE_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';

type ServiceType = 'wedding' | 'voice' | 'lesson' | 'recording' | 'mixing' | 'practice' | 'release' | 'funding' | 'cover' | 'promotion';

interface InlineServiceCalloutProps {
  type: string;
  locale: Locale;
}

const SERVICE_PATHS: Record<ServiceType, string> = {
  wedding: '/wedding-song',
  voice: '/voice-acting',
  lesson: '/lesson',
  recording: '/recording',
  mixing: '/mixing-mastering',
  practice: '/practice-room',
  release: '/release-project',
  // 펀딩 설계 대행 전용 LP(2026-09-25, ko 전용). 이 콜아웃도 ko에서만 렌더되므로 그대로 링크한다.
  funding: '/crowdfunding-design',
  cover: '/cover-video',
  promotion: '/music-promotion',
};

const SERVICE_ICONS: Record<ServiceType, React.ElementType> = {
  wedding: Heart,
  voice: Mic,
  lesson: GraduationCap,
  recording: Disc,
  mixing: SlidersHorizontal,
  practice: Speaker,
  release: Sparkles,
  funding: HandCoins,
  cover: Video,
  promotion: Megaphone,
};

const SERVICE_LABEL_KEYS: Record<ServiceType, string> = {
  wedding: 'nav.weddingSong',
  voice: 'nav.voiceActing',
  lesson: 'nav.lesson',
  recording: 'nav.recording',
  mixing: 'nav.mixingMastering',
  practice: 'nav.practiceRoom',
  release: 'nav.releaseProject',
  funding: 'stories.inline.serviceLabel.funding',
  cover: 'nav.coverVideo',
  promotion: 'nav.musicPromotion',
};

// 가격은 전부 data/pricing.ts 상수에서 온다. 2026-09-25까지 이 블록은 리터럴이었고
// data/pricing.test.ts의 리터럴 스캔이 data/만 봐서 드리프트가 조용히 쌓여 있었다: 발매
// EP·정규 하한이 번들가 조정 전의 옛 값, 연습실 "시간 대여는 운영하지 않음"(시간제 운영 중),
// 펀딩 "(후불)"(정본은 선불 + 성공 시 수수료). 지금은 그 스캔이 components/inline/도 본다.
const man = (value: number) => formatPriceLabel(value, 'ko');

// 한국어 풍부 콘텐츠. 다른 locale은 fallback (제목만 + generic body, features 없음).
// softNote: 고단가 오퍼(레슨 월정액·발매 수백만)는 정보탐색 독자에게 진입 마찰이 크다.
// 이미 실재하는 "첫 상담/견적 무료"를 앞세워 "등록·계약 전에 그냥 물어봐도 된다"는
// 저마찰 진입로를 명시한다(새 무료 서비스 약속이 아니라 기존 무료 상담의 프레이밍).
const KO_CONTENT: Record<ServiceType, { title: string; description: string; features: string[]; softNote?: string }> = {
  lesson: {
    title: '1:1 프로듀싱 레슨',
    description: '엔지니어와 함께 본인 곡을 단계별로 뜯어보며 개선합니다. 작곡·미디·믹싱 프로듀싱 멘토링.',
    features: [
      `월 ${man(LESSON_MONTHLY_PRICE)} 정액제 (주 1회 60분)`,
      '본인 곡 기준 1:1 진행',
      '믹싱·마스터링 단계 멘토 효과 큼',
      '첫 상담 무료',
    ],
    softNote: '월 정액이 부담되면 등록 전에 궁금한 것부터 편하게 물어보세요. 첫 상담은 무료입니다.',
  },
  wedding: {
    title: '축가·이벤트 녹음',
    description: '결혼식 축가·프로포즈·기념일 음원 제작 올인원 패키지.',
    features: [
      '녹음 2시간 + 보컬 튠 + 믹싱·마스터링',
      `올인원 ${man(WEDDING_PACKAGE_PRICE)} / 1곡`,
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
      `시간당 ${man(VOICEOVER_HOURLY_PRICE)} (최소 2시간)`,
    ],
  },
  recording: {
    title: '보컬 녹음',
    description: '전담 엔지니어와 함께 단곡부터 앨범까지. 디렉팅·마이크 포지셔닝 포함.',
    features: [
      `보컬 1프로 ${man(VOCAL_PACKAGE_PRICE)} (3시간 기준)`,
      `시간당 ${man(RECORDING_HOURLY_PRICE)} · Day Lock 4시간 ${man(DAY_LOCK_4H_PRICE)} · 8시간 ${man(DAY_LOCK_8H_PRICE)}`,
      '전담 엔지니어 디렉팅 포함',
      'Neumann U87AI 메인 마이크',
    ],
  },
  mixing: {
    title: '믹싱·마스터링 의뢰',
    description: '파일만 보내면 전국·해외 어디서든 진행. 3~7영업일 안에 완성본을 드립니다.',
    features: [
      `믹싱 곡당 ${man(MIXING_LEVEL1_PRICE)}부터 (트랙 수 기준 3단계)`,
      `마스터링 싱글 ${man(MASTERING_SINGLE_PRICE)} · 4곡 이상 곡당 ${man(MASTERING_PACKAGE_PRICE)}`,
      '기본 2회 수정 포함',
      '파일 전송 비대면 진행 — 방문 불필요',
    ],
    softNote: '트랙 수만 알려주시면 견적을 바로 드립니다. 문의는 무료입니다.',
  },
  practice: {
    title: '음악연습실',
    description: '월세 입주형 개인·보컬·키보드·작곡 연습실. 녹음실과 같은 건물이고, 한두 시간만 필요하면 시간제로도 쓸 수 있습니다.',
    features: [
      `월 ${man(PRACTICE_ROOM_MONTHLY_PRICE)}부터 (1년 계약 첫 달 50% 할인)`,
      `시간제 시간당 ${formatPriceAmount(PRACTICE_ROOM_HOURLY_PRICE_INCL)}원 (부가세 포함, 온라인 예약)`,
      '같은 건물에서 녹음 연계 가능',
      '밴드 합주실은 운영하지 않음',
    ],
  },
  release: {
    title: '음원 발매 프로젝트',
    description: '기획·녹음·믹싱·마스터링·유통·홍보까지, 싱글부터 정규 앨범까지 한 팀이 원스톱으로 함께합니다.',
    features: [
      `싱글 ${man(SINGLE_BUNDLE_PRICE)}부터 · EP ${man(EP_BUNDLE_PRICE)}부터 · 정규 ${man(ALBUM_BUNDLE_PRICE)}부터`,
      '기획 → 녹음 → 믹싱·마스터링 → 유통 원스톱',
      '협력 유통사 연결·발매 등록',
      '아티스트 상황에 맞춘 단계별 진행',
    ],
    softNote: '혼자 발매를 준비하다 막막하면, 계약 전에 예산·일정부터 편하게 물어보세요. 첫 상담 30분은 무료입니다.',
  },
  funding: {
    title: '크라우드펀딩 설계 대행',
    description: '스튜디오 놀 펀딩에 여는 음반 펀딩을 기획부터 페이지까지 맡습니다. 음반 펀딩 수십 건, 누적 약 3억원 규모를 진행해온 방식 그대로.',
    features: [
      `설계비 ${man(FUNDING_DESIGN_PRICE)} · 성공 수수료 없음`,
      `모금액에서 플랫폼 ${FUNDING_PLATFORM_FEE_PERCENT}%·결제 ${FUNDING_PAYMENT_FEE_PERCENT}% 수수료만(부가세 포함)`,
      '스토리텔링·리워드 구성·페이지 제작',
      '목표액 산정과 제작 예산 역산',
      '발매 제작을 맡기지 않아도 의뢰 가능',
    ],
    softNote: '펀딩을 열지 말지부터 고민 중이어도 괜찮습니다. 목표액이 현실적인지 같이 따져보는 것부터 시작해요.',
  },
  // 2026-09-25 추가 — 커버 영상·발매 홍보로 가는 본문 동선이 0~2건이었다.
  cover: {
    title: '커버 영상 촬영 올인원',
    description: '노래 커버 영상을 촬영·녹음·믹싱까지 한 번에 진행하고, 4K 영상과 음원을 함께 드립니다.',
    features: [
      `올인원 ${man(COVER_VIDEO_PACKAGE_PRICE)} (3시간)`,
      '촬영 + 보컬 녹음 + 믹싱',
      '4K 영상 + 음원 파일 납품',
      '조명을 갖춘 스튜디오 촬영',
    ],
  },
  promotion: {
    title: '음원 발매 홍보',
    description: '이미 발매한 음원도 받습니다. 보도자료를 5개 언어로 쓰고 국내외 음악 매체·라디오·레코드숍에 보냅니다.',
    features: [
      `${man(RELEASE_PRESS_INTRO_PRICE)} (${RELEASE_PRESS_INTRO_ENDS_ON}까지 도입가 · 정가 ${man(RELEASE_PRESS_PRICE)})`,
      '보도자료 5개 언어 · 프레스킷 페이지',
      '국내 음악 매체 + 해외 60개국 매체·라디오·레코드숍 발송',
      '발송 리포트 제공 — 기사 게재는 보장하지 않습니다',
    ],
    softNote: '음원을 들은 뒤 보낼 곳이 몇 곳인지 먼저 무료로 세어 드립니다. 비용은 그 숫자를 보신 다음입니다.',
  },
};

const isServiceType = (v: string): v is ServiceType =>
  Object.prototype.hasOwnProperty.call(KO_CONTENT, v);

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

  // ko 전용 컴포넌트다 — MarkdownRenderer가 비-ko 로케일에서 inline directive 자체를
  // 렌더하지 않는다(MarkdownRenderer.tsx:395, Phase 1 spec 9). 예전엔 `isKo ? ko : t(...)`
  // 분기가 있었지만 비-ko 경로가 도달 불가라, 그 분기가 쓰던 stories.inline.serviceBody.*
  // 번역 키도 함께 죽어 있었다. locale은 t()·경로 조립에 여전히 필요해 prop으로 남긴다.
  const title = koContent.title;
  const description = koContent.description;
  const features = koContent.features;

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

      {koContent.softNote && (
        <p className="text-sm text-secondary dark:text-secondary-light mb-4 font-medium">
          💬 {koContent.softNote}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button asChild variant="kakao" shape="pill" size="md">
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
            className="gap-1.5 h-auto min-h-[44px] px-4 py-2.5 text-sm font-bold touch-manipulation"
          >
            {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </Button>
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
          className="inline-flex items-center gap-1 text-sm font-semibold text-secondary dark:text-secondary-light hover:underline min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          {t('stories.inline.serviceDetail', { defaultValue: '서비스 자세히 보기' })}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
};

export default React.memo(InlineServiceCallout);
