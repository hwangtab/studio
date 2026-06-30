import { createTranslatedHowToSteps, createTranslatedQaItems } from './translatedList';

const t = (key: string) => `translated:${key}`;

describe('createTranslatedQaItems', () => {
  it('builds question and answer items from an indexed translation prefix', () => {
    expect(createTranslatedQaItems(t, 'voiceActing.faq.items', 2)).toEqual([
      {
        question: 'translated:voiceActing.faq.items.0.q',
        answer: 'translated:voiceActing.faq.items.0.a',
      },
      {
        question: 'translated:voiceActing.faq.items.1.q',
        answer: 'translated:voiceActing.faq.items.1.a',
      },
    ]);
  });
});

describe('createTranslatedHowToSteps', () => {
  it('builds schema HowTo step items from an indexed translation prefix', () => {
    expect(createTranslatedHowToSteps(t, 'coverVideo.process.steps', 2)).toEqual([
      {
        name: 'translated:coverVideo.process.steps.0.title',
        text: 'translated:coverVideo.process.steps.0.description',
      },
      {
        name: 'translated:coverVideo.process.steps.1.title',
        text: 'translated:coverVideo.process.steps.1.description',
      },
    ]);
  });
});
