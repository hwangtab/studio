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

  it('falls back by category when slug keywords are not decisive', () => {
    expect(resolveStoryCTAType({ slug: 'jazz-harmony-guide', categoryKey: 'production' })).toBe('practice');
    expect(resolveStoryCTAType({ slug: 'music-business-contract', categoryKey: 'business' })).toBe('production');
    expect(resolveStoryCTAType({ slug: 'studio-open-day', categoryKey: 'event' })).toBe('recording');
  });
});
