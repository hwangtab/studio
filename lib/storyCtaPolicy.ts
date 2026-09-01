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
// 발매·유통·스트리밍 등록 계열. `live-streaming`은 공연 중계지 음원 유통이 아니라 제외한다.
const RELEASE_SLUG_PATTERN =
  /(^|[-_])(release|distribut|(?<!live-)streaming|spotify|melon|playlist|publish|royalt|sync-licens|epk|music-pr\d*$|chart)/i;

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

  // 발매·유통 주제는 /release-project로. 믹싱·녹음 패턴 뒤에 두어 기술 가이드의
  // 판정을 빼앗지 않는다. business 카테고리 폴백을 통째로 release로 바꾸지 않는
  // 이유는 그 카테고리에 성우 견적·매장 BGM·커버 아트·세무처럼 발매와 무관한
  // 글이 섞여 있기 때문이다(커버 아트는 발매 프로젝트가 '별도 진행'으로 명시).
  // 본문 중간 숏코드는 storyAutoFallback이 이미 business → release로 주입하고
  // 있어, 이 패턴이 하단 CTA를 같은 오퍼로 맞춘다.
  if (RELEASE_SLUG_PATTERN.test(slug)) return 'release';

  return getCategoryFallbackCTA(categoryKey);
};
