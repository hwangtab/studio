import type { LucideIcon } from '@/lib/lucide-icons';
import { BookOpen, Clock, Disc, GraduationCap, Globe, Layers, Lightbulb, MapPin, Mic2, Music, Piano, Send, Settings, Speaker } from '@/lib/lucide-icons';
import { ARRANGEMENT_SMALL_PRICE, CUSTOM_MR_PRICE, formatPriceLabel } from '../data/pricing';
import type { Locale } from './i18n';

/**
 * 스토리 하단 CTA의 내용 정본 — 카테고리는 **색이 아니라 내용**(아이콘·문구·목적지)으로만 갈린다.
 *
 * 모양은 components/StoryCTA.tsx 하나가 디자인 시스템 토큰으로 그린다(2026-10-09 운영자 "통합관리 가능하게 기준을").
 * 예전엔 유형마다 보라·주황·청록·남색·빨강·자주 그라디언트와 흰 버튼을 따로 들고 있어, 파랑 = 누를 수 있는 것
 * 규칙과 따로 놀았다. 유형을 늘릴 때는 여기에 한 줄을 더하고 `stories.cta.<type>.*` 문구 키를 7개 로케일에 넣는다.
 *
 * 목적지: 주 버튼은 그 유형의 서비스 LP, 보조 버튼은 /contact(전 유형 공통). 둘 다 내부 이동이라 추적은
 * micro_click_service / micro_click_contact다(리드 아님 — StoryCTA의 trackCtaClick 주석).
 */
export type CTAType = 'recording' | 'lesson' | 'practice' | 'production' | 'release' | 'arrangement';

export interface StoryCtaSpec {
  /** 제목 위 아이콘 줄 — 회색 장식. 셋까지. */
  icons: readonly LucideIcon[];
  /** 주 버튼 목적지(로케일 접두 없이). */
  primaryPath: string;
  /** 설명 첫 줄에 보간할 값 — 가격은 data/pricing.ts 상수에서만 온다. */
  descriptionLine1Params?: (locale: Locale) => Record<string, string>;
}

export const STORY_CTA_SECONDARY_PATH = '/contact';

export const STORY_CTA: Record<CTAType, StoryCtaSpec> = {
  // /pricing이 아니라 녹음 LP — 상업 쿼리에서 LP CTR이 스토리의 2.85배였는데 CTA가 전부 /pricing·/contact로만
  // 가서 LP가 내부링크를 못 받고 있었다(2026-08-09 감사).
  recording: { icons: [Mic2, Settings, Music], primaryPath: '/recording' },
  lesson: { icons: [BookOpen, Lightbulb, GraduationCap], primaryPath: '/lesson' },
  practice: { icons: [MapPin, Clock, Speaker], primaryPath: '/practice-room' },
  production: { icons: [Music, Mic2, Settings], primaryPath: '/mixing-mastering' },
  release: { icons: [Disc, Send, Globe], primaryPath: '/release-project' },
  arrangement: {
    icons: [Piano, Layers, Music],
    primaryPath: '/composition-arrangement',
    descriptionLine1Params: (locale) => ({
      small: formatPriceLabel(ARRANGEMENT_SMALL_PRICE, locale),
      mr: formatPriceLabel(CUSTOM_MR_PRICE, locale),
    }),
  },
};
