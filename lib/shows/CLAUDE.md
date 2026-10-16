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
- 소개(`description`)는 빈 줄로 가른 문단이고, `## `로 시작하면 소제목·`> `로 시작하면 인용이다(`descriptionBlocks`). **첫 문단은 평문이어야 한다**(검색 요약·OG가 첫 문단에서 나오며 시드가 검사한다). 사실(수치·인용)은 펀딩 프로젝트 페이지처럼 출처가 있는 것만 옮기고 새 사실을 더하지 않는다.
- **공연장 지도는 제공자 목록이 만든다**(`lib/shows/maps.ts`). 길찾기 버튼(네이버 지도·카카오맵)은 `SHOW_MAP_PROVIDERS`를 돌아 만들어지므로 제공자를 늘리려면 그 목록에 한 줄만 더한다. **제공자마다 잘 먹는 검색어가 다르다**(실측 2026-10-04): 네이버·구글은 `장소명 + 도로명 주소`, **카카오맵은 도로명 주소만**(합치면 "검색 결과가 없어요"). 셋 다 "가동 1층" 같은 건물 안쪽 표기는 떼야 한다(`showMapStreet`). 검색이 다른 가게를 잡으면 공연 정의의 `mapLinks: { kakao: 'https://place.map.kakao.com/…' }`처럼 제공자별 정확한 주소(https)로 덮는다(컬럼 `map_links_json`, 마이그레이션 0049). 옛 `map_url` 컬럼은 더 쓰지 않는다. 상세 지도는 한국어 화면이 카카오맵(`components/maps/KakaoMap.tsx`, 실패하면 구글 임베드), 영어 화면이 구글 임베드다(CSP frame-src에 `www.google.com`).
- `performers`(이름 나열, NOT NULL)는 메일·관리자·검색용으로 남는다. 상세 화면은 `performers_json`을 읽는다.

### 화면은 ShowDetailView 한 벌이다 — 펀딩 상세와 같은 합성

| 자리 | 쓰는 것 |
|---|---|
| 히어로 | 공용 `ImageHero`(**포스터 배경을 다른 페이지와 똑같이 — 선명하게, 확대 애니메이션 그대로, `overlayGradient={HERO_SCRIM_STRONG}`**(펀딩 목록·상세와 같은 방식). 공연만 blur를 걸고 애니메이션을 끄던 것은 2026-10-07 운영자 지적("히어로 나오는 방식 정합성")으로 걷었다 — 다시 `className`으로 `.hero-zoom`을 덮지 말 것), 주최·제목·부제·일시/장소 알약·CTA). 페이지에 `hasHero = true`. 히어로 **안에** 작은 포스터 카드는 두지 않는다(운영자 지적 2026-10-04) — 포스터는 본문 `ShowPoster`가 보여 준다. 목록 히어로 배경은 가장 가까운 공연의 포스터. 포스터가 없을 때만 `SHOW_HERO_IMAGE`(스튜디오 사진) 폴백. **2026-10-04에 배경까지 고정 사진으로 바꿨다가 요청과 달라 되돌렸다 — 요청은 "히어로 안의 포스터 카드를 빼고 본문에 크게"였다** |
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

### 영어 화면(/en/shows) — 2026-10-07 운영자 결정 "영어만"

공연은 **한국어·영어 두 언어만** 연다. 그 밖의 로케일(zh·es…)로 들어오면 `/en/shows/…`로 보낸다(`fallbackShowLocale`).
처음(#442)엔 근거 없이 ko 전용이었다 — 운영자가 "왜 한국어 전용이냐"고 지적해 열었다.

- **화면 문구**는 `lib/shows/i18n.ts` 한 파일에 ko·en 두 벌(`showCopy(locale)`). common.json에 넣지 않는다(5개 로케일에 빈 키가 생긴다).
  컴포넌트는 `locale` prop(기본 'ko')을 받는다. 같이 쓰는 결제 컴포넌트(`PaymentMethodPicker`·
  `BankDepositGuide`·`RefundAccountFields`)와 메일 레이아웃(`buildEmailLayout`)에도 `locale` 옵션이 있다 — 기본 ko라 다른 화면은 그대로다.
- **공연 내용**의 영어는 공연 정의의 `en` 칸(`ShowTranslation`)이다. **DB에 넣지 않는다** — 페이지가 조회 직후
  `localizeShow`/`localizeManageOrder`(lib/shows/localize.ts)로 덮어쓴다. 한국어를 고치면 `en`도 같이 고친다. 번역이 없는 칸은 한국어 그대로 보인다.
  출연진 소개를 옮길 때 원문에 없는 성별(she/he)을 붙이지 않는다.
- **지도**: 영어 화면은 구글 지도 임베드 + 구글·네이버·카카오 길찾기(`showMapLinks(…, 'en')`). 지도 검색은 한국어 주소라야 잡혀서
  영어 화면도 `mapSource`(원래 한국어 장소명·주소)로 검색한다.
- **주문 언어**는 `show_order_locales`(마이그레이션 0050) — 영어 화면으로 만든 주문만 행이 있다. 티켓·환불·회차 취소·입금 안내 메일과
  "내 티켓" 주소(`/en/shows/manage/…`)가 이 언어를 따른다. 운영자 알림은 언제나 한국어. 별도 표인 이유는 0037과 같다(관계 조회가 전체
  컬럼을 SELECT) — 읽기·쓰기를 try로 감싸 **표가 없으면 한국어로 동작할 뿐 깨지지 않는다**(`lib/shows/orderLocale.ts`).
- **연락처**: 영어 주문을 위해 해외 번호(`+국가번호…`)도 받는다(`normalizeShowContact`). 문자 발송에는 쓰지 않는다.
- 토스 결제위젯 iframe은 토스가 그리는 한국어 화면이라 바꿀 수 없다. 처리방침은 한국어 원본으로 연결한다(라벨에 "(Korean)").
- 영어 화면도 사이트 정책대로 `noindex, follow`다(SEO.tsx의 비-ko noindex). 색인하려면 그 정책부터 정한다.

### 경로의 대문자는 미들웨어가 소문자로 308한다 — 링크에 실리는 값은 이걸 견뎌야 한다

`middleware.ts`가 대문자 섞인 경로를 소문자로 보낸다. 2026-10-03 프로덕션에서 두 링크가 깨져 있었다.

- `/ko/shows/manage/<orderNo>`: 주문번호는 대문자(`TKT-YYYYMMDD-XXXXXXXX`)인데 소문자로 도착한다.
  `getShowOrderForManage`·환불 API가 **대문자로 정규화해 비교**한다(booking·funding과 같다). 빼면 티켓
  메일의 "내 티켓" 링크가 전부 404다.
- `/ko/shows/scan/<token>`: 토큰은 **소문자 hex**로 발급한다(`scanLink.ts`). base64url이면 소문자가
  되는 순간 해시가 달라져 모든 스캔 링크가 401이다. 경로에 실리는 비밀값은 항상 소문자 안전 알파벳으로.

### 결제수단 — 카드·간편결제(토스) / 계좌로 직접 입금 (2026-10-14 되돌림)

예매 폼은 카드·간편결제(토스)와 "계좌로 직접 입금"을 보인다(`PaymentMethodPicker withBank`). 2026-10-12에는 직접 입금을 접고
토스 계좌이체로 바꿨지만, 토스 계좌이체는 은행을 고르면 뱅크페이가 떠 PC 보안 프로그램·앱 전환을 요구해 고령층이 쓰지 못했다.
그래서 직접 입금을 되살렸다(환불 때 환불 계좌를 받아 손으로 송금하는 번거로움은 알고 내린 결정). 입금 대기 주문은 좌석을 기한
없이 잡고, 회차 시작 2시간 전부터는 막는다(`bankDepositBlockReason`). `/api/shows/orders`는 `paymentMethod: 'bank_transfer'`를
받아 입금 안내 메일을 보내고 내 티켓 주소를 돌려준다. 결제 실패 화면(`shows/fail`)이 "계좌로 직접 입금"을 한 번 더 권한다.

- 아래 계좌 입금 절이 입금 대기·입금 확인·환불 계좌의 처리 경로다(2026-10-12에 신규 신청을 막았던 동안에도 지우지 않았다).

### 계좌 입금(무통장) — 좌석은 기한 없이 잡고, 자동 취소는 없다 *(신규 신청 없음, 기존 주문 처리용)*

공통 규칙은 `lib/payments/bankDeposit.ts` 머리 주석, 공연 쪽 전이는 `lib/shows/bankDeposit.ts`.

- 생성: `createShowOrder(paymentMethod: 'bank_transfer')` → 주문 `awaiting_deposit`, 티켓 `held`,
  `show_orders.hold_expires_at` **NULL**. 좌석 집계(conditions.ts·queries.ts)가 `hold_expires_at IS NULL`을 점유로
  세므로 이중 판매가 없고, `expireStaleShowOrders`는 `pending`만 보므로 만료되지 않는다. **새 좌석 집계를 만들면
  이 NULL 보류를 점유로 셀 것.** 회차 시작 2시간 전 이내는 계좌 입금 불가(판매가 전날 자정에 닫혀 실제로는 거의 걸리지
  않는다).
- 입금 확인(`confirmShowBankDeposit`): 회차가 살아 있을 때만 발권(`liveShowtimeCondition`) — 취소·시작 뒤 입금은
  돌려주고 "미입금 취소"로 닫는다. 결제 행 `bank-deposit:<주문번호>` → 정리번호 → `sendShowTicketEmail`(토스와 같은 센티널).
- 환불: 계좌 입금 주문은 토스를 부르지 않는다(`isBankDepositPayment`). 고객은 내 티켓에서 환불 계좌를 적고, 기록·
  티켓 refunded·좌석 해제는 그 자리에서 끝난다. 송금 여부는 `refund_accounts.refunded_at`(관리자 "송금 완료").
  **회차가 취소된 주문은 취소환불표 대신 100%**(refund.ts·queries.ts가 같은 판정).
- 회차 취소: 입금 전 신청은 닫고 "입금하지 마세요"(`bankNotice: 'not_deposited'`), 계좌로 결제된 주문은 토스로 못
  돌려주므로 티켓을 남겨 두고 "내 티켓에서 환불 계좌를 적어 주세요"(`refund_account_needed`). 입장은 회차 상태가 막는다.

### 공연 전체 취소 = 마지막 회차 취소의 결과 (2026-10-16)

별도 "공연 취소" 버튼은 없다. `cancelShowtime`이 **published 공연의 취소되지 않은 회차가 하나도 안 남으면** `shows.status`를 `cancelled`로 닫는다
(`ended` 회차가 남아 있으면 그대로, draft는 건드리지 않는다 — draft가 cancelled가 되면 취소 공연으로 공개된다). 공개 쪽은 이미 `cancelled`를 읽는다(판매 중단·취소 안내).
되돌림은 관리자 `set_status`(`draft`/`published`)가 취소 상태에서도 되고(`sqlUpdateStatus(..., { fromCancelled })`), 공개는 예정된 미래 회차가 있어야 한다.
주최자 승인 경로의 `sqlUpdateStatus`는 여전히 취소된 공연을 건드리지 않는다.

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

### 주최자 자가등록 (2026-10-14)

주최자 = 펀딩 개설자 계정(매직 링크, `creator_session`). 개설자 콘솔의 공연 탭 `/ko/funding/creator/shows` → 편집기
`/ko/funding/creator/shows/[id]`(`components/shows/organizer/ShowDraftForm.tsx`). 안내 `/ko/shows/host`, 약관 `/ko/shows/organizer-terms`.
제출물은 `show_submissions`(마이그레이션 0055). 어겨도 에러가 안 나는 것만 적는다.

- **초안 형식의 주인은 `lib/shows/organizer/draft.ts`다.** `ownImage` 검증(본인 업로드만, 한 조각 파일명 `resolveFundingBlobPath`,
  쿼리는 `?w=&h=`만)을 우회하는 새 경로를 만들지 말 것.
- **승인**(`review.ts`): 같은 slug의 `shows` 행이 하나라도 있으면 `duplicate_slug`(기존 공연을 넘겨받지 않는다). `seedShow`(반드시 새로 만듦)
  → 제출물 갱신(조건부) → 실패하면 방금 만든 초안 행을 지움 → publish 순서. publish만 실패하면 승인은 유지하고 경고를 낸다.
- **승인 뒤 주최자 수정은 `seedShow`를 쓰지 않는다.** `shows`의 메타 칸(title·subtitle·presenterName·performers·performersJson·description·
  coverImage·scheduleNote·noticesJson)만 `review_status='approved'` 조건의 한 배치로 고친다.
  **잠긴 칸**: ageRating·runningMinutes·venue·showtimes·capacity·ticketTypes — 운영자가 기존 관리자 도구로 손수 바꾸고, 주최자 저장이 되돌리지 않는다.
- **미디어**: `isApprovedFundingMedia`에 공연 갈래가 따로 있다(승인된 제출물 + 공연 published/cancelled + 소유자 접두). 심사 중 포스터는 무인증 404다.
  청소 크론(`mediaRetention`)은 `shows.cover_image`·`shows.performers_json`·`show_submissions.draft_json`을 참조로 센다 — 새 이미지 칸을 만들면 여기에 더할 것
  (표가 없는 DB는 허용, 그 외 오류는 삭제를 멈춘다).
- **주최자 공연은 `data/shows/<slug>.ts` 파일이 없다.** `scripts/seed-show.ts`를 그 slug로 돌리지 말 것.
- **약관 판본**: `SHOW_ORGANIZER_TERMS_VERSION`(`lib/shows/organizer/policy.ts`), 게이트 `content/showOrganizerTerms.baseline.test.ts`
  (갱신 `UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1`, 판본을 먼저 올린다). 해시에 조항·수수료·정산·리드타임 상수와 **`refundPolicy.ts`의 환불 구간 줄·각주**가 든다 —
  환불 구간을 바꾸면 주최자 약관 판본도 올려야 한다.
  제7조에 **지급 뒤 환불로 생긴 초과 지급의 반환 요청·상계 조항**이 있다(`show-organizer-terms-2026-10-16`, 기한은 숫자 없이 "요청과 함께 알리는 기한") — 정산 절의 `overpaidAmount` 회수 요청의 계약 근거다.
- 메일은 `lib/shows/organizer/email.ts`(운영자: 새 제출·승인 뒤 수정 / 주최자: 승인·보완 요청·반려). 승인했는데 공개하지 못하면 주최자 메일은
  `approved_pending`(승인됨·곧 공개, 공개 주소 없음)으로 가고, 운영자가 뒤에 `/admin/shows`에서 공개해도 메일은 다시 가지 않는다. 관리자는 `/admin/shows/submissions`, 처리는 `PATCH /api/admin/shows/submissions/[id]`.
- 정산 정보(계좌·세금 구분)는 개설자 콘솔의 정산 정보 탭(`/ko/funding/creator/payout`)에서 받는다. 승인된 공연 등록만 있어도 열린다
  (`hasApprovedEngagement`, `lib/funding/creatorEligibility.ts`).

### 주최자 정산 기록 (P2, 2026-10-16 — `lib/partnerPayouts/show*.ts`, 설계 `docs/settlement-record-design-2026-10.md`)

관리자 `/admin/shows/[id]`의 「정산」 절(`components/admin/ShowPayoutSection.tsx`) → `POST /api/admin/shows/[id]/payout`(record / mark_paid / delete / set_cancel_fee_waived).
`partner_payouts`(kind `show`, subject_key = 공연 id, period `all`, **creator_id 필수** — 보존·파기 코드가 이 칸으로 본다). 송금은 운영자가 은행 앱으로, 시스템은 계산하고 기록한다.

- **정산 대상 = 승인된 제출물이 있는 공연만.** `data/shows/*.ts` 직영 공연은 `settleable: false`("정산 대상 아님(직영)"), 기록도 거절(`not_settleable`).
- **판매액** = 결제 행이 있는 공연 티켓 주문(paid·partially_refunded·refunded)의 합계, **환불** = 그 주문 결제의 `done` 환불 합. 초대권(결제 없음·0원)·입금 대기·만료는 빠진다.
  부분 환불·회차 취소 전액 환불·계좌 입금 환불이 전부 같은 `refunds` 표에 기록되므로 그 합이 정본이다 — **환불을 기록하는 새 경로를 만들면 `refunds`에 `done` 행을 남길 것.**
- **계산은 펀딩 식 그대로**(`computeFundingPayoutForProject`, `showCalc.ts`) — 수수료 `FUNDING_PLATFORM_FEE_PERCENT`+`FUNDING_PAYMENT_FEE_PERCENT`(주최자 약관 제6조가 같은 상수를 보간), 개인은 부가세 상당액·원천징수, 사업자는 그대로.
  **계좌 입금 몫(결제 키 `bank-deposit:`)은 결제 수수료 과세표준에서 뺀다**(토스를 지나지 않은 돈 — 펀딩 `manualGrossAmount`와 같은 이유).
- **기록은 마지막 회차가 끝난 뒤에만**(`not_ended`). 끝 = 취소되지 않은 회차의 가장 늦은 시작 + 공연 길이, 전부 취소됐으면 마지막 취소 시각(`lastShowEndAt`; 대기열 SQL `listShowPayoutsAwaitingRecord`가 같은 규칙을 적었다 — 함께 바꿀 것).
  약관 기한(마지막 회차 종료 + 영업일 `FUNDING_PAYOUT_BUSINESS_DAYS`일)을 넘기면 점검 메일 high(`healthCheck.ts`), 기한 안은 대시보드 카드(「정산 기록 대기 공연」「이체 대기 공연 정산」).
- **막는 조건**: 세금 구분·계좌 없음, 사업자인데 사업자 정보 없음, 주최자 약관 동의 기록(`show_submissions.organizer_terms_version`) 없음, 이미 기록됨, 정산할 금액 없음. **경고만**: 주민등록번호 미등록,
  계좌 입금 환불을 접수했는데 송금 전(`refund_accounts.refunded_at` NULL), 취소된 회차에 환불이 안 끝난 주문(아직 판매액에 들어 있다 — 환불 뒤에 기록하는 편이 안전).
- **회차 취소 결제 수수료**(약관 제7조): `cancelShowtime` 끝에서 `showtime_cancel_fee` 조정을 만든다(음수, payee_key `creator:<id>`, source_ref = 회차 id, 환불한 **토스 결제분**×`FUNDING_PAYMENT_FEE_PERCENT`).
  fail-soft(`safeSyncShowtimeCancelFee` — 던지지 않는다), 멱등(이어서 처리로 다시 불리면 금액만 맞춘다), 정산 기록 직전·정산 절을 열 때 한 번 더 맞춘다. **스튜디오 귀책 면제는 취소 화면이 아니라 정산 절에서**
  — 반대 부호 `manual` 조정(source_ref `waive:<회차 id>`)을 쌓고/지운다(`setShowtimeCancelFeeWaived`). 취소는 되돌릴 수 없는 화면이라 귀책 판단을 거기 넣지 않았다. 수수료 조정이 이미 정산에 실렸으면 면제를 못 바꾼다(이체 전 기록을 취소하면 풀린다).
  **이 공연의 회차 조정만** 싣는다 — 같은 주최자의 다른 공연 조정은 그 공연 정산에 간다.
- **조정은 원천징수까지 뺀 금액에서 뺀다**(펀딩의 설계비·제작비 공제 자리). 모자라면 실지급 0원이고 모자란 만큼은 `shortfall_amount`에 남는다 — **이월하지 않는다**(약관 제7조: 모자라면 주최자에게 청구). 청구·협의 결과는 「지급 완료」 메모에.
- **기록 뒤 환불은 자동 조정을 만들지 않는다**(상점의 `late_refund`와 달리 — 공연 정산은 공연당 한 번이라 상계할 다음 정산이 없다). 화면이 `drift`(기록 판매·환불 ≠ 지금)를 보이고, 이체 전이면 「기록 취소」 후 다시 기록한다.
  **이미 지급(`paid`)한 뒤의 차액은 보이고 알린다**(새 표·마이그레이션 없음, `RecordedShowDelta` — `show.ts`):
  - 지금 판매·환불로 기록의 **세금 유형·실린 조정 그대로** 다시 계산한 실지급액(`currentNetAmount`)과 기록 `net_amount`의 차. 기록이 더 크면 `overpaidAmount`(초과 지급 = 회수 필요), 작으면 `underpaidAmount`(지급 뒤 추가 판매 — 자동 추가 지급 없음, 화면 안내만).
    세금 유형 변경·새 조정은 섞지 않는다(환불 때문이 아닌 차이가 초과 지급으로 읽히지 않게). 기록 시각 이후 완료된 환불 주문번호가 정산 절에 같이 뜬다(`lateRefundOrders`).
  - 정산 절: `paid` 기록에 남은 초과 지급이 있으면 호박색 블록 "지급 후 환불로 N원 더 지급됐습니다(회수 필요)" + 「회수 처리 남기기」.
  - 점검 메일 high(`healthCheck.ts`, `listOverpaidShowPayouts`) — 덮이지 않은 초과 지급이 1원 이상인 `paid` 정산. 이체 전(`pending`)은 대상이 아니다(기록 취소 후 재기록이 답).
  - **끄는 법 = 메모 줄**: 라우트 액션 `acknowledge_overpayment`{payoutId, amount, memo}가 `partner_payouts.memo` 끝에 `[회수 처리 N원 · 처리자 · YYYY-MM-DD] 메모`를 덧붙인다(`appendPartnerPayoutMemoIfPaid`, 지급 완료 기록만, 금액·상태 불변).
    점검과 화면은 줄의 `N원` 합(`parseAcknowledgedAmount`, `showOverpayment.ts`)이 지금 초과 지급액을 덮는지로 판정 — 부분 처리는 남은 몫만 울리고, **뒤늦은 환불이 더 생기면 덮이지 않은 몫만큼 다시 울린다.**
    남은 몫보다 큰 금액은 409(오타로 큰 금액을 적어 이후 경보가 가려지는 것을 막는다). 자유 메모의 `[`·`]`는 괄호로 바꿔 처리 줄을 흉내 내지 못하게 한다. 이 줄 형식을 바꾸면 파서와 기존 메모가 어긋난다.
  - 회수 자체(주최자에게 요청·상계·반환 받기)는 운영자가 밖에서 한다 — 시스템은 금액을 새로 정하지 않는다.
- 표(0067)가 없으면 정산 절만 "마이그레이션 필요" 안내로 열린다(공연 운영 화면은 그대로), 대시보드 카드는 0, 회차 취소는 평소대로 끝난다.
