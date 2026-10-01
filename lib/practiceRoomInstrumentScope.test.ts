import { isUnsupportedPracticeInstrumentSlug } from './practiceRoomInstrumentScope';
import { resolveStoryCTAType } from './storyCtaPolicy';
import { matchServiceForStory } from './storyAutoFallback';

describe('연습실은 드럼·관악기를 받지 않는다', () => {
  it.each([
    'practice-room-drum-fill1',
    'practice-room-wind1',
    'practice-room-saxophone21',
    'practice-room-trumpet1',
    'practice-room-percussion1',
  ])('%s는 연습실 CTA·브릿지를 받지 않는다', (slug) => {
    expect(isUnsupportedPracticeInstrumentSlug(slug)).toBe(true);
    expect(resolveStoryCTAType({ slug, categoryKey: 'instrument' })).not.toBe('practice');
    expect(resolveStoryCTAType({ slug, categoryKey: 'instrument', override: 'practice' })).not.toBe('practice');
    expect(matchServiceForStory('instrument', slug)).toBeNull();
  });

  it.each(['practice-room-drumless1', 'practice-room-piano1', 'practice-room-guitar1'])(
    '%s는 그대로 연습실 오퍼를 받는다',
    (slug) => {
      expect(isUnsupportedPracticeInstrumentSlug(slug)).toBe(false);
      expect(resolveStoryCTAType({ slug, categoryKey: 'instrument' })).toBe('practice');
    },
  );
});
