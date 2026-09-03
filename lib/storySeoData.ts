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

const META_DESCRIPTION_MAX_LENGTH = 160;
const META_DESCRIPTION_ELLIPSIS = '…';
// 문장부호(., !, ?, 다., 요.) 우선 → 공백 → 하드 절단, 순서로 자연스러운 경계를 찾는다.
// 최종 길이(말줄임표 포함)는 항상 META_DESCRIPTION_MAX_LENGTH를 넘지 않는다.
// 숫자 뒤 마침표("1. ", "2. ")는 마크다운 번호목록 표기이지 문장 종결이 아니다 —
// (?<![0-9])로 배제한다. 대안(경계가 limit 절반보다 앞이면 공백 폴백)은 번호목록이
// 아닌 정상 짧은 문장 뒤 truncate까지 함께 공백 폴백으로 밀어내 과도하게 짧아질
// 수 있어 채택하지 않았다 — 원인(숫자 뒤 마침표)을 직접 배제하는 쪽이 부작용이 적다.
const SENTENCE_BOUNDARY_RE = /(?<![0-9])[.!?](?=\s|$)|다\.|요\./g;

export const buildStoryMetaDescription = (content: string | null | undefined): string => {
  const plainText = stripMarkdown(content || '');

  if (plainText.length <= META_DESCRIPTION_MAX_LENGTH) return plainText;

  const limit = META_DESCRIPTION_MAX_LENGTH - META_DESCRIPTION_ELLIPSIS.length;
  const truncated = plainText.substring(0, limit);

  let lastSentenceEnd = -1;
  let match: RegExpExecArray | null;
  SENTENCE_BOUNDARY_RE.lastIndex = 0;
  while ((match = SENTENCE_BOUNDARY_RE.exec(truncated)) !== null) {
    lastSentenceEnd = match.index + match[0].length;
  }
  if (lastSentenceEnd > 0) {
    return `${truncated.substring(0, lastSentenceEnd)}${META_DESCRIPTION_ELLIPSIS}`;
  }

  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return `${truncated.substring(0, lastSpace)}${META_DESCRIPTION_ELLIPSIS}`;
  }

  return `${truncated}${META_DESCRIPTION_ELLIPSIS}`;
};

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
