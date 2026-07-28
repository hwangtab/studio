# 믹싱·마스터링 전용 페이지 신설 + 스토리 수정일 정합화 — 설계

> 2026-07-28 · 근거: `docs/proposals/geo-aeo-audit-strategy-2026-07-28.md` Phase 1 (1·5번 항목)

## 배경

GEO/AEO 전수 감사에서 두 가지가 드러났다.

**믹싱·마스터링만 전용 랜딩이 없다.** 녹음·레슨·연습실·성우·커버영상·발매는 각각 전용 페이지를 갖지만 믹싱·마스터링은 `pricing.tsx`의 한 섹션과 스토리 94편으로만 존재한다. 그 결과 "믹싱 마스터링 업체 추천" 쿼리에서 검색 노출이 전무하고, 상위는 크몽·숨고 같은 마켓플레이스와 가격표조차 없는 얕은 블로그가 차지하고 있다. 우리는 구체적 단가·트랙 기준·파일 규격을 이미 갖고 있으므로 콘텐츠 품질로 이길 수 있는 지형이다.

**스토리 수정일이 사실과 다르다.** `lib/stories.ts:330`이 `fs.statSync(filePath).mtime`으로 `dateModified`를 만든다. git은 mtime을 보존하지 않으므로 Vercel이 배포할 때마다 1,584편 전체가 "방금 수정됨"으로 찍힌다(감사 당일 실측: 발행일 2026-04-06인 글의 `dateModified`가 그날 빌드 시각). 균일한 가짜 최신성은 엔진이 결국 할인하고, 무엇보다 사실이 아니다.

## 확정된 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| URL | `/[locale]/mixing-mastering` 통합 | 한국어 검색이 "믹싱 마스터링"을 붙여 쓴다. 마스터링 단독 상품이 소수라 분리하면 thin content가 되고 두 페이지가 같은 쿼리에서 경쟁한다 |
| 영어 색인 | `lib/enIndexablePaths.json`에 추가 | 원격 납품이 가능한 유일한 서비스군. ChatGPT발 최대 랜딩이 `/en/contact`(90일 58세션)로 영어권 수요가 실증됨 |
| 수정일 | git 이력 → frontmatter `lastmod` 백필 | 진짜 개정 이력이 살아나고, Vercel·CI의 얕은 클론에 영향받지 않는다 |
| EP/앨범 마스터링 | 8만원/곡(4곡 이상) 공개 | 위키에는 확정돼 있으나 라이브 가격표에 없던 항목 |

## Part A — `/[locale]/mixing-mastering`

### 섹션 구성

`recording.tsx`의 검증된 골격을 따른다. 순서는 PAWC(위치 가중 단어수)를 고려해 배치했다 — 첫 150단어 안에 "얼마·얼마나 걸리나·원격 되나"가 모두 답변된다.

1. **히어로** — 원격 의뢰 가능·곡당 20만원부터를 제목·부제에 노출, 카톡 CTA
2. **빠른 답변 3문항** — 비용 / 기간 / 원격 가능 여부
3. **이런 분들을 위해 4종** — 홈레코딩 보유자, 타 스튜디오 녹음분, 발매 준비, 지방·해외
4. **가격** — `#mixing` Level 1~3, `#mastering` 싱글·EP/앨범, 보컬 튠 옵션 고지, VAT 별도
5. **원격 의뢰 4단계** — HowTo 스키마와 동일 데이터
6. **파일 준비 규격** — 증거 밀도의 핵심 섹션
7. **작업 환경** — 모니터·아웃보드·플러그인 실명
8. **믹싱 크레딧** — 포트폴리오 상세로 연결
9. **FAQ 6문항** — FAQPage 스키마
10. **관련 가이드 6편** + **문의 CTA**

### 페이지에 쓸 사실 (전부 저장소 출처, 날조 없음)

| 사실 | 출처 |
|---|---|
| 믹싱 Level 1 20만원 / 10트랙 이하 | `data/pricing.ts:15,141,154` |
| 믹싱 Level 2 35만원 / 11~30트랙 | `data/pricing.ts:16,167,180` |
| 믹싱 Level 3 50만원 / 31트랙 이상 | `data/pricing.ts:17,193,205` |
| 믹싱 기본 2회 수정 포함 | `data/pricing.ts:154,180,205` |
| 싱글 마스터링 10만원/곡, 1회 수정 | `data/pricing.ts:18,234` |
| EP/앨범 마스터링 8만원/곡(4곡 이상) | `docs/wiki/concepts/pricing-offers.md:33-55` — **본 작업에서 SSOT로 승격** |
| 보컬 튠/에딧 +15만원/곡 | `public/locales/ko/common.json:279` |
| VAT 별도 | `data/pricing.ts:47-48` |
| 원격 의뢰 가능, 카톡·구글드라이브·WeTransfer | `content/stories/onlinemix1.md` faq, `docs/wiki/entities/services.md:46` |
| 드라이 보컬 WAV + MR WAV + 레퍼런스 1~2개 | `content/stories/selfmix1.md` faq |
| WAV 24bit / 44.1~48kHz 권장 | `content/stories/mix-prep1.md`, `stem-mixing1.md` faq |
| 마스터링 의뢰 시 마스터버스 리미터·컴프 제거, 피크 −3~−6dBFS | `content/stories/mix-prep1.md` faq |
| 납품 3~7영업일 | `public/locales/en/common.json:259` |
| 스트리밍 라우드니스 Spotify −14 / Apple Music −16 / YouTube −14 LUFS | `docs/wiki/entities/services.md` |
| 모니터 Proac Tablett 50, EVE Audio SC207, ADAM A5 | `data/equipment.ts:39` |
| 아웃보드 SSL Fusion, Tegeler Vari Tube, SPL Optimizer | `data/equipment.ts:35,36,38` |
| 플러그인 UAD, Acustica, Softube, Soundtoys, iZotope | `data/equipment.ts:66-77` |

**크레딧 표기 주의.** 티어라이너 〈Bite Me〉는 마스터링이 런던 Metropolis Studios라 **믹싱 크레딧으로만** 쓴다. 〈젠트리피케이션〉은 `engineer` 필드와 본문 서술이 서로 어긋나 있어(마스터링 주체 불일치) 이번 페이지에서는 쓰지 않는다. 사용할 크레딧은 세민 〈여린 잎〉(전곡 녹음·믹싱·마스터링), 남자애 CHILD B(전 과정), 김동산 〈물결〉·남수 〈안녕〉·류형수 〈하루〉(녹음·믹싱)다.

### 구조화 데이터

`buildSchemaGraph`로 묶어 한 번에 emit한다.

- `Service` — `buildStudioServiceSchema` 재사용, 앵커 가격은 믹싱 Level 1(20만원), `pricingHash: 'mixing'`
- `Offer` 4종 — 믹싱 3티어 + 마스터링, `getOfferPriceValidUntil()` 적용
- `HowTo` — 원격 의뢰 4단계, `generateHowToSchema`
- `FAQPage` — SEO 컴포넌트의 `faqItems` prop 경유
- `BreadcrumbList`, `ItemPage`

### 코드 변경

| 파일 | 변경 |
|---|---|
| `pages/[locale]/mixing-mastering.tsx` | 신규. SSG + `revalidate: 86400`, `i18nSections: ['mixingMastering', 'stories']` |
| `public/locales/{7}/common.json` | `mixingMastering` 섹션 신규. 7개 로케일 전부 — `content/localeKeyParity.test.ts`가 키 집합 동일성을 강제한다 |
| `data/pricing.ts` | `MASTERING_PACKAGE_PRICE = 80000` 상수 + `masteringOffers`에 EP/앨범 항목 추가 |
| `lib/navLabels.ts` | `NavKey`에 `mixingMastering` + 7개 로케일 라벨 |
| `components/layout/Header.tsx` | `recording` 그룹에 항목 추가 |
| `components/layout/Footer.tsx` | 링크 추가 |
| `data/serviceRelatedStories.ts` | `mixing-mastering` 키 + 슬러그 6종 (`onlinemix1`, `mixing-vs-mastering1`, `mixing-mastering-price-by-track-count`, `mix-prep1`, `stem-mixing1`, `mastering1`) |
| `lib/enIndexablePaths.json` | `/mixing-mastering` 추가 |
| `pages/api/llms.ts` | Key Pages·Primary Services에 반영 |

이미지는 신규 촬영 없이 기존 자산(`console.webp`, `studio*.webp`, `og-hardware*.webp`)을 쓴다.

## Part B — 스토리 수정일 정합화

`scripts/backfill-story-lastmod.mjs`가 `content/stories/*.md` 전체에 대해 `git log -1 --format=%cI`를 돌려 마지막 커밋 시각을 얻고, 그 값이 frontmatter `date`보다 늦을 때만 `lastmod` 필드를 써넣는다. 발행 후 손대지 않은 글에는 아무것도 추가하지 않는다.

우선순위는 `lastmod` → `date`다. mtime은 완전히 제거한다.

| 파일 | 변경 |
|---|---|
| `scripts/backfill-story-lastmod.mjs` | 신규. 1회성 백필, `--dry-run` 지원 |
| `lib/storyFrontmatter.ts` | `lastmod` 파싱 + ISO 정규화 |
| `lib/stories.ts` | `fs.statSync().mtime` 제거, `lastmod ?? date` |
| `types/story.ts` | `modifiedDate` 주석 정정 |
| `pages/[locale]/stories/[id].tsx` | `lastmod`이 발행일보다 늦을 때만 "최종 업데이트" 표기 |
| `public/locales/{7}/common.json` | `stories.lastUpdated` 라벨 |
| `lib/storyFrontmatter.test.ts` | `lastmod` 파싱·폴백 케이스 |

**왜 사이드카 JSON이 아닌 frontmatter인가.** Vercel과 GitHub Actions는 얕은 클론이라 빌드 중 `git log`가 옛 파일 이력을 찾지 못한다. 사이드카를 쓰면 반드시 커밋해야 하고 콘텐츠를 고칠 때마다 재생성·커밋이 필요해 드리프트 검사까지 붙여야 한다. frontmatter는 콘텐츠 파일 안에 값이 들어가므로 그런 장치가 전부 불필요하다.

## Part C — 발견된 가격 오류 정정

`releaseProject.hubFaq`의 부분 의뢰 문항이 7개 로케일 전부에서 "시간당 4만원~ 보컬 녹음, 80만원~ 믹싱"이라고 안내한다. 실제 값은 시간당 10만원(`RECORDING_HOURLY_PRICE`), 믹싱 20만원부터(`MIXING_LEVEL1_PRICE`)다. 싱글 발매 전체가 50만원부터인데 믹싱만 80만원일 수는 없다.

`/release-project`는 ko·en 모두 색인 대상이라 AI 엔진이 틀린 가격을 그대로 인용할 수 있다. 7개 로케일을 가격 SSOT에 맞춰 정정한다.

## 검증

`npm run type-check` · `npm run lint` · `npm test` · `npm run build`를 모두 통과해야 한다. 특히 `content/localeKeyParity.test.ts`(7개 로케일 키 집합), `content/i18nKeys.test.ts`(코드가 쓰는 키 존재), `content/factGuards.test.ts`(사실 가드)를 주시한다. 빌드 후 `/ko/mixing-mastering`의 JSON-LD를 Rich Results Test 규격으로 파싱해 Service·HowTo·FAQPage가 모두 유효한지 확인한다.

## 범위 밖

레슨 콘텐츠 클러스터, 음반 제작 과정 pillar, Wikidata 등록, 네이버 블로그 발행, sameAs 확장은 GEO 전략의 Phase 1~2 별건이다. 이 설계에는 포함하지 않는다.
