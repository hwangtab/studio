import type { StoryCTAOverride } from '../types/story';

interface ResolveStoryCTATypeInput {
  slug: string;
  categoryKey?: string;
  override?: StoryCTAOverride;
}

// 작곡·편곡·코드·MIDI·비트메이킹 — 2026-09-25까지 연습실(practice) CTA였다(5월 규칙, 65093cc192).
// 그땐 레슨이 주력 상품이 아니었다. 지금 이 주제의 짝은 1:1 프로듀싱 레슨(미디·작곡·편곡)이라
// lesson으로 보낸다(운영자 결정 2026-09-25). 이름은 무엇을 가리키는지로 바꿨다.
const COMPOSITION_SLUG_PATTERN = /(^|[-_])(compos|songwrit|arrang|chord|midi|beatmak|producer|creative-?block|melody(?!ne)|topline)/i;
// 프로듀싱 레슨(미디·작곡·믹싱)이 맞는 학습 주제만. 발성 항목(breath·belting·falsetto·
// vibrato·head/chest/mix-voice·vocal-range·posture·warmup·articulation·ear/pitch/sight…)은
// 2026-09-04에 걷어냈다 — 스튜디오는 보컬·악기 레슨을 하지 않는다(CLAUDE.md "보컬·악기
// 레슨은 없다"). 슬러그가 lesson을 가리켜도 vocal 카테고리는 아래 가드가 막는다.
const LESSON_SLUG_PATTERN = /(^|[-_])(lesson|tutor|train(ing)?|beginner)/i;
// mix(?!…voice): mixvoice1·mixedvoice1·mix-voice-*는 발성(믹스 보이스) 글이라 믹싱 CTA에서 제외.
const PRODUCTION_SLUG_PATTERN = /(^|[-_])(mix(?!(-?ed)?-?voice)|master(ing)?|eq[-_]|compress|reverb|delay|chorus-effect|de-?esser|sidechain|loudness|limiter|stereo-?imag|automation|bus-?comp|808-bass|ai-master|auto-?tune|autotune|clipper)/i;
const RECORDING_SLUG_PATTERN = /(^|[-_])(record(ing)?|mic[-_]|demo-?tape|tracking|punch-?in|comping|studio-?record|takes)/i;
// 발매·유통·스트리밍 등록 계열. `live-streaming`은 공연 중계지 음원 유통이 아니라 제외한다.
const RELEASE_SLUG_PATTERN =
  /(^|[-_])(release|distribut|(?<!live-)streaming|spotify|melon|playlist|publish|royalt|sync-licens|epk|music-pr\d*$|chart)/i;

const getCategoryFallbackCTA = (categoryKey: string | undefined): StoryCTAOverride => {
  switch (categoryKey) {
    case 'instrument':
    case 'region':
      return 'practice';
    // 음악 제작(작곡·DAW) 카테고리 — 2026-09-25에 practice → lesson(위 COMPOSITION 주석과 같은 결정).
    case 'production':
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
// 사업 규칙: 보컬 카테고리 글은 어떤 경로(frontmatter override·슬러그 패턴·카테고리
// 폴백)로도 lesson CTA를 받지 않는다. 우리 레슨은 프로듀싱 레슨이고 보컬 발성 코칭은
// 미제공이라, 발성 글 독자에게 레슨을 권하면 없는 서비스를 광고하는 것이 된다.
// 2026-09-03 전수 확인에서 76편이 이렇게 새고 있었다(docs/ctr-surgery-log.md).
// 이 규칙은 주석이 아니라 코드와 content/vocalCategoryNoLesson.test.ts가 든다.
const VOCAL_LESSON_GUARD_FALLBACK: StoryCTAOverride = 'recording';

export const resolveStoryCTAType = (input: ResolveStoryCTATypeInput): StoryCTAOverride => {
  const resolved = resolveStoryCTATypeUnguarded(input);
  if (input.categoryKey === 'vocal' && resolved === 'lesson') return VOCAL_LESSON_GUARD_FALLBACK;
  return resolved;
};

const resolveStoryCTATypeUnguarded = ({
  slug,
  categoryKey,
  override,
}: ResolveStoryCTATypeInput): StoryCTAOverride => {
  if (override) return override;
  if (slug.startsWith('practice-room-')) return 'practice';

  // 작곡/편곡/코드/MIDI/비트메이킹 → 프로듀싱 레슨. melody(?!ne)는 Melodyne 같은 mixing 도구를
  // 제외한다. 보컬 카테고리(topline-* 등)만은 연습실을 유지한다 — lesson을 주면 보컬 가드가
  // recording으로 바꾸는데, 작곡 글 독자에게 녹음 세션을 권하는 것보다 기존 판정이 맞다.
  if (COMPOSITION_SLUG_PATTERN.test(slug)) return categoryKey === 'vocal' ? 'practice' : 'lesson';

  // 작곡·미디 입문 등 학습 주제 → 프로듀싱 레슨. (vocal 카테고리는 상단 가드가 걸러낸다.)
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
