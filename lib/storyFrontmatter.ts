import type { StoryCTAOverride, StoryFAQItem, StoryHowTo } from '../types/story';
import { STORY_CTA_OVERRIDES } from '../types/story';

const STORY_CTA_OVERRIDE_SET = new Set<string>(STORY_CTA_OVERRIDES);

export const normalizeStoryCTAOverride = (raw: unknown): StoryCTAOverride | undefined => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  return STORY_CTA_OVERRIDE_SET.has(trimmed) ? (trimmed as StoryCTAOverride) : undefined;
};

export const normalizeStoryFaq = (raw: unknown): StoryFAQItem[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const faq = raw.filter(
    (item): item is StoryFAQItem =>
      typeof item?.q === 'string' && typeof item?.a === 'string'
  );
  return faq.length > 0 ? faq : undefined;
};

export const normalizeStoryHowTo = (raw: unknown): StoryHowTo | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as {
    name?: unknown;
    description?: unknown;
    totalTime?: unknown;
    steps?: unknown;
  };
  const rawSteps = Array.isArray(candidate.steps) ? candidate.steps : [];
  const steps = rawSteps
    .filter((step): step is { name: unknown; text: unknown; image?: unknown } =>
      Boolean(step) && typeof step === 'object'
    )
    .map((step) => ({
      name: typeof step.name === 'string' ? step.name : '',
      text: typeof step.text === 'string' ? step.text : '',
      ...(typeof step.image === 'string' && { image: step.image }),
    }))
    .filter((step) => step.name.length > 0 && step.text.length > 0);

  if (steps.length === 0) return undefined;
  return {
    ...(typeof candidate.name === 'string' && { name: candidate.name }),
    ...(typeof candidate.description === 'string' && { description: candidate.description }),
    ...(typeof candidate.totalTime === 'string' && { totalTime: candidate.totalTime }),
    steps,
  };
};

export const stripCodeFenceWrapper = (source: string): string => {
  if (!source) return '';
  const trimmed = source.trimStart();
  if (!trimmed.startsWith('```')) {
    return source;
  }

  const lines = trimmed.split(/\r?\n/);
  const opening = lines[0].trim();
  if (!opening.startsWith('```')) {
    return source;
  }

  let closingIndex = lines.length - 1;
  while (closingIndex > 0 && !lines[closingIndex].trim().startsWith('```')) {
    closingIndex -= 1;
  }

  if (closingIndex <= 0) {
    return source;
  }

  return lines.slice(1, closingIndex).join('\n');
};
