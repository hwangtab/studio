type Translate = (key: string) => string;

export interface QuestionAnswerItem {
  question: string;
  answer: string;
}

export interface HowToStepItem {
  name: string;
  text: string;
}

export const createTranslatedQaItems = (
  t: Translate,
  keyPrefix: string,
  count: number
): QuestionAnswerItem[] => (
  Array.from({ length: count }, (_, index) => ({
    question: t(`${keyPrefix}.${index}.q`),
    answer: t(`${keyPrefix}.${index}.a`),
  }))
);

export const createTranslatedHowToSteps = (
  t: Translate,
  keyPrefix: string,
  count: number
): HowToStepItem[] => (
  Array.from({ length: count }, (_, index) => ({
    name: t(`${keyPrefix}.${index}.title`),
    text: t(`${keyPrefix}.${index}.description`),
  }))
);
