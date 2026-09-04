import { resolveStoryCTAType } from './storyCtaPolicy';

describe('resolveStoryCTAType', () => {
  it('uses explicit frontmatter CTA before automatic rules', () => {
    expect(resolveStoryCTAType({
      slug: 'practice-room-mapo',
      categoryKey: 'region',
      override: 'production',
    })).toBe('production');
  });

  it('pairs practice-room and songwriting topics with the practice-room CTA', () => {
    expect(resolveStoryCTAType({ slug: 'practice-room-hongdae', categoryKey: 'recording' })).toBe('practice');
    expect(resolveStoryCTAType({ slug: 'topline-melody-writing', categoryKey: 'vocal' })).toBe('practice');
  });

  it('never sends vocal-category stories to the lesson CTA — no vocal lessons are offered', () => {
    // 슬러그가 lesson 패턴에 걸려도 vocal 카테고리는 recording으로.
    expect(resolveStoryCTAType({ slug: 'vocal-lesson1', categoryKey: 'vocal' })).toBe('recording');
    expect(resolveStoryCTAType({ slug: 'kpop-trainee1', categoryKey: 'vocal' })).toBe('recording');
    // frontmatter가 lesson을 명시해도 가드가 이긴다.
    expect(resolveStoryCTAType({ slug: 'belting1', categoryKey: 'vocal', override: 'lesson' })).toBe('recording');
    // 발성 항목은 더 이상 lesson 패턴이 아니다(카테고리 폴백을 따른다).
    expect(resolveStoryCTAType({ slug: 'mix-voice-training', categoryKey: 'vocal' })).toBe('recording');
    expect(resolveStoryCTAType({ slug: 'belting-warmup-routine', categoryKey: 'recording' })).toBe('recording');
    // '믹스 보이스'는 믹싱이 아니다 — mix 패턴의 예외.
    expect(resolveStoryCTAType({ slug: 'mixedvoice1', categoryKey: 'vocal' })).toBe('recording');
    expect(resolveStoryCTAType({ slug: 'mix-voice-training', categoryKey: 'vocal' })).toBe('recording');
    expect(resolveStoryCTAType({ slug: 'vocal-mixing1', categoryKey: 'vocal' })).toBe('production');
  });

  it('still pairs producing-lesson topics with the lesson CTA outside the vocal category', () => {
    // midi-*는 PRACTICE 패턴이 먼저 잡는다(설계) — 연습실 항목이 없는 학습 슬러그로 검증.
    expect(resolveStoryCTAType({ slug: 'beginner-lesson-guide', categoryKey: 'production' })).toBe('lesson');
    expect(resolveStoryCTAType({ slug: 'daw-tutorial1', categoryKey: 'lesson' })).toBe('lesson');
  });

  it('routes mixing topics to production without catching excluded recording tools', () => {
    expect(resolveStoryCTAType({ slug: 'melodyne-pitch-correction', categoryKey: 'mixing' })).toBe('production');
    expect(resolveStoryCTAType({ slug: 'amp-simulator1', categoryKey: 'recording' })).toBe('recording');
  });

  it('routes release and distribution topics to the release project', () => {
    for (const slug of [
      'distribution1',
      'music-distribution1',
      'streaming-platforms1',
      'playlist-pitch1',
      'melon-chart1',
      'spotify-canvas1',
      'album-release1',
      'music-publishing1',
      'royalty1',
      'sync-licensing1',
      'epk1',
      'music-pr1',
    ]) {
      expect(resolveStoryCTAType({ slug, categoryKey: 'business' })).toBe('release');
    }
  });

  it('keeps release-adjacent slugs that are not distribution topics on their own CTA', () => {
    // 공연 중계는 음원 유통이 아니다 — live-streaming은 release 패턴에서 제외된다.
    expect(resolveStoryCTAType({ slug: 'live-streaming-music1', categoryKey: 'business' })).toBe('production');
    // 기술 가이드가 먼저 판정된다 — release 패턴이 믹싱·녹음 판정을 빼앗지 않는다.
    expect(resolveStoryCTAType({ slug: 'mastering-release-loudness', categoryKey: 'business' })).toBe('production');
    expect(resolveStoryCTAType({ slug: 'recording-release-prep', categoryKey: 'business' })).toBe('recording');
    // 발매와 무관한 business 글은 카테고리 폴백을 그대로 따른다.
    expect(resolveStoryCTAType({ slug: 'music-tax1', categoryKey: 'business' })).toBe('production');
    expect(resolveStoryCTAType({ slug: 'store-bgm1', categoryKey: 'business' })).toBe('production');
  });

  it('falls back by category when slug keywords are not decisive', () => {
    expect(resolveStoryCTAType({ slug: 'jazz-harmony-guide', categoryKey: 'production' })).toBe('practice');
    expect(resolveStoryCTAType({ slug: 'music-business-contract', categoryKey: 'business' })).toBe('production');
    expect(resolveStoryCTAType({ slug: 'studio-open-day', categoryKey: 'event' })).toBe('recording');
  });
});
