import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { summarizeContent, extractFirstImageUrl } from '../utils/localDataUtils';

const storiesDirectory = path.join(process.cwd(), 'content/stories');

const getStoryFilePath = (slug) => path.join(storiesDirectory, `${slug}.md`);

const stripCodeFenceWrapper = (source) => {
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

const getAllStorySlugs = () => {
  if (!fs.existsSync(storiesDirectory)) {
    return [];
  }
  return fs
    .readdirSync(storiesDirectory)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''));
};

const normalizeDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const mapStoryFrontmatter = (slug, frontmatter, content) => {
  const isoDate = normalizeDate(frontmatter?.date);
  return {
    id: slug,
    slug,
    title: frontmatter?.title || slug,
    date: isoDate,
    createdAt: isoDate,
    author: frontmatter?.author || '스튜디오 놀',
    category: frontmatter?.category || '공지',
    tags: Array.isArray(frontmatter?.tags) ? frontmatter.tags : ['기본'],
    summary: frontmatter?.summary || summarizeContent(content, 150),
    thumbnail: frontmatter?.thumbnail || extractFirstImageUrl(content),
    images: Array.isArray(frontmatter?.images) ? frontmatter.images : [],
  };
};

export const getAllStories = () => {
  return getAllStorySlugs()
    .map((slug) => {
      const filePath = getStoryFilePath(slug);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const normalized = stripCodeFenceWrapper(fileContents);
      const { data, content } = matter(normalized);
      return {
        ...mapStoryFrontmatter(slug, data, content),
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const getStoryDetail = async (slug) => {
  const filePath = getStoryFilePath(slug);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const normalized = stripCodeFenceWrapper(fileContents);
  const { data, content } = matter(normalized);
  const baseStory = mapStoryFrontmatter(slug, data, content);
  const processedContent = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(html)
    .process(content);

  return {
    ...baseStory,
    content,
    contentHtml: processedContent.toString(),
  };
};

export const getStoryPaths = () => getAllStorySlugs().map((slug) => ({ params: { id: slug } }));
