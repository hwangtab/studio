import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories, getStoryAvailableLocales } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { locales, type Locale } from '../../lib/i18n';
import { CANONICAL_FACTS } from '../../lib/factTokens';

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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }
  const siteConfig = getSiteConfig('ko');
  const siteUrl = siteConfig.url;

  // ?locale=ko|en|zh|... 명시 시 그 locale의 stories만 반환 (locale-scoped LLM index).
  // 미명시 시 전체 7 locale 통합. /llms-full-ko.txt, /llms-full-en.txt, /llms-full-zh.txt
  // 는 next.config.mjs rewrites에서 각 ?locale=... 로 매핑.
  const localeParam = typeof req.query.locale === 'string' ? req.query.locale : null;
  const requestedLocale = localeParam && (locales as readonly string[]).includes(localeParam)
    ? (localeParam as Locale)
    : null;

  let body = `# Studio NOL — Full Content Index (llms-full.txt${requestedLocale ? ` · ${HEADER_LABELS[requestedLocale]}` : ''})

Source site: ${siteUrl}
Purpose: Comprehensive, machine-readable index of Studio NOL content for AI search engines (ChatGPT, Perplexity, Claude, Gemini) and LLM crawlers.
Studio NOL is a professional music production studio in Yeonsinnae, Seoul. Services: recording, mixing, mastering, practice room residency, music lessons, album production, wedding song & voice acting recording.

- Primary sitemap: ${siteUrl}/sitemap.xml
- Short version: ${siteUrl}/llms.txt
- RSS (KO): ${siteUrl}/api/rss?locale=ko
- RSS (EN): ${siteUrl}/api/rss?locale=en
- Supported Languages: ko, en, zh, es, vi, th, uz

## Quick Facts (for AI citation)

- **Location**: 3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul (next to Dongmyeong Girls' High School main gate; 1st floor: car repair shop)
- **Subway**: Yeonsinnae Station Exit 4 (Lines 3 & 6) — 5 min walk; Bulgwang Station Exit 7 (Lines 3 & 6) — 7 min walk
- **Phone**: ${CANONICAL_FACTS.phoneIntl} · **KakaoTalk**: open.kakao.com/me/nol
- **Pricing (KRW, VAT excl.)**:
  - Practice Room Monthly Residency: 360,000/mo (₩0 deposit, 50% off first month for 6-month contracts)
  - Vocal Recording 1프로 (1-song package, 3 hrs): 250,000
  - Hourly Recording (voice acting / instrument / corrections): 100,000/hr (min 2 hrs)
  - Wedding Song Complete Package: 350,000 (2hr recording + tuning + mixing & mastering)
  - Day Lock (6-hour package): 500,000
  - 1:1 Music Lesson: 350,000/month flat (4 sessions, 60 min each)
  - Mixing: 200,000–500,000/song (tier by track count)
- **Operating Notes**: Hourly practice room rental and band rehearsal rooms are NOT operated. Practice room is monthly residency only.

`;

  const localesToEmit = requestedLocale ? [requestedLocale] : locales;
  for (const locale of localesToEmit) {
    // Only emit stories that render as indexable for this locale. Fallback,
    // explicit noindex, and runtime-thin pages should not be surfaced to LLM crawlers.
    const stories = getAllStories(locale).filter((story) =>
      getStoryAvailableLocales(story.slug).includes(locale)
    );
    if (stories.length === 0) continue;
    body += `\n## Stories — ${HEADER_LABELS[locale]} (${locale}) · ${stories.length} entries\n\n`;
    for (const story of stories) {
      body += formatStoryLine(siteUrl, locale, story) + '\n';
    }
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  // llms-full.txt는 AI 크롤러 안내용 메타 파일이라 SERP 색인 대상 아님.
  res.setHeader('X-Robots-Tag', 'noindex');
  const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB — Vercel 6MB 응답 한도 버퍼
  if (body.length > MAX_BODY_SIZE) {
    console.warn(`[llms-full] body size ${body.length} exceeds limit, truncating`);
    body = body.slice(0, MAX_BODY_SIZE) + '\n... (truncated)';
  }
  res.status(200).send(body);
}
