import {
  normalizeStoryCTAOverride,
  normalizeStoryFaq,
  normalizeStoryHowTo,
  stripCodeFenceWrapper,
} from './storyFrontmatter';

describe('normalizeStoryCTAOverride', () => {
  it('accepts known CTA override values case-insensitively', () => {
    expect(normalizeStoryCTAOverride(' Production ')).toBe('production');
  });

  it('ignores unknown CTA values', () => {
    expect(normalizeStoryCTAOverride('subscribe')).toBeUndefined();
    expect(normalizeStoryCTAOverride(null)).toBeUndefined();
  });
});

describe('normalizeStoryFaq', () => {
  it('keeps only FAQ entries with string question and answer', () => {
    expect(
      normalizeStoryFaq([
        { q: 'Question?', a: 'Answer.' },
        { q: 'Missing answer' },
        { q: 123, a: 'Wrong question type' },
      ])
    ).toEqual([{ q: 'Question?', a: 'Answer.' }]);
  });

  it('returns undefined when no valid FAQ entries exist', () => {
    expect(normalizeStoryFaq([{ q: 'Missing answer' }])).toBeUndefined();
    expect(normalizeStoryFaq('not faq')).toBeUndefined();
  });
});

describe('normalizeStoryHowTo', () => {
  it('normalizes valid HowTo steps and optional metadata', () => {
    expect(
      normalizeStoryHowTo({
        name: 'Prepare a session',
        description: 'Step-by-step setup',
        totalTime: 'PT30M',
        steps: [
          { name: 'Open DAW', text: 'Create a project.', image: '/images/album1.jpg' },
          { name: '', text: 'No name.' },
          { name: 'No text', text: '' },
        ],
      })
    ).toEqual({
      name: 'Prepare a session',
      description: 'Step-by-step setup',
      totalTime: 'PT30M',
      steps: [
        { name: 'Open DAW', text: 'Create a project.', image: '/images/album1.jpg' },
      ],
    });
  });

  it('returns undefined when HowTo has no valid steps', () => {
    expect(normalizeStoryHowTo({ steps: [{ name: 'Only name' }] })).toBeUndefined();
    expect(normalizeStoryHowTo(null)).toBeUndefined();
  });
});

describe('stripCodeFenceWrapper', () => {
  it('unwraps a full-file code fence wrapper', () => {
    expect(stripCodeFenceWrapper('```markdown\n# Title\nBody\n```')).toBe('# Title\nBody');
  });

  it('returns source unchanged when there is no closing fence', () => {
    const source = '```markdown\n# Title';
    expect(stripCodeFenceWrapper(source)).toBe(source);
  });
});
