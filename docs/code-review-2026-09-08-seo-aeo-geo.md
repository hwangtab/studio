# SEO·AEO·GEO 코드리뷰 — 2026-09-08

4개 영역 병렬 리뷰(테크니컬 SEO·구조화 데이터·GEO 표면·성능/크롤/i18n) 결과를 통합했다.
모두 읽기 전용이며, **각 발견은 프로덕션(studionol.co.kr) curl 실측으로 재검증한 것만** 남겼다.
이미 문서화된 항목(페이지네이션 SSG·빈 허브 사이트맵·404 canonical·주소 SSOT·VideoObject·
연습실 허브 308 링크·en noindex 정책·네이버 AI 크롤러 차단)은 재보고하지 않았다.

## 기준선 (실측)

| 항목 | 결과 |
|---|---|
| `npm run type-check` / `lint` | 통과 / 에러 0 (경고 11, 기존) |
| `npx jest` | 143 suites / 1,181 tests 통과 |
| 사이트맵 | 1,149 URL, 표본 40개 전부 200, hreflang self-ref 정상, 이미지 1,139건 |
| llms.txt 계열 링크 | 132건 실측 전부 200 |
| JSON-LD | 7개 페이지 파싱 OK, 스크립트 간 @id 충돌 0 |
| robots.txt | AI 크롤러 전부 허용, 명명 그룹 = `*` 그룹 규칙 동일 |
| 미들웨어 매처 | 정적 자산·API·llms·IndexNow 키 제외 정상 |

---

## P0 — 이번 주

### 1. 전 페이지 Organization·LocalBusiness·Product의 `image`가 사이트 개설 이래 404  [구조화 데이터 P1]
- 근거: `utils/schema/business.ts:86,142`, `utils/schema/commerce.ts:171` — 셋 다 `${siteUrl}/thumbnail.jpg`.
  실측 `curl -I /thumbnail.jpg` → **307 → `/ko/thumbnail.jpg` → 404**. 파일은 `public/thumbnail.jpg`(1440×809)에
  실재하지만, `middleware.ts:287` 로케일 매처의 negative lookahead(`images|icons|logo.*|…`)에
  루트 파일명 `thumbnail.jpg`가 없어 로케일 프리픽스 리다이렉트에 걸린다. 파일은 initial commit부터
  있었고 lookahead에 한 번도 오른 적이 없다. 루트 public 파일 10종 중 이것만 307.
- 영향: 모든 페이지 @graph의 대표 이미지가 깨진 URL. Rich Results Test에서 Organization/Product
  이미지 경고로 뜬다. 같은 부류 사고가 아이콘(`/icons/`)·IndexNow 키 파일에서 이미 두 번 났다.
- 수정(택1, 1줄): (a) 세 곳을 `/images/og-default.jpg`(1200×630, 200 확인, `/images/`라 매처 제외)로 교체.
  (b) 매처 lookahead에 `thumbnail\.jpg` 추가. **(a) 권장** — 루트 파일 하나 더 예외로 두는 것보다
  이미 예외인 디렉터리 안의 파일을 쓰는 게 재발이 없다.

---

## P1 — 이번 달

### 2. 봇 판정 정규식이 AI 응답엔진의 실시간 fetch 봇을 못 잡는다  [테크니컬 P2]
- 근거: `lib/bot-detection.ts:11-12` `BOT_PATTERN` — `Claude-User`·`Perplexity-User`·`MistralAI-User`가
  어떤 alternation에도 안 걸린다(정규식 실행으로 확인: 셋 다 `false`; `Claude-SearchBot`·`OAI-SearchBot`·
  `ChatGPT-User`는 `bot`/`user`… 부분매치로 `true`). `Perplexity-User`는 `next-sitemap.config.js:120`의
  robots NAMED_BOTS에 "답변 시 실시간 fetch 봇"으로 등재돼 있는데 미들웨어는 일반 방문자로 본다.
- 영향: `middleware.ts:205-264` — 봇이면 결정적 308 + 기본 로케일, 아니면 Accept-Language 기반
  307 + `Vary` + `no-store`. GEO가 1순위인 저장소에서 답변엔진 봇마다 신호가 갈린다.
- 수정: `BOT_PATTERN`에 `|claude-user|perplexity-user|mistralai-user` 추가(또는 `-user\b` 일반화).
  `lib/bot-detection`에 테스트가 있으면 세 UA 케이스 추가.

### 3. `/ko/author` @graph에 `#person-hwang` 완전 노드가 두 번  [구조화 데이터 P2]
- 근거: 실측 파싱 — script1 노드 7개 중 `@id` `#person-hwang`인 **완전 객체 2개**(키: award·image·jobTitle… /
  award·description·image…). `utils/schema/business.ts:354`(`generateDefaultSchema`의 사본)와
  `pages/[locale]/author.tsx:34-58`(`schema={[personSchema]}`)가 `collectSchemaItems`에서 그대로 병합된다.
  `utils/schema/person.ts:55-58` 주석은 "값이 충돌하지 않아 안전"이라 하지만, JSON-LD node-map 병합을
  엄격히 하는 소비자는 배열 속성(`award`·`sameAs`·`subjectOf`)을 합집합으로 처리해 수상 6건이 12건으로
  겹칠 수 있다.
- 수정: author.tsx 쪽을 `{ '@id': …, description }` 조각으로 축소하거나, author 페이지에서만
  기본 그래프의 Person을 생략.

### 4. 스토리 97%에서 화면 바이라인 ≠ JSON-LD author  [AEO 정합 P2]
- 근거: `utils/schema/article.ts:35-37` `isStudioAuthor` — frontmatter author가 없거나 "스튜디오 놀"이면
  JSON-LD `BlogPosting.author`를 **Person 황경하(@id #person-hwang, sameAs 7)**로 승격. 그런데 화면
  (`pages/[locale]/stories/[id].tsx:192-198`)은 `story.author === studioOperator.name`일 때만 링크 바이라인이고,
  기본값은 `<span>스튜디오 놀</span>` 또는 미표시. 실측 `audiobook-narration-recording-cost-time`:
  화면 itemprop author 없음 / JSON-LD author name "황경하". 명시적 `author: 황경하`는 48편뿐.
- 영향: 구조화 데이터 정책("페이지에 보이는 내용을 반영")과 어긋나고, Perplexity는 출처 카드에 저자를
  노출하므로 화면과 스키마가 같은 이름을 말하는 편이 인용 신호에 유리하다.
- 수정 방향(판단 필요, §확인 필요 참조): 화면 바이라인을 스키마에 맞춰 "황경하 · 스튜디오 놀"로
  렌더(스토리 템플릿 1곳). 잠긴 실험 페이지에도 적용되는 템플릿 변경이라 **9/11 판정 이후**에.

### 5. 연습실 허브 "관련 가이드" 32개 링크가 기본 prefetch  [성능 P2]
- 근거: `components/practice-room/RelatedGuidesSection.tsx:33-40,58-65`의 `<Link>`에 `prefetch` 미지정
  (기본 true). 같은 페이지 `RegionLinksSection.tsx:46`과 전역 `StoryCard.tsx:48-51`은 `prefetch={false}`.
  뷰포트에 들어오면 `/_next/data/*.json`을 링크 수만큼 받는다. 브라우저 트레이스는 이번에 못 떴다
  (chrome-devtools 프로필을 다른 세션이 점유) — 코드 근거만.
- 수정: 두 `<Link>`에 `prefetch={false}` (StoryCard와 같은 주석 첨부).

### 6. 같은 673개 링크 데이터를 `__NEXT_DATA__`로 한 번 더 실어 보낸다  [성능 P2]
- 근거: `pages/[locale]/practice-room.tsx:454` getStaticProps가 `PRACTICE_ROOM_RELATED_GUIDES` 전체를
  `relatedGuides` prop으로 반환. 실측 `__NEXT_DATA__` 59,891B 중 `relatedGuides` **52,558B**. 같은 데이터가
  이미 SSR `<a>` 632개로 HTML에 있다. 정적 TS 상수라 props 왕복이 불필요.
- 수정: `RelatedGuidesSection`이 데이터 모듈을 직접 import, getStaticProps에서 제거.

### 7. 번역 없는 로케일 폴백 스토리의 `<html lang>`이 콘텐츠 언어와 다르다  [i18n P2/P3]
- 근거: 실측 `/vi/stories/eq1` → `<html lang="vi">`, 본문·title 한국어, `noindex, follow`, canonical → ko.
  `pages/_document.tsx`가 라우트 파라미터로 `lang`을 정한다.
- 영향: 색인 손실은 없다(noindex+canonical). `follow`라 AI 크롤러 등이 읽을 때 언어 오신호.
- 수정: `isFallbackTranslation`이면 `lang`을 원문 로케일(ko)로. 우선순위 낮음.

---

## P2 — 여유 있을 때

| # | 내용 | 근거 | 제안 |
|---|---|---|---|
| 8 | 트레일링 슬래시 URL은 Vercel 플랫폼 308이 미들웨어보다 먼저 떠서, 로케일 누락·대문자·지역 308과 겹치면 **2홉** | 실측 `/pricing/`→308→307, `/ko/stories/pre-chorus1/`→308→308, `/KO/PRACTICE-ROOM/`→308→308. `middleware.test.ts`는 함수 직접 호출이라 이 계층을 못 본다 | 내부 링크·사이트맵에 트레일링 슬래시 **0건**이라 외부 유입만 해당. 코드로는 못 막음. e2e 1케이스로 회귀만 감시 |
| 9 | `Cache-Control`의 `stale-while-revalidate`가 서버리스 응답에서 사라진다 | `next.config.mjs:180-195`·`pages/api/llms.ts:476`·`pages/api/rss.ts:108` 선언 vs 실측 `/llms.txt` `public, max-age=3600`, `/api/rss` `public`. 정적 `/sitemap.xml`은 SWR 보존 | Vercel 함수 응답 정규화. `x-vercel-cache: HIT`·`age`는 정상이라 실피해 낮음. 주석만 실측대로 정정 |
| 10 | 스토리 18편에서 H2/H3 텍스트 중복으로 heading `id` 충돌(27그룹) — 목차·딥링크가 첫 항목으로만 이동 | `components/markdown/headings.ts`(dedupe 없음), `extractHeadings.ts:108-111` 주석은 "허용 가능한 degrade" | 의도된 트레이드오프. 스니펫 추출엔 영향 적음 |
| 11 | 근접 변형 3쌍(6편)의 `summary`가 완전 동일 | `audio-interface1`/`interface1`, `chord-progression1`/`chord-progressions1`, `mic-technique1`/`mictechnique1` | 카니벌 통합 후보이기도 함. 통합 안 하면 요약만 변주 |
| 12 | frontmatter `keywords` 9편 — `lib/stories.ts`가 읽지 않는 죽은 필드(meta keywords는 `tags`에서) | `lib/stories.ts` 참조 0건 | 작성자 혼선 방지용 정리 |
| 13 | `song-structure1` 리다이렉트가 3곳에 등록, `next.config.mjs:113-116` 규칙은 미들웨어가 항상 선점해 죽은 코드 | `lib/regionRedirectMap.json:420`이 먼저 잡음 | 규칙 제거 또는 주석 |
| 14 | robots NAMED_BOTS에 `Claude-SearchBot`·`Claude-User`·`GoogleOther`·`DuckAssistBot`·`MistralAI-User` 없음 | 명명 그룹 = `*` 규칙 동일이라 **실효 차이 0** | 목록 최신화(8/9 진단도 "우선순위 낮음") |
| 15 | `serializeJsonLd`가 `</`만 이스케이프, `<!--`·U+2028 미처리 | `components/seo/schemaData.ts:67-69`. frontmatter 전수에 해당 문자열 0건 → 현재 미노출 | `<!--` 이스케이프 한 줄 추가 |
| 16 | `telephone`이 `+82-10-4255-7893`(하이픈 포함) — 엄격 E.164 아님 | Google은 허용, 리치결과 차단 사례 없음 | 선택 |
| 17 | `/_next/data/{buildId}/**/*.json`이 200·`X-Robots-Tag` 없음, robots에 Disallow 없음 | Pages Router 표준 동작 | `Disallow: /_next/data/` 검토 |
| 18 | `/llms-full.txt`가 이름과 달리 인덱스+220자 요약(편당 ≈338B, 1,103항목 534KB) | `pages/api/llms-full.ts:23-35` `formatStoryLine` | llmstxt.org 관례상 "full"은 전문 인라인. 상위 N편 전문 파일은 별도 검토(§확인 필요) |
| 19 | FAQ 아코디언이 SSR에서 전부 접힘(`aria-hidden`·height 0) | `components/ui/FAQSection.tsx:76-95`. `<noscript>` 중복 + FAQPage JSON-LD로 완화됨 | 첫 항목만 기본 펼침(`activeIndex=0`) 정도. 설계 유지 가능 |
| 20 | FAQPage·HowTo 리치결과는 구글이 2023년에 제한·폐지 | 사실 기록. 텍스트는 화면과 일치(표본 3페이지) | AEO 목적으로 유지. SERP 기대치만 낮출 것 |

---

## 확인 필요 (판단은 운영자)

1. **#4 바이라인 방향** — 화면을 스키마에 맞출지(전 스토리에 "황경하" 노출 — 수상 자랑 톤 회피
   원칙과는 무관하나 실명 노출 범위가 넓어짐), 스키마를 화면에 맞출지(Person 엔티티·sameAs 7개를
   1,500편에서 잃음 — GEO 손실). 리뷰어 권고는 전자. 9/11 이후 결정.
2. **#18 llms-full 전문 파일** — `AI_CITED_SLUGS` 상위 20편만 본문 전문을 담은 `/llms-cited.txt` 같은
   파일을 낼지. ChatGPT가 이미 인용하는 글의 세부(가격 각주·FAQ 답변)를 한 파일로 주는 효과 vs
   토큰 예산(20편 × ~3,000자 ≈ 60KB).
3. **#17 `/_next/data` Disallow** — 표준 동작이라 대부분의 Next 사이트가 그대로 둔다. 크롤 예산이
   실제로 부족하다는 근거(GSC 크롤 통계)가 없으면 안 건드려도 된다.

## 오진 방지 메모 (다음 라운드에서 또 의심하기 쉬운 자리)

- **WebPage 노드는 있다.** 서비스 LP는 `@type: "ItemPage"`(WebPage 하위)라 `grep WebPage`에 안 잡힌다.
  9/4 렌더 감사가 이걸 "없다"고 오진했다.
- **연습실 페이지 HTML에 "만실" 문자열이 남아 있는 것은 정상.** 렌더 텍스트는 "지금 입주 가능"이고,
  `__NEXT_DATA__`의 i18n JSON에 만실용 예비 키가 실린 것이다. 렌더 텍스트로 확인할 것.
- **FAQ가 `aria-hidden`으로 접힌 것은 설계**(noscript 중복 + JSON-LD). 결함으로 보고하지 말 것.
- **사이트맵 lastmod가 2026-07-21에 358건 몰린 것**은 배포 타임스탬프 오염이 아니라 git 이력
  백필 결과(실제 다른 카테고리 슬러그). 정책 위반 아님.
- **`/` → `/ko` 307**은 의도(메모리·프리플라이트). 301로 바꾸지 말 것.
- **robots NAMED_BOTS 누락은 실효 차단이 아니다.** 모든 그룹의 규칙이 `*`와 동일하다.
- **`/llms.txt`에 SWR이 안 보이는 것**은 Vercel 함수 응답 정규화. 캐시 자체(`x-vercel-cache: HIT`)는 작동한다.
- **IndexNow 잡 로그가 비어 있으면** 9/8 이전 배포는 "0건일 때 침묵"이었다. 이후는 한 줄 남긴다.
- **`$c:tailwind.config.ts` 같은 zsh 경로 치환**은 `:t` 수식어로 해석돼 빈 결과를 낸다. `${c}:`로 쓸 것.

## 정상 확인 (재검토 불필요)

- 캐노니컬: 쿼리(`?utm_source=`) 제거, 프래그먼트 무관, 폴백 로케일 → ko 원문. hreflang은 색인 가능
  URL만(ko + x-default, en 화이트리스트 4+1). `content-language`·`og:locale` 일치.
- 리다이렉트: regionRedirectMap 496키 내부 체인 0, Googlebot(Accept-Language 없음) → 결정적 308 `/ko`,
  `/KO/…`·`song-structure1`·`practice-room-drum-kick1` 전부 1홉.
- 사이트맵: 폴백 로케일 미등재, 이미지 사이트맵 표본 10개 200, `/500`은 404로 정리.
- JSON-LD: BlogPosting headline 45~62자·image 1200×630·날짜 ISO·dateModified ≥ datePublished·
  `mainEntityOfPage`·`speakable`·`wordCount`; FAQPage 답변 = 화면 텍스트(eq1·pricing·home);
  AggregateOffer `offerCount` 20 = 개별 offers, low/high 일치; BreadcrumbList position 연속;
  Person sameAs 8 + Organization sameAs 3 전부 HEAD 200; 자체 리뷰 스키마 미발행(결정대로);
  `Offer.url` 앵커 실재; HowTo `tool` 미출력(모르면 생략 설계).
- llms.txt: 상단 12%에 가격·연락처·주소·24시간·"보컬·악기 레슨 미제공"·연습실 Availability·믹싱 3구간
  전부 존재, `Level` 0건, 옛 값(10:00–24:00·0507·02-764) 0건, 가격 리터럴 0건(전부 `data/pricing.ts` 보간),
  llms-full 정렬이 `lib/llmsPriority.ts`와 순서까지 일치.
- 렌더: 본문 이미지 alt 결측 0/1,578, 표는 진짜 `<table>`, 목차 `<details open>`(JS 없이 펼침),
  CTA 전부 SSR `<a>`, 카카오 링크 `noopener noreferrer`(nofollow 아님), 마크다운 외부 링크 nofollow 일관.
- 스토리 메타: title >60자 0편, 중복 title 0, summary 70~160자 65%(<70자 35%는 개선 여지),
  faq 100%, lastmod 결측 5편(`date` 폴백 정상).
- 성능: `__NEXT_DATA__` i18n 스코핑 정상(페이지당 7~29KB), next/image AVIF·deviceSizes 화이트리스트·
  1년 immutable, 히어로 서브셋만 preload(33KB)·본문 Variable은 미preload(설계), OG 정적 WebP/동적 PNG
  결정대로, 미들웨어 매처 정적 자산 제외.

## 실행 순서 제안

1. **#1** thumbnail → `/images/og-default.jpg` (1줄, 오늘)
2. **#2** BOT_PATTERN 3토큰 + 테스트 (5줄)
3. **#5·#6** RelatedGuidesSection prefetch·props 제거 (10줄) — 9/11 이후(연습실 LP 관측 중)
4. **#3** author Person 중복 정리 (10줄)
5. **#15·#13·#12** 위생 3건 (한 커밋)
6. **#4·#7** 스토리 템플릿 변경 — 9/11 판정 이후, §확인 필요 1 결정 후
