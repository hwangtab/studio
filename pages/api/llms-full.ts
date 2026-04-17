import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { locales, type Locale } from '../../lib/i18n';

const HEADER_LABELS: Record<Locale, string> = {
  ko: 'Korean',
  en: 'English',
  zh: 'Chinese Simplified',
  es: 'Spanish',
  vi: 'Vietnamese',
  th: 'Thai',
  uz: 'Uzbek',
};

const formatStoryLine = (siteUrl: string, locale: Locale, story: { title: string; slug: string; date: string; summary: string; category: string; tags: string[] }) => {
  const url = `${siteUrl}/${locale}/stories/${story.slug}`;
  const parts: string[] = [];
  parts.push(`- [${story.title}](${url})`);
  if (story.date) parts.push(` · ${story.date.slice(0, 10)}`);
  if (story.category) parts.push(` · ${story.category}`);
  if (story.tags && story.tags.length > 0) parts.push(` · tags: ${story.tags.slice(0, 6).join(', ')}`);
  if (story.summary) {
    const short = story.summary.replace(/\s+/g, ' ').trim().slice(0, 220);
    parts.push(`\n    ${short}`);
  }
  return parts.join('');
};

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const siteConfig = getSiteConfig('ko');
  const siteUrl = siteConfig.url;

  let body = `# Studio NOL — Full Content Index (llms-full.txt)

Source site: ${siteUrl}
Purpose: Comprehensive, machine-readable index of Studio NOL content for AI search engines (ChatGPT, Perplexity, Claude, Gemini) and LLM crawlers.
Studio NOL is a professional music production studio in Yeonsinnae, Seoul. Services: recording, mixing, mastering, practice room residency, music lessons, album production, wedding song & voice acting recording.

- Primary sitemap: ${siteUrl}/sitemap.xml
- Short version: ${siteUrl}/llms.txt
- RSS (KO): ${siteUrl}/api/rss?locale=ko
- RSS (EN): ${siteUrl}/api/rss?locale=en
- Supported Languages: ko, en, zh, es, vi, th, uz

`;

  for (const locale of locales) {
    const stories = getAllStories(locale);
    if (stories.length === 0) continue;
    body += `\n## Stories — ${HEADER_LABELS[locale]} (${locale}) · ${stories.length} entries\n\n`;
    for (const story of stories) {
      body += formatStoryLine(siteUrl, locale, story) + '\n';
    }
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.status(200).send(body);
}
