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

  it('keeps vocal technique topics on the lesson CTA before mixing matches', () => {
    expect(resolveStoryCTAType({ slug: 'mix-voice-training', categoryKey: 'vocal' })).toBe('lesson');
    expect(resolveStoryCTAType({ slug: 'belting-warmup-routine', categoryKey: 'recording' })).toBe('lesson');
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
