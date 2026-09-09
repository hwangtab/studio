import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories, getStoryAvailableLocales } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { locales, type Locale } from '../../lib/i18n';

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

// CDATA wrapper — RSS description은 RSS reader가 HTML로 렌더링하므로,
// XML 파싱 회피용 CDATA만으로는 부족하고 본문 내 `&`(예: "R&B")가 HTML 입장에서
// invalid entity로 보인다. CDATA 안이라도 `&` → `&amp;` escape를 추가로 수행해
// HTML 렌더 시 `&amp;` → `&`로 정상 디코딩되도록 한다. `]]>` 시퀀스가 본문에 있으면
// CDATA가 split되어 깨지지 않도록 먼저 분할 후 entity escape.
const cdata = (str: string): string => {
  const safe = str.replace(/\]\]>/g, ']]]]><![CDATA[>').replace(/&/g, '&amp;');
  return `<![CDATA[${safe}]]>`;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // HEAD 허용 — pages/api/llms.ts와 동일 이유: 수집기/감사 도구가 존재 확인에
  // HEAD를 먼저 쓴다. GET만 허용하면 405가 나가 "가져올 수 없음"으로 오판된다.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method Not Allowed');
  }
  const localeParam = (req.query.locale as string) || 'ko';
  const locale: Locale = locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : 'ko';

  const siteConfig = getSiteConfig(locale);
  const siteUrl = siteConfig.url;
  // RSS should only list stories that render as indexable in the requested
  // locale. Fallback, explicit noindex, and runtime-thin pages waste crawl
  // budget and leak low-quality links when syndicated.
  // 최신 50건 캡: RSS는 신규 글 발견용 피드다. 전량(ko 1,500+) 방출은 네이버
  // 서치어드바이저 수집·리더 폴링에 수 MB급 낭비이고 발견 목적에도 역행한다.
  // getAllStories는 날짜 내림차순 정렬이므로 slice가 곧 최신순 상위 50이다.
  const RSS_MAX_ITEMS = 50;
  const stories = getAllStories(locale)
    .filter((story) => getStoryAvailableLocales(story.slug).includes(locale))
    .slice(0, RSS_MAX_ITEMS);

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
      <description>${cdata(story.summary)}</description>
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
    <description>${cdata(siteConfig.description)}</description>
    <language>${locale}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <image>
      <url>${siteUrl}/logo512.png</url>
      <title>${escapeXml(siteConfig.name)} ${storiesLabel[locale]}</title>
      <link>${siteUrl}/${locale}/stories</link>
    </image>
    <atom:link href="${siteUrl}/api/rss?locale=${locale}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  // 주의: stale-while-revalidate는 이 서버리스 함수 응답에서는 실제로 나가지 않는다
  // (Vercel이 함수 응답 Cache-Control을 정규화). 실측(2026-09-08) `/api/rss` 프로덕션
  // 응답: `Cache-Control: public`만 확인, s-maxage·SWR 모두 빠짐. 캐시 자체는 정상
  // 동작(x-vercel-cache: HIT, age 증가) — "재검증 유예 없이 즉시 미스"로 동작한다는
  // 뜻이지 고장은 아니다. 정적 파일(/sitemap.xml)은 같은 선언에서도 SWR이 보존된다.
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(xml);
}
