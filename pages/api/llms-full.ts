import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories, getStoryAvailableLocales } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { getPortfolioItems } from '../../data/portfolio';
import { locales, type Locale } from '../../lib/i18n';
import { CANONICAL_FACTS } from '../../lib/factTokens';
import {
  DAY_LOCK_PRICE,
  formatPriceAmount,
  LESSON_MONTHLY_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL3_PRICE,
  PRACTICE_ROOM_MONTHLY_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

// 가격은 data/pricing.ts SSOT 상수 보간 — 리터럴 하드코딩 금지(llms.ts와 동일 규칙).
const krw = formatPriceAmount;

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
  // HEAD 허용 이유는 pages/api/llms.ts 핸들러 주석 참조.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
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
  - Practice Room Monthly Residency: ${krw(PRACTICE_ROOM_MONTHLY_PRICE)}/mo (₩0 deposit, 50% off first month for 1-year contracts)
  - Vocal Recording 1프로 (1-song package, 3 hrs): ${krw(VOCAL_PACKAGE_PRICE)}
  - Hourly Recording (voice acting / instrument / corrections): ${krw(RECORDING_HOURLY_PRICE)}/hr (min 2 hrs)
  - Wedding Song Complete Package: ${krw(WEDDING_PACKAGE_PRICE)} (2hr recording + tuning + mixing & mastering)
  - Day Lock (6-hour package): ${krw(DAY_LOCK_PRICE)}
  - 1:1 Music Lesson: ${krw(LESSON_MONTHLY_PRICE)}/month flat (4 sessions, 60 min each)
  - Mixing: ${krw(MIXING_LEVEL1_PRICE)}–${krw(MIXING_LEVEL3_PRICE)}/song (tier by track count)
- **Operating Notes**: Hourly practice room rental and band rehearsal rooms are NOT operated. Practice room is monthly residency only.

`;

  // 포트폴리오 상세 — 프로듀싱 크레딧은 "황경하/스튜디오 놀 작업물" 류 AI 쿼리의
  // 인용 근거인데 그동안 stories만 방출돼 색인 자산에서 통째로 빠져 있었다.
  // ko 상세만: 비-ko 상세는 productionNotes 폴백 시 noindex라 LLM에 내보내지 않는다
  // (sitemap isPortfolioThin 게이트와 동일 기준).
  if (!requestedLocale || requestedLocale === 'ko') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isPortfolioThin } = require('../../lib/sitemap/portfolioMeta') as {
      isPortfolioThin: (id: string, locale: string) => boolean;
    };
    const portfolioItems = getPortfolioItems('ko').filter((item) => !isPortfolioThin(item.id, 'ko'));
    if (portfolioItems.length > 0) {
      body += `\n## Portfolio — Production Credits (Korean) · ${portfolioItems.length} entries\n\n`;
      body += `Albums, singles, and commercial works produced/recorded/mixed at Studio NOL by producer Hwang Kyungha (황경하).\n\n`;
      for (const item of portfolioItems) {
        const url = `${siteUrl}/ko/portfolio/${item.id}`;
        const artist = item.artist ? ` — ${item.artist}` : '';
        const desc = item.description
          ? ` · ${item.description.replace(/\s+/g, ' ').trim().slice(0, 120)}`
          : '';
        body += `- [${item.title}](${url})${artist}${desc}\n`;
      }
    }
  }

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
