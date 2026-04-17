import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { locales, type Locale } from '../../lib/i18n';

const BASE_SECTIONS = (siteUrl: string) => `Studio NOL (${siteUrl.replace(/^https?:\/\//, '')})

Studio NOL is a professional music production studio located in Yeonsinnae, Eunpyeong-gu, Seoul, Korea.
Founded in 2024, the studio offers premium recording, mixing, mastering, practice room residency, and music production consultation services.
The studio is a 5-minute walk from Yeonsinnae Station (Seoul Metro Line 3 / Line 6).

## Primary Services

- **Recording Studio**: Professional vocal and instrument recording in a fully treated acoustic space
- **Mixing & Mastering**: Professional mixing and mastering services using industry-standard equipment
- **Practice Room Residency**: Premium private practice room residency program (monthly subscription)
- **Music Production Consulting & Lessons**: One-on-one recording/production lessons with studio engineers
- **Album Production**: Full-service album planning, recording, mixing, and mastering packages

## Business Information

- Founded: 2024-01-01
- Business Type: Entertainment Business, Recording Studio, Music Production
- Industry: Music & Entertainment
- Specialization: Independent artist support — affordable professional-grade recording, mixing, and production in Seoul
- Address: 3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul, KR 03424
- Geo: 37.614353, 126.925887
- Phone: +82-2-764-3114
- Email: contact@kosmart.org
- Business Hours: Mon–Fri 10:00–18:00, Sat 12:00–18:00, Sun Closed
- Preferred Contact: KakaoTalk (https://open.kakao.com/me/nol), Phone (+82-2-764-3114), Email (contact@kosmart.org)
- Naver Map: https://naver.me/5gFZhS3X
- Supported Languages: Korean, English, Chinese (Simplified), Spanish, Vietnamese, Thai, Uzbek

## Sitemaps & Feeds

- Sitemap: ${siteUrl}/sitemap.xml
- RSS Feed (Korean): ${siteUrl}/api/rss?locale=ko
- RSS Feed (English): ${siteUrl}/api/rss?locale=en
- llms-full.txt (content index): ${siteUrl}/llms-full.txt
`;

const localeKeyPages = (siteUrl: string, locale: Locale, label: string) => `## Key Pages (${label})

- Home: ${siteUrl}/${locale}
- About / Services: ${siteUrl}/${locale}/about
- Portfolio: ${siteUrl}/${locale}/portfolio
- Stories & News: ${siteUrl}/${locale}/stories
- Contact: ${siteUrl}/${locale}/contact
- Pricing: ${siteUrl}/${locale}/pricing
- Practice Room: ${siteUrl}/${locale}/practice-room
- Recording Lessons: ${siteUrl}/${locale}/lesson
- Studio Equipment: ${siteUrl}/${locale}/studio-info
- Wedding Song Recording: ${siteUrl}/${locale}/wedding-song
- Voice Acting Recording: ${siteUrl}/${locale}/voice-acting
`;

const LOCALE_LABELS: Record<Locale, string> = {
  ko: 'Korean',
  en: 'English',
  zh: 'Chinese Simplified',
  es: 'Spanish',
  vi: 'Vietnamese',
  th: 'Thai',
  uz: 'Uzbek',
};

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const siteConfig = getSiteConfig('ko');
  const siteUrl = siteConfig.url;

  let body = BASE_SECTIONS(siteUrl) + '\n';

  for (const locale of locales) {
    body += '\n' + localeKeyPages(siteUrl, locale, LOCALE_LABELS[locale]);
  }

  const koStories = getAllStories('ko').slice(0, 50);
  if (koStories.length > 0) {
    body += '\n## Recent Stories (Korean, latest 50)\n\n';
    for (const story of koStories) {
      body += `- [${story.title}](${siteUrl}/ko/stories/${story.slug})`;
      if (story.summary) {
        const short = story.summary.replace(/\s+/g, ' ').trim().slice(0, 160);
        body += ` — ${short}`;
      }
      body += '\n';
    }
  }

  body += '\n## Supported Languages\n\n';
  body += 'Korean (ko), English (en), Chinese Simplified (zh), Spanish (es), Vietnamese (vi), Thai (th), Uzbek (uz)\n';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.status(200).send(body);
}
