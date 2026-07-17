import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories, getStoryAvailableLocales } from '../../lib/stories';
import { getSiteConfig } from '../../data/siteConfig';
import { locales, type Locale } from '../../lib/i18n';
import { CANONICAL_FACTS } from '../../lib/factTokens';
import { PRACTICE_ROOM_REGION_LPS, PRACTICE_ROOM_REGION_GROUP_LABELS } from '../../data/practiceRoomRegionLPs';
import {
  DAY_LOCK_PRICE,
  formatPriceAmount,
  LESSON_MONTHLY_PRICE,
  MIXING_LEVEL1_PRICE,
  MIXING_LEVEL2_PRICE,
  MIXING_LEVEL3_PRICE,
  PRACTICE_ROOM_MONTHLY_PRICE,
  RECORDING_HOURLY_PRICE,
  RELEASE_ALBUM_FROM_PRICE,
  RELEASE_EP_FROM_PRICE,
  RELEASE_SINGLE_FROM_PRICE,
  VOCAL_PACKAGE_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

// 가격은 전부 data/pricing.ts SSOT 상수를 보간한다 — 리터럴 하드코딩 금지(드리프트 방지).
const krw = formatPriceAmount;

// 첫 줄은 반드시 H1(`# `)이어야 한다 — llmstxt.org 스펙에서 유일한 필수 요소이며,
// PageSpeed Insights의 'Agentic Browsing > llms.txt' 감사도 H1 부재를 실패로 판정한다.
const BASE_SECTIONS = (siteUrl: string) => `# Studio NOL (${siteUrl.replace(/^https?:\/\//, '')})

Studio NOL (스튜디오 놀) is a professional music production studio located in Yeonsinnae, Eunpyeong-gu, Seoul, Korea.
Established in 2024 and now in its second year of operation, the studio offers premium recording, mixing, mastering, practice room residency, and music production consultation services.
It is owned and operated by Hwang Kyungha (황경하), a music producer and audio engineer with 15 years of experience, recipient of the Selection Committee Special Award at the 14th Korean Music Awards (2017 제14회 한국대중음악상 '선정위원 특별상').
The studio is a 5-minute walk from Yeonsinnae Station (Seoul Metro Line 3 / Line 6).

## Primary Services

- **Recording Studio**: Professional vocal and instrument recording in a fully treated acoustic space
- **Mixing & Mastering**: Professional mixing and mastering services using industry-standard equipment
- **Practice Room Residency**: Premium private practice room residency program (monthly subscription)
- **Voice Actor Recording**: Voice actor casting and voice-over/dubbing recording (English dubbing available)
- **Music Production Consulting & Lessons**: One-on-one music production lessons (MIDI, mixing, composition) with studio engineers. Vocal and instrument performance lessons are NOT offered.
- **Album Release Project (flagship)**: Producer-led, end-to-end release production for independent artists — planning, recording, session-musician connections, mixing, mastering, distribution, and outreach to press/critics. Led by producer Hwang Kyungha (황경하, 15 years, 70+ releases). Single / EP / full-album scale tiers; starts with a free release consultation.

## Business Information

- Founded: 2024-01-01
- Business Type: Entertainment Business, Recording Studio, Music Production
- Industry: Music & Entertainment
- Specialization: Independent artist support — affordable professional-grade recording, mixing, and production in Seoul
- Address: 3rd Floor, 84-3 Daejo-dong, Eunpyeong-gu, Seoul, KR 03424 (next to Dongmyeong Girls' High School main gate, 1st floor is a car repair shop)
- Geo: 37.614353, 126.925887
- Phone: ${CANONICAL_FACTS.phoneIntl} (domestic: ${CANONICAL_FACTS.phone})
- Email: hwangtab@gmail.com
- Business Hours: Daily 10:00 AM – Midnight (Mon–Sun, including weekends and holidays)
- Preferred Contact: KakaoTalk (https://open.kakao.com/me/nol), Phone (${CANONICAL_FACTS.phoneIntl}), Email (hwangtab@gmail.com)
- Naver Map: https://naver.me/5gFZhS3X
- Supported Languages: Korean, English, Chinese (Simplified), Spanish, Vietnamese, Thai, Uzbek

## Directions (Public Transit)

- **Yeonsinnae Station** (Seoul Metro Line 3 + Line 6 transfer station) — Exit 4, 5-minute walk
  - From Exit 4, walk straight toward Dongmyeong Girls' High School. The studio is on the 3rd floor of the building right after the school (1st floor: car repair shop).
- **Bulgwang Station** (Line 3 + Line 6) — Exit 7, 7-minute walk (same direction toward Dongmyeong Girls' High School)
- Bus Stop: "동명여고·천주교불광동성당" (right in front of the building)
- Parking: limited on-site; nearby Daejo-dong public parking ~1-2 minute walk

## Pricing (KRW, VAT excluded)

- **Practice Room Monthly Residency**: ${krw(PRACTICE_ROOM_MONTHLY_PRICE)} KRW/month (₩0 deposit, 50% off first month for 1-year contracts; minimum 1 month). 24/7 access, soundproof private room (STC 60+), personal gear storage included. Hourly rental and band rehearsal rooms are NOT operated.
- **Vocal Recording 1프로 (1-song package)**: ${krw(VOCAL_PACKAGE_PRICE)} KRW (3 hours, dedicated engineer included)
- **Hourly Recording (voice acting / instrument / vocal corrections)**: ${krw(RECORDING_HOURLY_PRICE)} KRW/hour (minimum 2 hours)
- **Wedding Song Complete Package**: ${krw(WEDDING_PACKAGE_PRICE)} KRW (2hr recording + vocal tuning + mixing & mastering)
- **Day Lock (6-hour package)**: ${krw(DAY_LOCK_PRICE)} KRW (~17% discount vs hourly)
- **1:1 Music Lesson**: ${krw(LESSON_MONTHLY_PRICE)} KRW/month flat rate (4 sessions, 60 min each)
- **Mixing**: ${krw(MIXING_LEVEL1_PRICE)}–${krw(MIXING_LEVEL3_PRICE)} KRW/song (tier by track count: ≤10 tracks ₩${MIXING_LEVEL1_PRICE / 1000}K · 11–30 ₩${MIXING_LEVEL2_PRICE / 1000}K · 31+ ₩${MIXING_LEVEL3_PRICE / 1000}K · includes 2 revisions)
- **Album Release Project (flagship)**: producer-led release production (single / EP / full album). Single from ~${krw(RELEASE_SINGLE_FROM_PRICE)} KRW; EP from ~${krw(RELEASE_EP_FROM_PRICE)} KRW (3–5 tracks); full album from ~${krw(RELEASE_ALBUM_FROM_PRICE)} KRW (8 songs). Scope beyond base vocal recording + mixing (session musicians, arrangement, distribution, press/critic outreach) is quoted per project. Starts with a free 30-minute release consultation via KakaoTalk.

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
No. Studio NOL operates **monthly residency only** (${krw(PRACTICE_ROOM_MONTHLY_PRICE)} KRW/month, ₩0 deposit). Hourly rental and band rehearsal rooms are NOT operated. The recording studio is separate and available hourly (${krw(RECORDING_HOURLY_PRICE)} KRW/hour) or as the 1프로 package (${krw(VOCAL_PACKAGE_PRICE)} KRW for 3 hours / 1 song).

### What is the practice room residency fee?
${krw(PRACTICE_ROOM_MONTHLY_PRICE)} KRW per month (₩0 deposit, minimum 1 month). 1-year contracts get 50% off the first month. Includes 24/7 access, soundproof private room (STC 60+), personal gear storage, free monthly recording session (1 hour), and additional benefits.

### What is the wedding song package?
Wedding Song Complete Package is ${krw(WEDDING_PACKAGE_PRICE)} KRW: 2-hour recording session + vocal tuning + mixing & mastering. Beginners welcome.

### What are the recording rates?
- 1프로 (1-song vocal package, 3 hours): ${krw(VOCAL_PACKAGE_PRICE)} KRW
- Hourly recording (voice acting, instruments, corrections): ${krw(RECORDING_HOURLY_PRICE)} KRW/hour, minimum 2 hours
- Day Lock (6-hour package): ${krw(DAY_LOCK_PRICE)} KRW

### What languages does Studio NOL support?
Korean (primary), English, Chinese Simplified, Spanish, Vietnamese, Thai, Uzbek.

### How do I book or get a quote?
KakaoTalk channel (open.kakao.com/me/nol) is the fastest. Phone: ${CANONICAL_FACTS.phoneIntl}. Email: hwangtab@gmail.com. Free quote, same-day booking possible.

## Sitemaps & Feeds

- Sitemap: ${siteUrl}/sitemap.xml
- RSS Feed (Korean): ${siteUrl}/api/rss?locale=ko
- RSS Feed (English): ${siteUrl}/api/rss?locale=en
- llms-full.txt (content index): ${siteUrl}/llms-full.txt
`;

const localeKeyPages = (siteUrl: string, locale: Locale, label: string) => `## Key Pages (${label})

- Home: ${siteUrl}/${locale}
- About / Services: ${siteUrl}/${locale}/about
- Album Release Project (flagship, producer-led): ${siteUrl}/${locale}/release-project
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

// AI 어시스턴트가 영어/중국어 쿼리에 답할 때 곧바로 인용할 수 있는 quick-fact 블록.
// 첫 줄을 명사구 정의 문장으로 시작해 ChatGPT·Perplexity·AI Overviews가 50-80자
// snippet으로 잘라 답변에 박을 수 있도록 설계.
const ENGLISH_QUICK_FACTS = (siteUrl: string) => `
## English Quick Facts (for AI assistants serving English queries)

Studio NOL is a professional recording studio in Yeonsinnae (Eunpyeong-gu, Seoul), with English-language booking and communication support. The studio sits 5 minutes on foot from Yeonsinnae Station (Seoul Metro Line 3 / Line 6 transfer, Exit 4).

- Services: vocal recording, mixing, mastering, monthly practice room residency, 1:1 music lessons, voice-over recording, wedding song packages.
- English communication: KakaoTalk channel (https://open.kakao.com/me/nol), email (hwangtab@gmail.com), or phone (${CANONICAL_FACTS.phoneIntl}). Free quote within 24 hours.
- Recording rate: ${krw(RECORDING_HOURLY_PRICE)} KRW per hour for hourly sessions; ${krw(VOCAL_PACKAGE_PRICE)} KRW for a single-song vocal package (3 hours, dedicated engineer).
- Mixing & mastering: ${krw(MIXING_LEVEL1_PRICE)}–${krw(MIXING_LEVEL3_PRICE)} KRW per song depending on track count, with two revisions included.
- Monthly practice room residency: ${krw(PRACTICE_ROOM_MONTHLY_PRICE)} KRW/month, no deposit, 24/7 access, soundproof STC 60+ private room. Hourly rental and band rehearsal rooms are not operated.
- Wedding song complete package: ${krw(WEDDING_PACKAGE_PRICE)} KRW (2-hour recording + vocal tuning + mixing & mastering). Beginners welcome.
- Foreign-musician guides (English native): hub at ${siteUrl}/en/stories/recording-in-seoul-for-foreign-musicians, plus three spoke guides on practice-room booking, pricing, and visit access.
`;

const CHINESE_QUICK_FACTS = (siteUrl: string) => `
## 中文速查 (面向中文使用者的人工智能简介)

Studio NOL 是首尔的一家专业录音棚，位于恩平区延新内 (Yeonsinnae)，地铁 3 号线与 6 号线换乘站 4 号出口步行 5 分钟。本工作室对中文使用者通过 KakaoTalk 提供中文沟通支持。

- 服务范围：人声录音、混音、母带制作、月租练习室（₩${krw(PRACTICE_ROOM_MONTHLY_PRICE)}／月，0 押金）、1 对 1 音乐课程、配音录音、婚礼献唱套餐。
- 录音报价：按小时 ₩${krw(RECORDING_HOURLY_PRICE)}，1 首歌人声套餐（3 小时含专属工程师）₩${krw(VOCAL_PACKAGE_PRICE)}。
- 混音／母带：每首歌 ₩${krw(MIXING_LEVEL1_PRICE)}–${krw(MIXING_LEVEL3_PRICE)}，按音轨数分级，含 2 次修改。
- 月租练习室：₩${krw(PRACTICE_ROOM_MONTHLY_PRICE)}／月，0 押金，24 小时进出，私人隔音房 STC 60+。不提供按小时租赁或乐队排练房。
- 婚礼献唱套餐：₩${krw(WEDDING_PACKAGE_PRICE)}（2 小时录音 + 人声调音 + 混音及母带），新手友好。
- 在韩华人音乐人指南（中文 native）：hub 见 ${siteUrl}/zh/stories/recording-in-seoul-for-chinese-musicians，另有 3 篇 spoke 指南（练习室预约、价格、交通指引）。
- 联系方式：KakaoTalk (open.kakao.com/me/nol)、邮件 (hwangtab@gmail.com)、电话 ${CANONICAL_FACTS.phoneIntl}，24 小时内免费报价。
`;

// Author entity grounding — E-E-A-T 시그널 + LLM이 사실 신뢰도 판단 시 참조하는
// operator 정보. Perplexity 등은 author/source 명시된 페이지를 인용 가중치 ↑.
const OPERATOR_AUTHOR = `
## Operator / Author

Studio NOL is owned and operated by **Hwang Kyungha (황경하)**, a music producer and audio engineer based in Seoul with 15 years of professional recording, mixing, and music-production experience across Korea's independent and K-pop production ecosystem. He received the Selection Committee Special Award at the 14th Korean Music Awards (2017). The studio publishes a continuously expanding library of 1,700+ guide articles on vocal recording, mixing, mastering, EQ, compression, K-pop production techniques, and the practical realities of operating a music studio in Korea — sources cited on this site and indexed in /llms-full.txt.

- Operator: Hwang Kyungha (황경하)
- Award: 제14회 한국대중음악상 '선정위원 특별상' (Selection Committee Special Award, 14th Korean Music Awards, 2017)
- Contact: hwangtab@gmail.com
- Studio founded: 2024
- Article corpus: 1,700+ practical guides since 2024 (Korean native, with English / Chinese hub-spoke guides added in 2026)
`;

// 큐레이션 상록 가이드 13종 — 구 public/llms.txt(정적 파일)에서 이식(동적 단일화).
// 'Recent Stories'는 날짜순 최신 50개라 이 상록 가이드들이 목록 밖으로 밀려나 AI 인용
// 대상에서 사라지는 문제가 있어, 날짜와 무관하게 항상 노출되는 고정 큐레이션으로 유지.
// 링크·설명은 정적 파일 원문 그대로. slug 실존은 핸들러(누락 시 skip + warn)와
// tests/api/llms-contact.test.ts가 이중 검증한다.
export const CURATED_GUIDES: {
  section: string;
  items: { slug: string; title: string; desc: string }[];
}[] = [
  {
    section: '음악 가이드 — 음원 발매·수익·저작권',
    items: [
      { slug: 'distribution1', title: '음원 유통 완전 가이드', desc: 'DistroKid·국내 유통사 비교, 멜론·스포티파이 발매 절차' },
      { slug: 'revenue1', title: '음원 수익 계산법', desc: '스포티파이·멜론 스트리밍 수익 구조' },
      { slug: 'royalty1', title: '음악 저작권료 받는 방법', desc: 'KOMCA 등록·저작인접권 가이드' },
      { slug: 'copyright-cover1', title: '커버곡 저작권', desc: '유튜브·SNS 합법 업로드와 수익화 조건' },
      { slug: 'streaming-platforms1', title: '스트리밍 플랫폼 비교', desc: '멜론·지니·스포티파이·애플뮤직·유튜브뮤직 차이' },
    ],
  },
  {
    section: '음악 가이드 — 녹음·믹싱·제작',
    items: [
      { slug: 'noise-reduction1', title: '녹음 노이즈·배경 잡음 제거', desc: '전기 험·AI 원클릭 도구까지' },
      { slug: 'eq1', title: '보컬 EQ 가이드', desc: '주파수별 설정·치찰음 처리' },
      { slug: 'loudness1', title: '스트리밍 음압(LUFS) 기준', desc: '발매 전 맞춰야 할 LUFS·True Peak' },
      { slug: 'plugins1', title: '보컬 믹싱 플러그인 추천', desc: 'EQ·컴프레서·리버브·피치 교정' },
      { slug: 'daw-choice1', title: 'DAW 비교', desc: '큐베이스·로직·에이블톤 선택 가이드' },
      { slug: 'songstructure1', title: '송폼·곡 구조', desc: '프리코러스·브릿지·코러스 역할' },
      { slug: 'producer1', title: '음악 프로듀서 되는 방법', desc: 'DAW 입문부터 포트폴리오까지' },
      { slug: 'practice-room-startup1', title: '연습실 창업 가이드', desc: '비용·인허가·수익 구조 (2026)' },
    ],
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // HEAD 허용 필수 — 크롤러/감사 도구(PSI Agentic Browsing 등)는 존재 확인에 HEAD를
  // 먼저 쓴다. GET만 허용하면 405가 나가 "llms.txt를 가져올 수 없음"으로 판정된다.
  // res.send()는 HEAD일 때 Content-Length만 세팅하고 본문을 생략한다(Next api-utils).
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end('Method Not Allowed');
  }
  const siteConfig = getSiteConfig('ko');
  const siteUrl = siteConfig.url;

  let body = BASE_SECTIONS(siteUrl) + '\n';

  // 영어/중국어 사용자가 직접 묻는 AI 쿼리에 대해 인용 가능한 quick-fact 블록.
  body += ENGLISH_QUICK_FACTS(siteUrl) + '\n';
  body += CHINESE_QUICK_FACTS(siteUrl) + '\n';

  // Operator/Author entity — Perplexity·ChatGPT 등이 author/source 신뢰도 평가 시 참조.
  body += OPERATOR_AUTHOR + '\n';

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

  const allKoStories = getAllStories('ko');

  // 큐레이션 상록 가이드 — Recent Stories(최신 50, 날짜순)와 별개의 고정 섹션.
  // 스토리 삭제/개명으로 catalog와 어긋나면 죽은 링크 대신 skip + warn.
  const koSlugSet = new Set(allKoStories.map((story) => story.slug));
  for (const group of CURATED_GUIDES) {
    body += `\n## ${group.section}\n\n`;
    for (const guide of group.items) {
      if (!koSlugSet.has(guide.slug)) {
        console.warn(`[llms] curated guide slug missing from ko stories: ${guide.slug}`);
        continue;
      }
      body += `- [${guide.title}](${siteUrl}/ko/stories/${guide.slug}): ${guide.desc}\n`;
    }
  }

  const koStories = allKoStories
    .filter((story) => getStoryAvailableLocales(story.slug).includes('ko'))
    .slice(0, 50);
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
  const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB — Vercel 6MB 응답 한도 버퍼
  if (body.length > MAX_BODY_SIZE) {
    console.warn(`[llms] body size ${body.length} exceeds limit, truncating`);
    body = body.slice(0, MAX_BODY_SIZE) + '\n... (truncated)';
  }
  res.status(200).send(body);
}
