import type { StoryCTAOverride } from '../types/story';

interface ResolveStoryCTATypeInput {
  slug: string;
  categoryKey?: string;
  override?: StoryCTAOverride;
}

const PRACTICE_SLUG_PATTERN = /(^|[-_])(compos|songwrit|arrang|chord|midi|beatmak|producer|creative-?block|melody(?!ne)|topline)/i;
const LESSON_SLUG_PATTERN = /(^|[-_])(lesson|tutor|train(ing)?|beginner|breath|warmup|articulation|posture|pitch-?train|ear-?train|sight-?read|belting|falsetto|vibrato|head-?voice|chest-?voice|mix-?voice|mixed-?voice|vocal-?range|harmony-?sing)/i;
const PRODUCTION_SLUG_PATTERN = /(^|[-_])(mix|master(ing)?|eq[-_]|compress|reverb|delay|chorus-effect|de-?esser|sidechain|loudness|limiter|stereo-?imag|automation|bus-?comp|808-bass|ai-master|auto-?tune|autotune|clipper)/i;
const RECORDING_SLUG_PATTERN = /(^|[-_])(record(ing)?|mic[-_]|demo-?tape|tracking|punch-?in|comping|studio-?record|takes)/i;

const getCategoryFallbackCTA = (categoryKey: string | undefined): StoryCTAOverride => {
  switch (categoryKey) {
    case 'instrument':
    case 'region':
    case 'production':
      return 'practice';
    case 'lesson':
      return 'lesson';
    case 'mixing':
    case 'business':
      return 'production';
    case 'recording':
    case 'vocal':
    case 'feedback':
    case 'event':
    default:
      return 'recording';
  }
};

/**
 * 글 주제 -> CTA 매칭. slug 키워드 우선, categoryKey 폴백 모두 deterministic.
 * frontmatter `cta`가 있으면 작가 명시값을 우선한다.
 */
export const resolveStoryCTAType = ({
  slug,
  categoryKey,
  override,
}: ResolveStoryCTATypeInput): StoryCTAOverride => {
  if (override) return override;
  if (slug.startsWith('practice-room-')) return 'practice';

  // 작곡/편곡/코드/MIDI/비트메이킹은 24시간 작업 환경(음악연습실 월세) 페어링.
  // melody(?!ne)는 Melodyne 같은 mixing 도구를 제외한다.
  if (PRACTICE_SLUG_PATTERN.test(slug)) return 'practice';

  // 보컬 테크닉은 vocal 카테고리 폴백보다 lesson이 의도에 더 맞는다.
  // lesson이 production보다 앞에 있어야 mix-voice가 mixing CTA로 가지 않는다.
  if (LESSON_SLUG_PATTERN.test(slug)) return 'lesson';

  // amp-sim은 recording 가이드 위치라 production 패턴에서 제외하고 카테고리 폴백을 따른다.
  if (PRODUCTION_SLUG_PATTERN.test(slug)) return 'production';
  if (RECORDING_SLUG_PATTERN.test(slug)) return 'recording';

  return getCategoryFallbackCTA(categoryKey);
};
