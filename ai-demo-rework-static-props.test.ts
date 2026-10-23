/** @jest-environment node */

import { getStaticProps } from './pages/[locale]/ai-demo-rework';
import type { AiReworkPriceLabels } from './data/aiRework';
import type { Locale } from './lib/i18n';
import type { StoryCardData } from './types/story';

describe('ai-demo-rework static props', () => {
  it('returns localized price labels and related stories', async () => {
    const result = await getStaticProps({ params: { locale: 'ko' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const props = result.props as {
      locale: Locale;
      priceLabels: AiReworkPriceLabels;
      relatedStories: StoryCardData[];
    };

    expect(props.locale).toBe('ko');
    expect(props.priceLabels.vocalOnly).toBe('25만원');
    expect(props.relatedStories.some((story) => story.slug === 'suno-ai-song-rework1')).toBe(true);
  });
});
