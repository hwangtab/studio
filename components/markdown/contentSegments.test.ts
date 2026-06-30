import { splitContentByShortcodes } from './contentSegments';

describe('splitContentByShortcodes', () => {
  it('splits markdown and standalone shortcodes while preserving shortcode args', () => {
    expect(splitContentByShortcodes('Intro\n%%price:recording%%\nOutro')).toEqual([
      { type: 'markdown', value: 'Intro' },
      { type: 'shortcode', name: 'price', arg: 'recording' },
      { type: 'markdown', value: '\nOutro' },
    ]);
  });

  it('ignores whitespace-only markdown segments', () => {
    expect(splitContentByShortcodes('\n%%online-fallback%%\n\n%%session-checklist%%\n')).toEqual([
      { type: 'shortcode', name: 'online-fallback' },
      { type: 'shortcode', name: 'session-checklist' },
    ]);
  });

  it('leaves inline shortcode-looking text as markdown', () => {
    expect(splitContentByShortcodes('Before %%price:recording%% after')).toEqual([
      { type: 'markdown', value: 'Before %%price:recording%% after' },
    ]);
  });
});
