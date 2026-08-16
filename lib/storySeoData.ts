import { stripMarkdown } from '../utils/textUtils';
import {
  generateFaqSchema,
  generateHowToSchema,
  generatePracticeRoomMonthlyRentSchema,
} from '../utils/schema';
import type { Locale } from './i18n';
import type { StoryDetail } from '../types/story';

type StorySchemaSource = Pick<StoryDetail, 'slug' | 'title' | 'summary' | 'faq' | 'howTo'>;

interface BuildStoryExtraSchemasInput {
  story: StorySchemaSource;
  locale: Locale;
  siteUrl: string;
}

interface StoryDynamicOgImageInput {
  title: string;
  category?: string;
  date?: string;
  locale: Locale;
}

export const getStoryWordCount = (
  content: string | null | undefined,
  locale: Locale
): number | undefined => {
  if (!content) return undefined;
  const plainText = stripMarkdown(content);

  // CJK/Thai 등 공백 기반 어절 계산이 과소 집계되는 로케일은 비공백 글자 수로 맞춘다.
  if (locale === 'ko' || locale === 'zh' || locale === 'th') {
    return plainText.replace(/\s+/g, '').length;
  }

  return plainText.split(/\s+/).filter(Boolean).length;
};

export const buildStoryMetaDescription = (content: string | null | undefined): string => (
  stripMarkdown(content || '').substring(0, 160)
);

export const buildStoryDynamicOgImage = ({
  title,
  category,
  date,
  locale,
}: StoryDynamicOgImageInput): string => (
  `/api/og/story?title=${encodeURIComponent(title)}&category=${encodeURIComponent(category || '')}&date=${encodeURIComponent(date || '')}&locale=${locale}`
);

export const buildStoryExtraSchemas = ({
  story,
  locale,
  siteUrl,
}: BuildStoryExtraSchemasInput): Record<string, unknown>[] | undefined => {
  const schemas: Record<string, unknown>[] = [];

  if (story.faq && story.faq.length > 0) {
    const faqSchema = generateFaqSchema(
      story.faq.map((item) => ({ question: item.q, answer: item.a })),
      locale
    );
    if (faqSchema) schemas.push(faqSchema);
  }

  // frontmatter howTo가 있는 글만 발행한다. 자동 추출은 false-positive 위험이 크다.
  if (story.howTo && story.howTo.steps.length > 0) {
    schemas.push(generateHowToSchema(
      story.howTo.name || story.title,
      story.howTo.description || story.summary,
      story.howTo.steps,
      story.howTo.totalTime,
      locale,
      // frontmatter howTo.tools에 적힌 경우에만 발행. 없으면 tool을 아예 생략한다.
      story.howTo.tools
    ));
  }

  if (story.slug.startsWith('practice-room-') && locale === 'ko') {
    schemas.push(generatePracticeRoomMonthlyRentSchema(
      `${siteUrl}/${locale}/stories/${story.slug}`,
      locale
    ));
  }

  return schemas.length > 0 ? schemas : undefined;
};
