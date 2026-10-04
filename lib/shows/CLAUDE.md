# CLAUDE.md — 공연 예매(shows)

`lib/shows/`·`components/shows/`·`pages/[locale]/shows/`·`data/shows/`를 만질 때 읽는 규칙이다.
2026-10-03 설계 정리(데이터 틀 → 화면 틀 → 공용화) 결과를 적는다.

### 새 공연 = 데이터 파일 하나 + 이미지 폴더. 코드는 손대지 않는다

정본은 `data/shows/<slug>.ts`(`ShowDefinition`)이고 DB는 그 사본이다. 등록·갱신은
`npx tsx scripts/seed-show.ts <slug>`(dry-run) → `--apply`(TURSO_* 필요, Turso 1일 토큰 — 루트 CLAUDE.md
"운영 DB 마이그레이션 적용 방법"과 같은 방식). 멱등이라 다시 돌려도 안전하고, 새 공연은 **draft**로
만들어지므로 관리자 `/admin/shows`에서 '공개하기'를 눌러야 열린다.

- 부제·출연진(소개·사진·SNS)·OG 이미지·일정 한 줄·현장 판매가·안내 목록·지도 링크는 전부 `shows`의
  **구조화 칸**(마이그레이션 0047)에 산다. `lib/shows/structured.ts`가 저장 형식의 유일한 주인이다 —
  시드가 `serialize*`로 쓰고 조회(`queries.ts`)가 `parse*`로 읽는다. 깨진 JSON은 빈 값으로 읽힌다(500 방지).
- 그 전엔 부제를 `title`에 ` — `로, 소개를 `performers` 평문에, 시간·수익·가격을 `description` 뒤 문단과
  코드 상수에 흩어 두고 파서가 갈랐다. **공연 하나 올릴 때마다 코드를 고쳐야 했던 원인**이고, 되돌리지 말 것.
  시드 검증이 `title`의 ` — `를 거부한다.
- 시드가 사진·OG 파일 존재와 OG 1200×630을 검증한다. 이미지는 `public/images/shows/`에 **날짜 박힌
  파일명**(`/images/**`는 immutable 1년 캐시 — 같은 이름으로 갈아 끼우면 옛 그림이 남는다). webp는
  `.gitignore` 대상이라 **`git add -f`** 로 올린다(펀딩 이미지와 같다) — 빠뜨리면 로컬에선 보이고 배포에선 404다.
- 히어로 폰트 서브셋(`scripts/generate-hero-font.mjs`)이 `data/shows/*.ts`의 `title`을 소스로 읽는다.
  공연을 추가하면 **빌드 후 바뀐 woff2·chars.json을 함께 커밋**한다(CI `--check`가 잡는다).
- `performers`(이름 나열, NOT NULL)는 메일·관리자·검색용으로 남는다. 상세 화면은 `performers_json`을 읽는다.

### 화면은 ShowDetailView 한 벌이다 — 펀딩 상세와 같은 합성

| 자리 | 쓰는 것 |
|---|---|
| 히어로 | 공용 `ImageHero`(**공연과 무관한 고정 사진** `SHOW_HERO_IMAGE` + `HERO_SCRIM_STRONG`, 부제·일시/장소 알약·CTA). 페이지에 `hasHero = true`. **포스터를 배경으로 깔지 않는다** — 글자가 든 이미지라 잘리고 어수선하고 공연마다 히어로가 달라진다(2026-10-04 운영자 지적). 목록 히어로도 같은 고정 사진 |
| 포스터 | `ShowPoster` — 본문(오른쪽 sticky 패널 맨 위, 모바일은 소개 앞)에서 읽을 수 있는 크기로, 너비에 맞춰 비율을 지키고 누르면 원본을 새 탭에서 연다. 가로·세로 포스터 모두 같은 틀 |
| 섹션 제목 | `SectionHeading`의 v2 문법(eyebrow + 번호 + 잉크 대형 제목). 맨 `<h2 class="typo-section-title">`를 쓰지 않는다 |
| 핵심 정보 | `ShowFacts`(`BaseCard glass`, 데스크톱 sticky, `<lg`에서는 소개 **앞**) |
| 출연진 | `LineupCard`(`components/common/`) — 펀딩 `FundingLineupPerson`과 같은 카드 |
| 목록 카드 | `ShowCard` = `Link > BaseCard glass > ResponsiveImage`(FundingProjectCard와 같은 구조) |
| 내 티켓 | 티켓 한 장 = `BaseCard` 한 장(QR·입장 번호·상태 배지). 환불은 선택 → 버튼 한 번(라벨에 매수·금액) |
| 모바일 | 공용 `MobileStickyCta`(`components/common/`) — `hideWhenInView={['#book', '[data-hide-mobile-cta]']}`로 폼·패널 버튼이 보이면 숨는다. Layout이 공연 상세에서 카카오 FAB을 `<lg`로 숨긴다 |
| FAQ | 공용 `FAQSection` + SEO `faqItems`. 답은 `lib/shows/faq.ts`가 코드의 실제 동작(환불표·판매 마감)에서 만든다 |

v2 색 가드(`components/ui/SectionHeading.test.tsx`의 `V2_FILES`)에 공연 파일들이 들어 있다 — 새 공연
컴포넌트를 만들면 그 목록에 더한다. 다크 짝·포커스 링·손 조립 카드 금지 가드는 `tailwind.config.test.ts`가
본다(실제로 두 번 걸려 고쳤다).

**동의는 결제하기를 누르는 행위로 받는다** — 환불 규정 체크박스를 두지 않는다(펀딩 PledgeWizard와 같은
규칙, 운영자 지시 2026-10-03 "동의 최소화, UX 최우선"). 규정은 `<details>`로 접어 두고, 서버 검증
(`refundPolicyAgreed`)과 기록은 그대로다. 회차·티켓 종류가 각각 하나면 라디오 대신 요약 한 줄이다.

### 경로의 대문자는 미들웨어가 소문자로 308한다 — 링크에 실리는 값은 이걸 견뎌야 한다

`middleware.ts`가 대문자 섞인 경로를 소문자로 보낸다. 2026-10-03 프로덕션에서 두 링크가 깨져 있었다.

- `/ko/shows/manage/<orderNo>`: 주문번호는 대문자(`TKT-YYYYMMDD-XXXXXXXX`)인데 소문자로 도착한다.
  `getShowOrderForManage`·환불 API가 **대문자로 정규화해 비교**한다(booking·funding과 같다). 빼면 티켓
  메일의 "내 티켓" 링크가 전부 404다.
- `/ko/shows/scan/<token>`: 토큰은 **소문자 hex**로 발급한다(`scanLink.ts`). base64url이면 소문자가
  되는 순간 해시가 달라져 모든 스캔 링크가 401이다. 경로에 실리는 비밀값은 항상 소문자 안전 알파벳으로.

### 남은 것(2026-10-03 기준)

- **공용화(설계안 겹 3)**: `MobileStickyCta`·`StatusBadge`는 새 공용 파일로 만들어 공연이 먼저 쓴다(2026-10-04).
  `FundingMobileCta`는 2026-10-04에 `MobileStickyCta`로 옮겼다(HTML 동일을 렌더 비교로 확인, 열린 실험에 펀딩 없음).
  booking·funding·shows success/fail을 공용 `TransactionResult` 한 벌로 합치는 것은 **하지 않기로 했다** — 펀딩은 유리 카드·
  여러 상태, 공연·예약은 단순해 레이아웃이 다르고, `tests/pages/privateLinkNavigation.test.ts`가 비밀 URL 페이지 **파일 안에**
  브랜드 줄과 `<a href rel="noreferrer">`가 있어야 통과하도록 짜여 있어 셸로 빼면 그 가드와 싸운다. 10/14까지 `BaseCard`·`Button`·카카오 버튼 파일 수정
  금지(전환 실험 교락 — 메모리 `design-v2-redesign-plan`). 새 파일을 만들고 *사용*하는 것은 괜찮다.
- 메일 3종(티켓·환불·회차 취소)은 `lib/shows/emailHtml.ts`(순수)가 HTML을 만들고 텍스트는 폴백이다(#463).
  QR은 첨부(ticket-N.png) — cid 인라인을 발송 모듈이 지원하지 않아서다. 실발송 확인은 아직이다.
- 실결제 흐름은 브라우저에서 눌러 본 적이 없다. 공개 뒤 최소 매수로 결제·취소를 한 번 할 것.
