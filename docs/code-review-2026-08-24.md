# 전방위 코드리뷰 — 2026-08-24

7개 영역 병렬 에이전트 리뷰(보안·접근성·성능·코드품질·i18n·SEO·테스트/위생) 결과 통합.
모두 읽기 전용 리뷰이며 코드는 변경하지 않았다.

## 기준선 (실측)

| 항목 | 결과 |
|---|---|
| `npm run type-check` | 통과, 에러 0 |
| `npm run lint` | 통과, 에러 0 — **단, 대상 디렉토리 절반 누락(High-2 참조)** |
| `npm test` | 97 suites / 709 tests 전부 통과 |
| i18n 키 패리티 | 7개 언어 876키, missing 0 |
| SEO 구현 | P0/P1 결함 없음 |
| 시크릿·인감 커밋 | 재발 없음 |

---

## P0 — 이번 주

### 1. 계약 페이지(PII)가 `public` 캐시 지시자로 내려간다  [보안 High]
- 근거: `next.config.mjs:231-235`의 `/:locale(ko|en|zh|es|vi|th|uz)/:path*` →
  `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
  이 패턴이 `/ko/contracts/{id}/sign`·`/complete`까지 매칭한다.
  두 페이지는 GSSP로 이름·호실·기간·금액·연락처·계약 본문을 렌더하며
  스스로 Cache-Control을 설정하지 않는다(확인 완료: grep 결과 0건).
- Next 15는 config 헤더를 렌더 이전에 세팅하고, 페이지 핸들러는
  `if (cacheControl && !res.getHeader('Cache-Control'))`일 때만 기본 `no-store`를
  붙인다 → SSR 기본 private 정책이 덮이지 않고 사라진다.
- 영향: 공용 프록시·Vercel Edge가 계약 본문 HTML을 최대 1시간(+SWR 24h) 보관.
  취소·재발송으로 무효화한 뒤에도 캐시 수명 동안 옛 계약이 서빙된다.
- 수정: 두 GSSP 첫 줄에서
  `context.res.setHeader('Cache-Control', 'private, no-store, max-age=0')`
  또는 next.config 패턴에서 contracts 제외.
- **배포 후 반드시 `curl -sI https://studionol.co.kr/ko/contracts/<id>/sign?token=...`로
  실제 헤더 확인** (Vercel 프록시 적용 시점은 self-hosted 코드 경로로만 검증됨).

### 2. lint가 `hooks/`·`types/`·`scripts/`를 건너뛴다 — CI 게이트 구멍  [코드품질 High]
- 근거: `package.json:44` — 대상이 `pages components lib data utils middleware.ts next.config.mjs`뿐.
- 동일 설정으로 세 디렉토리 직접 실행 시 **102 error / 276 warning**.
  - `types/data.ts:52,79`, `types/prismjs.d.ts` — `any` 7건 (프로젝트가 error로 켜둔 규칙)
  - `types/index.ts:12` — 빈 `{}` 타입
  - `scripts/structureIntegrity.js:12`, `scripts/styleDistribution.js:104-107` — no-require-imports
- 수정: lint 스크립트에 `hooks types` 추가 + `scripts/`용 완화 override 블록.
  `types/`의 `any` 7건은 실제 타입으로 교체.

### 3. 계약서 시스템 HTTP 레이어가 통째로 무테스트  [테스트 P0]
- `pages/api/admin/auth.ts`, `lib/contracts/admin-auth.ts`, `admin-rate-limit.ts` — 테스트 0건.
  서명 API가 같은 rate-limit 모듈을 재사용하므로(`sign.ts:5`) 버그가 전파된다.
- `lib/contracts/*.test.ts` 14개는 순수 함수만 검증. 라우트 5개
  (`[id].ts`, `[id]/download.ts`, `[id]/pdf.ts`, `[id]/sign.ts`, `index.ts`)의
  메서드 분기·400/401/404/405·`waitUntil` 후처리 배선은 미검증.
- `cron/*` 3개 무테스트 — `purge-contracts`는 데이터 삭제 로직.

---

## P1 — 이번 달

### 4. 서명 토큰만으로 서명본 PDF를 무기한 다운로드  [보안 Medium]
- `pages/api/contracts/[id]/download.ts:27-77` — 토큰 + `status==='signed'`만 확인,
  본인 확인(연락처 뒷자리) 미요구(서명 시에는 요구함: `sign.ts:108-138`).
  서명 완료 후 토큰 무효화 없음, 만료는 `sent` 상태에만 적용(`status.ts:107-114`).
  이 URL이 완료 메일에 영구 링크로 실린다(`finalize.ts:34`).
- 수정: 다운로드에도 `verifyIdentityDigits` 요구, 또는 짧은 수명 다운로드 토큰 분리,
  또는 서명 후 N일 경과 시 차단 + 운영자 재발급.

### 5. 관리자 로그인 제한이 IP 기준 + DB 장애 시 fail-open  [보안 Medium]
- `admin-rate-limit.ts:20-33, 61-84`, `admin-auth.ts:6,22-35`.
  프록시 풀로 IP 회전 시 10회/10분 제한 무력화. 인스턴스 분산 시 카운터 분열.
  성공하면 `/api/contracts` GET 한 번으로 전 계약 PII 노출.
- 수정: `admin_login:global` 전역 카운터 추가. 장기적으로 `/admin`에
  TOTP 또는 Vercel Deployment Protection.

### 6. `/admin/*`에 CSP가 적용되지 않음  [보안 Medium]
- `middleware.ts:243` matcher가 negative lookahead에 `admin` 포함 →
  `setSecurityHeaders` 미적용. `next.config.mjs:238-250` 전역 블록에는 CSP 없음.
- 관리자 화면이 계약 본문을 `markdown-to-jsx`로 렌더하므로 두 번째 방어선이 필요.
- 수정: admin 경로에서 `setSecurityHeaders(NextResponse.next())` 조기 반환.

### 7. 스토리 1,764편을 런타임에 읽는 경로 2곳  [성능 Medium]
- `pages/api/stories/catalog.ts:39-45` — 카테고리 필터마다 `getAllStories()`.
  콜드 스타트 시 1,580편 `readFileSync`+`gray-matter` 파싱 후 12개만 반환.
- `pages/[locale]/stories/[id].tsx:377-380` — `fallback:'blocking'` +
  `getRelatedStories`(`lib/stories.ts:489-501`)가 다시 전체 코퍼스 스캔.
  검색·SNS 유입이 정확히 이 콜드 경로를 탄다.
- 선례: `scripts/generate-story-catalog.js`가 GSC 감사용으로 이미 빌드타임
  경량 JSON을 만들고 있다 — 두 경로만 이 패턴이 안 붙었다.
- 수정: prebuild에서 locale별 경량 catalog JSON 생성 → 두 경로가 그걸 조회.
  `--check` 모드 CI 게이트 동반(hero-font-subset 패턴).

### 8. i18n 패리티 CI 게이트 부재  [i18n P3이나 실질 우선]
- 현재 876키 100% 일치하지만 이를 지켜주는 자동 검증이 없다.
  `lib/i18n.ts:82-105`의 `missingKeyHandler`는 dev에서 `console.warn`만 →
  ko에만 키 추가 시 프로덕션 비-ko에 `home.faq.title` 원시 키 노출.
- 수정: flatten 비교 스크립트를 Jest 테스트로 승격.

### 9. AudioPlayer 아이콘 버튼 라이트 모드 대비 미달  [접근성 High]
- `AudioPlayer/PlayerControls.tsx:30,58`, `VolumeControls.tsx:30` —
  `text-gray-400`(#9ca3af) on `bg-white` ≈ **2.85:1**, WCAG 1.4.11(3:1) 미달.
  다크 모드는 `text-white/60`으로 별도 관리 → 라이트만 놓친 비대칭.
  터치 기기엔 hover가 없어 복구 불가.
- 수정: `text-gray-500`(이미 AA용으로 재조정된 토큰) 이상으로.

### 10. 계약서 페이지 저장소 위생 — 12MB 잡파일  [테스트/위생 P1]
- `.gemini-clipboard/*.png` 4개 **9.1MB**(프로젝트 무관), `naver-cards/` 2.3MB,
  `build_output.log`·`raw_refs.txt`·`problematic_refs.txt`(반년 방치),
  루트 스크린샷 `en-header.png` 외 3개.
- `.gitignore`가 파일명 단위 예외만 나열 → 매번 개별 추가 필요한 구조.
- 수정: `git rm` + 루트 `*.png`·`naver-cards/`·`.gemini-clipboard/` 포괄 패턴 추가.

---

## P2 — 여유 있을 때

| # | 항목 | 근거 |
|---|---|---|
| 11 | 죽은 코드 제거 (~200줄) | `LocalizedLink.tsx`(51줄, import 0), `ScrollProgress.tsx`(29줄), `data/faq.ts`의 FAQ 필터 3함수(~90줄), `buildEmailHtml`, `HOVER_Y`/`VIEWPORT_ONCE` |
| 12 | 서비스 5페이지 셸 공통화 | `recording/lesson/voice-acting/wedding-song/cover-video.tsx` 각 387~498줄, 동일 섹션 순서 반복. CTA 배색 같은 횡단 규칙 적용 시 누락 지점 |
| 13 | 문의 폼 JSON 파싱 실패 무음 | `utils/contactSubmitPolicy.ts:35-41` — 500 HTML 응답을 `{}`로 삼켜 잘못된 성공 메시지 위험 |
| 14 | `ImageHero` 텍스트 대비 | `common/ImageHero.tsx:40,104-119` — 오버레이 최대 20%, drop-shadow를 호출부가 개별 부담. 컴포넌트 기본값으로 승격 |
| 15 | 랜드마크 aria-label 영어 하드코딩 | `layout/DesktopNav.tsx:47`, `ui/Pagination.tsx:57` |
| 16 | KakaoFab 라벨 하드코딩 | `common/KakaoFab.tsx:35,37` — common.json 실제 값("카카오톡")과 다른 "카톡 문의" 하드코딩, 단일 소스 깨짐 |
| 17 | FAQSection/QuickAnswers 한국어 기본 prop | `ui/FAQSection.tsx:24-25`, `ui/QuickAnswers.tsx:22-23` — 현재는 죽은 코드지만 새 페이지에서 prop 누락 시 비-ko에 한국어 노출 |
| 18 | 크론 시크릿 비상수시간 비교 | `cron/{gsc-audit,purge-contracts,backup-contracts}.ts` — `timingSafeEqual`로 통일 (관리자 비밀번호는 이미 적용됨) |
| 19 | 홈 BreadcrumbList 단일 항목 | `pages/[locale]/index.tsx:79-81` — 다른 페이지는 2단계. 홈은 prop 생략이 스펙 의도 |
| 20 | 스토리 메타 description 하드 절단 | `lib/storySeoData.ts:40-42` — 160자에서 경계 무시 절단, 소셜 카드에 단어 중간 노출 |
| 21 | 미사용 의존성 | `i18next-http-backend`, `react-intersection-observer` |
| 22 | rate limit IP 판정 불일치 | `lib/contact/rateLimit.ts:63-75`가 위조 가능한 `x-real-ip`/`x-forwarded-for` 폴백. 계약 쪽(`client-ip.ts:18`)은 `x-vercel-forwarded-for`만 사용 — 계약 쪽으로 통일 |
| 23 | 운영자 이메일·계좌·전화 하드코딩 | `inbound/resend.ts:19`, `contact/send-email.ts:13`, `cron/gsc-audit.ts:19`, `lib/contracts/email.ts:97,115` — env 폴백 패턴으로 |

---

## 확인 필요 (판단 불가, 사용자 확인 요망)

1. **`next` 15.5.18 고정 이유가 어디에도 없음.** `npm audit --omit=dev` high 7건
   (Server Actions DoS/SSRF, 캐시 혼동, SVG 이미지 최적화 DoS 등).
   15.5.23 패치가 나와 있으나 고정 사유를 몰라 판단 보류.
   `sharp` <0.35.0 libvips CVE 4건은 `@vercel/og`가 물고 있어 breaking.
2. **`CRON_SECRET`이 Vercel에 실제 설정돼 있는지.** 미설정이면 코드는 401로
   fail-closed되지만, **3년 경과 개인정보 자동 파기가 조용히 멈춘 상태**일 수 있다.
   `purge-contracts` 실행 로그 확인 권장.
3. **`audit:thin:ci`가 CI에 안 걸려 있음.** 스크립트만 존재. 의도적 제외인지 누락인지.
4. **`practiceRoom.residentBenefits.calendarLinkUrl`이 `kosmart.co.kr/calendar`.**
   사이트 도메인은 studionol.co.kr이고 kosmart는 현재 모조직이 아니다. 구 도메인 잔재 여부.
5. **`markdown-to-jsx`가 계약 본문 raw HTML을 실행하는지 미검증.** 현재 도달 경로는
   없다고 판단(본문이 템플릿+이스케이프 필드로만 조립)했으나, 향후 관리자 자유 입력을
   열면 반드시 먼저 확인할 것.

---

## 오진 방지 메모 (다음 라운드에서 또 의심하기 쉬운 자리)

- `next-sitemap.config.js:51`의 `/recording` OG "₩250K/song"은 `RECORDING_HOURLY_PRICE`
  (₩100K/시간)와 어긋나 보이지만 `VOCAL_PACKAGE_PRICE`(250,000원) 기준의 **정확한 표기**다.
- `MotionConfig reducedMotion`이 데스크톱에서 `'user'`인 것은 framer-motion이 OS
  `prefers-reduced-motion`을 자체 감지하기 때문 — 버그 아님.
- 비-ko 5개 로케일의 SEO 메타/JSON-LD가 영어인 것은 site-wide noindex 정책과 맞물린
  의도된 상태 — 검색 영향 없음.
- `ContactInfoCard`가 전 로케일에서 카카오 링크를 렌더하는 것은 CLAUDE.md에
  명시적 제외 대상으로 문서화돼 있음 — 규칙 위반 아님.
- `data/portfolio/items.ts`(877줄)는 `generate-portfolio-meta.js`의 brace-tracking
  파싱 때문에 구조를 유지해야 함 — 방치가 아니라 의도된 트레이드오프.
- `en` 로케일 orphan 키 2건(`contact.whatToExpect.items`, `contact.faq`)은
  `contact.tsx:198-244`의 영어 전용 블록 — ko에 없는 게 정상.
