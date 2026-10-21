# CLAUDE.md

This file provides guidance for development in the **Studio NOL** repository.

## Development Commands

```bash
# SEO 분석 (자세한 규칙은 "SEO·GA4·GSC 분석 규칙" 절)
node scripts/seo-preflight.mjs                              # 데이터 열기 전 필수 — 최근 커밋·열린 실험·관측창
node --env-file=.env.local scripts/gsc-fetch-detail.mjs     # GSC 90일 원시 데이터
node --env-file=.env.local scripts/ga4-fetch.mjs            # GA4 90일 원시 데이터
node --env-file=.env.local scripts/ctr-verdict.mjs --surgery YYYY-MM-DD --slugs a,b --control c,d
node --env-file=.env.local scripts/lead-verdict.mjs --from YYYY-MM-DD --pages a,b --control c   # 전환 실험(GA4 랜딩 기준 세션당 리드)

# 제목 서체(Paperlogy Bold) subset (LCP)
# prebuild에서 모든 빌드(Vercel·CI)가 저장소의 원본(lib/fonts/paperlogy-7bold-full.woff2, OFL)으로 다시 만든다 —
# 네트워크를 쓰지 않고, 제목·스토리 제목이 바뀌어도 손으로 재생성·커밋할 필요가 없다(본문 서체와 같은 방식, 2026-10-09).
# 커밋된 display.woff2는 next dev용이라 낡아도 배포에 영향이 없다. 원본을 못 읽으면 빌드가 멈춘다(조용한 대체 없음).
# 제목·본문 서체 모두 font-display: optional — swap으로 되돌리지 말 것(첫 방문에 글자 폭이 꿈틀댄다, lib/fonts.ts 주석).
node scripts/generate-hero-font.mjs           # 로컬 dev 서체를 최신으로(선택)
node scripts/generate-hero-font.mjs --check   # woff2·사이드카 짝 검증(CI) — 커밋본이 낡았으면 알림만

# 사이트맵 lastmod
# prebuild에 넣지 않는다 — Vercel·GitHub Actions는 얕은 클론이라 빌드 중 git 이력이 없다.
# pages/[locale]/ 에 라우트를 추가하면 pageRouteMap(lib/sitemap/routes.js) 등록 후
# 아래를 로컬에서 실행하고 lib/sitemap/pageLastmod.json을 함께 commit할 것.
# 빠뜨리면 routes.test.js의 'lastmod 커버리지'가 CI에서 잡아낸다.
npm run generate:page-lastmod
node scripts/generate-page-lastmod.mjs --check  # git 없이 커버리지만 검증

# postbuild는 조용히 실패하지 않는다
# postbuild = `rm -f public/sitemap*.xml public/robots.txt && next-sitemap && node scripts/normalize-sitemap-hreflang.js`.
# next-sitemap은 내부 오류를 .catch(Logger.error)로 삼키고 exit 0으로 끝나므로, 예전엔 사이트맵과
# robots.txt가 지워진 채 "초록 빌드"로 배포될 수 있었다(rm이 선행이라 이전 산출물도 안 남는다).
# 지금은 normalize 스크립트가 sitemap*.xml이 0개이거나 robots.txt가 없으면 원인을 적고 exit 1 한다.
# 회귀 방지: scripts/normalize-sitemap-hreflang.test.ts

# 제목 서체 글자 검사 (CI, 빌드 뒤) — 제목(ImageHero h1·SectionHeading)의 글자가 전부 제목 서체 서브셋에 있는가
# 없으면 그 글자만 Pretendard로 그려져 한 제목 안에서 서체가 섞인다(2026-10-08 공연 "출연"의 "출", 스토리 제목 130자).
# 실패하면 scripts/generate-hero-font.mjs가 그 제목의 출처를 읽게 한다(서체 파일은 손으로 다시 만들 필요 없다 —
# 원본 lib/fonts/paperlogy-7bold-full.woff2가 저장소에 있어 모든 빌드가 prebuild에서 다시 만든다. 커밋본은 next dev용).
# 서체에 아예 없는 문자(베트남어 성조·우즈베크어 ʻʼ)는 globals.css가 그 로케일 제목을 Pretendard로 돌린다.
# DB에서 오는 제목(펀딩·공연)은 lib/fonts/displayCoverage.ts로 검사해 안 맞으면 제목 전체를 본문 서체로.
# 제목에 줄바꿈 금지 하이픈(U+2011)·키릴 글자를 넣지 말 것.
npm run build && npm run check:display-font

# 섹션 단위 중복 검사 (CI)
npm run check:dup-sections
node scripts/check-duplicate-sections.mjs --update  # 기준선 갱신

# 검증 필요 후보 검사 (CI) — 새 글이 날조 후보(인물 인용문·"최초" 주장·"한국에서 표준" 서술·출처 없는 비율)를 들여오는 걸 막는다
npm run check:claims
node scripts/check-unverified-claims.mjs --show     # 후보 문장 전체 보기
node scripts/check-unverified-claims.mjs --update   # 근거를 확인하고 정리한 뒤 기준선 갱신

# 서비스 수치 정합 검사 (CI)
npm run check:facts

# 스토리 라우팅 기준선 (CI) — 하단 CTA·가격 카드 판정이 바뀐 글을 잡는다
npm run check:cta-routing
npx tsx scripts/cta-routing-baseline.ts --update   # 의도한 변경이면 기준선 갱신

# 펀딩 콘텐츠 불변식 기준선 (CI) — slug 개명·리워드 id 변경·리워드 금액 변경·프로젝트 삭제를 잡는다
npm run check:funding-baseline
npm run check:funding-baseline -- --update         # 의도한 변경이면 기준선 갱신

# 펀딩 약관 판본 게이트 (CI) — 동의 문서 내용이 바뀌었는데 FUNDING_TERMS_VERSION이 그대로면 실패
npx jest content/fundingTerms.baseline.test.ts
UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts   # 버전을 올린 뒤 갱신

# 공연 주최자 약관 판본 게이트 (CI) — 조항·수수료·환불 구간이 바뀌었는데 SHOW_ORGANIZER_TERMS_VERSION이 그대로면 실패
npx jest content/showOrganizerTerms.baseline.test.ts
UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1 npx jest content/showOrganizerTerms.baseline.test.ts   # 버전을 올린 뒤 갱신

# 링크 계약(의뢰인 정보를 서명할 때 받는 제작·믹싱·마스터링 계약) — 카카오톡으로 보낼 서명 링크를 바로 만든다
npx tsx scripts/contract-link.ts create --kind mixmaster --tracks 30 [--total N] [--song 제목]   # 미리보기, --yes로 발송
#   --memo "카톡 홍길동" 으로 누구에게 보낸 링크인지 남긴다(제목 끝, 의뢰인에게 안 보임). --deposit-days·--weeks·--first-days
npx tsx scripts/contract-link.ts list                                                             # 최근 20건 — 상태(만료 포함)·발송·만료·열람·링크
npx tsx scripts/contract-link.ts resend <계약 id>                                                 # 만료·재전송 — 옛 링크 무효, 새 링크
npx tsx scripts/contract-link.ts cancel <계약 id>
npx tsx scripts/contract-link.ts events <계약 id>                                                 # 진행 기록 타임라인(최근 30건, 무효·통지 결과 포함)
npx tsx scripts/contract-link.ts log <계약 id> --type payment_received --amount 225000 [--stage --song --note --link --at "YYYY-MM-DD HH:mm" --cause] [--yes]   # 진행 기록 — 관리자 API와 같은 검증·통지, --void <기록 id> --note 사유

# IndexNow 변경분 제출 — 전량 반복 제출 금지, CI(main push)가 diff로 바뀐 URL만 자동 제출한다.
# 문구·링크·가격·구조가 안 바뀐 순수 디자인 커밋은 메시지에 `[skip-indexnow]`를 붙인다 — 그 커밋에서만 바뀐
# 파일은 제출에서 빠진다(2026-10-05 UI 정제가 모양만 바꿨는데 14 URL이 제출됐다). 본문이 바뀐 커밋엔 붙이지 말 것.
npm run indexnow:changed -- --dry-run
```

### 연습실 공실 상태 = 상수 하나

연습실 만실/공실은 `data/practiceRoomAvailability.ts`의 `PRACTICE_ROOM_HAS_VACANCY` 하나로
바꾼다. 카피 3곳(연습실·pricing 페이지 note/subtitle)과 `pages/api/llms.ts`가 이 상수를
따라간다. 바꿀 때 `PRACTICE_ROOM_AVAILABILITY_UPDATED_ON`도 함께 갱신할 것 — 오래되면
`practiceRoomAvailability.test.ts`가 CI에서 실패한다.

### 펀딩·개설자 규칙은 `lib/funding/CLAUDE.md`에 있다

`lib/funding/`·`content/funding/`·`pages/**/funding/`·`components/funding/`를 만지기 전에 그 파일을 읽을 것 (하위 CLAUDE.md는 해당 디렉터리 파일을 열 때만 자동 로드된다). 어겨도 에러가 안 나는 금지 세 가지는 여기에도 둔다:

- 오픈 뒤 펀딩 리워드 id·slug·금액은 바꾸지 않는다 — 후원 기록이 문자열로 참조한다. 가격 변경은 새 id로 티어를 추가.
- 새 `content/funding/<slug>.md`의 slug는 승인된 DB 프로젝트의 slug와 겹치면 안 된다 — 다른 개설자의 후원자 배송지가 노출된다.
- 마이그레이션 0037·0039·0041~0044는 배포보다 먼저 적용한다 — 결제 확인 경로가 새 표·컬럼을 함께 읽어 순서를 뒤집으면 결제 확인 전체가 깨진다. 0048(결제 공용 환불 계좌 `refund_accounts`)도 먼저 — 결제는 안 깨지지만 환불 계좌 접수·조회가 실패한다. 0061(`refund_accounts`에 상점 종류 추가 + `payment_link_orders`)도 먼저 — 안 그러면 상점 계좌 입금 주문의 셀프 취소가 실패하고(주문은 그대로 돌려 두고 멈춘다) 결제 링크 주문에 상품명이 안 남는다. 결제 자체는 안 깨진다.

### 계좌 입금(무통장)은 펀딩·예약·믹싱·공연·상점 공통이다 — 자동 취소 없음, 자원은 잡는다

**결제수단의 계좌 줄은 "계좌로 직접 입금"(우리 계좌번호 안내)이다. 토스 계좌이체(`method: 'TRANSFER'`)는 쓰지 않는다**
(운영자 결정 2026-10-14). 은행을 고르면 금융결제원 뱅크페이 결제창이 무조건 떠서, PC에서는 은행 보안 프로그램 설치를,
모바일에서는 뱅크페이·은행 앱 전환을 요구해 고령층이 사실상 쓰지 못한다(실제 화면으로 확인). 그래서 2026-10-12의
"공연은 직접 입금을 접고 토스 계좌이체로"를 되돌렸다 — 직접 입금은 환불이 생기면 환불 계좌를 받아 손으로 송금해야 한다는
부담을 알고 내린 결정이다. 입금 흐름이 있는 화면(펀딩·예약·믹싱·예약금 링크·공연·상점)만 `PaymentMethodPicker`에 `withBank`를 주고,
입금 확인 경로가 없는 화면(소프트웨어 — 키 즉시 발급과 맞지 않는다)은 주지 않는다 — 가드 테스트가 지킨다.
결제 실패 화면(`booking/fail`·`funding/fail`·`shows/fail`·`shop/fail`·`pay/fail`)은 "계좌로 직접 입금" 버튼을 한 번 더 권한다(`FailBankFallback`,
폼 주소에 `?bank=1`을 붙여 돌려보내면 폼이 계좌 줄을 고른 채 열린다 — `lib/payments/bankFallback.ts`).

규칙 전체는 `lib/payments/bankDeposit.ts` 머리 주석(공연·예약·믹싱)과 `lib/funding/CLAUDE.md`(펀딩).
어겨도 에러가 안 나는 것만 여기 둔다:

- 공연·예약·믹싱의 계좌 입금 대기는 `orders.status = 'awaiting_deposit'`이다(입금 전 취소는 `deposit_cancelled`).
  토스 홀드 만료 경로는 `status = 'pending'`만 봐서 자동으로 건너뛴다 — **새 만료 경로를 만들면 `pending`만 볼 것.**
  반대로 **새 점유 판정을 만들면 대기도 점유로 셀 것** — 예약은 `occupiedBookingSql`(lib/booking/service.ts) 하나,
  공연은 `hold_expires_at IS NULL`인 held 티켓(좌석 집계가 이미 센다).
- 계좌 입금으로 확정된 주문은 결제 행 키가 `bank-deposit:<주문번호>`다(`isBankDepositPayment`). **토스 API에
  `payments.payment_key`를 넘기는 새 경로를 만들면 이 판정으로 먼저 걸러야 한다** — 걸러지지 않으면 토스가 거절하고
  환불이 실패한다. 환불은 고객이 적은 환불 계좌(`refund_accounts`)로 운영자가 송금한다.

### 마이그레이션 0022(`fulfillment_updated_by`)는 배포보다 먼저 적용한다

`db/schema.ts`의 `fundingPledges.fulfillmentUpdatedBy`(`drizzle/migrations/0022_ancient_proemial_gods.sql`,
`ALTER TABLE funding_pledges ADD fulfillment_updated_by text`)이 추가한 컬럼이다.
**적용 순서를 뒤집으면(배포 먼저, 마이그레이션 나중) 깨지는 범위는 개설자 배송 화면이
아니라 후원 결제 전체다** — drizzle의 관계 조회(`with: { fundingPledge: true }`)는 해당
테이블의 전체 컬럼을 SELECT에 실으므로, 컬럼이 없는 DB에서는 그 조회 자체가
`no such column: fulfillment_updated_by`로 던진다.

이 조회를 지나는 경로를 직접 열어 확인한 결과:

- `lib/funding/service.ts`의 `findFundingOrderByOrderNo`/`findFundingOrderById` —
  `with: { fundingPledge: true, payments: { with: { refunds: true } } }`. 이 둘을
  `lib/funding/confirm.ts`(**토스 결제 승인**), `lib/funding/cancel.ts`(환불),
  `pages/api/funding/pledges.ts`·`display-name.ts`·`download.ts`·
  `pages/api/admin/funding/pledges/[id].ts`·`pages/admin/funding/[id].tsx`가 지난다 —
  즉 **결제 확인 자체**가 이 컬럼에 걸린다.
- `lib/funding/admin-list.ts` — 관리자 후원 목록(`with: { fundingPledge: true, payments: true }`).
- `lib/funding/fulfillment.ts`의 `setFulfillment`, `lib/funding/creatorShipping.ts`의
  `loadCreatorShipping`/`loadFulfillmentGate` — `db.query.fundingPledges.findFirst`로
  `funding_pledges` 테이블을 직접 조회해 같은 문제를 겪는다.

배포 전 확인: `PRAGMA table_info(funding_pledges);`로 `fulfillment_updated_by` 행이 있는지
직접 본다. 없으면 마이그레이션을 먼저 적용하고, 적용을 확인한 뒤에 배포한다. 이 저장소는
마이그레이션을 CI/CD에서 자동 실행하지 않는다(`npm run db:migrate`는 운영자가 수동 실행) —
그래서 순서를 지키는 것은 배포하는 사람의 책임이고, 그 사람이 보는 문서는 여기다.

### 마이그레이션 0055(`show_submissions`)도 배포보다 먼저 적용한다

공연 주최자 제출물 표다. 순서를 뒤집어도 **주최자 화면(개설자 콘솔의 공연 탭·편집기)과 관리자 제출물 화면만** 실패한다 — 공개 공연 페이지·결제는 이 표를 읽지 않고,
미디어 공개 판정(`mediaAccess`의 공연 갈래)·청소 크론·관리자 공연 목록의 대기 건수는 표가 없어도 견디게 감싸 두었다. 확인은 `PRAGMA table_info(show_submissions);`.

### 마이그레이션 0058(`creator_business_profiles`)도 배포보다 먼저 적용한다

개설자 사업자 정보 표다. 순서를 뒤집으면 실패하는 범위는 넷이다 — 결제·로그인·원천징수 저장은 이 표 없이 돈다.

- 사업자(세금계산서) 개설자는 **정산 정보를 아무것도 저장하지 못한다**(계좌 포함, `business_unavailable` — 저장 전체를 거부한다).
- 사업자 개설자의 정산 기록이 `business_profile_unavailable`로 막힌다.
- 사업자등록증 업로드·삭제 라우트가 503을 돌려준다.
- 월간 파기 크론(`purge-funding`)의 사업자 정보·사본 단계가 매달 실패하고, 그때마다 운영자에게 실패 메일이 간다.

확인은 `PRAGMA table_info(creator_business_profiles);`.

**배포 직후 할 일 — 기존 사업자 개설자에게 연락한다.** 이 표가 생기기 전에 사업자로 등록한 개설자는 사업자 정보가 없어, 정산을
기록하려 하면 `no_business_number`로 막힌다. 정산 전에 운영자가 그 개설자들에게 정산 정보 탭에서 사업자등록번호·상호·대표자명을
넣어 달라고 연락할 것. 국세청 상태조회 키 env `NTS_BUSINESS_STATUS_API_KEY`(공공데이터포털 "국세청_사업자등록정보
진위확인 및 상태조회 서비스"의 일반 인증키 Decoding, Production·Preview)는 머지 전에 넣어 두면 머지 푸시가 싣고 간다 — 따로 재배포하지 않는다.
키가 없어도 저장은 되고 상태가 "미확인(API 키 없음)"으로 남는다. 규칙은 `lib/funding/CLAUDE.md` "개설자 사업자 정보·국세청 조회".

### 마이그레이션 0076(`show_tickets.refunding_at`)도 배포보다 먼저 적용한다

공연 티켓 환불 선점('refunding') 시각이다. 관리자 '환불 재확인'(`reconcileShowRefund`)이 선점 뒤 120초 안의 티켓은 "토스 응답 대기 중"으로
보고 되돌리지 않는다(`REFUNDING_GRACE_SECONDS`) — 되돌린 직후 그 취소가 성공하면 같은 티켓이 두 번 환불되던 창을 막는다. NULL(0076 이전
선점)은 오래된 것으로 본다. 순서를 뒤집으면 `show_tickets`를 읽는 모든 경로(예매 확정·티켓 화면·체크인·환불)가 `no such column:
refunding_at`으로 깨진다 — 관계 조회가 전체 컬럼을 SELECT한다. 확인은 `PRAGMA table_info(show_tickets);`. 머지 직후 Vercel 빌드가
끝나기 전에 `npm run db:migrate -- --yes`를 돌릴 것(빌드 3~4분, 적용 수 초).

### 마이그레이션 0065(`manual_revenues.deleted_at`·`deleted_by`)도 배포보다 먼저 적용한다

수기 매출 삭제가 행 삭제에서 소프트 삭제(누가 언제 지웠는지 남김)로 바뀌었다. 순서를 뒤집으면 **수기 매출 조회·삭제만** 실패한다 —
매출 현황은 "직접 받은 매출 표를 읽지 못했다" 경고와 함께, 대시보드는 `manualMissing`으로 직접 입금분이 빠진 숫자를 보이고(나머지 매출은 정상), 삭제 버튼은 500이다. 확인은 `PRAGMA table_info(manual_revenues);`.

### 마이그레이션 0067(`partner_payouts`·`partner_payout_adjustments`)도 배포보다 먼저 적용한다

상점(P1)·공연(P2) 정산 기록 표 둘이다. 새 표뿐이고 어떤 `relations()`에도 잇지 않았다 — 순서를 뒤집어도 결제·주문·로그인은 안 깨진다. 깨지는 범위:

- `/admin/shop`의 정산 표가 "마이그레이션 0067 필요" 안내와 함께 예전 읽기 전용 "정산 예정" 표로 되돌아간다(재고·주문 화면은 그대로). 기록·지급 완료·조정 API는 503 `migration_needed`.
- 대시보드 「정산 기록 대기 상점」「이체 대기 상점 정산」 카드는 0이다(대시보드는 열린다). 정산 뒤 환불 조정은 못 쌓인다 — 환불 자체는 성공하고 로그 `[partner-payouts]`만 남는다(표가 생긴 뒤 그 아티스트의 다음 정산 기록 직전 보충이 메운다).
- 공연 주최자 정산(P2): `/admin/shows/[id]`의 정산 절만 같은 "마이그레이션 0067 필요" 안내로 열리고(공연 운영 화면은 그대로), `POST /api/admin/shows/[id]/payout`은 503, 대시보드 공연 카드·기한 점검은 건너뛴다. 회차 취소는 평소대로 끝난다(결제 수수료 조정만 못 쌓이고 표가 생긴 뒤 정산 절을 열 때 보충된다). 규칙은 `lib/shows/CLAUDE.md` "주최자 정산 기록".
- 보존·파기 코드(`lib/partnerPayouts/creatorPayouts.ts`)는 표가 없으면 펀딩 기록만으로 돈다 — 월간 파기 크론이 실패하지 않는다. 확인은 `PRAGMA table_info(partner_payouts);`.

**배포 직후 할 일 없음**(상점 판매가 열리기 전에는 정산할 것도 없다). 규칙은 `lib/shop/CLAUDE.md` "정산", 설계는 `docs/settlement-record-design-2026-10.md`. 공연 정산(P2)·알림 메일/CSV(P3)가 같은 표를 쓴다 — 두 번째 마이그레이션 없이
`kind='show'`·조정 사유 `showtime_cancel_fee`가 이미 표현된다.

### 마이그레이션 0035(`public_name`)·0036(`listing_hidden_at`)·0039(`listing_hidden_name`)도 배포보다 먼저 적용한다

`funding_pledges.public_name`(후원자 명단 표시 이름 — 가린 이름·닉네임, `lib/funding/publicName.ts`)이
`drizzle/migrations/0035_funding_public_name.sql`로 추가됐다. 위 0022 절과 **같은 이유로** 순서를
뒤집으면 후원 결제 확인 전체가 `no such column: public_name`으로 깨진다 — 관계 조회가 전체 컬럼을
SELECT한다. 확인은 `PRAGMA table_info(funding_pledges);`, 순서는 마이그레이션 → 배포.

명단은 `COALESCE(public_name, customer_name)`을 쓴다. 그래서 1년 파기(`lib/funding/retention.ts`)는
이 값을 NULL이 아니라 `PURGED_MARK`로 덮고, 명단 조회는 그 표식을 보고 행을 내린다 — NULL로 비우면
실명을 피해 닉네임을 고른 사람이 파기 시점에 실명으로 공개된다.

0036의 `listing_hidden_at`은 **운영자 숨김**이다(관리자 후원 상세의 "후원자 명단에서 내리기").
공개 동의(`display_name_public`)와 별개로 둔다 — 동의를 끄는 것으로 대신하면 후원자가 펀딩
확인 페이지에서 다시 켜 내린 닉네임이 되살아난다. 0036도 같은 이유로 배포보다 먼저다.

0039의 `listing_hidden_name`은 운영자가 명단에서 내릴 당시 실제로 떠 있던 이름의 스냅샷이다(`drizzle/migrations/0039_funding_listing_hidden_name.sql`).
그 뒤 후원자가 표시 이름을 바꿔도 "사칭·욕설 닉네임이라 내렸다"는 기록이 원래부터 그 이름이었던 것으로 읽히지 않게 한다. 같은 이유로 배포보다 먼저다.

### 공연 예매(shows)는 `lib/shows/CLAUDE.md`를 먼저 읽는다

새 공연은 `data/shows/<slug>.ts` 하나 + 이미지로 올린다(코드 수정 없음, 시드 `scripts/seed-show.ts`).
구조화 칸(0047)·ShowDetailView 합성·소문자 308에 견디는 링크 규칙·10/14 공용화 보류가 거기 있다.

### 상점(음반·굿즈)은 `lib/shop/CLAUDE.md`를 먼저 읽는다

`/ko/shop`. 상품 정의는 `data/shop/catalog.ts`, 재고는 DB(계산값), 결제는 카드·간편결제(토스)와 계좌로 직접 입금(2026-10-14 도입, `lib/shop/bankDeposit.ts`).
**`SHOP_SALES_OPEN`(data/shop/policy.ts)이 false인 동안 주문을 받지 않는다** — 켜기 전 체크리스트(마이그레이션 0052 → 처리방침
개정·판본 → 상품·재고 → 켜기 → 메뉴·사이트맵)가 그 파일에 있다. 새 주문 종류를 만들면 `lib/booking/webhook.ts`의 type 분기를
먼저 넣을 것 — 모르는 type은 예약 확정으로 떨어진다.
아티스트 상품(DB 정본)은 마이그레이션 0053(새 표 다섯 개)과 `lib/shop/repository.ts` 입구를 쓴다 — 순서는 마이그레이션 → 배포, 설계는 `docs/shop-artist-platform-design-2026-10.md`.

### 소프트웨어(플러그인·툴) 판매는 `lib/software/CLAUDE.md`를 먼저 읽는다

`/ko/software`·`/en/software`. 상품 정의는 `data/software/catalog.ts`, 라이선스·기기 활성화는 DB(0054), 서명은 Ed25519.
**라이선스 파일 형식·활성화 API 응답 코드·`publicKeys.ts`의 kid는 배포된 플러그인이 오프라인으로 기대므로 바꾸지 않는다.**
서명 비밀키(`SOFTWARE_LICENSE_SIGNING_KEY`)를 잃으면 모든 플러그인을 다시 배포해야 한다 — 오프라인 백업 필수.
`SOFTWARE_SALES_OPEN`이 false인 동안은 관리자 수동 발급만 된다. 국내 결제는 `orders(type='software')` + `software_orders`(0056)이고
승인 batch가 라이선스를 함께 발급한다 — 판매를 열기 전 체크리스트(약관 사용권·청약철회 조항, 처리방침·판본)가 그 파일에 있다.

### 믹싱 전·후 비교 음원 (`components/audio/MixComparePlayer.tsx`)

김동산과 블루이웃 〈물결〉의 믹싱 전 / 믹싱 후를 같은 재생 위치에서 바꿔 듣는다. **네 자리**에 있다 —
홈 02번 절(전체 곡, `component: HomeMixCompare`)과 30초 발췌본 셋: `/ko/mixing-mastering` 마스터링 절 끝, 가격 카드·표 아래
(`MixingMasteringMixCompare` — 처음에 카드 위에 뒀더니 음원이 먼저 나와 가격이 밀려 옮겼다, 운영자 지적), `/release-project` 발매작 절 아래(`ReleaseMixCompare`), 믹싱 주문 마법사 1단계의
접힌 한 줄(`MixingOrderMixCompare`). 발췌본은 **절이 아니라 기존 절 안의 블록**(`MixCompareBlock`)이다 — 절을
끼우면 아래 모든 절의 배경 번갈음이 뒤집힌다(홈은 그래서 뒤 절들을 한 칸씩 밀었다).
- **라벨은 그냥 "믹싱 전" / "믹싱 후"다**(운영자 결정 2026-10-01 — "발매본"이라는 말도 뺐다). 실체는 마스터링을 거친
  발매본이다(마스터링 담당은 화면에 적지 않는다, 2026-09-30.
  **곡명·아티스트도 화면에 적지 않는다**, 같은 날 결정). 그 소리는 믹싱 전보다 10dB 크고 다이내믹이 눌려 있다
  (-20.2 vs -10.2 LUFS). 믹싱·마스터링 페이지에서는 이 소리가 우리 마스터링처럼 읽힐 수 있다(실제 마스터링은 외부).
  마스터링 전 믹스 파일이 생기면 그걸로 바꿔 끼울 것.
  (이 곡의 마스터링이 외부 작업이라는 뜻이다 — 스튜디오 서비스로서의 마스터링은 직접 한다, 운영자 확인 2026-10-01.)
- **믹싱 후는 포트폴리오 원본 음량 그대로, 맞추는 쪽은 믹싱 전이다**(운영자 결정 2026-10-01 — 두 번 틀린 끝에 나온
  규칙). 믹싱 후는 `public/audio/wave.mp3`(-10.2 LUFS, 피크 +0.2 dBTP)를 게인 0·리미터 없이 쓴다(전체 곡은 원본 mp3를
  재인코딩 없이 잘라 복사, 발췌는 자르기·페이드만). **믹싱 후를 내리거나 다시 올리는 방식은 쓰지 않는다** — 먼저 믹싱 후를
  믹싱 전(-20.2)에 맞춰 내렸더니 둘 다 너무 작았고, 둘을 -14 LUFS로 올렸더니 원본을 건드렸다고 지적받았다.
  `--match-to-after on`이 믹싱 전만 올린다: 게인 +11.7dB(전체)/+9.2dB(발췌)에 피크 리미터(0.95)를 걸고, **인코딩한 mp3를
  재서** 믹싱 후 mp3의 통합 라우드니스에 0.03dB 안으로 맞출 때까지 반복한다(인코딩이 0.5dB 가까이 깎는다). 발췌는 128k로
  다시 인코딩하면 원본이 0.5dB 작아지므로 **두 발췌 모두 256k**다(0.01dB 안쪽).
  **믹싱 전은 이 음량에서 눌린다는 것을 알고 쓴다** — 마스터링 전 믹스를 -10 LUFS까지 올리려면 피크가 게인만으로는 +9dBFS
  가까이 가므로 리미터가 크게 닿는다(전체: 피크 -1.0→-0.2 dBTP인데 RMS는 +10dB, 크레스트 약 22→13dB). 믹싱 전이
  "믹싱 후와 똑같이 눌린 소리"로 들리면 이 때문이다. 재측정(인코딩된 파일): 전체 -10.22 / -10.21, 발췌 -10.38 / -10.37 LUFS.
  **평균이 같아도 다이내믹이 넓은 믹싱 전은 큰 순간이 더 크다**는 문제는 위 방식에서 리미터가 줄여 준다.
  `--loud-balance`·`--target-lufs`는 없앴다(다시 만들지 말 것).
  **시간도 맞춘다**(물결은 믹싱 전이 1.3035초 늦게 시작 → 앞을 잘랐다). 전환은 재생 위치를 그대로 넘기므로,
  어긋나 있으면 "다른 구간"을 듣게 된다. **발췌본은 그 구간 안에서 다시 맞춘다**(전체 곡 기준은 구간마다 어긋난다).
  발췌는 160~190초(밴드와 보컬이 모두 든 구간), 앞 0.25초·뒤 0.8초 페이드를 두 파일에 같게 건다.
- 음원·파형 생성: `node scripts/build-mix-compare.mjs --before … --after … --offset <초> --duration <초> --tag <날짜>`
  (전체 곡), 발췌는 `--variant excerpt --start 160 --duration 30` 추가(`data/mixComparePeaks*.ts`는 생성물). 현재 태그
  `20261001c`(`--match-to-after on` 필수). 옛 태그(`20260930b`·`20261001`·`20261001b`) 파일 12개는 2026-10-01에 지웠다.
  offset은 스크립트가 재지 않는다 — 대역 통과 파형 상호상관으로 따로 재서 넘긴다. 음원을 바꾸면 `--tag`를 새 날짜로.
- **"재생하면 내려받습니다" 같은 다운로드 안내 문구는 화면에 두지 않는다**(운영자 결정 2026-09-30).
- **재생 전에는 한 바이트도 받지 않는다**(`preload="none"`, 실제 Chromium으로 요청 0건 확인). 처음 재생하면 반대편을
  미리 받는다. 전환은 새 소리가 `playing`이 된 뒤에 이전 소리를 멈춘다(실측 0~1ms 겹침, 빈 틈 없음).
- **재생 아이콘은 우리 버튼이 아니라 오디오의 실제 상태를 따라간다.** 재생기기 변경·블루투스 해제·통화·미디어 키는
  버튼을 거치지 않고 `pause`/`playing` 이벤트만 보낸다. 활성이 아닌 쪽의 pause(전환 때 우리가 멈추는 반대편)와 끝까지
  간 경우(`ended`)는 걸러 낸다. 빠른 A→B→A 전환에서 첫 전환의 뒤늦은 pause가 다시 켠 소리를 끄지 않게 막아 두었다.
- 주문 마법사 1단계는 **접힌 한 줄**로 시작한다(1단계 제목 바로 아래). 열 때에야 플레이어 코드를 불러온다
  (`next/dynamic`, ssr 끔). 한때 펼쳐 두었더니 상품 선택 화면이 무거워져 운영자가 접는 쪽으로 되돌렸다(2026-09-30).
  결제 흐름을 떠나는 포트폴리오 링크는 뺀다. 2단계(결제 입력)에는 없다.

### 비공개 감상실 (`/press/sabbaha-slung`) — 발매 전 음원을 평론가·매체에게

비밀번호로 들어오는 앨범 감상·소개 페이지(ko/en, 다른 로케일은 /en으로). 어겨도 에러가 안 나는 것만 적는다:

- **비밀번호 원문을 커밋하지 않는다**(공개 저장소). `lib/press/listeningRoom.ts`에는 scrypt 해시만 있고, 바꿀 때는
  `node scripts/press/hash-password.mjs '<새 비밀번호>'` 출력으로 갈아 끼운다 — 해시가 바뀌면 기존 입장 쿠키도 전부 풀린다.
  쿠키 서명 키는 `ADMIN_SESSION_SECRET`에서 갈라 낸다(없으면 운영에서 문을 닫는다).
- **음원은 Blob private**(`press/sabbaha-slung/`)이고, 통과한 요청에만 곡별 6시간 서명 주소가 나간다(`lib/press/audio.ts`).
  `public/`에 넣거나 public Blob으로 올리지 말 것. 브라우저가 서명 주소를 직접 Range로 받으므로 함수 4.5MB 한도와 무관하고,
  그래서 **CSP `media-src`에 `*.private.blob.vercel-storage.com`이 열려 있어야 한다**(middleware.ts).
- 음원 교체: `node --env-file=.env.local scripts/press/build-sabbaha-slung.mjs --src <mp3 폴더> --prune` →
  `data/press/sabbahaSlungAudio.ts`(생성물) 갱신. 받은 파일 번호는 앨범 순서와 달랐다 — 스크립트가 제목·길이로 앨범 순서에 맞춘다.
- 문안(`data/press/sabbahaSlung.ts`)도 공개 저장소에 있다. 이미 공개된 정보만 둔다. 가사·곡 소개 인용은 sabbaha.kr/slung 부클릿 원문 그대로.
- 사이트 껍데기를 두르지 않는다(`components/Layout.tsx` isPressRoom). noindex + no-store, 사이트맵 제외. robots.txt에는 적지 않는다(경로를 광고하게 된다).

### 계약 본문은 만든 템플릿으로 서명 때 완성한다 (마이그레이션 0046)

계약 본문(`contracts.content`)은 만들 때 굳지만, 서명 API는 고객이 채운 생년월일·주소·계약일을 넣어 **템플릿에서 본문을
다시 만들어** 해시에 묶는다(`buildSignedContractContent`). 그 사이 `contract-template.md`가 바뀌면 고객이 화면에서 읽은
조항과 서명에 묶이는 조항이 달라진다(2026-10-02 코드리뷰). 그래서 계약을 만들거나 초안을 고칠 때 **템플릿 원문을
`contract_template_snapshots`에 떠 두고**(`lib/contracts/template-snapshot.ts`), 서명 때 그 사본으로 완성한다.

- 이용수칙처럼 `contract_attachments`에 넣지 않은 이유: 그 표의 행은 전부 "고객이 동의하는 문서"로 취급되어 서명 화면의
  동의 체크·PDF·지문에 들어간다. 템플릿 사본이 거기 끼면 동의 항목이 하나 늘어난다.
- `contracts`에 컬럼을 더하지 않고 별도 표를 둔 이유는 배포 순서다(0037과 같다). 표가 없으면 읽기는 `null`을 돌려
  현재 파일로 되돌아간다 — **마이그레이션 전에 배포해도 계약 화면은 깨지지 않는다.** 그래도 적용은 해야 사본이 쌓인다.
- **0046 이전에 만든 계약은 사본이 없다.** 그 계약은 서명 때 현재 파일을 쓴다(옛 동작). 서명 대기 중인 계약이 있을 때
  `contract-template.md`를 고치지 말 것 — 그 계약만은 여전히 읽은 본문과 서명 본문이 갈릴 수 있다.
- 사본 저장이 실패해도 계약 생성은 막지 않는다(로그만). 보호가 조용히 빠질 수 있으니 `[contracts/template-snapshot]`
  로그가 보이면 표 적용 여부를 확인한다.

### 음원 제작 용역 전자계약은 `lib/contracts/production/`에 있다 (마이그레이션 0070)

연습실 계약과 서명 원칙(템플릿 사본·조건부 batch·버전 접두사 지문·연락처 뒷자리)을 같이 쓰되 표는 따로다
(`production_contracts`·`production_contract_signers`). 설계·남은 단계는 `docs/production-contract-design-2026-10.md`.
어겨도 에러가 안 나는 것:

- **고객 화면·API는 `/contracts/` 아래에 둔다**(`/ko/contracts/production/…`, `/api/contracts/production/…`). 그 경로의
  no-store 헤더(next.config.mjs)·측정 제외(lib/analytics/privatePaths.ts)·사이트맵 제외를 그대로 받는다. 다른 곳으로
  옮기면 네 군데를 모두 고쳐야 한다.
- **PDF Blob 접두사는 `production-contracts/`다**(`lib/contracts/pdfPath.ts`). 백업 크론의 고아 정리가 `contracts/` 아래에서
  contracts 표가 가리키지 않는 PDF를 지우므로, 같은 접두사에 두면 제작 계약서가 지워진다.
- **계약 조건은 `terms_json`으로 계약마다 굳는다.** 기한·수정 횟수를 계산하는 코드는 코드 상수가 아니라 그 계약의 terms를
  읽을 것. 금액 기본값만 `data/pricing.ts` 상수에서 온다.
- **발송 = 운영자 서명.** 서명 API는 운영자 서명이 없는 계약의 의뢰인 서명을 받지 않는다(계약서 제14조 "양 당사자 서명으로 성립").
- **진행 기록(`production_contract_events`, 0071)은 추가만 한다.** 고칠 일은 `void` 기록으로. UPDATE는 통지 결과와 파기뿐이다.
  상태 판정은 전부 `ledger.ts`(순수 함수) 하나에서 — 화면·크론·API가 각자 계산하지 말 것.
- **간주 승인(제5조 5항)은 전달 통지 메일이 실제로 나간(`notice_status = sent`) 전달에만 기록한다.** 통지 실패를 무시하고
  기록하는 경로를 만들지 말 것 — 알리지 않은 기한으로 승인을 의제할 수 없다.
- 해지 정산 경계는 계약마다 terms에 있고 제10조 3항 문장도 거기서 나온다. 경계를 바꾸면 새 계약부터다.
- **계약 성립은 `finalizeProductionContractIfComplete` 하나로만.** 서명자가 둘(의뢰인·법정대리인)일 수 있어, 서명 쓰기와
  성립을 나눴다 — 성립 단계가 다시 읽은 상태로 본문(계약일 = 마지막 서명)과 지문을 만든다. 서명 요청이 각자 계산한
  지문을 쓰면 동시 서명에서 한쪽 서명이 지문에서 빠진다.
- **마이그레이션 0072는 배포 직후 바로 적용한다**(`production_contract_signers`에 컬럼 추가 — 관계 조회가 전체 컬럼을
  SELECT해 적용 전에는 제작 계약 화면이 깨진다. 연습실·결제 경로는 무관). `refund_accounts` 재생성도 함께다(0061과 같은 방식).
- **마이그레이션 0073(EP·정규)도 배포 직후 바로 적용한다.** `production_contracts`를 다시 만들어 kind CHECK를 넓히고
  `production_contract_events.song`을 더한다. 표 재생성은 libsql 마이그레이터가 외래 키를 끈 채 돌려서 서명자·기록이
  CASCADE로 지워지지 않는다 — **마이그레이터 밖에서 SQL을 손으로 돌릴 땐 `PRAGMA foreign_keys=OFF`를 먼저.**
- EP·정규 계약서(`release-template.md`)는 싱글 문안에서 곡 수 문장만 바꾼 것이다. 공통 조항을 고치면 두 파일을 같이 —
  template.test.ts가 어긋남을 잡는다.
- **믹싱·마스터링 계약(kind `mixmaster`, `mixmaster-template.md`, 2026-10-20)** — 녹음이 끝난 파일을 받아 1곡을 믹싱·마스터링한다.
  조 번호(제1~14조)는 제작 계약과 같게 둔다 — 진행 기록·메일이 "제5조 5항", "제10조 1항"을 가리킨다. 범위(제2조)·착수(제10조 1항)·
  발매(제9조, 의뢰인이 직접)가 다르고 제3·12·14조는 싱글과 같은 문장이다(mixmaster.test.ts). 장부와 화면은 종류 대신
  `scope.arrangementTracks = 0`으로 알아본다(편곡 단계·녹음·유통 기록을 숨긴다, `isMixMasterTerms`). 환불 항목은 하나(믹싱 1차 전달 때
  믹싱 몫, 마스터링 전달 때 전액). `mixing`이 아니라 `mixmaster`인 이유는 온라인 믹싱 주문이 이미 `mixing`을 쓰기 때문이다.
  **마이그레이션 0078(kind CHECK 확장, 표 재생성)은 배포 직후 적용한다** — 적용 전에는 믹싱·마스터링 계약 저장만 CHECK에 걸려
  실패한다(기존 종류·결제는 무관). 손으로 SQL을 돌릴 땐 0073과 같이 `PRAGMA foreign_keys=OFF`를 먼저.
- **링크 계약(의뢰인 정보를 서명할 때 받기, `open-link.ts`, 2026-10-20)** — 운영자가 의뢰인 이름·연락처를 모를 때 작성 폼의
  체크박스로 만든다. 의뢰인 칸은 빈 문자열로 저장되고(`client_phone = ''`이 판정), 발송하면 메일 없이 링크만 생겨 관리자 상세의
  "서명 링크 복사"로 카카오톡에 보낸다. 의뢰인은 서명 화면에서 이름·활동명·연락처·이메일을 적고, **연락처 뒷자리 대조를 하지
  않는다** — 대조할 번호가 없다. 그래서 `identityVerifiedAt`을 남기지 않고 서명본 PDF에 "연락처 대조 없음 — 1:1로 전달한 링크"로
  적는다(하지 않은 확인을 기록하지 말 것). 법정대리인은 지정할 수 없다(미성년 의뢰인은 서명 화면이 막는다).
- **50만원 이하 계약은 한 번에 받는다**(운영자 결정 2026-10-20, `terms.ts` `SINGLE_PAYMENT_MAX`·`splitPayment`) — 계약금 = 계약금액,
  잔금 0. 계약서 요약표·제3조 2항·제5조 6항, 메일·체결·진행 화면이 "계약금·잔금" 대신 "대금 일시불"로 말한다(`depositWordFor`).
  넘으면 절반씩. **계약서에는 납품 기한이 있다**(제4조 1항 "N주 이내 최종 마스터 인도", 믹싱·마스터링은 "믹싱 1차 N영업일 이내"도 —
  `firstDeliveryBusinessDays`, 기본 7). "약 N주"로 되돌리지 말 것 — 운영자가 기한을 요구했다.
- **서명 화면의 동의는 체크 하나다**(2026-10-20, `clauses.ts` `buildProductionClauses`) — 중요 조항 요약(간주 승인 N일·착수 후 해지
  공제·발매 후 포트폴리오)을 보여 주고 한 번에 받는다. 서명이 곧 모든 조항 동의라 조항마다 받지 않는다. 요약 문장(`points`)은
  지문에 들어간다(없는 옛 계약의 지문은 그대로). 옛 다섯 항목 계약은 저장된 사본(`clauses_json`) 그대로다.
- **계약 대금은 결제 링크로 받는다**(2026-10-20, `payment-link.ts`, 마이그레이션 0079 `production_contract_payment_links`) — 체결되면
  지금 받을 돈(계약금·일시불 전액, 마스터링 승인 뒤 잔금)의 결제 링크를 열고(`ensureContractPaymentLink`, 여러 번 불러도 같다),
  결제가 확정되면(`confirmDeposit`·계좌 입금 확인) 진행 기록에 `payment_received`(data.orderNo, actor `system:payment`)를 **한 번만**
  남기고 링크를 닫는다. **결제 링크는 여러 번 결제될 수 있다 — 받을 돈이 바뀌면 열린 링크를 닫고 새로 만드는 규칙을 깨지 말 것**
  (관리자 기록 뒤 `recordAdminProgress`가 맞춘다). 링크 결제는 결제 행으로 매출에 잡히므로 `productionRevenue`는 data.orderNo 기록을 뺀다.
  계약 결제 주문의 계좌 입금 확인은 결제 링크의 일반 입금 메일 대신 계약 통지 메일을 보낸다(두 통 가지 않게).
  **0079는 배포 직후 적용한다** — 전에는 결제 링크가 안 생길 뿐 서명·체결·결제 링크 주문은 그대로 돈다(전부 실패를 삼킨다).
- **간주 승인 기한은 전달일과 통지가 실제로 나간 날 중 늦은 날부터 센다**(`deemedBaseDay`). 장부와 전달 메일이 같은
  함수를 쓴다 — 통지가 실패했다가 다시 나가면 의뢰인은 그날부터 7일을 받는다. 기한이 지난 뒤의 수정 요청은 크론이
  아직 승인을 기록하지 않았어도 거절한다.
- **판정을 거치는 진행 기록은 `recordProgressEvent`로만 넣는다.** 판정한 장부의 다음 순번으로 INSERT해 그 사이 다른
  기록이 들어왔으면 UNIQUE(contract_id, seq)가 막고 다시 판정한다(낙관적 잠금) — 같은 결과물에 승인·수정 요청이 동시에
  두 번 와도 하나만 남는 이유다. `appendProductionEvent`를 직접 부르는 새 경로를 만들지 말 것(기한 안내 기록만 예외).
- **해지 환불에서 동의한 추가 비용(제6조)·이행한 초과 수정 요금은 착수 후 의뢰인 사정의 해지(제10조 3·5항)에서만
  돌려주지 않는다**(운영자 결정 2026-10-19, 계약서 제10조 3·4항에 문안으로 넣었다). 착수 전(2항)·스튜디오 사정(4항)은
  공제하지 않고, 수정 요금은 다시 전달까지 마친 것만 센다. 해지 사유 구분은 `termination_reason` 앞 `[라벨]`이다
  (`termination.ts` — 마이그레이션 없이 담으려고). 해지하면 의뢰인에게 환불액·계좌 안내 메일이 간다.
- **개인정보 3년 보관의 기산점은 최종 인도일·해지일이다**(제13조·처리방침 ⑫). 완료 처리는 완료일을 최종 인도일로
  기록하고(운영자가 날짜를 고르지 않는다), 완료 처리를 빠뜨린 계약도 `retention.ts`가 최종 인도일 기준으로 파기한다.
  미체결 계약은 서명 링크 만료 시각(sent·expired), 취소·버려진 초안은 마지막 수정일부터 3년. 해지일은 체결일보다
  앞설 수 없다.
- **날짜 세기는 초일불산입이다.** "14일 이상 지체"·"30일 이상 무응답"·"4주 이상 지연"은 그 기간이 다 지난 다음 날부터
  성립한다(`>`로 비교). 작업 기간 지연에서는 의뢰인 사유 정지와 **피드백 대기**(결과물 전달 → 답)를 빼고 센다(제4조 2항).
- **제10조 5항 해지(cause `client_default`)는 요건과 통지가 있어야 한다** — 무응답 30일·대금 14일 지체 중 하나와 앞선
  `termination_notice` 기록. 없으면 API가 거절한다.
- **계약서 자리표시자는 `fillPlaceholders`(lib/contracts/placeholders.ts)로 한 번에 채운다**(연습실·제작 공통). 차례로
  replaceAll 하면 서명자가 주소에 적은 `{{…}}`가 다시 치환돼 표가 깨진다.
- 템플릿(`single-template.md`) 제13조(개인정보 3년)·처리방침 ⑫·`retention.ts`가 같은 약속을 한다. 한쪽을 바꾸면 셋 다,
  처리방침은 `FUNDING_TERMS_VERSION`도.

### 계약 변경 이력은 별도 표에 남는다 (마이그레이션 0075 `contract_admin_events`)

관리자가 계약에 한 발송·재발송·수정·취소·삭제·종료·완료 메일 재발송·생성의 수행자·전후 상태·시각이다(`lib/contracts/admin-events.ts`).
화면은 계약 상세의 "관리자 작업 이력"과 `/admin/contracts/history`(필터·CSV). 열람 기록(`privacy_access_logs`의 `contract_view`)과는 별개다 —
그 표는 개인정보를 *여는* 행위의 기록이고 이 표는 *바꾼* 행위의 기록이라 섞지 않는다.

- **개인정보를 넣지 말 것.** 계약 id·행위·수행자 id·상태뿐이다. 개인정보가 아니므로 접속기록(처리방침 19항)에는 기록하지 않는다(법적 검토 전 가정 — 개인정보를 더하게 되면 접속기록 대상으로 바꿀 것), 계약 파기(`purgedAt`)와 무관하게
  남는다 — 종료 사유 같은 자유 서술을 복사해 오면 파기 때 안 지워지는 사본이 된다. 칸을 늘리려면 이 규칙부터 본다.
- 계약 FK를 걸지 않는다(초안 삭제 행위 자체를 기록해야 한다). 계약 라우트가 **성공한 변경 직전에** `recordContractChange`를 부른다 — 새 변경 액션을 만들면 거기에 넣을 것.
  실패한 시도는 남기지 않는다.
- 쓰기는 DB가 실패해도 던지지 않고(서버 로그는 항상 남는다), 읽기는 표가 없으면 상세는 빈 목록·이력 화면은 0075 적용 안내다. 순서는 마이그레이션 → 배포가 맞지만 뒤집혀도 계약 화면은 깨지지 않는다.
- 0075 적용 이전의 변경은 수행자를 알 수 없어 소급하지 않았다(지어내지 않는다). 그 전 계약의 발송·서명 시각은 서명 지문(`AuditTrail`)에 있다.

### 후기 요청 메일은 처리방침이 허용한 주문에만 간다 (마이그레이션 0038)

`/api/cron/review-requests`(매일 11:00 KST)가 녹음 세션 다음 날·믹싱 납품 다음 날 고객에게
후기 요청 메일을 한 번 보낸다. 판정은 `lib/reviews/reviewRequests.ts`, 발송 기록은
`review_requests`(0038, 별도 테이블 — 0037과 같은 이유).

- **`REVIEW_REQUEST_ELIGIBLE_FROM`(2026-09-27 KST)보다 앞선 주문에는 보내지 않는다.** 이 목적은
  2026-09-26 처리방침 2항 개정으로 생겼고, 그 전 고객은 동의한 적이 없다. 이 날짜를 앞당기지 말 것.
  처리방침 문구("한 건당 한 번", "다음 날", "혜택 없음")와 코드가 같은 약속을 해야 한다 —
  한쪽을 바꾸면 다른 쪽도 바꾸고, 처리방침은 펀딩 약관 판본 게이트를 탄다.
- **기록을 먼저 넣고 보낸다.** 크론이 겹쳐도 한 통만 나가게. 일시적 실패(API·네트워크)는 기록을
  지워 7일 창 안에서 다음 날 다시 시도하고, 반송·시간 초과는 두 통이 가지 않게 기록을 남긴다.
  실패는 전부 운영자에게 메일로 간다.
- **"다음 날"은 KST 날짜로 판정한다**(끝난 날 < 오늘). 경과 시간으로 자르면 전날 밤 늦게 끝난
  이용이 이틀 뒤로 밀린다.
- **연습실 시간제는 대상이 아니다.** 처리방침은 "녹음 세션·믹싱 납품"만 약속한다. 넓히려면
  처리방침을 먼저 고치고 판본을 올릴 것. 운영자 결제 테스트(`smoke-test`), 운영자 본인 주소,
  취소·노쇼·환불 건도 제외. 같은 이메일(대소문자 무시)로 180일 안에 보냈으면 건너뛴다.
- **노쇼 제외는 운영자 표시에 달려 있다.** `no_show`는 관리자가 손으로 바꾸므로, 다음 날 11:00 전에
  표시하지 않으면 노쇼 고객에게도 메일이 간다. 운영자 예약 알림 메일에 이 안내가 붙는다.
- **크론이 통째로 실패하면(표 없음·DB 장애) 운영자에게 메일이 간다.** 개별 발송 실패 알림과 별개다.
- 운영자 판단(2026-09-27): 이 메일은 광고성 정보가 아니다 — 혜택·홍보 문구를 넣으면 그 판단이 달라진다.
- **혜택을 붙이거나 좋은 후기를 유도하는 문구를 넣지 말 것**(추천·보증 심사지침). 테스트가 막는다.
- 네이버 스마트플레이스에는 고객에게 보낼 리뷰 작성 링크가 없다(2026-09-26 확인). 네이버는
  플레이스 단축 링크(`naverMapUrl`)로, 구글은 `googleReviewUrl`(g.page 리뷰 링크)로 보낸다.
- 적용은 "운영 DB 마이그레이션 적용 방법" 절대로. 표가 없으면 크론이 500으로 실패한다
  (조용히 0건으로 끝나지 않게 일부러 던진다).

### 마이그레이션은 배열 순서가 아니라 `when`으로 걸러진다 — 작은 `when`은 조용히 건너뛴다

drizzle의 libsql 마이그레이터는 적용된 것 중 `created_at`이 가장 큰 행 하나만 읽고
(`ORDER BY created_at DESC LIMIT 1`), 저널 엔트리의 `when`(밀리초)이 그 값보다 **큰 것만**
실행한다(`node_modules/drizzle-orm/libsql/migrator.js`의 `Number(last[2]) < migration.folderMillis`).
인덱스(0019·0020)도, 배열 순서도 보지 않는다. 그래서 **이미 적용된 것 중 최대 `when`보다
작은 마이그레이션은 영원히 실행되지 않고 오류도 나지 않는다.** `npm run db:migrate`는
초록으로 끝나고, 없는 컬럼을 참조하는 코드가 런타임에서야 깨진다.

이 저장소는 마이그레이션을 코드와 함께 배포하지 않는다(생성·커밋만 하고 적용은 운영자가
수동으로 `npm run db:migrate`). 그래서 이 함정이 더 오래 숨는다.

**`when` 오름차순이 곧 적용 순서다.** 지금 관련된 셋:

(이 표는 함정을 처음 만난 사례의 기록이다. `0020_serious_luckman`은 재발행되어 지금 저널에 없고 그 컬럼은 0022에 있다.)

| tag | when | 위치 |
|---|---|---|
| `0020_serious_luckman` | 1790039737875 | PR #211 (`feat/creator-shipping`, 미머지) |
| `0020_payment_failure_reason` | 1790065459500 | main (머지됨) |
| `0021_cheerful_spencer_smythe` | 1790132266461 | `feat/funding-payout` |

**PR #211의 `0020_serious_luckman`이 셋 중 가장 작다.** main의 `0020_payment_failure_reason`이
운영 DB에 이미 적용됐다면 #211을 머지해도 그 마이그레이션은 **영영 적용되지 않는다** —
`db:migrate`는 아무 말 없이 초록으로 끝난다. 이건 `feat/funding-payout`이 만든 문제가
아니지만 이 절이 그 함정을 적는 유일한 자리다. 되살리는 방법은 둘이다: 머지한 뒤
마이그레이션을 **재발행해 `when`을 현재 최댓값보다 크게** 만들거나, 그 SQL을 손으로
실행하고 `__drizzle_migrations`를 맞춰 준다. 앞쪽이 안전하다.

**두 브랜치가 같은 idx를 주장하면 머지에서 저널이 부딪힌다.** 위 두 0020이 그 경우다.
해결은 엔트리를 **`when` 오름차순으로 합치고 `idx`를 다시 매기는 것** — idx는 표시용이고
판정은 `when`이 하므로, 순서를 `when`에 맞춰야 읽는 사람과 마이그레이터가 같은 말을 한다.

**병합 뒤의 두 번째 함정 — 스냅샷.** `drizzle-kit generate`는 저널 **마지막 엔트리**의
스냅샷과 현재 스키마를 diff한다. 브랜치 스냅샷은 자기 쪽 변경만 담고 있으므로, 합친 뒤
마지막 엔트리의 스냅샷에 **없는 쪽의 DDL이 다시 발행되고**, 그 컬럼은 이미 적용돼 있으니
운영 DB에서 `duplicate column name`으로 터진다. 어느 쪽이 끝에 오든 성립한다 — 방향을
한쪽으로 단정하지 말 것. 처방: 머지할 때 **마지막 스냅샷이 양쪽 변경을 모두 담은 전체
스키마**가 되도록 재발행하고, `prevId` 사슬을 앞 스냅샷의 `id`로 이어 둘 것.

**브랜치 체크아웃에서 `db:migrate`를 돌리지 마라.** 그 브랜치에 없는 마이그레이션이
`when` 최댓값 아래로 깔려 영영 건너뛰어진다. 적용은 main 병합본에서 한 번에 한다.

밀린 마이그레이션 자체는 `scripts/check-migration-drift.mjs`(CI)와 `lib/ops/migrationDrift.ts`
(매일 크론 메일)가 저널 엔트리 수와 `__drizzle_migrations` 행 수를 비교해 잡는다. 다만 그
판정은 **개수**를 보므로, 가운데 하나가 건너뛰어진 이 함정에서는 밀린 건수는 맞아도 이름은
저널 뒤쪽 것을 댄다. 개수가 어긋났다면 저널의 `when`과 `__drizzle_migrations.created_at`을
직접 대조할 것.

### 운영 DB 마이그레이션 적용 방법 — Turso CLI로 한다

`npm run db:migrate`(= `scripts/db-migrate.mjs`)가 **유일한 적용 경로**다. 스크립트가 main 병합본인지(브랜치 main·
HEAD == origin/main) 확인하고, Turso CLI 세션으로 적용 예정 목록과 "when이 작아 조용히 건너뛰어질 목록"을 보여 준 뒤,
`--yes`가 있을 때만 그 자리에서 1일짜리 토큰을 만들어 적용한다(미리 보기는 토큰을 만들지 않는다). 건너뛰어질 것이 있으면 멈춘다.
`.env.local`의 TURSO_*는 로컬 작업용 **단기(30일) 토큰**이다 — 운영 적용에 쓰지 않는다(`vercel env pull`은 Sensitive라
빈 값으로 내려온다). 이 맥에는 로그인된 Turso CLI가 있다.

- CLI 위치는 `~/.turso/turso`이고 PATH에 없다. 운영 DB 이름은 **`studio-nol`**이다.
  같은 계정에 `ggac-prod`도 있으니 이름을 헷갈리지 말 것.
- 적용은 **main 병합본에서만** 한다(위 절의 브랜치 체크아웃 금지와 같은 이유).

1. **적용 전 확인(읽기 전용).** 적용된 행 수와 최신 시각을 저널과 대조한다. 행 수가 저널보다
   적고, 밀린 엔트리의 `when`이 모두 `max(created_at)`보다 커야 실제로 실행된다. 아니면
   위 절의 함정이므로 적용하지 말고 재발행부터 한다.
   ```bash
   ~/.turso/turso db shell studio-nol "select count(*), max(created_at) from __drizzle_migrations;"
   node -e "const e=require('./drizzle/migrations/meta/_journal.json').entries;console.log(e.length);e.slice(-3).forEach(x=>console.log(x.tag,x.when))"
   ```
2. **적용.** 1번 확인까지 스크립트가 대신 한다. 토큰은 파일에 쓰지 않고 스크립트가 만든다(`-e 1d` — 토큰 기본값이
   **만료 없음**이라 빼면 쓰고 버린 토큰이 영구히 살아 남는다). `npx drizzle-kit migrate`를 직접 부르지 말 것.
   ```bash
   npm run db:migrate          # 대상·적용 예정·건너뜀 목록만 보여 주고 멈춘다
   npm run db:migrate -- --yes # 적용
   ```
3. **확인.** 1번 조회를 다시 돌려 행 수가 저널 수와 같은지 보고, 새 테이블·컬럼은
   `pragma table_info(<테이블>);`로 코드와 대조한다. main CI의 `Migration drift check`도
   다음 push부터 초록이 된다.

**토큰 정책(2026-10-17 회전).** Turso는 토큰 단위 폐기가 없다 — `turso db tokens invalidate`는 키를 돌려 **기존 토큰
전부**를 무효화한다. 그래서 회전은 전체 교체이고 저트래픽 시간에 한다. 세 벌만 둔다: Vercel Production(rw, 만료 없음),
GitHub Secret(`--read-only -e 90d`, drift 점검용 — **90일마다 재발급**, 만료되면 main push마다 drift 잡이 unknown/실패),
`.env.local`(rw `-e 30d`, 로컬 스크립트용). `.env.local` 백업 파일을 만들지 말 것 — 토큰 사본이 늘어난다.

### 운영 DB 백업과 시점 복구 — PITR은 하루뿐이다

운영 Turso 조직의 플랜은 **starter(무료)**라 시점 복구(PITR) 보존이 **1일**이다(Developer 10일·Scaler 30일).
하루 넘겨 발견한 사고(잘못된 마이그레이션·실수 삭제·토큰 유출)는 PITR로 되돌릴 수 없다. 그래서
`/api/cron/backup-ledger`(매일 02:30 KST, `lib/ops/ledgerBackup.ts`)가 주문·결제·환불·예약·결제 링크·후원·구독·입주·정산·공연·
상점 원장을 표 단위로 떠서 private Blob `ledger/backup/`에 28일 보관한다. 자격증명·상시 토큰은 뺀다(빌링키 원문·raw_response·
구독 manage/setup 토큰·customer_key·주문 manage_token·티켓 code, 토스 원문의 secret) — 그래서 **복구 때 관리 링크·티켓 QR은
전부 재발급·재발송이 전제**다. 백업 실패와 옛 백업 정리 실패는 각각 운영자 메일이 온다.

- **PITR 복구**(24시간 안쪽): `~/.turso/turso db create studio-nol-restore --from-db studio-nol --timestamp <RFC3339>`
  → 새 DB 내용을 확인한 뒤 Vercel env의 `TURSO_DATABASE_URL`·`TURSO_AUTH_TOKEN`을 그쪽으로 교체. 원본은 지우지 않는다.
- **백업에서 복구**(그 뒤): Blob에서 그날의 `.json.gz`를 받아 표 단위로 되살린다. 백업에 없는 컬럼(빌링키·토큰)은
  재발급이 전제다 — 구독 카드는 고객이 다시 등록해야 한다.
- 분기마다 한 번 복구 리허설(백업 파일을 로컬 SQLite에 풀어 행 수 대조)을 한다. 외부 스케줄러는 쓰지 않는다.

### 함수 지역은 도쿄(`hnd1`)다 — DB 옆에 둔다

운영 DB(Turso `studio-nol`)가 `aws-ap-northeast-1`(도쿄)에 있어서, 2026-10-16에 Vercel 함수 기본 지역을
`iad1` → `hnd1`로 옮겼다. 미국 동부에서는 DB 왕복 한 번이 약 150ms라, 조회를 차례로 여섯 번 하던 펀딩 상태 API가
CDN이 비었을 때 1.15~2.1초 걸렸다(응원 메시지가 늦게 뜨던 원인, #717). 옮긴 뒤에는 0.10~0.26초다.

- **설정은 `vercel.json`이 아니라 프로젝트 설정에 있다**(`resourceConfig.functionDefaultRegions`, 대시보드 Settings → Functions).
  바꾸면 **다음 배포부터** 적용된다 — 확인은 응답 헤더 `x-vercel-id`의 가운데 값(`icn1::hnd1::…`).
- **서울(`icn1`)로 옮기지 말 것.** Turso에는 서울 지역이 없다(`turso db locations`). 함수를 서울에 두면 방문자 쪽 한 번(약 30ms)을
  아끼는 대신 DB 왕복마다 약 30ms가 붙는다 — 한 요청이 DB를 여러 번 묻는 경로(결제 확인·예약·관리자)에서 더 느리다.
  Turso가 서울을 열면 DB와 함수를 함께 옮기는 것을 검토한다.
- **요금은 함수 지역이 아니라 요청이 들어온 CDN 지역으로 매겨진다.** 2026-09-16~10-15 사용량(`vercel usage --group-by region`)에서
  함수가 `iad1`이었는데도 지역 과금(ISR·Fast Origin Transfer·Fluid CPU)이 전부 "Seoul"로 잡혔다. 지역 이동으로 단가가 바뀌지 않는다.
- **Blob 저장소도 도쿄다 — `studio-files`(`store_YPoqIWRzeosPPaPv`, private, `hnd1`).** 계약서 PDF·백업·원장 백업·감상실 음원·
  GSC 스냅샷·소셜 이미지, 펀딩 미디어·서류가 모두 여기 있다. 2026-10-16에 `iad1`의 `seo-snapshots`에서 옮겼다
  (`scripts/copy-blob-store.mjs`로 40개 복사·해시 대조 → 연결 교체 → 재배포). 이유는 감상실 실측: 곡의 첫 요청(서울 CDN MISS)이
  iad1에서 1.2~2.6초 → hnd1에서 0.22~0.33초. 연결은 `BLOB_READ_WRITE_TOKEN`·`BLOB_STORE_ID`(SDK는 OIDC가 있으면 그쪽, 없으면 토큰)다.
  옛 `seo-snapshots`(iad1)는 2026-10-17에 비우고 삭제했다 — 되돌릴 저장소는 없다.
- **Blob 파일은 주소가 아니라 경로(pathname)로 다룬다.** 주소의 호스트가 저장소 ID라, 주소를 DB에 두고 그 주소로 읽고·지우고·
  비교하면 저장소를 옮기는 순간 틀어진다 — 계약서 PDF는 고아 정리가 멀쩡한 파일을 지우고 파기가 사본을 남겼을 것이다
  (`lib/contracts/pdfPath.ts`, #728). 새 Blob 사용처도 경로로 읽고 경로로 비교할 것.
- 지역과 별개로, **핫 경로에서 DB 조회를 차례로 늘리지 말 것** — 독립 조회는 `db.batch` 한 번으로 보낸다(`aggregateProjectStatus` 참조).

### 토스 키는 두 쌍이다 — 결제창을 연 키와 같은 쌍으로 승인한다

같은 MID(studkol3wd)에 키 쌍 둘이 공존한다. v2 SDK는 두 갈래이고 갈래마다 요구하는 키가 다르다.

| 갈래 | 클라이언트 키 | 시크릿 키 | 쓰는 화면 |
|---|---|---|---|
| `toss.widgets()` + `renderPaymentMethods` | `NEXT_PUBLIC_TOSS_CLIENT_KEY`(`live_gck_`) | `TOSS_SECRET_KEY`(`live_gsk_`) | 결제위젯 — **2026-10-14에 화면에서 걷어냈다.** 그 전에 위젯으로 낸 결제의 조회·취소·웹훅이 아직 쓴다 |
| `toss.payment()` + `requestPayment` | `NEXT_PUBLIC_TOSS_API_CLIENT_KEY`(`live_ck_`) | `TOSS_API_SECRET_KEY`(`live_sk_`) | 우리가 그린 결제수단 목록 — **유일한 결제 경로**. 둘 중 하나라도 없으면 헬스체크(`checkTossApiKeyPair`)가 high |

SDK가 `payment()` 경로에서 `isAPIIndividualKey()`를 단언한다 — 위젯 키로 부르면
`NotSupportedWidgetKeyError`를 던진다. 결제창 개설 API(`px-payment-parameters`)는 위젯 키로도
토큰을 내주므로 **API로만 확인하면 "된다"는 잘못된 결론이 나온다**(2026-09-15에 그렇게 배포했다가
되돌렸다). 판정은 브라우저에서 `toss.payment()`를 실제로 불러 할 것.

**승인 시크릿 고르기**(`lib/booking/toss.ts`). 승인은 결제창을 연 키와 같은 쌍이어야 한다.
결제수단 목록으로 연 결제는 success 주소에 `tosskey=api`를 싣고(`withApiKeyChannel`), success
페이지(booking·funding·shows)가 그 값을 `confirm*`에 `channel`로 넘겨 API 시크릿부터 쓴다. 채널을
모르는 경로(웹훅·재조회·취소·자동 취소)는 위젯 시크릿부터 묻는다. 어느 쪽이든 응답이 키 불일치 계열
(`UNAUTHORIZED_KEY`·`INVALID_API_KEY`·`FORBIDDEN_REQUEST`·`NOT_FOUND_PAYMENT`·`NOT_FOUND_PAYMENT_SESSION`)일
때만 다른 쌍으로 **한 번** 더 묻는다. 이 코드들은 돈이 움직이지 않았다는 뜻이라 재시도가 이중 승인·이중
취소를 만들지 않는다. **네트워크 오류·5xx·카드 거절은 다시 묻지 않는다** — 응답만 늦은 요청은 처리됐을 수
있고, 토스 멱등 키는 API 키별로 묶여 다른 키로 보내면 중복 취소를 막아 주지 못한다. 결제 행에 채널을
기록하지 않는 것은 마이그레이션 없이 넣기 위해서다 — 같은 MID라 조회·취소는 두 시크릿 모두 같은 결제를 본다
(2026-10-04 실측: 두 시크릿 모두 위젯 결제를 조회했다).

**결제수단 목록 화면**(`components/payments/PaymentMethodPicker.tsx`, 정의 `lib/payments/paymentChoices.ts`,
공용 훅 `components/payments/usePaymentCheckout.ts`) — 이제 **모든 결제 화면의 유일한 경로**다(위젯·`?pay=` 스위치·
`studio_pay` 쿠키·`NEXT_PUBLIC_PAYMENT_PICKER`는 2026-10-14에 걷어냈다. Vercel에 남은 `NEXT_PUBLIC_PAYMENT_PICKER`는 무해하니 치워도 된다).
순서는 신용·체크카드 / 계좌로 직접 입금(`withBank`를 준 화면만) / 카카오페이 / 네이버페이 / 토스페이 / 페이코 / 애플페이(`window.ApplePaySession`이
결제 가능할 때만). 간편결제는 `method: 'CARD', card: { flowMode: 'DIRECT', easyPay: '카카오페이' }`처럼 **한국어** 값으로 그
결제창에 직행한다 — 영문 enum은 토스가 거부한다(SAF2026 실측). 토스 계좌이체는 위 계좌 절의 이유로 뺐다. 이 화면에는 약관 UI가
없다(결제창이 자체 약관을 받는다).

### 계좌 입금 대기 처리는 스크립트로도 한다 (`scripts/deposit-ops.ts`)

운영자가 "돈 받았어"라고 하면 관리자 화면 버튼과 **같은 서비스 함수**(`confirm*BankDeposit`)를 운영 DB에 대고 부른다 — 결제 행·발권·확정 메일이 화면에서 누른 것과 같다.
`node --env-file=.env.local --import tsx scripts/deposit-ops.ts list | confirm <주문번호> [--yes] | cancel <주문번호> [--yes]`. `--yes` 없이는 미리보기만 한다.
- **`--yes`는 운영자가 돈을 받았다고 말한 주문에만.** 주문 종류·금액이 운영자가 말한 것과 맞는지 미리보기로 대조한 뒤 붙인다. DB를 SQL로 직접 고치지 않는다 — 결제 행·메일·캘린더가 빠진다.
- 대상은 예약·믹싱·예약금 링크·공연·상점. 펀딩은 관리자 후원 상세에서, 캘린더 자동 등록 예약은 먼저 "고객 정보·금액 수정"으로 금액을 맞춘 뒤 확인한다.

### 새 결제 흐름은 공용 체크아웃으로 만든다 — 토스 SDK를 직접 쓰지 않는다

결제 화면(펀딩·예약·믹싱·예약금 링크)은 전부 `usePaymentCheckout`(결제창 열기) + `PaymentMethodPicker`(토스 수단 목록) +
`BankDepositGuide`(계좌 안내)로 같은 모양이다(`PaymentMethodPicker withBank` — 소프트웨어는 입금 확인 흐름이 없어 계좌 줄이 없다).
새 결제 링크·상품을 붙일 때 계좌 줄을 빼먹으면 결제가 막힌 고객이 갈 곳이 없다. 2026-10-06 예약금 결제 링크(`/ko/pay/<slug>`)가 "코드를 가장 적게 쓰는 설계"로, 쓰는 곳 없던 카드
전용 `TossPaymentWidget`을 골라 계좌 입금 없이 PR까지 나갔다 — 운영자가 보고서가 아니라 화면에서 발견했다.

- **설계 전에 가장 가까운 기존 흐름(믹싱 주문·공연 예매)의 고객 화면을 연다.** 결제수단 줄·안내 문구·
  버튼 말을 적어 두고, 서브에이전트에 조사를 맡길 때 "고객이 결제수단으로 무엇을 고르는가"를 명시적으로 묻는다.
- 계좌 입금은 `awaiting_deposit` → 운영자 입금 확인 → `paid` 흐름이라 **관리자 입금 확인 경로와 안내 메일까지**
  걸린다(`lib/payments/bankDeposit.ts` 머리 주석). 결제 화면만 만들고 끝나지 않는다.
- 새 주문 종류를 `orderTypeEnum`에 더하면 `tests/payments/sharedCheckout.guard.test.ts`가 결제 화면(또는 면제 사유)을
  짝지으라고 CI에서 선다. 토스 SDK를 공용 체크아웃 밖에서 직접 import해도 선다. 허용 목록을 늘리지 말고 공용 컴포넌트를 쓴다.
- 새 결제 종류는 CHANGELOG 대신 이 체크리스트로 점검한다: 결제수단 목록(계좌 줄 `withBank`) · 실패 화면 안내 · 계좌 안내 · 운영자 입금 확인 ·
  입금 안내 메일 · 매출장부 라벨 · 비공개 경로(`lib/analytics/privatePaths.ts`) 등록 · 배포 뒤 실제 결제 1건.

### 맞춤 결제 링크(`/ko/pay/<slug>`)는 배포 없이 만든다 (마이그레이션 0060)

링크 정의는 DB 표 `payment_links`다. **만드는 길은 둘** — 관리자 `/admin/payment-links`(주소 복사 버튼·닫기), 터미널 `npx tsx scripts/pay-link.ts create --name … --amount <부가세 포함 총액> [--expires YYYY-MM-DD] [--memo …] --yes`
(`--yes` 없이는 공급가·VAT를 풀어 보여 주는 미리보기만, `list`·`close <slug>`도 있다 — 운영 DB는 로그인된 Turso CLI로 붙는다). 둘 다 **즉시** 열린다.
- **금액은 부가세 포함 총액이다.** 2026-10-15에 상품가 250,000원에 VAT를 또 얹어 275,000원 링크를 만들어 보냈다가 폐기했다 — 그래서 화면·스크립트가 공급가 + VAT = 총액을 풀어 보여 준다. 2026-10-15부터 사이트 표기가는 전부 부가세 포함·표기가=청구액이다(예외: 연습실 월 이용료·레슨 월정액 — 별도). 그래도 맞춤 링크는 **고객이 내는 돈이 얼마인지부터 확인**하고 그 금액을 그대로 넣는다.
- **발급한 링크의 금액은 바꾸지 않는다**(결제 기록과 어긋난다) — 수정 액션 자체가 없다. 틀렸으면 닫고 새로 만든다.
- 조회는 DB → 옛 파일(`data/paymentLinks.ts`, 읽기 전용) 순서이고, 표가 없는 DB(0060 전)에서는 파일 링크만 돈다. 마이그레이션은 **배포보다 먼저**(안 그러면 관리자에서 만들기가 실패한다 — 결제는 안 깨진다; 0062 전에는 링크 주문 기록(session 칸)과 대시보드 링크 일정만, 0064 전에는 캘린더 등록만 빠진다).
- **주문에는 어느 링크였는지가 남는다**(`payment_link_orders`, 마이그레이션 0061 — slug·상품명 스냅샷). 관리자 예약 목록·상세가 "예약금" 대신 상품명(+링크 메모)을 보이고, 입금 안내·결제 알림 메일에도 상품명이 실린다. 기록은 best-effort라 표가 없어도 주문은 돈다(그 주문은 "예약금"으로 보인다).
- **이용 일시·시간을 넣으면(권장) 대시보드·슬롯에 반영된다**(마이그레이션 0062 — `payment_links`·`payment_link_orders`의 `session_at`·`session_hours`, `payment_links.block_id`). 결제된 링크 주문이 관리자 대시보드 "이번 주 세션"(결제 링크 배지)과 예약 목록 "일시" 칸에 그 시각으로 나온다 — 링크 주문은 예약 시스템(`bookings`)에 행이 없어 예전엔 어디에도 안 보였다(2026-10-15). 기본으로 그 시간대를 **"예약 불가 블록"(녹음실)으로 자동 차단**해 웹 이중 예약을 막고(`--no-block`·관리자 체크박스로 끔), 링크를 **결제·입금 대기 없이 닫으면 블록도 풀린다**(결제가 있으면 남는다). 링크가 만료돼 저절로 닫힌 건 블록을 풀지 않는다(자동 해제 크론이 없다) — 안 쓸 링크는 만료를 기다리지 말고 닫는다. 이용 일시 없이 만든 링크는 대시보드·슬롯에 안 보인다(그때는 캘린더를 따로 막는다).
  **새 링크는 반드시 DB 경로(관리자 화면·`pay-link.ts`)로 만든다 — `data/paymentLinks.ts`(파일 링크)는 이용 일시·블록·캘린더를 못 이어서 2026-10-16 최혜정 건이 결제만 되고 일정에 안 올라갔다. 기계가 지킨다: 파일 링크 목록이 늘면 `data/paymentLinks.test.ts`가 CI에서 실패하고, 품목명에 일시가 있는데 이용 일시가 없는 결제 완료 주문(긴급)·캘린더에 없는 앞날 예약은 매일 운영 점검 메일·대시보드에 올라온다.
- **구글 캘린더에도 올라간다**(마이그레이션 0064 — `payment_link_orders.gcal_event_id`·`gcal_error`, `lib/payments/linkCalendar.ts`). 이용 일시가 있는 링크 주문이 **결제 확정(카드)·입금 확인**되면 녹음실 캘린더("스튜디오 놀 — 예약", `BOOKING_GCAL_ID`)에 `[예약] 상품명 — 고객` 일정이 생기고, 토스 웹훅이 전액 취소를 대사하면 지워진다. 그 캘린더의 일정은 웹 예약 슬롯을 막으므로(slots.ts freeBusy) 링크의 "예약 불가 블록"과 같은 시간을 이중으로 막지만 해가 없다. 사이트 → 캘린더 한 방향이다. 등록·삭제 실패는 결제를 막지 않고 `gcal_error`에 남으며, 관리자 예약 상세의 "구글 캘린더" 줄에서 **다시 등록 / 캘린더에서 지우기**로 처리한다(계좌 입금 주문을 운영자가 손으로 환불한 뒤에는 "지우기"를 누른다 — 그 환불 경로에는 웹훅이 없다).

### 구글 캘린더 → 사이트 (대시보드 로드 때 읽는다, 실시간 아님)

관리자 대시보드를 열 때마다 `lib/ops/adminDashboard.ts`가 ① `syncLinkEventsFromCalendar`(결제 링크 일정이 캘린더에서 옮겨졌으면 `session_at`·예약 불가 블록을 따라 옮기고, 지워졌으면 `gcal_error`에 적는다)와
② `loadUnlinkedCalendarEvents`(`bookings`·`payment_link_orders`에 연결되지 않고 "주문번호:" 줄도 없는 일정 = 운영자가 캘린더에 손으로 넣은 일정)를 돈다.
후자는 "캘린더에만 있는 일정" 카드로 뜨고, "사이트에 등록"은 `/admin/bookings?fromEvent=…`로 수기 예약 칸을 시간 채운 채 연다.
등록(`createManualBooking`의 `adoptEventId`)이 끝나면 원래 캘린더 일정을 지우고 사이트 예약으로 새로 동기화한다 — 충돌 검사는 그 일정을 제외한다(자기 자신과 겹치지 않게).
캘린더 읽기 실패는 대시보드를 막지 않는다(`calendarError`).

### 예약 일정 변경은 시작만 옮긴다 (`lib/booking/reschedule.ts`)

관리자 예약 상세의 "일정 변경"(확정 또는 입금 대기 세션 예약)은 날짜·시작 시각만 옮긴다 — 이용 시간·금액·방은 그대로다(길이를 바꾸면 금액이 달라지니 취소 후 다시 등록).
캘린더 충돌 검사(자기 일정 제외, 조회 실패는 거절) → 조건부 UPDATE 한 문장(다른 예약·예약 불가 블록과 겹치면 0행) → 캘린더 PATCH 순이고,
PATCH가 실패해도 DB는 되돌리지 않고 `gcal_error`에 적는다("캘린더 재시도"가 새 일정을 만들고 옛 일정을 지운다). 고객 메일은 자동으로 나가지 않는다 — 운영자가 "알림 재발송".

### 캘린더에 손으로 넣은 일정은 사이트에 자동 등록된다 (`lib/booking/calendarAutoImport.ts`)

운영자가 구글 예약 캘린더에 직접 넣은 일정(사이트가 올린 일정이 아닌 것)은 **입금 대기 수기 예약으로 자동 등록**된다 — 대시보드를 열 때(`loadAdminDashboard`)와 매일 운영 점검 크론(`/api/cron/health-check`)이 돈다. 운영자는 "캘린더에 넣으면 사이트에도 들어가야 한다"고 기대한다(2026-10-17, 조희정 녹음이 카드만 뜨고 안 들어가 지적받음).
- 이름은 제목에서 짐작(`guessNameFromTitle`), 연락처·이메일은 비움(고객 메일 없음), 상품은 임시로 `recording-hourly`(상품가×시간)이다. **입금 대기라 매출에 안 잡힌다** — 금액을 모르는 채 장부를 틀리게 하지 않는다. 메모에 `[캘린더 자동 등록]`이 남아 운영 점검 메일이 "확인 필요"로 알린다.
- 운영자는 예약 상세의 **"고객 정보·금액 수정"**(`lib/booking/manualEdit.ts`, 입금 대기 세션 예약만)으로 채우고, 돈을 받으면 "입금 확인". 시간은 "일정 변경".
- 자동으로 못 가져오는 일정(종일·자정 넘김·영업시간 밖·8시간 초과·이미 끝남)은 대시보드 "캘린더에만 있는 일정" 카드에 남고 수동 "사이트에 등록"으로 가져온다. 30분 단위는 덮는 시 단위로 만들고 원본 시각을 메모에 남긴다. 끄려면 env `CALENDAR_AUTO_IMPORT=off`.
- 2차 감사(2026-10-18)로 더 막은 것: 제목이 `!`로 시작하거나 `[제외]`를 담거나 휴무·점검·공사·청소·정비·마감·예약불가·회의·미팅이면 가져오지 않는다(운영자가 웹 예약을 막으려 넣은 일정이 입금 대기 예약이 되고, 취소하면 막은 시간이 풀리는 문제). 원본 삭제가 실패하면 예약 메모에 `[원본 일정이 남아 있음: <id>]`를 남겨 다시 가져오지 않고 운영 점검이 알린다. 이미 지난 세션의 입금 확인은 고객에게 확정 메일을 보내지 않는다. 월 입주 가져오기도 R02·R03을 거절하고 연락처는 **같은 방의 계약**에서만 채운다. 전체 캘린더 동기화는 연락처를 복호화하므로 접속기록에 남긴다.
- 6차 감사(HTTP 핸들러 시험·운영 사이트 블랙박스, 2026-10-19)로 더 막은 것: 결제 링크 "캘린더 다시 등록"은 **새 일정을 먼저 만들고 옛 일정을 지운다**(예전엔 지우고 만들어 만들기가 실패하면 일정이 통째로 사라졌다). "캘린더에서 지우기"는 구글 삭제가 실패하면 성공이라 하지 않고 502를 돌려준다. 결제 대기(`pending`) 주문은 캘린더 재시도를 거절한다(15분 홀드가 만료돼도 [예약] 일정이 남아 시간을 막는다). 입주 퇴실일은 입주 시작일보다 앞설 수 없다(오타가 입금 이력까지 지우는 파기를 부른다). "송금 완료"는 환불 계좌가 접수된 주문만. 월 입주 파기가 계약 파기와 같이 실패하면 알림 메일에 둘 다 적는다. 블랙박스 확인: 인증 없는 접근 58건 전부 401/로그인 이동, 입금 예정 일정이 있는 날의 슬롯은 막히지 않음.
- 5차 감사(관리자 화면, 2026-10-19)로 더 막은 것: 입주 폼의 "36만원"이 NaN→null→**0원 월 이용료**로 저장되던 것(클라이언트는 숫자만 받고, 서버도 null·빈 값·1,000원 미만 월 이용료를 거절). 캘린더 일정을 가져올 때 시간제 상품으로 바꾸면 시간이 줄고 원본만 지워지던 것(패널이 일정 길이를 지키고, **서버가 예약이 일정 전체를 덮는지 확인**해 못 덮으면 거절). 입주 목록 props에서 Date 컬럼을 뺐다(dev에서 직렬화 오류). 환불 폼 기본값이 금액 수정 뒤 옛 값으로 남던 것, 결제 링크 닫기 네트워크 실패 시 busy가 안 풀리던 것.
- 4차 감사의 시나리오 시험(3,000건 무작위·동시 실행)으로 더 막은 것: **같은 방에 활성 입주자는 DB 부분 유일 인덱스가 막는다**(`room_tenancies_active_room_uq`, 마이그레이션 0074 — `roomTaken` 확인만으로는 동시 등록·되돌리기에 뚫렸다; 마이그레이션을 먼저 적용하지 않아도 코드는 돈다). 진행 중인 일정도 캘린더 충돌 검사를 한다(끝난 일정만 건너뜀). 시트 가져오기는 등록 화면과 같은 검증(`parseTenancyInput`)을 거치고 금액은 숫자만 남을 때만 읽는다("360,000.50"이 36,000,050이 되던 것 차단). 일정 변경·입금·퇴실 날짜는 말이 되는 범위만 받는다(0001·9999년 오타가 퇴실일로 들어가면 파기 크론이 기록을 지운다). 이름의 제어·양방향 문자를 걷고 서로게이트 쌍을 쪼개지 않는다.
- 4차 감사(2026-10-19, 수정이 만든 회귀 검토)로 더 막은 것: 자동 등록은 **운영 배포(`VERCEL_ENV=production`)에서만** 돈다(로컬 `next dev`·`next start`는 VERCEL_ENV가 없어도 운영 캘린더 키를 읽을 수 있다) — 다른 곳에서 돌리려면 `CALENDAR_AUTO_IMPORT=on`을 명시한다. 원본 표시는 메모 400자 뒤에 붙여 잘리지 않게 하고(일정 id 200자 이하), 원본이 구글에서 이미 사라졌으면 다음 실행이 표시를 자동으로 걷는다(안 걷으면 "기록 삭제"가 영영 거절된다). 제외 단어는 한글 낱말이 **통째로** 그 말일 때만 맞춘다("정비아 녹음"·"공사랑 녹음"은 사람 이름이라 가져온다; `개인`·`합주`는 정상 예약 제목이 많아 뺐다). 월 입주 기록 파기가 실패하면 운영자에게 메일이 가고 크론이 500을 돌려준다. 수기 등록의 시간 계산은 자정에 끝나는 일정을 24시로 본다.
- 3차 감사(보안·운영, 2026-10-18)로 더 막은 것: 크론은 자동 등록에 15초 예산을 두고 나머지는 `waitUntil`에 맡긴다(구글이 느려도 운영 점검 메일이 나가야 한다). 프리뷰·개발 배포(`VERCEL_ENV`≠production)는 자동 등록을 하지 않는다. 반복 일정의 회차는 가져오지 않는다. 원본을 지우기 **전에** 메모에 `[원본 일정이 남아 있음: id]`를 적고 지운 뒤 걷는다(지우다 멈춰도 취소한 예약이 원본을 되살리지 않는다) — 이 표시가 있는 예약은 "기록 삭제"도 거절하고, 취소된 것도 운영 점검이 알린다. 동시 실행이 남긴 빈 `failed` 주문(플레이스홀더 고객·예약 없음·최근 10분)은 정리한다. 월 입주 연락처를 캘린더로 내보내는 일은 접속기록(`tenancy_calendar_export`)에 남고, 퇴실 3년 후 개인정보·5년 후 기록 전체를 월 크론(`purge-contracts`)이 지운다(`lib/tenancy/retention.ts`, 처리방침 19항·수탁자 표 갱신, 약정 판본 `funding-terms-2026-10-18`). 로그에는 drizzle 오류 메시지(바인딩된 개인정보)를 싣지 않고 `safeDbErrorSummary`만 쓴다.
- 감사(2026-10-18)로 막은 것: 등록 전에 DB 점유를 읽기만으로 확인해 충돌 일정은 주문을 만들지 않고 건너뛴다(안 그러면 `failed` 주문이 열람마다 쌓이고 한 일정이 뒤 일정을 영영 막는다). 새 `[입금 대기]` 일정을 못 올리면 원본을 지우지 않는다. "바쁨 아님"(transparent) 일정은 예약이 아니라 가져오지 않는다. 일정 설명은 메모로 보존한다. 읽은 뒤 구글에서 시간이 바뀐 일정은 등록하지 않는다. 고객 정보·금액 수정은 1,000원 미만·빈 값을 거절한다(0원 결제 방지).
- 겹치면 **가장 늦게 들어온 일정을 두고 앞 일정을 조정**한다는 운영 규칙이 있다(자동 집행은 안 한다 — 고객 영향이 있어 사람이 확인).

### 입금 확인 뒤 금액 정정 (`lib/booking/paidAmount.ts`)

관리자 예약 상세 "결제 금액"의 **금액 정정**은 계좌 입금으로 확정된 **세션 예약·믹싱 주문·예약금 링크 주문**(그리고 아래 티켓·상점)의 총액을 고친다(협의가를 잘못 넣었거나 받은 돈과 기록이 다를 때, 운영자 요청 2026-10-20). 계좌 입금의 결제 행에는 금액 칸이 없고 정본이 `orders` 한 곳이라 그 값을 고치면 매출·환불 잔액이 함께 맞는다.
- **토스(카드) 결제·환불 기록이 있는 주문은 거절한다**(믹싱 작업 주문·링크 기록에는 금액 칸이 없어 `orders`만 고친다) — 카드는 승인 금액이 토스에 있어 주문만 고치면 어긋난다(차액은 환불). 이 제한을 풀 때는 그 칸들이 따로 가진 금액을 먼저 본다.
- **공연 티켓·상점 주문도 같은 함수다**(관리자 공연 상세 주문 행·상점 주문 화면의 "금액 정정", `components/admin/PaidAmountCorrection.tsx`). 티켓은 새 총액을 **장당 금액(`show_tickets.unit_amount`)에 비례 배분**한다(환불 계산이 장당 금액×요율이라 할인·감면이 환불에도 그대로 반영되고, 장별 변경은 기록에 남는다). 환불 중·환불된 티켓이나 보상 기록(`compensated_amount`)이 있으면 거절. 상점은 `orders`만 고치고 주문 줄은 정가 기록 그대로라 **아티스트 정산은 정가 기준 그대로**(할인은 스튜디오 부담 — 나누려면 정산 조정으로 따로).
- **0원(완전 무료)으로도 정정된다**(운영자 요청 2026-10-20). 1~999원은 "250000"을 "250"으로 적는 식의 오입력이라 막는다. 0원 주문은 환불할 돈이 없고 매출 0원이며, 티켓은 장당 0원(환불 계산·정산 집계는 `unit_amount > 0`만 센다). 다시 올리는 것도 환불 기록이 없으면 된다.
- 누가·언제·얼마→얼마·왜는 결제 행 `raw_response`(계좌 입금에서는 비는 칸)에 `amountAdjustments` JSON으로 쌓는다. 소급 변경이라 사유가 필수이고 고객 메일은 없다.

### 입금 전 취소 기록 삭제 (`lib/booking/deleteUnpaid.ts`)

관리자 예약 상세의 "기록 삭제"는 **돈이 한 번도 오가지 않은** 세션·믹싱 신청(`deposit_cancelled`)만 지운다 — 결제 행·환불 계좌 기록·남은 캘린더 일정이 있으면 거절한다(결제 기록은 매출·환불 장부의 근거).
자식 행 삭제에도 같은 상태 조건을 건다(검사와 삭제 사이에 상태가 바뀌어 자식만 지워지는 일 방지). 다른 주문 종류에 이 삭제를 넓히지 말 것 — 각각 자식 표·외부 자원(Blob·티켓·라이선스)이 다르다.
캘린더에서 가져오기(`adoptEventId`)는 **사이트가 올린 일정이 아닌 것만** 지운다 — 요청의 id가 다른 고객의 확정 일정이면 등록 뒤 그 일정이 지워지므로, DB 연결·"주문번호:" 줄을 확인하고 읽지 못하면 거절한다.

### 관리자 매출 현황·수기 등록·메뉴 (2026-10) — 어겨도 에러가 안 나는 것만

- **매출 숫자의 정본은 `lib/ops/revenueReport.ts`**(`/admin/revenue`·대시보드 카드가 같은 `summarizeRevenue`를 쓴다). 승인 시각(KST) 기준, 환불은 `done`만(기간 밖 환불도 같은 결제에서 뺀다).
  결제 행이 없는 **계좌 입금·수기 펀딩은 `funding_pledges.paid_at`**으로 더하되 환불은 주문이 `refunded`일 때만 전액으로 친다. `smoke-test` 펀딩은 매출 화면에서만 뺀다 —
  **세무용 결제 장부 CSV(`salesLedger.ts`)는 실제 거래라 빼지 않는다.** 직접 서비스(예약·믹싱·구독·예약금·소프트웨어·**연습실 월 입주**)와 판매·중개(펀딩·공연·상점)는 가르되, **판매·중개의 매출은 결제액이 아니라 스튜디오 몫(플랫폼 수수료)** 이다(`lib/ops/platformFee.ts`, 운영자 결정 2026-10-21 — 정산해 줄 돈까지 매출에 올리면 부풀어 보인다).
  펀딩·공연은 순결제액 × `FUNDING_PLATFORM_FEE_PERCENT`(5.5%), 상점은 아티스트 상품 판매가의 `100 − SHOP_ARTIST_SHARE_PERCENT`%·스튜디오 자체 상품 전액·배송비는 발송하는 쪽(`artistPayout.ts`와 같은 규칙). 결제(PG) 수수료는 비용이라 매출에서 더하거나 빼지 않는다. 행에는 원래 결제액이 `sourceGross`로 남는다.
  **정산 규칙(수수료율·아티스트 몫)을 바꾸면 이 파일의 비율도 같이** — 정산 기록의 실제 금액과는 반올림·부분 환불에서 몇 원 다를 수 있는 발생 기준 추정이다.
  새 `orders.type`을 만들면 `REVENUE_TYPE_LABELS`·`REVENUE_GROUP_OF`·`DEFAULT_LINE_OF_TYPE`(lib/ops/businessLine.ts)·장부 `TYPE_LABELS`에 함께 넣을 것(공연 티켓이 한동안 `ticket`으로 찍혔다 — 분야 표는 `businessLine.test.ts`가 짝을 강제한다).
- **분야별 매출·수익(마이그레이션 0084)**: 매출 현황 맨 위 표와 대시보드 카드가 연습실 / 녹음·제작 / 플랫폼 / 기타로 **매출 − 지출 = 수익**을 보인다. 판정은
  `lib/ops/businessLine.ts`(유형 기본값 + 행의 `line`), 계산은 `businessLinePnl.ts` 하나다 — 화면마다 다시 계산하지 말 것. 세션 예약은 `service_type = practice-room`이면 연습실,
  구독은 종류로(연습실 월 이용료 → 연습실, 아티스트 구독 → 플랫폼, 레슨 → 유형째 `lesson`), 결제 링크는 제작 계약 링크면 항상 녹음·제작 → 링크에 고른 분야 → 기본 녹음·제작,
  수기 매출은 고른 분야 → 유형. 레슨·소프트웨어는 운영자 지정으로 '기타'다. 지출 구분 저장값 `studio`는 **공통**(분야에 나누지 않고 전체 수익에서만 뺀다)이고,
  항목 `loan_principal`(대출 원금)은 수익에서 빼지 않고 "손익에 넣지 않는 지출"로만 보인다. 플랫폼 수익은 PG 수수료를 빼지 않은 값이다(DB에 수수료 기록이 없다).
  결제 링크·수기 매출의 분야는 **그 표에 컬럼을 더하지 않고** `revenue_line_assignments`(raw SQL 전용, `businessLineStore.ts`)에 둔다 — `payment_links`·`manual_revenues`는 결제 링크 결제·
  결제 확인·수기 목록이 drizzle로 전체 컬럼을 SELECT해, 컬럼을 선언한 채 마이그레이션보다 먼저 배포하면 결제가 깨진다(0022 절). 0084은 `studio_expenses`도 다시 만들어 CHECK를 넓힌다.
  **순서는 마이그레이션 → 배포가 맞지만 뒤집혀도 안 깨진다**: 표가 없으면 분야 지정은 기본값으로 읽히고 저장은 "분야는 저장하지 못했다"고 알리며(링크·매출 기록은 만들어진다),
  새 지출 구분·항목 저장만 503으로 거절된다. 확인은 `PRAGMA table_info(revenue_line_assignments);`.
  - **운영자 결정(2026-10-21)**: 비상주 사무실(`room_tenancies.kind = 'virtual'`)도 월 입주 수입이라 **연습실**이다. 스튜디오 자체 음반·굿즈를 상점에서 팔아도
    **플랫폼**이다(상점 매출은 수수료 몫 규칙 — 자체 상품은 전액이 스튜디오 몫일 뿐 분야는 그대로).
  - **지출은 이번 달(KST)까지만 센다**(`loadExpenseOccurrences`의 `untilMonth`) — 월 입주 수입이 오늘이 속한 달까지만 생기므로, 반복 지출을 앞으로 올 달까지
    펼치면 연 전체·다음 달 화면에 "매출 0 · 수익 −임대료"가 생긴다(감사에서 11월이 −3,075,000원). 이번 달은 날짜가 안 왔어도 전액.
  - **분야는 나중에 바꿀 수 있다**: 결제 링크 목록·수기 매출 목록의 분야 선택(PATCH, 이미 받은 결제에도 소급). 분야 지정 표의 `created_by`·`created_at`은
    "마지막으로 정한 사람·시각"이다(덮어쓸 때 갱신). 수기 매출은 메모에 `[분야 변경 A→B · 사람 · 날짜]`를 남기고, 결제 링크는 서버 로그만 남긴다 — **링크 메모는
    예약 목록·캘린더 일정에 실리므로 이력을 붙이지 않는다.** 제작·믹싱 계약 링크는 바꿀 수 없다(409). 지출은 구분·항목·메모만 고칠 수 있고 메모에 `[구분 A→B …]`가 남는다.
  - **제작 계약 링크 결제는 유형도 계약 종류로 옮긴다**(`assignDepositLines` — 믹싱·마스터링 계약은 `mixing`, 나머지는 `production`). 유형별 표에서 한 계약이
    '예약금'과 '음원 제작'으로 갈라지지 않게.
  - **수기 매출 중복 의심**(`lib/ops/manualRevenueDuplicates.ts`): 같은 총액의 세션·믹싱·예약금 주문이 받은 날 ±3일 안에 결제됐거나, 같은 날 같은 금액의 수기 매출이 있으면
    저장 API가 409 `possible_duplicate`로 주문번호를 보여 주고 "그래도 저장"을 받는다(막지 않는다). 확인하고 저장하거나 매출 현황 목록의 "중복 아님"을 누르면 메모에
    **`[중복 아님]`**이 붙고, 그 표시가 있는 기록은 운영 점검(최근 35일)·목록이 더 묻지 않는다 — 손으로 메모에 적어도 같다.
  - **운영 점검(`lib/ops/revenueChecks.ts`, medium)**: 수기 매출 중복 의심 · 결제 링크 기록(`payment_link_orders`)이 없는 예약금 주문(최근 60일 — 분야를 몰라 녹음·제작으로 센다) ·
    연습실 월 이용료 카드 구독과 월 입주 기록이 **같은 계약이나 같은 이름**으로 둘 다 활성(연습실 월세 이중 집계 의심).
  - 장부 CSV(`/api/admin/orders/export`) 맨 끝 열 `businessLine`이 같은 판정의 분야 이름이다 — 기존 열 순서는 그대로(스프레드시트가 깨지지 않게 새 열은 끝에만 붙인다).
  - 대시보드 카드 숫자는 `buildRevenueSnapshot`(순수 함수)이 매출 현황과 같은 `summarizeRevenue`·`computeBusinessPnl`로 만든다 — `revenueSnapshot.test.ts`가 같은 달의 두 숫자가 같은지 고정한다.
- **수기 매출(`manual_revenues`, 0063·0065)은 주문·예약과 연결하지 않는다.** 이름·연락처 칸이 없다(내용에 적는다). 삭제는 소프트 삭제(`deleted_at/by`) — 읽는 곳은 전부 `deleted_at IS NULL`을 본다.
  환불 변경은 메모에 누가·얼마→얼마를 남긴다. 장부 CSV에는 들어가지 않는다.
- **수기 예약 등록은 고객 계좌 입금과 같은 함수**(`createBookingOrder`/`createMixingOrder` → `confirmBookingBankDeposit`)를 탄다(`lib/booking/manualEntry.ts`). 점유·캘린더·환불·매출이 웹 예약과 같은 원장이다.
  이메일을 비우면 `MANUAL_PLACEHOLDER_EMAIL`이 들어가는데 **배달되지 않는 주소**다 — 고객에게 메일을 보내는 새 경로는 `isManualPlaceholderRecipient`(`lib/privacy/manualPlaceholder.ts`)로 먼저 거를 것(반송이 발신 평판을 깎는다).
- **관리자 메뉴는 `ADMIN_NAV_ENTRIES`(components/admin/AdminShell.tsx) 한 곳**이다 — 연습실 / 녹음실 / 플랫폼 / 공통. 새 구역은 묶음 하나에 넣는다. 예약은 한 화면을 `?line=practice|studio|mixing`으로 갈라 세 곳에 건다(`lib/booking/line.ts`).
- **개인정보(이름·연락처·이메일·주소)를 props로 싣는 관리자 상세 화면은 열람을 기록한다**: `logAdminView`(`lib/privacy/adminView.ts`) 또는 `recordAdminPrivacyAccess` + `privacyAccessActionEnum` + `accessLogLabels.ts`(열거와 라벨이 어긋나면 테스트가 선다). 값은 적지 않고 대상 id·결과만.
  목록 화면은 기록하지 않는 대신 **표에 안 나오는 개인정보를 props에 싣지 않는다**(`serializePledgeForAdminList`).

### 연습실 손익 = 월 입주 수입 − 지출 항목 (마이그레이션 0080 `studio_expenses`)

월 입주 수입은 결제 행이 없어 매출 현황에서 통째로 빠져 있었다 — `lib/ops/tenancyRevenue.ts`가 **발생 기준**으로 읽는다(유형 `tenancy`, 직접 서비스): 입주해 있는 달(하루라도, 퇴실한 달 포함)마다 지금의 월 이용료 전액, 오늘이 속한 달까지. **입금일(`room_tenancy_payments`) 기준으로 읽지 않는다** — 달 중순에 입금일이 안 온 사람이 빠져 이번 달이 모자라 보인다(2026-10-21 예정 5,005,000원이 3,786,000원으로 보였다). 운영 판단: 다들 예정일에 내고 매출이 줄어드는 건 방이 비었을 때뿐. 입금이 늦은 사람은 연체 알림이 따로 잡는다. 요금 변경 이력·첫 달 일할은 기록이 없어 반영하지 않는다. 부가세는 나누지 않는다.
임대료·청소비 같은 **지출은 관리자 `/admin/expenses`에 적는다**(`lib/ops/expenses.ts`). 매달 같은 금액이면 "매달 반복"으로 한 번만(시작 달부터 끝나는 달까지 센다, 31일은 짧은 달 말일로 보정). 구분이 "연습실"인 지출만 매출 현황의 연습실 순수익에서 빼고 "스튜디오 전체"는 참고로만 보인다.
- **순서는 마이그레이션 0080 → 배포.** 뒤집어도 결제·매출은 안 깨지고 손익 칸만 "지출 표 미적용"으로 열린다(대시보드 카드는 지출을 빼지 않은 입주 수입만 보인다). 월 입주 표(0066)를 못 읽으면 월 입주 수입이 빠졌다고 알린다.
- 수기 매출 유형(`MANUAL_TYPES`)에서 `tenancy`는 뺐다 — 수기로 또 적으면 두 번 센다.

### 프로듀싱 레슨 관리 (`lib/lessons/`, 관리자 `/admin/lessons`, 마이그레이션 0081)

설계는 `docs/lesson-management-design-2026-10.md`(P0 매출 분리 + P1 수강 등록·회차는 구현, P2 수강 계약·P3 알림은 구현, P4 수강생 화면은 아직). 운영자 결정(2026-10-21): **계좌·현금 선불이 카드보다 많다**, **결석은 보강하지 않는다**.
- 수강 등록 한 건이 과정 길이(12/24주)만큼 **회차를 미리 만들고**, 회차마다 컨트롤 룸을 막는 **예약 불가 블록**(`availability_blocks`, 녹음실)을 건다. 겹치는 회차가 하나라도 있으면(녹음실 예약·다른 블록) 등록을 거절한다. 완료·결석·휴강이 되면 블록을 푼다.
- **결석 = 소화된 회차**(보강 없음). **스튜디오 사정 휴강만** 과정 끝에 회차를 하나 붙이고(`extends_session_id`), 휴강을 되돌리면 그 회차를 지운다(보충이 이미 진행됐으면 거절). 예정 회차가 없으면 `completed`, 중도 종료는 남은 회차를 `dropped`로 취소하고 블록을 푼다.
- **구글 캘린더에 올리지 않는다** — 녹음실 예약 캘린더에 손으로 넣은 일정은 사이트가 예약으로 자동 등록한다(`calendarAutoImport`). 캘린더 연동을 붙일 땐 그 규칙부터 본다.
- **연락처·이메일은 아직 저장하지 않는다**(이름만 평문). 받으려면 처리방침 수집 항목·`FUNDING_TERMS_VERSION`·암호화 필드 등록(`ENCRYPTED_FIELD_TARGETS`)·접속기록을 함께 — 수강 계약(P2) 때 서명에서 받는다. **파기 정책(수강 종료 후 이름 삭제)도 아직 없다** — 계약 단계에서 처리방침과 같이 정한다.
- **매출**: 유형 `lesson`("프로듀싱 레슨", 직접 서비스). 계좌·현금 수납(`lesson_payments`, 수납일 기준·부가세는 적은 값 그대로 — 안 받으면 0)과, 카드 정기결제(레슨 구독의 주문을 `구독`에서 `레슨`으로 옮김, `lib/ops/lessonRevenue.ts`)를 합친다. 수기 매출 유형에서는 뺐다(이중 집계 방지). 카드 구독을 수강 등록에 연결(`subscription_id`)하는 화면은 아직 없다 — 카드 수강은 구독 화면에서 결제를 본다.
- **미수금**(`arrearsOf`): 계좌·현금이 대부분이라 사람이 입금을 기억해야 한다. 월 4회를 한 달 치로 보고, **진행했거나 날짜가 도래한 회차의 달 수**(첫 회차 3일 전부터 한 달)만큼 수강료(공급가)를 받았어야 한다 — 받은 돈은 부가세를 뺀 값으로 센다. 과정 일괄 선불은 몇 달 치를 덮는다. 목록 "미수 X원" 배지·수강 상세 안내·**운영 점검 메일**(`레슨 미수금`, `레슨 종료 임박` — 마지막 예정 회차가 14일 안)에 올라온다. 수납 기록의 "기간" 표기는 계산에 안 쓴다(자유 서술).
- **수강 계약(P2, `lib/contracts/lesson/`, 마이그레이션 0082)**: 수강생 한 명이 서명하는 전자계약. 음원 제작 계약 엔진의 원칙(템플릿 사본·서명 때 본문 완성·지문 `l1:`·연락처 뒷자리 본인 확인·운영자 서명=발송)을 쓰되 서명 칸이 계약 행에 있다(서명자 표 없음). 관리자는 수강 상세의 "수강 계약" 칸에서 초안 만들기·보내기·취소, 수강생은 `/ko/contracts/lesson/<id>/sign`(경로가 `/contracts/` 아래라 no-store·측정 제외·사이트맵 제외를 그대로 받는다). **서명본은 PDF가 아니라 완료 화면에서 연락처 뒷자리를 확인한 뒤 본문으로 보여 준다**(인쇄로 저장).
  - **환불 조항(제9조)은 확정 전 초안이다 — 본문에 `【확정 전 초안` 표시가 남아 있으면 발송이 거절된다**(`DRAFT_MARKER`, service.ts `sendLessonContract`). 교습비 반환 기준을 법률 확인한 뒤 `lesson-template.md` 제9조의 표시 줄을 지우고 문안을 확정하면 풀린다. 이미 만든 초안은 옛 템플릿 사본을 쥐고 있으니 취소하고 새로 만든다.
  - 만 19세 미만은 받지 않는다(법정대리인 경로 없음). 연락처·이메일은 **계약서에서만** 받고(수강 등록에는 이름뿐), 열람은 `lesson_contract_view`로 접속기록에 남는다. 개인정보는 수강이 끝난 날부터 3년(계약서)·5년(수강 등록 이름) 뒤 월 크론이 파기한다(`retention.ts`, 처리방침 1항·⑫·접속기록 항목 — `FUNDING_TERMS_VERSION` 2026-10-21).
  - 계약서 문구(제10조 개인정보 3년)·처리방침·`retention.ts`가 같은 약속을 한다 — 한쪽을 바꾸면 셋 다.
- **수업 전날 안내 메일(P3, `lib/lessons/reminders.ts`, 크론 `/api/cron/lesson-reminders` 매일 10:00 KST, 마이그레이션 0083 `lesson_reminders`)**: 서명한(파기 전) 수강 계약이 있는 활성 수강의 내일(KST) 예정 회차에 계약서 이메일로 한 통. **기록을 먼저 넣고 보낸다**((kind, ref_id) 유일 — 겹친 크론도 한 통) · 실패는 `error`에 남기고 **다시 보내지 않는다**(전날 한 번뿐인 안내, 운영자 알림 메일이 직접 연락을 부탁한다). 이행 안내라 광고성이 아니다 — **홍보·혜택·재등록 권유를 넣지 말 것**(테스트가 막는다; 종료 임박은 운영자 점검 메일 몫). 처리방침 2항에 목적을 적었다(판본 `-r2`). 끄기: `LESSON_REMINDERS=off`. 표가 없으면 크론이 500+운영자 메일이다.
- 순서는 마이그레이션 0081(0082) → 배포. 뒤집어도 결제는 안 깨지고 레슨 화면만 "미적용"으로 열린다(대시보드 큐·매출의 레슨 수납은 건너뛴다, 계약 칸은 "0082 필요").

### 월 입주 관리 (`lib/tenancy/`, 관리자 `/admin/tenancies`, 마이그레이션 0066)

연습실 월 입주자(R01…)와 비상주 사무실(`kind='virtual'`, 방 없이 사업자등록 주소만 씀)의 **정본은 DB 표 `room_tenancies`**다. 예전 스프레드시트(연습실대여현황)는 더 쓰지 않는다 — 두 곳을 정본으로 두지 말 것.
- **계약 종료일이 지나도 입금이 이어지면 자동 연장**이다(운영자 확정). 퇴실은 운영자가 "퇴실"을 눌러야만 된다(`status`).
  계약서 제3조①대로 만료일까지 통지가 없으면 1개월씩 자동 갱신으로 본다 — **DB `end_date`는 처음 약정 만료일로 그대로 두고**(위약금 판단 근거) 현재 기간 종료일은
  `currentTermEnd`(lib/tenancy/rules.ts)가 계산한다. 목록은 "갱신 N회 · 이번 기간 …까지"를 보이고, 캘린더 "[계약 종료·자동 갱신 중]" 일정은 매일 운영 점검 크론이
  기간이 바뀐 입주자만 옮긴다(`rollRenewedTenancyCalendars`). 갱신 중인 입주자는 종료 임박 메일을 보내지 않는다(매달 울리면 묻힌다).
  **비상주(`kind='virtual'`)도 같은 1개월 갱신 규칙이다**(운영자 확인 2026-10-20) — 방 입주와 따로 분기하지 말 것. 시트의 "8일전" 같은 값은 상태가 아니라 남은 일수였다.
- 날짜는 KST 달력 날짜 문자열. 입금을 기록하면 `next_due_on`이 납부일 기준으로 한 달 넘어간다(말일 보정, `rules.ts`). 같은 예정일을 두 번 기록하지 못하게 조건부 UPDATE.
- **개인정보(연락처·비상연락처·이메일·사업자번호·성별)는 `private_enc` 한 칸에 JSON째 암호화**(`ENCRYPTED_FIELD_TARGETS`에 등록됨 — 키 회전 대상). 목록·props에는 싣지 않고, 버튼을 누른 순간의 응답으로만 나가며 열람은 접속기록(`tenancy_private_view`)에 남는다. 처리방침 19항과 `FUNDING_TERMS_VERSION`을 함께 올렸다.
- **구글 캘린더는 DB의 투영**이다: 기존 연습실 캘린더(`PRACTICE_ROOM_GCAL_ID`, 전용 `TENANCY_GCAL_ID`가 있으면 그쪽)에 입주자당 최대 둘 — "입금 예정"(다음 입금일, 입금을 기록하면 다음 달로 옮김)과 "계약 종료"(종료일이 오늘 이후일 때만). **모든 일정은 `transparency: 'transparent'`(바쁨 아님)로 올린다** — 그래야 freeBusy에 안 잡혀 입금일마다 시간제 방(R02)이 막히지 않는다. 이 표시를 빼지 말 것. 녹음실 예약 캘린더에는 올리지 않는다. 어긋나면 "캘린더 전체 다시 맞추기".
- **알림은 매일 운영 점검 메일(Vercel 크론 `0 23 * * *` = UTC, 한국 아침 8시)과 대시보드 "처리할 일"에 같이 올라온다**(`collectDbIssues`, 이상이 없으면 메일이 안 간다): "월 입주 연체"(입금 예정일 경과), "계약 종료 임박"(7일 안 — 종료일이 지난 자동 연장은 알리지 않는다), "캘린더 동기화 실패". 이름·방·일수만 싣고 연락처는 싣지 않는다. 방 정가(`room_list_price`)는 방의 속성이라 이용료와 다를 수 있다(36만원 방 외에 40·44만원 방).
- **보증금은 면제**다(연습실 계약서 제5조) — 계약서의 `deposit_amount`는 받은 돈이 아니라 위약금 기준액(월 이용료 1개월분)이라 `room_tenancies.deposit_amount`(실제로 받은 보증금)로 옮기지 않는다. 약정 종료일 전 퇴실이면 퇴실 확인창이 위약금 가능성을 알린다(자동 연장 중 통지 종료는 위약금 없음, 제3조②).
- 시트 가져오기(`importService.ts`)는 일회성·멱등이다. 전화번호가 빈 사람은 전자계약에서 같은 이름으로 찾아 채운다. 새 방을 늘릴 때 코드 수정은 필요 없다(입주 등록에서 방 번호만 적는다).

### 세션 연주자 등록 (`/ko/session-musicians`, `lib/sessionMusicians/`, 마이그레이션 0077)

방문객이 로그인 없이 세션 연주자 프로필을 등록하고, 운영자가 `/admin/session-musicians`(녹음실 메뉴)에서 섭외할 사람을 찾는다.
비공개 명단이다 — 사이트에 공개하지 않는다(공개 디렉터리는 별도 동의를 받는 2단계). 설계는 `docs/session-musician-registration-design-2026-10.md`. 어겨도 에러가 안 나는 것:

- **경로에 싣는 토큰은 소문자만 쓴다.** 미들웨어가 대문자가 섞인 경로를 소문자로 308해서, base64url 토큰은 메일 링크를 누르는 순간 다른 값이 된다.
  관리 토큰은 소문자 hex 64자이고 DB에는 sha256만 있다 — 원문을 다시 보낼 수 없어 재발송(같은 이메일 재등록·재확인 메일)은 새 토큰을 만들고 옛 링크를 끊는다.
- **이메일 중복 판정 해시의 키는 `ADMIN_SESSION_SECRET`에서 갈라 낸다**(`FUNDING_FIELD_KEY`는 회전 대상이라 쓰지 않는다). 이 비밀을 바꾸면
  옛 등록과 같은 이메일이 한동안 새 행으로 들어온다(데이터는 안 잃는다).
- **보유 기간 2년·1년 9개월째 재확인은 세 곳이 같은 약속을 한다** — 처리방침 3항·18항 ⑯, 폼 동의 요약, `retention.ts`(상수는 `data/sessionMusicians.ts`).
  한쪽을 바꾸면 셋 다, 처리방침은 `FUNDING_TERMS_VERSION`도. 파기·재확인은 새 크론 없이 월간 `purge-contracts`가 돈다.
- 연락처(실명·휴대전화·이메일·카카오톡 ID)는 `private_enc` 한 칸에 암호화(`ENCRYPTED_FIELD_TARGETS` 등록). 목록 props·운영자 알림 메일에 싣지 않고
  "연락처 보기" 응답으로만 나간다. 상세 열람·연락처 열람·관리자 삭제는 각각 접속기록(`session_musician_view`·`_private_view`·`_delete`)에 남는다.
- 접수 확인 메일은 누구나 남의 주소로 보낼 수 있다 — 메일에 사용자가 적은 자유 서술을 싣지 않고(활동명만), IP·이메일·전체 하루 상한(50건)이 대량 발송을 막는다.
  상한을 풀지 말 것. 원장 백업(`ledgerBackup.ts`)에는 넣지 않는다(돈과 무관하고 28일짜리 개인정보 사본이 생긴다).
- 연주비는 이 화면에서 약속하지 않는다 — "연주자 실비만, 섭외 수수료 없음"(가격 정본)과 같은 뜻으로만 쓴다. 희망 단가는 참고용 메모다.

### 메일은 공용 레이아웃으로 — 글자만 보내지 않는다

사이트가 보내는 메일(고객·운영자·개설자·크론 알림 약 70종)은 전부 `lib/email/layout.ts`의 `buildEmailLayout`
(계약 메일 디자인 기준: 로고·정보 표·브랜드색(파랑) 버튼·안내 박스·푸터)으로 HTML을 입히고, 글자 본문(`text`)은 대체로
함께 보낸다. 2026-10-07 점검에서 HTML이 있는 메일이 7종뿐이었고(골격 3개가 제각각), 운영자가 받는 예약·펀딩·
구독·크론 알림은 거의 전부 서식 없는 글자였다 — 헬스체크는 이동할 관리자 주소를 이미 갖고도 메일에 싣지 않았다.

- `sendEmail`의 `html`은 **필수 인자**다. 글자만 보내는 새 메일은 타입 검사가 세운다. 자기만의 `<!DOCTYPE` 골격을
  들이면 `tests/email/layoutGuard.test.ts`가 세운다. 레이아웃에 없는 요소는 `hero`·`blocks` 슬롯으로 얹고,
  골격을 새로 만들지 않는다.
- **운영자 알림은 `audience: 'operator'`** — 핵심 값(고객·연락처·상품·금액·일시)을 rows로 위쪽에, 해당 건의
  **관리자 딥링크 버튼**(`adminUrl('/admin/…/{id}')`)을 둔다. 목록 링크만 주지 않는다. 사람이 해야 할 일(입금 확인·
  계좌 송금)과 실패·긴급은 `notices`의 `noticeTone: 'alert'`로 눈에 띄게. 크론 실패는 `lib/email/operatorAlert.ts`.
- 사용자 입력은 반드시 escape — rows·heading은 레이아웃이 하지만 `paragraphs`·`notices`·`blocks`에 값을 넣을 때는
  호출부가 `escapeHtml`로 한다.
- 새 메일은 `scripts/preview-emails.ts`(`npx tsx scripts/preview-emails.ts`)로 렌더해 크롬으로 **눈으로** 본 뒤 낸다.
  제목·`text`는 기존 테스트와 메일 필터가 기대는 형태라 HTML을 입힐 때 바꾸지 않는다.

### 약관·처리방침을 고치면 FUNDING_TERMS_VERSION을 함께 올린다

`funding_pledges.terms_version`은 "그때 이 내용에 동의했다"는 증거다. 내용이 바뀌었는데
문자열이 같으면 서로 다른 문서에 동의한 후원 행들이 같은 판본을 갖게 되어 증거 능력이
무효가 된다. 이 규칙은 `lib/funding/policy.ts` 주석에만 있었다 —
`content/fundingTerms.baseline.test.ts`가 이제 테스트로 고정한다.

해시 대상은 **같은 동의 체크박스가 함께 받는 문서 전부**다: 펀딩 약관 16개 조항
(`FUNDING_TERMS_SECTIONS`), ko 개인정보 처리방침 전체(`POLICY_COPY_BY_LOCALE.ko`), 그리고
약관 본문에 보간되는 공유 상수(보유기간·법정 보존·결제 대기 시간·수집 항목·이용 목적·수탁자).
처리방침은 ko만 본다 — 펀딩은 ko 전용이라 동의 화면에 뜨는 것이 ko 문서다.

갱신 절차(실패 메시지에도 적혀 있다): ① `FUNDING_TERMS_VERSION`을 올린다
→ ② `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`
→ ③ 같은 커밋에 **어느 조항이 어떻게 바뀌었는지** 적는다. 이미 후원이 들어온 뒤라면
기존 행의 `terms_version`은 옛 문자열 그대로 두고, 옛 본문은 git 이력으로 추적한다.

**①을 빠뜨리고 ②만 실행하는 것이 이 게이트의 유일한 구멍이었다.** 갱신 경로가 기존 기준선을
읽지 않고 덮어써서, 절차 한 단계를 건너뛰면 "옛 판본 + 새 내용"이 조용히 기록되고 다음
실행은 초록이 됐다(리뷰 샌드박스 재현: 제10조 환불 기한 3영업일 → 5영업일). 지금은 갱신
경로 자체가 `assertBaselineUpdateAllowed`로 그 조합을 거부한다 — 검사 모드만 막으면
자물쇠 옆에 열쇠를 걸어 두는 셈이다.

판본 형식은 `funding-terms-YYYY-MM-DD`이고 **같은 날 두 번째 개정부터 `-r2`·`-r3`**를 붙인다.
날짜만으로는 하루에 두 번 고친 것을 구분할 수 없어 게이트를 통과시킬 방법이 사라진다 —
`-r2`가 실제로 그 경우였다(#63이 처리방침에 언론 홍보 3개 항을 더한 날 이 게이트가 도입됐다).

**개설자 약관은 판본·게이트가 따로 있다.** `FUNDING_CREATOR_TERMS_VERSION`(개설자가 심사
신청 때 동의하는 문서)과 `content/creatorTerms.baseline.test.ts`가 위와 **같은 구조**로
돈다 — 갱신 환경변수만 `UPDATE_CREATOR_TERMS_BASELINE`이다. 해시 대상은 개설자 약관
조항 전부이고, 처리방침은 넣지 않는다(개설자 동의 체크박스가 함께 받는 문서가 아니다).
후원자 약관과 개설자 약관은 **서로 모순되면 안 된다** — 한쪽이 개설자에게 약속한 것과
다른 쪽이 후원자에게 약속한 것이 같은 사실을 가리켜야 한다(리워드 이행 주체와 대외 계약
책임이 그 자리다).

`status`·`hidden`은 다른 frontmatter 필드와 같이 **엄격 검증**한다(`lib/funding/projects.ts`).
`status: Draft` 오타나 따옴표가 붙은 `hidden: "true"`는 예전엔 조용히 공개로 떨어졌다.
사이트맵 쪽(`lib/sitemap/fundingMeta.js`)도 정규식이 아니라 같은 파서(gray-matter)로 같은
규칙을 적용한다 — 두 판정이 갈리면 앱은 404인데 사이트맵·IndexNow가 그 URL을 제출한다.

### 암호화 필드는 `lib/crypto/CLAUDE.md`에 있다

`FUNDING_FIELD_KEY`를 옛 키 백업 없이 덮어쓰지 말 것 — 잃으면 저장된 값은 복호화되지 않는다. 키 회전은 `scripts/rotate-field-key.mjs`이고, 절차·순서는 그 파일에서 읽고 진행한다.

### 스토리의 외부 사실은 근거를 확인한 것만 쓴다 (`check:claims`)

2026-10 표본 점검(약 190편)에서 서비스 노출 스토리의 90% 넘는 글이 틀린 연대·인명·장비(Push 2013, Lexicon 224=1978, 1176 어택은 20~800μs 등)와 출처 없는 인용문·"최초" 주장·"한국에서 표준" 서술을 담고 있었다(#503·#504·#518·#519). AI가 쓴 글에서 반복되는 유형이라 `scripts/check-unverified-claims.mjs`가 기준선 대비로 후보가 늘어나는 것만 막는다(`content/unverified-claims.baseline.json`).
- 이 검사는 "틀렸다"를 판정하지 않는다. 후보에 걸리면 근거(공식 페이지·위키)를 확인해 사실에 맞추거나 그 문장을 뺀다. 확인했는데도 정당하면 `--update`로 기준선을 올리고 커밋 메시지에 "무엇을 어디서 확인했는지"를 적는다.
- **윤문 스킬로 고칠 수 없다.** 윤문은 "내용 불변"이 원칙이라 날조 서술을 그대로 보존한다. 사실 점검과 문체 윤문은 별개 작업이다.
- 윤문·점검 에이전트가 새 가격·수치를 써 넣지 못하게 한다. 소프트웨어·유통 가격은 시점에 따라 바뀌어 근거 없이 쓰면 곧 틀린다.
- 아직 점검하지 못한 글이 남아 있다(밀도 순위 약 650편). 기준선에 남은 후보를 정리하면 `--update`로 낮춘다.

### 서비스 수치는 정본에서만 온다

스토리가 말하는 납기·수정 횟수·대표 가격이 정본과 어긋나면 `check:facts`가 CI를 세운다.
factGuards는 전화번호·서비스 범위를 **1인칭 맥락**에서만 보기 때문에 표 안의 수치나 링크
라벨은 그대로 통과한다 — 2026-08-29 감사에서 네 건이 그렇게 빠져나가 있었다:
납기를 "영업일 2~5일"로 약속한 122편(정본 3~7영업일 — 짧게 약속), 마스터링까지
"2라운드 수정"으로 읽히는 20편(정본 1회 — 많게 약속), "1:1 보컬·믹싱 레슨" 링크 라벨
22편(보컬 레슨 미운영), "전주역은 KTX가 정차하지 않습니다"(사실 오류).

정본은 검사 스크립트에 베끼지 않고 **소스에서 읽는다** — 가격은 `data/pricing.ts` 상수,
납기·수정 횟수는 `public/locales/ko/common.json`의 믹싱·마스터링 페이지 문구. 정본이
바뀌면 스토리보다 먼저 여기서 드러난다(문구 형태가 바뀌면 검사가 에러로 멈춘다).

상품별로 기준이 다른 것에 주의: **축가는 납기 정본이 따로 있다**(믹싱·마스터링 3~7영업일 vs
축가 3~5일). 마스터링 단독 의뢰 납기는 정본이 없어 검사 대상이 아니다. 후기(`category: 후기`)
글은 고객이 겪은 일을 적은 것이라 검사에서 제외한다 — 약속이 아니므로 정본에 맞출 대상도 아니다.

### 가격 드리프트 가드 (`data/pricing.test.ts`)

`check:facts`는 **스토리**만 본다. 카피·데이터에 박힌 가격은 아래 세 겹이 지킨다.
전부 "상수가 움직였는데 카피가 안 따라온 것"을 잡는 장치다 — 이 저장소에서 실제로
난 사고 형태다(2026-09-02에 `data/buyerIntentHubs.ts`의 발매 허브 카드가
"EP 약 150만원~ · 정규 약 400만원~"을 문자열로 물고 있는 걸 손으로 발견했다).

| 가드 | 보는 곳 | 잡는 것 |
|---|---|---|
| 오퍼 id ↔ 상수 매핑 | `data/pricing.ts` 오퍼 | 한쪽만 고치면 실패 |
| 가격 리터럴 스캔 | `data/**/*.ts` (SSOT 본체 제외) | `250,000원`·`25만원`이 상수 밖이면 실패 |
| 릴리즈 티어 카피 | `public/locales/*/common.json` 7개 로케일 | 티어 하한이 상수와 다르면 실패 |

- **리터럴 스캔**은 두 표기를 다 본다. 처음엔 `N만원`만 봐서 `faq.ts`의 원 단위
  단가를 통째로 놓쳤다. `data/portfolio/` 같은 하위 디렉터리까지 재귀로 훑는다.
  우리 상품이 아닌 금액(외부 시세·환산값·기사 제목 인용)은 `NON_SSOT_AMOUNTS`에
  **이유와 함께** 등재한다. 이유 없이 넣으면 가드가 무의미해진다.
- **로케일 티어 가드**는 표기 형식이 로케일마다 달라(`180만원~` · `₩1.8M` ·
  `₩180万起`) 문자열이 아니라 **숫자로 파싱해** 비교한다.
- `common.json`에 "모든 금액이 상수여야 한다"는 넓은 규칙은 쓰지 않는다. 로케일당
  금액 90~140개 중 13~21종이 상수 밖인데 전부 정상이다 — 증분(정규 "12곡 +170만원"),
  환산(레슨 "회당 87,500원"), 외부 시세. 상수를 그대로 말해야 하는 키만 지정해 본다.
- 카피에 새 가격을 넣을 땐 리터럴 대신 `formatPriceLabel`로 상수에서 끌어온다.

### 발매 티어 하한 = 통합 번들 가격 (한쪽만 고치지 말 것)

`RELEASE_{SINGLE,EP,ALBUM}_FROM_PRICE`와 `{SINGLE,EP,ALBUM}_BUNDLE_PRICE`가 같은
값인 것은 우연이 아니라 **의도**다. 통합 번들이 발매 프로젝트의 **고정 구성 엔트리**이고,
발매 티어는 거기서 편곡 확장·PR 라운드를 올려 견적하는 같은 상품군이다.
한쪽을 바꾸면 다른 쪽도 함께 움직여야 하며, 위 가드가 그걸 강제한다.

세 번들 모두 **기획 · 녹음 · 믹싱 · 마스터링 · 디지털 유통 등록 · 발매 홍보**를 포함한다.
홍보는 보도자료 작성과 국내 음악 기자·평론가 + 해외 매체·라디오·플레이리스트 피칭까지다.
**세션 연주비는 번들에도 티어에도 들어 있지 않다**(2026-09-26 운영자 결정). 연주자에게
지급하는 실비만 그대로 받고 섭외 수수료는 없다. "세션 1~2인 포함" 같은 문구를 다시 쓰지 말 것 —
가격 정본(`data/pricing.ts`)에 세션 항목이 없어 약속을 지킬 근거가 없다.

EP 하한이 4곡 번들가인데 상품은 3-5곡인 이유: 기획·유통·보도자료는 곡수와 무관한
고정비라 3곡이어도 같은 하한에서 시작한다.

### 믹싱 상품명은 트랙 수다 (`Level 1~3` 아님)

고객이 보는 이름은 "10트랙 이하 / 11~30트랙 / 31트랙 이상"이다. `Level 1~3`은 내부
축약이었는데, 같은 페이지의 FAQ·섹션 부제·SEO description이 이미 전부 트랙 수로
말하고 있어 카드만 혼자 다른 이름을 쓰던 상태였다(2026-09-02 교체). 검색 쪽에서도
`Level`은 값이 0이다 — 믹싱 거래형 쿼리는 "믹싱 마스터링 비용"이지 "Level"이 아니다.

**오퍼 id(`mixing-level1~3`)는 그대로 둔다** — `buyerIntentHubs`와 가이드 페이지가
이 id로 오퍼를 찾으므로 바꾸면 링크가 끊긴다. `docs/wiki`도 트랙 수 표기로 맞춰 뒀다.
위키는 `wiki-query`가 읽는 운영 지식 베이스라, 옛 표기가 남으면 사이트에 없는 이름으로
고객에게 답하게 된다.

### 보컬·악기 레슨은 없다 — 코드 가드가 든다

스튜디오의 레슨은 **프로듀싱 레슨(미디·작곡·믹싱·마스터링)** 하나다. 보컬 발성·악기 레슨은
하지 않는다. 그런데 보컬 글(category 보컬 가이드)에 레슨 오퍼가 붙으면 독자는 보컬 레슨으로
읽는다 — 없는 서비스를 광고하는 셈이라, 이 조합은 **어떤 경로로도 만들어지면 안 된다.**

2026-09-03 전수 확인: 보컬 글 76편이 frontmatter `inlineFallback.price: lesson-monthly`로
본문에 프로듀싱 레슨 가격 카드를 띄우고 있었고, `storyCtaPolicy`의 슬러그 패턴(head-voice·
belting·breath…)이 하단 CTA도 레슨으로 보내고 있었다. 카테고리 기본값(`vocal: recording-pro`)은
처음부터 맞았는데 frontmatter와 슬러그 패턴이 그걸 덮어썼다.

지금은 세 겹으로 막는다: `lib/storyCtaPolicy.ts`의 vocal 가드(어떤 경로든 lesson 반환 불가),
`lib/stories.ts`의 폴백 가격 가드(vocal + lesson-monthly → recording-pro), 그리고
`content/vocalCategoryNoLesson.test.ts`(frontmatter 자체를 CI에서 검사). 보컬 글에 레슨 오퍼를
넣고 싶어지면 그건 규칙이 아니라 사실 확인이 먼저다 — 서비스 범위의 정본은 이 절과 memory
`feedback_studionol_services`이지 코드 주석이 아니다.

**라우팅 기준선 게이트.** `content/cta-routing.baseline.json`에 전 ko 스토리의 하단 CTA와
가격 카드 id 판정을 커밋해 두고, `content/ctaRouting.baseline.test.ts`가 현재 판정과 대조한다.
`storyCtaPolicy`·`storyAutoFallback`·frontmatter(`cta`·`inlineFallback`) 중 무엇을 바꾸든
판정이 달라진 글이 있으면 CI가 서고, 그 목록을 카테고리 × from→to로 보여준다. 위 76편
사고는 이 대조 한 번이면 즉시 보였을 일이다. 의도한 변경이면 `--update`로 기준선을 갱신하되
**같은 커밋에 "왜 이 글들의 목적지가 바뀌는지"를 적을 것** — 기준선 갱신을 이유 없이 끼워
넣으면 게이트가 무력화된다.

**정책 주석은 사업 사실을 뒤집을 수 없다.** 이 사고의 직접 원인은 "보컬 테크닉은 lesson이
의도에 더 맞는다"는 AI 작성 주석이었다. 그럴듯한 주석 한 줄이 `storyAutoFallback.ts`에
이미 적혀 있던 올바른 규칙("보컬 발성 코칭은 미제공")과 같은 저장소 안에서 공존했다. 라우팅·
오퍼 정책을 바꿀 때는 먼저 이 파일과 memory에서 사실을 확인하고, 규칙은 주석이 아니라
테스트로 고정할 것.

### 중복 콘텐츠 게이트가 두 겹인 이유

`scan-near-duplicates.mjs`는 **문서 전체** Jaccard 0.45로 본다. 2,400자 글에서 380자
섹션이 겹치는 정도는 이 임계에 닿지 않아, 워드카운트 패딩 스크립트(`scripts/archive/`의
`fix-topic-wordcount.js` 계열)가 심은 동일 섹션이 수백 편에 쌓이는 동안 한 번도 안 걸렸다.
2026-08-28에 290편에서 12.1만자를 걷어냈고, 재발 방지로 `check-duplicate-sections.mjs`를
CI에 넣었다 — 섹션 해시가 파일 간 같으면 잡는다.

`scan-near-duplicates.mjs`는 실행한 달 이름으로 리포트를 쓴다(`docs/near-duplicate-scan-YYYY-MM.*`,
`--month`로 지정 가능). 예전엔 2026-07 파일에 하드코딩돼 있어 돌릴 때마다 비교 기준인 과거
스냅샷을 덮어썼다 — 개선 효과는 회차 비교로만 보이므로(2026-07 81건 → 2026-08 31건) 이전
파일이 남아야 한다. 생성물이라 손으로 고치지 말 것: 다음 실행에 지워진다.

기준선(`content/duplicate-sections.baseline.json`) **대비**로 판정한다. 절대 임계면 아직
정리 안 된 기존 중복 때문에 CI가 계속 빨갛다. 새 그룹이 생기거나 기존 그룹이 커지면 실패,
줄어드는 건 항상 통과. 의도한 증가라면 `--update` 후 이유를 커밋에 남길 것.

**같은 안내를 여러 글에 넣어야 하면 복붙 대신 숏코드 컴포넌트를 쓴다**
(`%%session-checklist%%`·`%%studio-more%%`). 새 숏코드를 만들면 세 곳을 함께 고쳐야 한다 —
`MarkdownRenderer` 배선, `lib/storyContentPolicy.ts`의 글자수 추정, `content/factGuards.test.ts`
화이트리스트. 추정치는 **컴포넌트가 실제 렌더하는 분량 실측값**으로 넣을 것: 이 값이 thin
판정에 직접 들어가서, 과대 계상하면 thin 페이지가 색인 대상으로 잘못 분류된다(실제로
session-checklist가 실측 160자인데 420으로 잡혀 있었다).

**펀딩 콘텐츠의 숏코드는 위 "세 곳" 규칙이 적용되지 않는다** — `storyContentPolicy.ts`·
`factGuards.test.ts`는 `content/stories`만 스캔한다. `MarkdownRenderer` 배선만 하면 된다.

**본문 마크다운은 raw HTML을 못 쓴다**(`disableParsingRawHTML: true` — 개설자가 펀딩 본문에
스크립트·위장 폼을 못 심게 막는 장치). `<div>`를 넣어도 화면에 `&lt;div&gt;`로 그대로 찍힌다.
원형 사진+이름+소개 같은 카드형 레이아웃이 필요하면 그리드 이미지 합성이나 title 폭 힌트
(`![alt](경로 "240")`, 사진 한 장을 작게 넣을 때만 유효)로 때우지 말고 숏코드 컴포넌트를
만들 것 — `components/funding/FundingLineupPerson.tsx`가 그 예다. 참고로 `content/**/*.md`는
`tailwind.config.ts`의 content 스캔 대상이 아니라, 컨텐츠에만 쓰는 새 Tailwind 클래스는
(raw HTML이 허용돼도) 컴파일이 안 돼 조용히 무효과다 — 숏코드처럼 실제 .tsx 컴포넌트로
만들어야 클래스가 실제로 스타일을 입는다.

### 로컬 프로덕션 빌드로 화면을 확인하려면 VERCEL_ENV가 필요하다

`npx next start`만 하면 미들웨어의 canonical host 강제가 걸려 studionol.co.kr로 **308**
한다. 그대로 스크린샷을 찍으면 내 코드가 아니라 프로덕션을 보게 된다(2026-09-21에 한참
헤맸다 — 화면이 안 바뀌는 것이 아니라 다른 사이트를 보고 있었다).

**`fullPage: true` 스크린샷은 `position: sticky`·`fixed` 요소와 `loading="lazy"` 이미지를
실제와 다르게 보여준다.** sticky/fixed 버튼이 페이지 중간 엉뚱한 자리에 뜨고, 아직 안
트리거된 lazy 이미지는 빈 칸으로 나온다 — 둘 다 화면 버그가 아니라 촬영 아티팩트다. 실제
스크롤(또는 전체 페이지를 미리 스크롤한 뒤 캡처)로 다시 확인할 것.

**PR 자동병합 완료 ≠ 프로덕션 배포 완료.** merge 직후 curl로 확인하면 옛 배포가 그대로
응답한다(수 분 걸림). Vercel MCP `list_deployments`로 그 커밋의 `state`가 READY인지 먼저
본 뒤에 "여전히 안 바뀌었다"고 판단할 것.

```bash
VERCEL_ENV=preview npx next start -p 3100
```

모금 현황·응원 메시지처럼 DB가 채우는 화면은 playwright의 `page.route`로
`**/api/funding/**`를 가로채 실제 응답 모양을 주입한다. **CORS 헤더를 함께 줄 것** —
페이지가 절대 URL(`https://studionol.co.kr/api/...`)로 부르므로 없으면 브라우저가 막는다.

### 그림을 바꾸면 **파일명도 바꾼다** (OG·썸네일 공통)

`/images/**`는 `cache-control: public, max-age=31536000, immutable`로 나간다. `immutable`은
브라우저에게 "1년간 다시 물어보지도 말라"는 뜻이라, **경로가 같으면 내용을 갈아 끼워도
이미 한 번 본 사람에게는 영영 옛 그림이 보인다.** 배포로는 고칠 수 없고, CDN·서버는 새 그림을
주고 있으므로 로그로도 안 보인다. 확인하려면 그 그림을 본 적 없는 프로필로 열어야 한다.

이 저장소에서 두 번 났다. 카카오 공유 썸네일(아래)과 **펀딩 목록 썸네일** — 후자는 파일만
갈아 끼운 채 몇 주가 지나 "여전히 옛날 썸네일이 보인다"는 지적을 받았다.

파일명에 날짜를 박아 새 URL로 만든다(예: `cover-20260916.webp`, `og-20260915.webp`).
펀딩 프로젝트의 `cover`·`ogImage`·`heroImage`는 `content/fundingImages.baseline.test.ts`가
이름 × 내용 해시로 고정한다 — 내용이 바뀌었는데 이름이 그대로면 CI가 선다. 갱신 경로도 같은
위반을 거부하므로 `UPDATE_FUNDING_IMAGE_BASELINE=1`로 빠져나갈 수 없다(이름을 먼저 바꿔야 한다).

### OG 이미지를 바꾸면 파일명도 바꾼다 (카카오톡 썸네일)

카카오톡 스크랩 서버는 `og:image`를 **URL 단위로 캐시**한다. 같은 경로에 그림만 갈아
끼우면 공유 디버거로 다시 긁어도 옛 썸네일이 계속 나간다. 바꿀 때는 파일명에 날짜나
판을 박아 새 URL로 만든다(예: `og-20260915.webp`).

**포맷은 원인이 아니다.** 이 저장소는 "WebP를 카카오가 못 읽는다"는 진단으로 OG를 JPEG로
바꾼 적이 있고(`d51e9e2113`), 운영자 확인 결과 시간이 지나자 WebP로도 정상 표시돼
되돌렸다(`85178f14ad`). 2026-05의 `397eea2930`까지 합치면 같은 오진이 두 번이다.
최초 공유 직후 안 뜨는 것은 **카카오의 수집 지연**이지 포맷 미지원이 아니다.

또 하나: **이미 보낸 카카오톡 메시지의 카드는 영영 바뀌지 않는다.** 그건 메시지에 박힌
스냅샷이라 다시 공유해야 새 카드가 만들어진다. "디버거에는 새 이미지가 보이는데 채팅방은
그대로"라면 대개 이 경우다.

### lastmod 정책 (사이트맵 freshness)

`<lastmod>`는 **절대 파일 mtime에서 오면 안 된다.** git은 mtime을 보존하지 않고 Vercel은
얕은 클론이라, mtime을 쓰면 배포할 때마다 전체 URL이 같은 순간을 "방금 수정됨"으로 주장한다.
Google은 lastmod을 "consistently and verifiably accurate"할 때만 사용하므로 신호가 통째로 폐기된다.

| 대상 | 소스 | 생성 |
|---|---|---|
| 스토리 1,000+편 | frontmatter `lastmod` → `date` | `scripts/backfill-story-lastmod.mjs` |
| 정적 페이지 22 라우트 | `lib/sitemap/pageLastmod.json` | `scripts/generate-page-lastmod.mjs` |
| 카테고리 허브 | 소속 스토리 lastmod의 최댓값 | 자동 |

두 경로 모두 mtime은 **항목이 없을 때의 폴백**으로만 남아 있다. 로컬에서는 파일마다 mtime이
달라 이 버그가 드러나지 않으므로, 검증은 반드시 프로덕션 사이트맵으로 할 것.

**생성기 실행 후에는 diff를 반드시 눈으로 거를 것.** `scripts/generate-page-lastmod.mjs`는
"파일을 건드린 마지막 커밋"만 보므로, 콘텐츠와 무관한 일괄 수정도 날짜를 끌어올린다.
실제 사례: `85178f14ad`(OG 이미지 WebP→JPEG revert)가 14개 페이지의 `ogImage` 한 줄씩을
바꿔서, 그 뒤 생성기를 돌릴 때마다 무관한 13개 라우트가 `2026-08-20T08:00:10`으로 함께
올라온다. 그대로 커밋하면 사이트맵 14개 URL이 같은 순간을 "방금 수정됨"으로 주장하게 되고,
이 절이 막으려는 상태로 정확히 되돌아간다. **이번 커밋이 실제로 바꾼 라우트만 남기고
나머지는 `git checkout -- lib/sitemap/pageLastmod.json` 후 해당 항목만 손으로 옮길 것.**

알려진 한계: 페이지 카피만 `public/locales/*/common.json`에서 고치면 날짜가 오르지 않는다.
common.json은 전 페이지 공유 파일이라 반영하면 카피 한 줄에 모든 페이지가 갱신 처리되어
원래 문제로 돌아간다. 과소보고는 안전한 방향이라 의도적으로 감수한다 — 크게 개편했다면
`pageLastmod.json`의 해당 날짜를 손으로 올려도 된다.

### 상업 LP를 고친 날은 GSC 색인 요청을 넣는다 (사이트맵만으로는 안 긁힌다)

lastmod이 정확해도 구글이 그 페이지를 다시 긁으러 오는 데는 **한 달 넘게** 걸린다.
2026-09-15 GSC 크롤 통계 실측: 90일 크롤 6.31만 중 HTML이 32%(하루 약 225페이지)인데
구글이 아는 HTML URL이 8,200개(색인 1,110 + noindex 폴백 6,344 + 리디렉션 356 + 기타)라
**URL당 재크롤 간격이 약 36일**이다. 실제로 URL 검사에서 `/ko/pricing`의 마지막 크롤이
7/26(7주 전), `/ko/recording`이 8/11(5주 전)이었다 — 8/17 pricing h1 즉답화(`93b788596a`)와
StoryCTA→LP 배선을 구글이 그때까지 본 적이 없었다는 뜻이다.

**IndexNow로는 해결되지 않는다.** IndexNow는 Bing·네이버용이고 구글은 지원하지 않는다
(`npm run indexnow:changed`가 이미 CI에서 도는 것과 별개다).

그래서 `/pricing`·`/recording`·`/mixing-mastering`·`/lesson` 같은 **상업 LP의 본문·타이틀·
가격을 고쳤으면 배포 후 GSC에서 색인 요청을 넣는다.** 콘솔 전용 기능이라 API가 없다 —
GSC > 상단 URL 검사창에 URL 입력 → "색인 생성 요청". 브라우저 자동화(aside)로 할 때는
한 URL씩, "실제 URL 테스트"는 누르지 말 것(`feedback_live_console_writes` 규칙).

효과는 실측됐다: 2026-09-15에 LP 4종을 요청했더니 **3시간 만에 3종이 재크롤**됐다
(pricing 7/26→9/15, mixing-mastering 9/09→9/15, lesson 8/29→9/15. recording만 대기열에 남음).
하루 요청 한도가 있으니(체감 10건 남짓) 리드에 직결되는 페이지부터 넣는다.

이 사실은 판정에도 영향을 준다 — `docs/ctr-surgery-log.md`의 "LP는 나이 문제라 기다린다"
(2026-09-02 `/mixing-mastering` 보류 판정)는 **구글이 다시 긁는다는 전제** 위에 있었고,
그 전제는 색인 요청을 넣어야 성립한다. 2026-10-26 재평가는 그 뒤에 의미가 있다.

### 스토리 프리렌더는 번역이 있는 로케일만 (빌드 곱집합 금지)

`getStoryPaths`(`lib/stories.ts`)는 **원문 파일이 있는 (슬러그, 로케일) 조합만** 반환한다.
번역이 없는 로케일은 ko 본문을 대신 보여주는 폴백이고, 그 렌더는 robots를
`noindex, follow`로 내리고 canonical을 원본 로케일로 돌린다. 사이트맵도
`getIndexableStoryLocales`로 같은 조합만 싣는다 — 즉 폴백 페이지는 어떤 색인 경로에도
없다. 예전엔 슬러그 × 7 로케일을 전부 반환해서, 매 빌드마다 색인 대상이 아닌 페이지를
6,000장 넘게 만들고 있었다(12,355장 → 1,276장, 2026-09-04).

**`fallback: 'blocking'`은 목록에 **없는** 경로만 지연시킨다.** 목록에 넣은 경로는
`fallback` 설정과 무관하게 빌드 때 전부 만들어진다 — 흔한 오해라 여기 적어 둔다.
목록에서 뺀 조합은 첫 요청에 생성돼 ISR로 캐시된다(실측 첫 요청 90ms, 이후 4ms).

`lib/stories.test.ts`가 두 가지를 막는다: 원문 없는 조합이 목록에 들어오는 것, 그리고
곱집합으로 되돌아가는 것. 번역을 새로 추가하면 자동으로 프리렌더 대상이 되므로
손댈 것이 없다.

관련 규칙: **로케일 전환 링크에는 `prefetch={false}`를 유지할 것**
(`components/LanguageSwitcher.tsx`). 메뉴를 열면 현재 페이지의 나머지 6개 로케일이
동시에 viewport에 들어와, 폴백 페이지의 온디맨드 생성을 무더기로 유발한다.
`StoryCard`·`StoryCTA`와 같은 판단이며 hover/focus prefetch는 유지된다.

## 중간 계층 UI 프리미티브와 기준선 가드 (2026-10-05)

고르는 항목·안내 박스·배지·거래 화면 머리·단계·금액 요약·결과 카드·모달·빈 상태·접기는
`components/ui/`의 `ChoiceCard`·`Checkbox`·`Notice`·`Panel`·`Badge`·`PageHeader`·`Stepper`·
`PriceSummary`·`ResultCard`·`Modal`·`EmptyState`·`Disclosure`를 쓴다 — 손으로 다시 짜지 않는다.
규칙은 `docs/design-system.md` §3·§4, 배경과 순서는 `docs/design-ui-refinement-plan-2026-10.md`.

`components/ui/uiPatterns.baseline.test.ts`가 7종 패턴(`rounded-md`·상태 박스 손조립·배지 손조립·
라디오/체크박스 `accent-primary` 누락·원시 h1·이모지 아이콘·hover 모션 복제)을 **파일별 기준선
대비**로 본다. 늘면 CI가 서고, 줄면 통과한다. 줄인 뒤에만
`UPDATE_UI_PATTERN_BASELINE=1 npx jest components/ui/uiPatterns.baseline.test.ts`로 기준선을 내린다
(올리는 갱신은 거부된다).

**페이지 뼈대는 `tests/pages/pageScaffold.test.ts`가 따로 본다** — 모든 페이지 `designEdition = 'v2'`, 페이지가
`<main>`을 만들지 않기(Layout이 준다 → `PageShell`), `min-h-screen` 바탕 금지. 예외·부채 목록은 이유와 함께 그 파일에
있고 줄기만 한다. 새 화면은 이웃 파일이 아니라 `docs/design-system.md` §8을 기준으로 만든다.

공용 CTA·카드 동결(2026-10-13까지)은 **2026-10-05 운영자 결정으로 해제**됐다 —
그날 세 PR(#486·#487·#488)이 Button·BaseCard·배지·콜아웃까지 바꿨고 교락은 `docs/ctr-surgery-log.md`
2026-10-05 행에 있다. 측정 중 LP를 고칠 때는 `node scripts/seo-preflight.mjs`로 확인하고 장부에 적는다.

## Liquid Glass 재질 시스템 (디자인 리뉴얼)

iOS 26 리퀴드 글래스 스타일 리뉴얼의 재질 레이어. **성능 예산제**로 운영한다 —
이 프로젝트는 iOS Safari GPU/PSI 때문에 blur를 걷어낸 이력이 있으므로(아래 표 참조)
글래스 확대 적용 전 반드시 PSI 모바일 실측을 거칠 것.

- **토큰**: `styles/globals.css`의 `--glass-*` CSS 변수 (라이트/`.dark` 분기 포함)
- **클래스**: `tailwind.config.ts` 플러그인의 `.glass-regular`(기본 표면),
  `.glass-menu`(텍스트 밀도 높은 플로팅 메뉴 전용 — 틴트 0.88, DropdownMenu·
  LanguageSwitcher. 큰 컬러 타이포그래피 위에서 0.72는 비침이 레이블과 경쟁),
  `.glass-clear`(화려한 배경 위 소수 요소 전용, 뷰포트당 1–2개), `.glass-bar`(전폭
  sticky 바 — border·그림자는 컴포넌트가 직접 관리)
- **자동 폴백** (토큰 교체만으로 전체 강등, 컴포넌트 코드 무변경):
  1. `prefers-reduced-transparency` (OS 접근성)
  2. 터치 기기 + `max-width: 768px` — 1차 릴리스는 **모바일 전체 솔리드**
  3. 킬스위치: `NEXT_PUBLIC_DISABLE_GLASS=1` → `_document.tsx`가 `<html data-glass="solid">` 부여
- 솔리드 폴백 값은 기존 `bg-white/95`·`dark:bg-gray-900/95`와 동일 — 강등 시 리뉴얼 이전 모습으로 복귀
- `-webkit-backdrop-filter` 프리픽스는 tailwind.config의 .glass-* 컴포넌트 클래스에 **명시적으로** 둔다.
  autoprefixer는 이 컴포넌트 클래스들에 프리픽스를 일관되게 안 붙인다(빌드 CSS 감사에서
  glass-regular만 붙고 glass-clear·glass-bar 누락 확인). Safari 16–17 데스크톱 blur에 필수라 수동 유지.
- 가드레일: 뷰포트당 상시 고정 blur 레이어 ≤ 2, 본문 텍스트는 글래스 위에 직접 올리지 않기,
  글래스 위 텍스트 대비 AA(4.5:1) 유지

적용 현황:
- Phase 1: DropdownMenu, LanguageSwitcher, SectionAnchorNav, PortfolioDetailModal 헤더
- Phase 2: Header 반응형 — 모바일/태블릿(<lg) 전폭 글래스 바(전폭 MobileNav와 정합),
  데스크톱(lg+) 플로팅 pill. 두 경우 모두 하단선 64px(모바일 h-16 / 데스크톱 pt-2+h-14)로
  MobileNav `top-16`·scroll-mt 오프셋과 정합. backdrop-filter는 안쪽 바 div에만
  (header에 주면 MobileNav fixed containing block이 깨짐). Button `glass` variant,
  ScrollToTop. **투명 헤더 CTA는 glass 토큰이 아니라 고정 반투명 `bg-white/15`+`text-white`**
  — glass-clear는 모바일 폴백 시 불투명 흰색이 되어 흰 글씨가 사라진다(히어로 위 오버레이엔 부적합).
  **KakaoFab은 의도적으로 솔리드 옐로 유지** — 전환 핵심 브랜드 버튼 + blur 예산
  (상시 고정 레이어 ≤2: 헤더+ScrollToTop) 준수.
- Phase 3: BaseCard `glass`/`glass-highlight` variant(FeatureCard·PricingCard 적용,
  PricingCard는 동심원 라운드 24px/12px). **인플로우 카드는 `.glass-card` — blur 없는
  글래스**(정적 배경 위 backdrop-filter는 시각 이득 0에 GPU만 소모). glass 카드는
  hover 시 SHADOW_HOVER를 섞지 않는다(inline boxShadow가 inset 스펙큘러를 지움).
  AudioPlayer 대형 패널 2개의 무의미 backdrop-blur 제거(앨범아트 위 배지는 유지).
- Phase 4: BaseCard `default`/`highlight` 재질을 글래스로 전환(전 소비처 일괄 —
  .glass-card는 blur 무비용이라 안전). ~~스펙큘러 포인터 하이라이트~~(2026-10-09 TDS 대조에서 제거 — 장식 효과)(.glass-card::after,
  hover 기기 한정, --glass-glow는 솔리드 폴백에서 transparent), 클릭 카드 press
  스케일(0.98/0.1s), Button glass variant press(active:scale-[0.97]).
  카드 hover에 SHADOW_HOVER 금지 원칙은 전 glass variant로 확대.
- 남은 솔리드: outline variant, 모달 본문 패널, StoryCard(BaseCard 미사용), KakaoFab.
- **성능 실측 완료 (2026-08-05, 프로덕션)**: lighthouse devtools 스로틀 기준
  모바일 홈 96 · practice-room 95 · story 94 · pricing 92 (LCP 전부 1.8s),
  데스크톱 홈(글래스 blur 전면 활성) 100 · TBT 0ms · CLS 0. CDN TTFB 58~67ms HIT.
  글래스 리뉴얼 성능 회귀 없음 — 배포 게이트 통과. 익명 PSI API는 쿼터로 실패했으니
  재측정 시 `--throttling-method=devtools` 로컬 측정을 쓸 것(방법론: PSI 메모리 참조).

## 카카오 CTA 배색 규칙

카카오톡은 GA4 기준 검증된 유일 전환 채널인데, 예전엔 같은 오픈채팅으로 가는 링크가
위치마다 색이 달랐다(옐로·보라 그라디언트·반투명 검정·흰색·보라·앰버·yellow-400 — 7종).
`#FEE500`은 KakaoFab 한 곳뿐이라 방문자가 "노란 건 카톡"을 학습할 기회가 없었다.
아래 규칙으로 진입점을 통일했다.

- **토큰**: `tailwind.config.ts`의 `kakao`(`#FEE500`) / `kakao-dark`(`#FADA0A`, hover) /
  `kakao-ink`(`#191600`, 옐로 위 텍스트·아이콘·focus ring)
- **단일 규칙(양방향)**: 목적지가 카카오톡인 링크는 **전부** 옐로, 카카오가 아닌 링크에는
  **절대** 옐로를 쓰지 않는다. 이 규칙이 깨지는 순간 노란색의 신호 가치가 사라진다.
  - 비-ko 로케일은 같은 자리라도 목적지가 `/contact` 폼이므로 옐로 금지 —
    `ContactCTA`·`ReleaseHeroCtas`가 `isKorean`/locale로 분기한다.
  - `PricingCard`는 `isKakaoCta`(ctaHref에 'kakao' 포함)로 분기. 카드 5장이 나란히
    노란 CTA인 건 의도 — 상품은 달라도 행동은 하나다.
- **옐로 위 글씨는 항상 `text-kakao-ink`.** 흰 글씨는 대비 1.3:1로 WCAG 미달이라
  올릴 수 없다. `#191600` on `#FEE500`은 약 16:1.
- **히어로 위계**: 1차(카카오)가 옐로면 2차는 솔리드 `bg-primary`를 쓰지 않는다 —
  어두운 히어로 사진 위에서 채도 높은 브랜드색(지금은 파랑)이 옐로와 경쟁해 위계가 뒤집힌다.
  2차는 Button `inverse` — 흰 면 + 잉크 글씨(2026-10-11 개정: 반투명 테두리 상자도, 그 뒤의 잉크 면(scrim)도
  어두운 사진 위에서 거의 안 보였다). 노란 카톡이 없는 비-ko·가이드 히어로는 1차가 파랑 `solid`, 2차가 흰 `inverse`.
- 적용: HeaderActions, KakaoFab, 홈·pricing 히어로, HeroKakaoCta(onImage/onSurface 공통),
  ContactCTA, ReleaseHeroCtas, PricingCard, StickyBottomCTA, Inline{Booking,Price,Service}Callout,
  {Korean,English}FastContactActions, ContactFormCard, ContactFormErrorFallback,
  서비스 페이지(recording·lesson·voice-acting·wedding-song·cover-video) 섹션 CTA
- **헤더 CTA는 투명 상태에서도 옐로**(`kakaoCtaButtonClass`). 솔리드 옐로는 배경 사진
  밝기와 무관하게 `kakao-ink` 대비가 16:1로 고정되므로, 밝은 히어로에서 흰 글씨가
  흐려지던 스크림 방식보다 안정적이고 text-shadow도 필요 없다. 비-ko는 목적지가
  `/contact` 폼이라 투명·스크롤 상태 모두 파랑 솔리드를 쓴다(`formCtaButtonClass`, 2026-10-11 잉크 면에서 변경 — 어두운 히어로 위에서 안 보였다) —
  헤더는 이 규칙의 ko/비-ko 분기가 가장 눈에 띄는 자리다.
- **미적용(의도)**: `ContactInfoCard`·`about` 연락처 카드는 버튼이 아니라 텍스트/카드형
  링크라 제외. `StoryCTA`의 amber는 스토리 테마 색이지 카카오 신호가 아니므로 건드리지 않는다.

### 소셜 발행 (Instagram·Threads API)

`scripts/social/post.mjs --slug <s> [--dry-run]`로 스토리 한 편을 두 플랫폼에 올린다. 상세는
`docs/social/README.md`. 기억할 것: Meta는 **HTTPS redirect만** 받아 OAuth는 `auth.mjs`가
URL 출력 → 사이트로 돌아온 `?code=`를 `--code`로 넘기는 2단계다. Instagram은 **JPEG 공개 URL만**
받으므로 OG 카드(PNG)를 sharp로 바꿔 Blob에 올린다. **영구 토큰은 없다** — 60일 장기 토큰을 무제한 연장할 뿐이고 만료 후엔 재승인만 남는다.
토큰은 env가 아니라 Turso `social_tokens`에 있고(Vercel env는 배포 시점에 박혀 갱신값을 못 본다),
Vercel Cron `/api/cron/social-refresh`가 주간 갱신한다. 앱 ID·시크릿은 Vercel env → `vercel env pull`.
발행 원장 `docs/social/posted.json`이 중복 발행을 막는다. 반응 확인·답글은 `inbox.mjs`(자동 답글 없음,
IG DM은 모바일 앱의 "메시지 액세스 허용" 토글 필요), 지표 적재는 `insights.mjs`.

## SEO·GA4·GSC 분석 규칙 (오진 재발 방지)

**데이터를 열기 전에 반드시 먼저 실행한다:**

```bash
node scripts/seo-preflight.mjs        # 최근 커밋·열린 실험·관측창·판독 함정
```

2026-08-14~18 라운드에서 같은 유형의 오진이 네 번 났다. 전부 데이터 해석 실력이 아니라
**"데이터를 읽기 전에 확인했어야 할 것을 안 읽어서"** 났다. 프리플라이트가 그 확인을 대신한다.

- 의도적 noindex(`8621b269da`, 경쟁자 대상 콘텐츠)를 "고칠 문제"로 보고
- 2026-08-04에 이미 고친 폼 오류(`780a1631cb`)를 "현재 문제"로 보고
- 진행 중인 전환 작업(7/26~8/4, 8/17 `93b788596a`)과 같은 내용을 "남은 갭"으로 제안
- 90일 스냅샷 두 개를 빼서 "증분"이라 부르고 "타이틀 수술 실패" 결론 — 기간지정으로 다시 재니 5편이 +34~+546% 성공

### 절대 규칙

1. **문제를 발견하면 먼저 `git log --oneline -S"<키워드>"`.** 이미 처리됐는지 확인하기 전에는
   보고하지 않는다. 이 저장소는 SEO 작업이 활발해서, 발견한 문제 상당수가 이미 처리 중이다.
2. **`docs/gsc-raw`·`docs/ga4-raw`는 90일 누적 스냅샷이다.** 최근 3주 작업의 효과는 거의 안 보이고
   이미 고친 문제가 미해결로 보인다. 최근 상태를 알려면 기간을 좁혀 직접 질의한다.
3. **두 스냅샷을 빼서 "증분"이라 부르지 않는다.** 창 뒤끝에서 빠져나간 기간이 섞인다.
   실험 판정은 `node --env-file=.env.local scripts/ctr-verdict.mjs`로 — 기간지정 + 대조군 + 노출 정규화.
   전환 실험(콜아웃·CTA 변경)은 `scripts/lead-verdict.mjs` — GA4 **랜딩 기준** 세션당 리드(규칙 6의 귀속 함정 회피).
4. **CSV 집계는 `#` 앵커 행 제외 + `/ko/` 정본 필터.** 앵커는 목차 점프링크지 별개 페이지가 아니고,
   slug로 키잡으면 uz/en 행이 ko 행을 덮어쓴다(mixing19가 9clk→0clk로 뒤집힌 적 있음).
   **앵커가 노출에서 차지하는 비중은 2026-09-23 실측 34%다**(28일 `query`×`page`, /ko 71,296 대
   앵커 36,577). 한동안 "~13%"로 적혀 있었는데 그 사이 커졌다 — 규모를 얕보면 안 된다.
   ⚠ **앵커를 base 페이지에 합치는 것은 제외가 아니다.** `split('#')[0]`으로 정규화하면 같은
   노출을 두 번 세어 쿼리당 노출이 2~4배로 뛴다. 2026-09-23에 실제로 그렇게 집계했다가
   "음악 연습실 대여 118노출"이 실제 30노출인 것을 보고 되돌렸다. `#`가 있는 행은 **버린다**.
5. **낮은 CTR·noindex·통합 제외가 전부 결함은 아니다.** 사전형 단일어 쿼리(흉성·더블링·딜레이)는
   동음이의 검색자가 다수라 구조적으로 클릭이 안 난다. 0클릭 상업 쿼리도 상품 불일치일 수 있다
   ("아이돌 연습실"=댄스 연습실, "합주실 대여"=시간제 합주실 — 둘 다 우리 상품이 아니다).
6. **GA4 `landing.csv`(랜딩 기준)와 `events.csv`(클릭 발생 page_path 기준)를 나눠 전환율을 만들지 않는다.**
   그건 트래픽 품질 비교가 아니라 귀속 산출물이고, 그 동선은 `f549323537`·`9546332e18`로 의도적으로
   배선한 것이다. "/stories/ 0.55% vs practice-room 6.79%"를 스토리 결함 근거로 쓰면 오독이다.
7. **GSC 쿼리 차원 합계는 익명화로 과소집계된다**(28일 1,112 vs 실제 5,385클릭). 헤드라인 총계는
   차원 없는 조회나 device/searchType 합계를 쓴다.

측정 중(🔒) 실험과 308 관측창(통상 2~4주) 안에서는 해당 페이지의 타이틀·본문·H2를 수정하지 않는다 —
효과가 교락돼 둘 다 판정 불가가 된다. 무엇이 열려 있는지는 프리플라이트가 알려준다.

## Next.js Experimental Flags

`next.config.mjs` `experimental` 블록 결정 사항 — 이유 없이 건드리지 말 것:

| 플래그 | 상태 | 이유 |
|--------|------|------|
| `optimizePackageImports` | **활성** (7개 라이브러리) | `lucide-react`, `framer-motion` 등 barrel import tree-shaking |
| `optimizeCss` (critters) | **비활성** | PSI 모바일 점수 85→38 급락, TBT 260→7,130ms. Next.js 15 + React 19 + Pages Router 조합에서 불안정 |
| `nextScriptWorkers` (Partytown) | **비활성** | TBT 260→1,990ms 회귀 확인 |

## 의존성 버전 고정 정책

`next`·`react`·`react-dom`은 **캐럿 없이 정확한 버전으로 고정**한다. 특정 버그를 피하려는
것이 아니라, 세 패키지가 함께 움직여야 하기 때문이다(`f2accd09f2` Next 15 + React 19
atomic update에서 이 방식으로 전환). 따라서 **같은 minor 안의 패치 상승은 정책 위반이
아니다** — 실제로 `701233f0ac`에서 15.5.12 → 15.5.18로, 2026-10-01에 15.5.23 → 15.5.27로(critical RCE 권고 2건) 올린 전례가 있다.

- 패치 상승(15.5.x → 15.5.y): 보안 권고가 있으면 올린다. 검증은
  `type-check` → `lint` → `test` → `build` → `middleware.test.ts` 순.
  **미들웨어에 `NextURL.pathname` setter 버그 워크어라운드가 있으므로**
  (`middleware.ts:207`, `701233f0ac`) 업그레이드 후 반드시 `middleware.test.ts`를 확인할 것.
- minor·major 상승: PSI 실측 없이 올리지 않는다(`optimizeCss`·Partytown 회귀 이력 참조).

`npm audit`은 **0건**이다(2026-10-01, 개발 의존성 포함). 0을 유지하는 데 알아 둘 것:

- **`vercel` CLI는 devDependency가 아니다.** 예전에 들어 있던 CLI가 취약한 빌더 패키지(`@vercel/*`·tar·minimatch·
  path-to-regexp 등) 25여 건을 끌고 왔고, 저장소 코드 어디서도 쓰지 않았다(`vercel env pull` 등은 운영자가 전역 CLI로
  실행). 다시 넣지 말 것 — 필요하면 `npx vercel`. 그 CLI가 **선언 없이 끌어오던 `ts-morph`**는 `content/i18nKeys.test.ts`가
  쓰므로 12.0.0으로 직접 선언해 뒀다(옛 설치본과 같은 버전).
- **overrides가 막고 있는 것**: `ip-address`(10.7.2), `gray-matter`의 `js-yaml`(3.15.2), drizzle-kit이 물고 오는
  `@esbuild-kit/core-utils`의 `esbuild`(0.25.12 — `drizzle-kit check`로 동작 확인). 새 권고가 나오면 이 값을 올린다.
- **락파일은 CI와 같은 npm 10으로 만든다**(`npx -y npm@10 install --package-lock-only`). 로컬 npm 11로 만든 락은
  puppeteer-core 중첩 `proxy-agent`를 걷어내 CI의 `npm ci`가 "Missing: proxy-agent@…"로 실패한다. `npx -y npm@10 ci --dry-run`으로
  먼저 확인할 것.
- `postcss` 8.4.31(next 번들)은 audit이 잡지 않는다. next가 올라가면 함께 정리된다.
