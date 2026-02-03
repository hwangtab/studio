import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { summarizeContent, extractFirstImageUrl } from '../utils/localDataUtils';
import type { Story, StoryDetail, StoryFrontmatter, StoryPath } from '../types/story';

const storiesDirectory: string = path.join(process.cwd(), 'content/stories');

const getStoryFilePath = (slug: string): string =>
  path.join(storiesDirectory, `${slug}.md`);

const stripCodeFenceWrapper = (source: string): string => {
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

const getAllStorySlugs = (): string[] => {
  if (!fs.existsSync(storiesDirectory)) {
    return [];
  }
  return fs
    .readdirSync(storiesDirectory)
    .filter((file: string) => file.endsWith('.md'))
    .map((file: string) => file.replace(/\.md$/, ''));
};

const normalizeDate = (value: string | Date | undefined): string => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const mapStoryFrontmatter = (
  slug: string,
  frontmatter: Record<string, unknown>,
  content: string
): Story => {
  const isoDate = normalizeDate(frontmatter?.date as string | Date | undefined);
  const derivedThumbnail = (frontmatter?.thumbnail as string | undefined) || extractFirstImageUrl(content);

  return {
    id: slug,
    slug,
    title: (frontmatter?.title as string) || slug,
    date: isoDate,
    createdAt: isoDate,
    author: (frontmatter?.author as string) || '스튜디오 놀',
    category: (frontmatter?.category as string) || '공지',
    tags: Array.isArray(frontmatter?.tags) ? (frontmatter.tags as string[]) : ['기본'],
    summary: (frontmatter?.summary as string) || summarizeContent(content, 150),
    thumbnail: derivedThumbnail || null,
    thumbnailDerived: !(frontmatter?.thumbnail) && Boolean(derivedThumbnail),
    images: Array.isArray(frontmatter?.images) ? (frontmatter.images as string[]) : [],
  };
};

export const getAllStories = (): Story[] => {
  return getAllStorySlugs()
    .map((slug: string) => {
      const filePath = getStoryFilePath(slug);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const normalized = stripCodeFenceWrapper(fileContents);
      const { data, content } = matter(normalized);
      return mapStoryFrontmatter(slug, data, content);
    })
    .sort((a: Story, b: Story) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getStoryDetail = async (slug: string): Promise<StoryDetail> => {
  const filePath = getStoryFilePath(slug);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const normalized = stripCodeFenceWrapper(fileContents);
  const { data, content } = matter(normalized);
  const baseStory = mapStoryFrontmatter(slug, data, content);
  let contentToProcess = content;

  // If the thumbnail was derived from the content (meaning it's the first image),
  // we remove that image from the content to avoid duplication in the UI (Hero + Content Body).
  if (baseStory.thumbnailDerived && baseStory.thumbnail) {
    const imageRegex = /!\[.*?\]\(([^)]+)\)/;
    const match = contentToProcess.match(imageRegex);
    if (match && match[1] === baseStory.thumbnail) {
      contentToProcess = contentToProcess.replace(match[0], '');
    }
  }

  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(html)
    .process(contentToProcess);

  return {
    ...baseStory,
    content: contentToProcess,
    contentHtml: processedContent.toString(),
  };
};

export const getStoryPaths = (): StoryPath[] =>
  getAllStorySlugs().map((slug: string) => ({ params: { id: slug } }));
