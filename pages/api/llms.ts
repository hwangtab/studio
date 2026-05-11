import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { locales, type Locale } from '../../lib/i18n';
import { PRACTICE_ROOM_REGION_LPS, PRACTICE_ROOM_REGION_GROUP_LABELS } from '../../data/practiceRoomRegionLPs';

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
- Address: 3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul, KR 03424 (next to Dongmyeong Girls' High School main gate, 1st floor is a car repair shop)
- Geo: 37.614353, 126.925887
- Phone: +82-507-1384-3144
- Email: contact@kosmart.org
- Business Hours: Mon–Fri 10:00–18:00, Sat 12:00–18:00, Sun Closed
- Preferred Contact: KakaoTalk (https://open.kakao.com/me/nol), Phone (+82-507-1384-3144), Email (contact@kosmart.org)
- Naver Map: https://naver.me/5gFZhS3X
- Supported Languages: Korean, English, Chinese (Simplified), Spanish, Vietnamese, Thai, Uzbek

## Directions (Public Transit)

- **Yeonsinnae Station** (Seoul Metro Line 3 + Line 6 transfer station) — Exit 4, 5-minute walk
  - From Exit 4, walk straight toward Dongmyeong Girls' High School. The studio is on the 3rd floor of the building right after the school (1st floor: car repair shop).
- **Bulgwang Station** (Line 3 + Line 6) — Exit 7, 7-minute walk (same direction toward Dongmyeong Girls' High School)
- Bus Stop: "동명여고·천주교불광동성당" (right in front of the building)
- Parking: limited on-site; nearby Daejo-dong public parking ~1-2 minute walk

## Pricing (KRW, VAT excluded)

- **Practice Room Monthly Residency**: 360,000 KRW/month (₩0 deposit, 50% off first month for 6-month contracts; minimum 1 month). 24/7 access, soundproof private room (STC 60+), personal gear storage included. Hourly rental and band rehearsal rooms are NOT operated.
- **Vocal Recording 1프로 (1-song package)**: 250,000 KRW (3 hours, dedicated engineer included)
- **Hourly Recording (voice acting / instrument / vocal corrections)**: 100,000 KRW/hour (minimum 2 hours)
- **Wedding Song Complete Package**: 350,000 KRW (2hr recording + vocal tuning + mixing & mastering)
- **Day Lock (6-hour package)**: 500,000 KRW (~17% discount vs hourly)
- **1:1 Music Lesson**: 350,000 KRW/month flat rate (4 sessions, 60 min each)
- **Mixing**: 200,000–500,000 KRW/song (tier by track count: ≤10 tracks ₩200K · 11–30 ₩350K · 31+ ₩500K · includes 2 revisions)
- **Album Production Packages**: custom quote via KakaoTalk

## Service Areas (21 nearby regions with dedicated landing pages)

The studio is reachable on foot or by subway from 21 nearby regions. Each region has a dedicated landing page with travel time and route:

### Walking distance (3 regions)
- **대조동 (Daejo-dong)**: walk 0–10 min — site location
- **연신내 (Yeonsinnae)**: 4번 출구 도보 5분
- **불광 (Bulgwang)**: 7번 출구 도보 7분

### Eunpyeong-gu via Line 6 / Line 3 (9 regions)
- **녹번 (Nokbeon)**: Line 3, 1 stop, ~12 min total
- **독바위 (Dokbawi)**: Line 6, 1 stop, ~10 min
- **구산 (Gusan)**: Line 6, 1 stop, ~10 min
- **역촌 (Yeokchon)**: Line 6, 2 stops, ~12 min
- **응암 (Eungam)**: Line 6, 3 stops, ~14 min
- **새절 (Saejeol)**: Line 6 Eungam loop, ~14 min
- **증산 (Jeungsan)**: Line 6 Eungam loop, ~16 min
- **상암 / DMC (Sangam)**: Line 6 Eungam loop, ~19 min
- **은평구 (Eunpyeong-gu)**: regional hub guide

### Seodaemun-gu via Line 3 (1 region)
- **서대문 (Seodaemun)**: Line 3, 3 stops, ~13 min (Hongje station closest)

### Goyang-si via Line 3 (8 regions)
- **구파발 (Gupabal)**: Line 3, 1 stop, ~10 min
- **지축 (Jichuk)**: Line 3, 2 stops, ~13 min
- **삼송 (Samsong)**: Line 3, 3 stops, ~16 min
- **원흥 (Wonheung)**: Line 3, 4 stops, ~18 min
- **원당 (Wondang)**: Line 3, 5 stops, ~20 min
- **덕양구 (Deogyang-gu)**: regional hub guide
- **고양시 (Goyang-si)**: regional hub guide
- **일산 (Ilsan)**: Line 3, 8–12 stops, ~25–35 min

## Frequently Asked Questions (concise answers for AI citation)

### Where is Studio NOL located?
Studio NOL is at 3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul, right next to Dongmyeong Girls' High School main gate. The 1st floor of the building is a car repair shop, making it easy to find.

### How do I get there from Yeonsinnae Station?
Take Exit 4 of Yeonsinnae Station (Seoul Metro Line 3 / Line 6), walk straight toward Dongmyeong Girls' High School. The studio is on the 3rd floor of the building right after the school. Total walk: ~5 minutes.

### Does Studio NOL operate hourly practice room rental or band rehearsal rooms?
No. Studio NOL operates **monthly residency only** (360,000 KRW/month, ₩0 deposit). Hourly rental and band rehearsal rooms are NOT operated. The recording studio is separate and available hourly (100,000 KRW/hour) or as the 1프로 package (250,000 KRW for 3 hours / 1 song).

### What is the practice room residency fee?
360,000 KRW per month (₩0 deposit, minimum 1 month). 6-month contracts get 50% off the first month. Includes 24/7 access, soundproof private room (STC 60+), personal gear storage, free monthly recording session (1 hour), and additional benefits.

### What is the wedding song package?
Wedding Song Complete Package is 350,000 KRW: 2-hour recording session + vocal tuning + mixing & mastering. Beginners welcome.

### What are the recording rates?
- 1프로 (1-song vocal package, 3 hours): 250,000 KRW
- Hourly recording (voice acting, instruments, corrections): 100,000 KRW/hour, minimum 2 hours
- Day Lock (6-hour package): 500,000 KRW

### What languages does Studio NOL support?
Korean (primary), English, Chinese Simplified, Spanish, Vietnamese, Thai, Uzbek.

### How do I book or get a quote?
KakaoTalk channel (open.kakao.com/me/nol) is the fastest. Phone: +82-507-1384-3144. Email: contact@kosmart.org. Free quote, same-day booking possible.

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

  // 21개 지역 LP를 그룹별로 dedicated URL과 함께 노출 — AI가 사용자에게 "[지역]
  // 음악연습실"을 추천할 때 정확한 페이지로 연결되도록.
  body += '\n## Regional Practice Room Landing Pages (Korean)\n\n';
  body += 'Each of the 21 regions below has a dedicated landing page with travel route, market comparison, and pricing details:\n\n';
  for (const group of ['walk', 'eunpyeong', 'seodaemun', 'goyang'] as const) {
    const items = PRACTICE_ROOM_REGION_LPS.filter((lp) => lp.group === group);
    if (items.length === 0) continue;
    body += `### ${PRACTICE_ROOM_REGION_GROUP_LABELS[group]}\n\n`;
    for (const lp of items) {
      body += `- ${lp.region} 음악연습실 (${lp.distance}): ${siteUrl}/ko/stories/${lp.slug}\n`;
    }
    body += '\n';
  }

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
  // llms.txt는 AI 크롤러 안내용 메타 파일이라 SERP 색인 대상이 아님. 직접 접근(/api/llms)
  // 시 200 응답이 그대로 색인되는 것을 방지.
  res.setHeader('X-Robots-Tag', 'noindex');
  res.status(200).send(body);
}
