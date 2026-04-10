import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getAllStories } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { locales, type Locale } from '../../lib/i18n';
import { defaultLocale } from '../../lib/i18n-config';

const storiesLabel: Record<Locale, string> = {
  ko: '스토리',
  en: 'Stories',
  zh: '故事',
  es: 'Historias',
  vi: 'Câu chuyện',
  th: 'เรื่องราว',
  uz: 'Hikoyalar',
};

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const localeParam = (req.query.locale as string) || 'ko';
  const locale: Locale = locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : 'ko';

  const siteConfig = getSiteConfig(locale);
  const siteUrl = siteConfig.url;
  const storiesDir = path.join(process.cwd(), 'content', 'stories');
  const allStories = getAllStories(locale);
  const stories = locale === defaultLocale
    ? allStories
    : allStories.filter((s) => fs.existsSync(path.join(storiesDir, `${s.slug}.${locale}.md`)));

  const lastBuildDate = stories.length > 0
    ? new Date(stories[0].date).toUTCString()
    : new Date().toUTCString();

  const items = stories
    .map((story) => {
      const link = `${siteUrl}/${locale}/stories/${story.slug}`;
      const thumbnailUrl = story.thumbnail
        ? (story.thumbnail.startsWith('http') ? story.thumbnail : `${siteUrl}${story.thumbnail}`)
        : null;
      const mediaTag = thumbnailUrl
        ? `\n      <media:content url="${thumbnailUrl}" medium="image" />`
        : '';
      const authorTag = story.author
        ? `\n      <author>${escapeXml(siteConfig.contact.email)} (${escapeXml(story.author)})</author>`
        : `\n      <author>${escapeXml(siteConfig.contact.email)}</author>`;
      const categoryTag = story.categoryKey
        ? `\n      <category>${escapeXml(story.categoryKey)}</category>`
        : '';
      return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${link}</link>
      <description>${escapeXml(story.summary)}</description>
      <pubDate>${new Date(story.date).toUTCString()}</pubDate>
      <guid isPermaLink="true">${link}</guid>${authorTag}${categoryTag}${mediaTag}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(siteConfig.name)} ${storiesLabel[locale]}</title>
    <link>${siteUrl}/${locale}/stories</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>${locale}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <image>
      <url>${siteUrl}/logo512.png</url>
      <title>${escapeXml(siteConfig.name)}</title>
      <link>${siteUrl}</link>
    </image>
    <atom:link href="${siteUrl}/api/rss?locale=${locale}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  res.status(200).send(xml);
}
