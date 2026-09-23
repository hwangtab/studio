# CLAUDE.md

This file provides guidance for development in the **Studio NOL** repository.

## Project Overview

Studio NOL is a multi-language music studio website built with:
- **Framework**: Next.js 15.5.23 (Pages Router)
- **Runtime**: React 19.2.4
- **Styling**: Tailwind CSS with custom design system
- **Animation**: Framer Motion
- **i18n**: react-i18next (7 languages: ko, en, zh, es, vi, th, uz)
- **Content**: Markdown-based story system
- **Deployment**: Vercel

## Key Technologies

- **Frontend**: Next.js 15.5.23, React 19.2.4, Tailwind CSS, Framer Motion, Lucide React
- **i18n**: i18next with language detection and locale-based routing
- **Form**: Serverless contact form via Next.js API Routes and Resend
- **Imaging**: Sharp-based image optimization (WebP/AVIF)
- **Audio**: Custom AudioPlayer with `useAudioPlayer` hook

## Development Commands

```bash
# Development
npm run dev                  # Start Next.js development server

# Build & Verification
npm run type-check           # Run TypeScript compiler check
npm run lint                 # Run ESLint
npm run build                # Production build (includes image optimization)

# Image Optimization
node scripts/optimizeImages.js # Manually run image optimization

# SEO 분석 (자세한 규칙은 "SEO·GA4·GSC 분석 규칙" 절)
node scripts/seo-preflight.mjs                              # 데이터 열기 전 필수 — 최근 커밋·열린 실험·관측창
node --env-file=.env.local scripts/gsc-fetch-detail.mjs     # GSC 90일 원시 데이터
node --env-file=.env.local scripts/ga4-fetch.mjs            # GA4 90일 원시 데이터
node --env-file=.env.local scripts/ctr-verdict.mjs --surgery YYYY-MM-DD --slugs a,b --control c,d
node --env-file=.env.local scripts/lead-verdict.mjs --from YYYY-MM-DD --pages a,b --control c   # 전환 실험(GA4 랜딩 기준 세션당 리드)

# Hero font subset (LCP)
# prebuild에서 자동 실행됨. hero h1 텍스트(data/home.ts heroContent,
# public/locales/*/common.json의 *.hero.title*) 변경 후 빌드하면 woff2가 재생성되며
# 변경된 woff2 + pretendard-hero.chars.json 사이드카를 반드시 함께 commit해야 함.
# 빠뜨리면 hero-font-subset.test.js(CI)가 --check 모드로 잡아낸다.
# 수동 재실행:
node scripts/generate-hero-font.mjs
node scripts/generate-hero-font.mjs --check  # 네트워크 없이 subset 커버리지 검증

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

# 섹션 단위 중복 검사 (CI)
npm run check:dup-sections
node scripts/check-duplicate-sections.mjs --update  # 기준선 갱신

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

# IndexNow 변경분 제출 — 전량 반복 제출 금지, CI(main push)가 diff로 바뀐 URL만 자동 제출한다.
npm run indexnow:changed -- --dry-run
```

### 연습실 공실 상태 = 상수 하나

연습실 만실/공실은 `data/practiceRoomAvailability.ts`의 `PRACTICE_ROOM_HAS_VACANCY` 하나로
바꾼다. 카피 3곳(연습실·pricing 페이지 note/subtitle)과 `pages/api/llms.ts`가 이 상수를
따라간다. 바꿀 때 `PRACTICE_ROOM_AVAILABILITY_UPDATED_ON`도 함께 갱신할 것 — 오래되면
`practiceRoomAvailability.test.ts`가 CI에서 실패한다.

### 오픈 뒤 펀딩 프로젝트의 리워드 id·slug·금액은 바꾸지 않는다

프로젝트·리워드의 정본은 `content/funding/<slug>.md`인데, 후원 기록은 DB에 문자열
`project_slug`·`reward_id`로 남는다. 파일만 고치면 에러 없이 조용히 깨진다.

- **리워드 id 변경 → 한정 재고가 0으로 리셋된다.** `lib/funding/service.ts`의 재고 조건은
  `fp.reward_id = <파일의 id>`로 기존 후원을 세므로, id가 바뀐 순간 그 후원들이 안 세어져
  100개짜리 리워드가 200개 팔린다.
- **slug 변경 → 진행 중 모금액이 공개적으로 0원이 되고**, 기존 후원자는 manage 페이지에서
  프로젝트를 못 찾아 셀프 취소·후원 확인을 잃는다.
- **금액 변경 →** 후원 기록이 결제 당시 단가를 스스로 저장하므로 기록은 남지만, DB의 단가와
  상세 페이지·관리자 화면·CSV의 표시가 어긋나 환불 금액과 모금액 설명이 맞지 않게 된다.
  가격을 바꿔야 하면 기존 리워드는 두고 **새 id로 티어를 추가**한다.

`content/funding.baseline.json` + `content/funding.baseline.test.ts`가 이 규칙을 지킨다
(slug × 리워드 id × **단가** × 한정 여부). 2026-09-11까지 기준선이 `{ limited }`만 실어서
`amount: 30000 → 35000`이 CI를 그냥 통과했다 — 이 절의 제목이 "금액은 바꾸지 않는다"인데
게이트가 금액을 안 보고 있었다. 의도한 변경이면 `npm run check:funding-baseline -- --update`
후 **같은 커밋에 왜 바뀌는지를 적을 것** — 이유 없는 갱신은 게이트를 무력화한다.

### 펀딩 프로젝트의 정본은 둘이다 — 파일이 먼저, 그다음 DB

`content/funding/<slug>.md`와 `funding_projects` 테이블이 공존한다. 읽는 입구는
`lib/funding/repository.ts` 하나뿐이고 **같은 slug가 양쪽에 있으면 파일이 이긴다.**
새 코드에서 `lib/funding/projects.ts`의 동기 함수(`getFundingProject` 등)를 직접 부르지 말 것 —
그 함수들은 파일만 보므로 DB 프로젝트가 조용히 404가 된다.

검증은 `lib/funding/shape.ts`의 `validateFundingProjectShape` 하나다. md 파서와 DB 변환이
같은 함수를 지난다 — 한쪽에만 검증을 두면 다른 쪽은 `status: Draft` 오타로 초안을 공개한다.

DB 조회는 전부 실패를 삼키고 파일 기준으로 응답한다. **빌드는 `TURSO_*` 없이 성공해야 한다**
(CI·로컬). 공개 페이지는 ISR(60초)이고 상세는 `fallback: 'blocking'`이라 DB 프로젝트가 첫
요청에 생성된다. 사이트맵은 `next-sitemap`이 파일만 싣고, DB 프로젝트는 런타임 라우트
`/sitemap-funding.xml`이 맡는다.

### 개설자가 쓴 것은 우리가 쓴 것과 다르게 다룬다

펀딩 프로젝트를 아티스트가 직접 등록한다. 그래서 세 가지가 코드로 강제된다.

- **본문의 신뢰 숏코드를 저장 시점에 벗긴다**(`lib/funding/creatorContent.ts`).
  `%%price:...%%`·`%%studio-services%%`는 스튜디오가 자기 글에 쓰라고 만든 장치라, 개설자
  글에 뜨면 읽는 쪽이 그 프로젝트에 대한 우리 보증으로 읽는다. 렌더 시점이 아니라 저장
  시점에 벗기는 이유는 렌더 경로가 여럿이라(상세·미리보기·OG·llms) 한 곳을 빠뜨리면 그
  경로로만 새어 나가기 때문이다.
- **승인된 리워드는 id·금액·한정 여부를 바꿀 수 없다**(`lib/funding/creatorProjectWrite.ts`의
  `lockedViolation`). md 시절 `content/funding.baseline.json`이 하던 일이고, 운영자에게도
  예외가 없다. 가격을 바꿔야 하면 새 id로 티어를 추가한다.
- **slug는 예약어를 피한다**(`lib/funding/reservedSlugs.ts`). 리터럴 라우트가 `[slug]`를
  이기므로 프로젝트를 `apply`로 지으면 그 상세는 어떤 주소로도 안 열린다. 오류도 안 난다.
  `pages/[locale]/funding/` 아래 리터럴 라우트를 추가하면 그 목록에도 넣어야 한다.

업로드 이미지는 sharp로 다시 인코딩해 **private** Blob에 올리고 `/api/funding/media/`가
대신 내보낸다 — 그 저장소에는 계약서 PDF가 있어 공개 업로드를 섞을 수 없다(소셜 이미지가
이미 같은 길을 간다). 치수는 주소 쿼리(`?w=&h=`)로 실어 보낸다. `utils/imageMetadata.json`은
저장소의 정적 이미지만 알기 때문이다.

`lib/funding/projects.ts`는 `node:fs`·`gray-matter`를 물고 있고 **모듈 최상위에서
`process.cwd()`를 실행**한다. 그래서 클라이언트 컴포넌트는 이 모듈에서 **타입만** 가져와야
한다 — 런타임 값을 하나라도 가져가면 순수하지 않은 최상위 호출이 트리셰이킹을 버티고
클라이언트 번들에 끌려 들어가 빌드가 깨진다(2026-09-17에 실제로 났다). 클라이언트와
공유해야 하는 순수 함수는 `lib/funding/shape.ts`에 둔다. **`components/` 아래를 건드린
변경은 `npm run build`까지 돌려야 이 파손이 드러난다** — 타입 검사·테스트는 통과한다.

**`npx jest`도 디렉터리를 좁히지 말 것.** 포커스 링 대비·다크 짝·`transition-all` 금지 같은
디자인 시스템 가드는 `tailwind.config.test.ts`에 있어서, `jest components/…`로 좁히면
통째로 건너뛴다. 실제로 그렇게 CI를 두 번 빨갛게 했다.

### 승인은 세 가지를 한 묶음으로 한다

`lib/funding/reviewDecision.ts`의 승인은 slug 확정 · 리워드 `lockedAt` · `status` 열기를
함께 한다. **하나라도 빠지면 조용히 잘못된다** — `lockedAt`이 없으면 승인된 리워드의 금액을
바꿀 수 있고(잠금 가드가 전부 그 값에 달려 있다), `status`가 안 열리면 승인했는데 공개가
안 되고, slug가 확정 안 되면 주소가 개설자 입력 그대로 남는다.

리워드 잠금 UPDATE의 `WHERE`에는 프로젝트가 이미 승인으로 바뀌었다는 조건(`EXISTS`)을
함께 건다. 경합으로 프로젝트가 안 바뀌었는데 리워드만 잠기면 "잠겼는데 공개는 안 된"
상태가 남는다. 그 `EXISTS`에는 **`p.updated_at = <이 배치의 epoch>`까지** 넣는다 — "승인
상태인가"만 보면 다른 운영자가 먼저 승인해 둔 경우에도 참이라, 경합을 `conflict`로
돌려주면서 실제로는 리워드를 잠그고 커밋한다.

승인은 `creator_terms_version`이 비어 있으면 거부한다(`terms_not_agreed`). 동의 기록 없이
공개되면 "그때 이 내용에 동의했다"는 증거가 사라진다. 막다른 길은 아니다 — 보완 요청으로
돌려보내면 재제출이 지금의 게이트를 거친다.

판정 뒤에는 `revalidateFundingPaths`로 **목록과 상세 둘 다** 다시 만든다. 상세만 하면
목록 카드가 60초 낡고, 목록만 하면 상세가 404로 남는다(상세의 `notFound`도 캐시된다).
재검증·메일 실패는 판정을 실패시키지 않되 응답의 `warnings`로 화면에 드러낸다 — 조용히
성공으로 보이면 운영자가 개설자에게 연락이 갔다고 착각한다.

**`reviewNote`는 내부 메모가 아니다.** 개설자 화면 두 곳에 그대로 렌더된다. 보완 요청 사유,
반려 사유, 보관 사유가 전부 이 한 칸을 쓰고 서로 덮어쓴다.

**보관(`archive`)과 반려는 DB에서 같은 `rejected`다.** 새 상태 값을 만들지 않기로 했으므로
(마이그레이션 없이 넣은 기능이다) 둘을 가르는 것은 `reviewNote`뿐이다. 나중에 "반려율"
같은 통계를 내려는 사람은 이 사실을 먼저 알아야 한다.

### 승인 뒤에 열리는 것과 잠기는 것

`lib/funding/reviewTransition.ts`의 `EDITABLE_SECTIONS`가 상태별로 개설자가 고칠 수 있는
구획(`basic`·`story`·`rewards`)을 정한다. 승인 뒤에는 **본문(story)과 기본정보(basic)만**
열리고, 기본정보 안에서도 `basicLockedViolation`(`lib/funding/creatorProjectWrite.ts`)이
주소(slug)·목표 금액·모금 기간을 잠근다. 리워드는 승인 뒤 구획 자체가 닫혀 **설명글까지**
통째로 잠긴다 — 후원자가 보고 결제한 약속이라, 바뀌면 후원자 약관 제8조의 "표시·광고와
다르게 이행"에 걸리고 판매자인 스튜디오가 3개월짜리 청약철회를 받는다.

이 표는 **두 군데에 있다.** `components/funding/creator/types.ts`의 `EDITABLE_SECTIONS`가
같은 표를 리터럴로 복제한다 — `reviewTransition.ts`는 `db/schema`를 값으로 import해
클라이언트 번들에 DB 스키마를 끌어들이기 때문이다. `components/funding/creator/types.test.ts`가
상태 × 구획 전수 조합을 대조하므로 한쪽만 고치면 CI가 선다.

승인 뒤 편집은 **심사를 거치지 않는다.** 그래서 `saveBasicSection`·`saveStorySection`이
저장 시점의 상태가 `approved`일 때만 `creator_edited_at`을 찍고, 운영자에게 메일을 보낸다
(`sendCreatorEditedNotice`, 관리자 화면은 `pages/admin/funding/projects/[id].tsx`에서
"승인 뒤 개설자가 수정했습니다"로 표시). `updated_at`으로는 알 수 없다 — 관리자 쓰기
(`set_internal_note` 등)도 그 값을 갱신하므로 운영자가 메모만 달아도 "개설자가 고쳤다"로
보인다.

**개설자 저장 라우트(`pages/api/funding/creator/projects/[id].ts`)는 검증을 우회하는
장치를 하나 갖고 있다.** 화면(`BasicSectionForm`)은 승인 뒤 잠긴 시작일·종료일 필드도
매번 폼 값에 실어 함께 보내는데, `validateBasicSection`은 상태와 무관하게
`startAt >= now + leadDays`를 요구한다. 그래서 모금이 이미 시작된(startAt이 과거인) 승인
프로젝트를 그대로 검증하면 **항상** 400이 난다 — `basicLockedViolation`에 닿기도 전에
막힌다. 이 라우트는 승인된 프로젝트에 한해 요청의 날짜를 검증 전에 DB의 기존 값으로
강제 치환하고, 리드타임 검사의 기준 시각도 `now` 대신 epoch(`new Date(0)`)로 넘겨 이
검사를 우회한다 — 치환한 값이 곧 기존 값이라 이후 `basicLockedViolation`은 항상 무위반이
된다. 이 우회가 없으면 모금이 시작된 프로젝트는 제목 한 글자도 저장할 수 없다. 2026-09-21
리뷰에서 재현된 회귀이고, `validateBasicSection`을 고칠 때 이 호출부의 전제(승인 프로젝트는
검증기에 실제 `now`가 아니라 epoch가 들어온다)를 모르면 되살아난다.

### 마이그레이션 0020(`fulfillment_updated_by`)은 배포보다 먼저 적용한다

`db/schema.ts`의 `fundingPledges.fulfillmentUpdatedBy`(`drizzle/migrations/0020_serious_luckman.sql`,
`ALTER TABLE funding_pledges ADD fulfillment_updated_by text`)가 이 브랜치에서 새로 생겼다.
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

### 개설자 배송지 열람은 마감 뒤에만 열린다

`lib/funding/creatorShipping.ts`의 `loadCreatorShipping`은 프로젝트 상태가 `closed`가
아니면(`upcoming`·`live`) 개인정보를 한 줄도 내보내지 않고 집계(`summary`)만 돌려준다.
모금 중에는 셀프 취소가 자유로워 주소가 후원마다 들어왔다 나갔다 하고, 물량 준비 단계의
개설자에게는 집계면 충분하다 — 취소될 수도 있는 주소를 미리 보여줄 이유가 없다.

발송 상태 전환은 `lib/funding/fulfillment.ts`의 `setFulfillment` **한 곳**이고, 관리자
쓰기 라우트와 개설자 쓰기 라우트(`/api/funding/creator/projects/[id]/fulfillment`)가
`actor.kind`(`'admin'` | `'creator'`)로만 갈라져 같은 함수를 지난다. 이 함수 안에 이유가
적힌 규칙이 넷 있다 — 살아 있는 주문 집합(`LIVE_FUNDING_ORDER_STATUSES`, 부분환불도
포함), 환불 요청된 후원은 발송 상태를 바꿀 수 없게 막는 것, `delivered_at`을 COALESCE로
첫 전달 시각만 보존하고 되돌릴 때는 NULL로 비우는 기산점 규칙, 그리고 경합을 막는
UPDATE의 WHERE(사전 검사와 별개로 존재하는 마지막 층). 이 넷을 관리자 경로와 개설자
경로에 따로 구현하면 두 벌이 갈라져 한쪽만 고쳐지는 사고가 난다 — 그래서 이 함수를
공유하는 것 자체가 설계다.

**마크다운 프로젝트의 후원은 개설자 경로로 닿지 않는다 — 단, 그 이유는 "행이 없어서"가
아니라 "slug가 겹치지 않아서"다.** `funding_pledges.project_slug`는 문자열이고, 개설자
actor 분기는 그 slug로 `funding_projects`(DB 테이블)를 조회해 소유를 확인한다. 지금은
`content/funding/*.md` 프로젝트의 slug와 같은 slug를 가진 DB 행이 없으므로 조회가 실패해
`forbidden`이 되는 것이지, md 프로젝트라서 원천적으로 막히는 것이 아니다. 지금 운영 DB의
후원은 전부 마크다운 프로젝트(`keep-singing-for-palestine`)의 것이고, 그 후원자들은
"배송지는 개설자에게 제공되지 않는다"에 동의했다 — 지금의 slug 불일치가 이 격리를 만들고,
그 동의를 소급해 뒤집지 않는다.

**`content/funding/`에 새 md를 추가할 때는 승인된 DB 프로젝트와 slug가 겹치면 안 된다.**
`lib/funding/reviewDecision.ts`의 승인 로직은 md가 이미 쓰고 있는 slug로 DB 프로젝트를
승인하는 것만 막는다(`getFundingProject(slug)` 검사) — **반대 방향은 아무 데도 막혀 있지
않다.** 이미 승인된 DB 프로젝트와 같은 slug로 나중에 `content/funding/<slug>.md`를 추가하면
`lib/funding/repository.ts`의 "파일이 이긴다" 규칙 때문에 공개 상세는 그 순간부터 md가 되고,
거기 새로 들어오는 후원의 `project_slug`도 그 slug와 같아진다 — 그러면 개설자 actor 분기의
slug 대조가 통과해, **그 DB 프로젝트를 만든 개설자의 배송 화면·CSV에 실제로는 자기
프로젝트가 아닌(md 쪽) 후원자의 이름·연락처·주소가 실린다.** 열람만이 아니라 발송 상태
쓰기까지 그 개설자에게 열린다. 코드 가드는 없다 — 빌드가 `TURSO_*` 없이 성공해야 해서
빌드 시점에 DB slug를 볼 수 없다. md를 새로 추가하기 전에 그 slug가 승인 프로젝트 목록에
없는지 직접 확인할 것.

개설자는 `delivered`로 상태를 바꿀 수 있고, `delivered_at`이 찍히는 순간이 처리방침
8항·약관 제13조가 약속한 "리워드 전달 완료 후 1년 파기"의 기산점이 된다(`retention.ts`의
`REWARD_RETENTION_YEARS`). 다만 전자상거래법 5년 법정 보존(`LEGAL_RETENTION_YEARS`)이
하한을 잡는다 — 리워드 전달 후 1년이 지났어도 결제일로부터 5년이 안 지났으면 파기하지
않는다.

같은 파일이 파기 대상에서 **일부러 빼는 값**이 하나 있다: `fulfillment_updated_by`
(발송 상태를 마지막으로 바꾼 주체, `'admin'` 또는 `'creator:<id>'`). 배송지·admin_memo·
supporterMessage는 후원자가 준 개인정보라 파기 약속이 걸리지만, 이 컬럼은 운영자·개설자
쪽 행위자 식별자다. 값에 `creator:<id>`가 들어 있어 "식별자니까 지우자"는 판단이 나올 수
있는데, 그렇게 하면 "누가 발송 상태를 바꿨는지"에 대한 감사 기록이 배송지와 같은 시점에
사라진다 — `retention.test.ts`가 이 컬럼이 파기 후에도 남는 것을 고정한다.

### `review_note`와 `internal_note`는 다른 칸이다

`review_note`는 **개설자에게 보인다** — 개설자 프로젝트 목록(`pages/[locale]/funding/creator/index.tsx`)과
편집 화면(`pages/[locale]/funding/creator/[id].tsx`) 두 곳, 그리고 심사 결과 메일
(`lib/funding/reviewEmail.ts`)이 이 값을 그대로 렌더한다. 보완 요청 사유·반려 사유·보관
사유가 전부 이 칸을 쓰고 서로 덮어쓴다. `internal_note`(`set_internal_note` 액션,
`db/schema.ts`의 `internalNote` 컬럼)는 운영자 전용이고 개설자 조회에 어떤 경로로도 실리지
않는다 — `lib/funding/creatorProjectWrite.integration.test.ts`가 그것을 고정한다.

### 개설자 이름 기본값은 "미설정"이다

가입은 `name: email.split('@')[0]`으로 이름을 **채운다**(`lib/funding/creatorToken.ts`).
채워져 있어 미설정을 감지할 수 없었고, 3차가 그 값을 공개 상세의 판매자 표시 옆에 그리고
동시에 잠그면서 "개설자 hwangtab"이 영영 남는 경로가 생겼다. `isDefaultCreatorName`
(`lib/funding/creatorValidation.ts`)이 그 값을 미설정으로 판정하고, 심사 신청·승인이 막고,
이름 잠금도 걸리지 않는다(설정한 적 없는 값을 잠그는 것은 잠금이 아니라 사고다).

### 개설자 계정은 운영자만 되돌릴 수 있다

`funding_creators`에 쓰는 경로는 세 개다 — 가입(`lib/funding/creatorToken.ts`), 개설자 본인
저장(`saveCreatorSection`), 그리고 운영자(`lib/funding/creatorAccountDecision.ts`). 앞의 둘만
있던 동안 두 자리가 막다른 길이었다: 잘못 저장된 이름이 승인되면 본인 잠금이 영구히
거부하는데 그 이름은 공개 상세에 판매자 표시와 함께 박히고, 개설자가 자기 이메일 접근을
잃으면 매직링크가 유일한 인증이라 로그인 수단 자체가 사라진다.

운영자 경로는 관리자 심사 상세(`pages/admin/funding/projects/[id].tsx`)에 붙어 있다.
**개설자 본인의 이름 잠금은 그대로 둔다** — 축이 다르다. 알아 둘 것 셋:

- **이름을 바꾸면 그 개설자의 승인된 프로젝트를 전부 재검증해야 한다.** 지금 보고 있는
  하나만 하면 나머지는 최대 60초 동안 옛 이름을 보여 준다. 판정 모듈이 대상 slug를
  전부 돌려주고 라우트가 `revalidateFundingPaths`를 그 수만큼 부른다.
- **이메일 변경은 그 개설자의 로그인 토큰을 전부 지운다.** 토큰 DELETE는 이메일
  UPDATE와 같은 배치에 있고 `updated_at = epoch` EXISTS를 요구한다 — 경합으로 UPDATE가
  0행일 때 토큰만 죽는 상태를 막는다.
- **이미 발급된 `creator_session` 쿠키는 서버가 끊을 수 없다**(iron-session, 최대 7일).
  이메일을 바꿔도 로그인된 브라우저는 그동안 그대로 들어온다. 관리자 화면에 적혀 있다.

**변경 사유는 어느 컬럼에도 저장되지 않는다.** 메일 본문과 서버 로그가 유일한 기록이다 —
새 컬럼 없이 넣은 기능이라 그렇고, 분쟁 시 로그 보존 기간 밖이면 증거가 없다. `reviewNote`는
프로젝트 단위 심사 메모라 여기에 쓰지 않는다.

### 개설자에게 가는 메일이 실패하면 운영자가 알아야 한다

`/api/funding/creator/login`의 응답은 **언제나 같다**(200, "로그인 링크를 보냈습니다").
다르게 답하면 그 화면이 누가 개설자인지 알려 주는 조회기가 된다. 그래서 발송 실패를
화면으로 알릴 수 없고, 대신 운영자에게 메일이 간다(`sendCreatorLoginMailFailureAlert`).

알림도 레이트리밋을 탄다 — 키는 `creator_login:mail_failure_alert`이고 전역 캡 알림
(`creator_login:global_alert`)과 **반드시 달라야 한다.** 같으면 한쪽이 다른 쪽 예산을 먹어
둘 중 하나가 조용해진다.

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

### 토스 연동 키는 **위젯 키**다 — `payment()` 결제창 API를 쓸 수 없다

`NEXT_PUBLIC_TOSS_CLIENT_KEY`는 `live_gck_`, `TOSS_SECRET_KEY`는 `live_gsk_`로 시작하는
**결제위젯 연동 키 쌍**이다. v2 SDK는 두 갈래인데 이 키로는 한쪽만 된다.

| 갈래 | 요구하는 키 | 우리 상태 |
|---|---|---|
| `toss.widgets()` + `renderPaymentMethods` | 위젯 키(`gck`) | **이걸 쓴다** |
| `toss.payment()` + `requestPayment` | API 개별 연동 키(`ck`) | 못 쓴다 |

SDK가 `payment()` 경로에서 `isAPIIndividualKey()`를 단언하고, 아니면
`NotSupportedWidgetKeyError("결제위젯 연동키는 지원하지 않습니다.")`를 던진다. 예외는
SDK에 하드코딩된 위젯 키 2개뿐이고 우리 키는 거기 없다.

**API가 통과하는 것과 SDK가 통과시키는 것은 다르다.** 결제창 개설 API
(`px-payment-parameters`)는 위젯 키로도 토큰을 내준다 — 그래서 API로만 확인하면
"된다"는 잘못된 결론이 나온다(2026-09-15에 실제로 그렇게 배포했다가 되돌렸다).
판정은 반드시 **브라우저에서 `toss.payment()`를 실제로 불러** 할 것.

**우리 수단 목록을 따로 들지 않는다.** 펀딩 폼은 위젯을 신청 폼 **안에** 띄우고
(`useTossPaymentWidgets`), 제출 한 번에 주문 생성 → `requestPayment`로 간다. 수단은 위젯이
계약·노출 설정대로 그리므로 토스 쪽에서 늘거나 줄면 그대로 따라간다. 수단을 우리 코드에
나열하면 두 목록이 갈라지고, 그때 화면과 실제가 어긋난다.

정말로 폼에서 직접 고르게 해야 한다면 토스에서 **API 개별 연동 키**를 새로 발급받아야 하고,
그러면 `TOSS_SECRET_KEY`도 그 쌍의 `live_sk_`로 함께 바꿔야 한다 — 승인·조회·취소가 전부
같은 쌍이어야 한다. 한쪽만 바꾸면 결제창은 열리는데 승인이 실패한다.

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

### 암호화 필드 — 키를 잃으면 값도 잃는다

이 저장소에 DB 필드 단위 암호화가 생겼다(`lib/crypto/fieldCrypto.ts`, AES-256-GCM).
지금 쓰는 곳은 `funding_creators.resident_number_enc`(원천징수 대상 개설자의 주민등록번호)
하나다 — 주민등록번호는 저장 시 암호화가 법적 의무라 예외가 없다.

- **새로 쓰는 저장 형식은 `v2:<keyId>:<iv_b64>:<tag_b64>:<ct_b64>` 한 문자열.**
  읽기는 `v1:<iv_b64>:<tag_b64>:<ct_b64>`도 받는다 — 운영 DB에 이미 그 값이 있고, 영구히
  읽혀야 한다. 판본 접두사는 장식이 아니라 알고리즘·키를 바꿀 때 **옛 값을 구분할 유일한
  수단**이다. IV는 레코드마다 새로 뽑는다(GCM에서 같은 키로 IV를 재사용하면 기밀성과 인증이
  함께 무너진다).
- **`keyId`는 키에서 결정적으로 유도한 hex 8자**(`sha256("studionol:field-key-id:v2" ‖ key)`의
  앞 4바이트). 32바이트 다이제스트 중 4바이트만 남기므로 **키를 지목하지 못한다** — 같은
  keyId를 내는 키가 2^224가량 존재한다. 그래서 키 검증 수단으로 쓰지 않는다(실제 판정은
  언제나 GCM 인증 태그가 한다). 도메인 문자열을 섞는 것은 이 값이 다른 곳의 `sha256(key)`와
  같아지지 않게 하려는 것이다.
- **`keyId` 덕분에 `key_mismatch`와 `auth_failed`가 갈린다.** v1에서는 "키가 바뀌었다"와
  "값이 손상됐다"가 둘 다 `auth_failed`였다 — GCM은 두 경우를 같은 방식으로 실패한다.
  회전 중에는 그 구분이 반드시 필요하다(어느 행이 아직 옛 키인지 알아야 이어서 돌린다).
  v1 값은 keyId가 없으니 예전 그대로 `auth_failed`다.
- **키는 env `FUNDING_FIELD_KEY`(base64 32바이트)이고 호출 시점에 읽는다.** 모듈 최상위에서
  읽으면 키 없는 환경에서 import만으로 빌드가 깨진다(`TURSO_*` 없이 빌드가 되어야 한다는
  규칙과 같은 이유). 키가 없거나 길이가 틀리면 암호화 함수는 **던진다** — 조용히 평문을
  저장하는 경로는 없어야 한다.
- ⚠ **키를 잃으면 저장된 값은 영영 복호화되지 않는다.** 백업도 우회로도 없다. 복구 수단은
  개설자에게 다시 입력을 요청하는 것 하나뿐이다. 값이 이미 저장된 뒤에 키를 새로 만드는 것은
  그 값을 버리는 것과 같다 — 복호화가 전부 실패하면 먼저 **옛 키를 되찾을 수 있는지**부터 본다.
- **평문을 로그·화면 props·메일에 넣지 않는다.** Pages Router는 props를 `__NEXT_DATA__`로
  페이지 HTML에 싣는다. **암호문도 담지 않는다** — 암호문이 나가면 키가 유일한 방어가 된다.
  화면이 아는 것은 등록 여부(`residentNumberRegistered`)뿐이고, 복호화 조회는 운영자가 버튼을
  누른 그 순간의 응답으로만 나간다(`pages/api/admin/funding/projects/[id]/resident-number.ts`).
  조회 사실은 서버 로그에 남기되 값은 적지 않는다. `console.log`로 찍어 보고 지우는 것도
  하지 마라 — 지우는 걸 잊으면 그대로 배포된다.
- 키가 빠진 배포는 **DB에 흔적을 남기지 않는다.** 개설자가 번호를 실제로 입력한 저장만 계좌까지
  통째로 거부되고(칸을 비운 채 계좌만 고치는 저장은 키 없이도 된다), **이미 번호를 등록한 개설자의
  정산 기록이 전부 `resident_number_unreadable`로 막힌다** — 번호가 아예 없을 때의
  `no_resident_number`와 다른 코드다. 그런데 개설자가 연락해 줄 때까지 아무도 모른다. 그래서 매일 크론 운영 점검이 키를 왕복으로 찔러 본다
  (`checkFieldCryptoKey`, `lib/ops/healthCheck.ts`) — 보고하는 것은 "설정됨 / 없음 / 형식 이상"뿐이고
  키 값도 암호문도 메일에 싣지 않는다.
- **마이그레이션 0023을 먼저 적용하지 않으면 개설자 로그인까지 깨진다.** `funding_creators`를
  컬럼 지정 없이 `select()`로 읽는 경로가 여럿이고(`lib/funding/creatorToken.ts`의 로그인 링크
  검증, `creatorProjectWrite.ts`의 계정 조회), 그 쿼리는 새 컬럼까지 함께 요구한다. 코드가
  먼저 배포되면 정산 화면만이 아니라 **로그인부터** 실패한다. 적용 순서는 마이그레이션 → 배포다
  (0020 절과 같은 규칙).

#### 키 회전 절차 — 순서가 틀리면 데이터를 잃는다

키를 바꾸는 수단은 `scripts/rotate-field-key.mjs` 하나다(엔진은 `lib/crypto/fieldKeyRotation.ts`).
**옛 키와 새 키가 동시에 살아 있는 구간**이 반드시 있어야 하고, 그 구간을 건너뛰면 값을 잃는다.

| env | 담는 것 | 언제 |
|---|---|---|
| `FUNDING_FIELD_KEY` | **새 키** | 처음부터 끝까지. 회전이 끝나면 이 값 하나만 남는다 |
| `FUNDING_FIELD_KEY_OLD` | 옛 키 | 회전이 **끝난 뒤에** 지운다 |

스크립트는 `TURSO_DATABASE_URL`·`TURSO_AUTH_TOKEN`도 요구한다 — 운영 DB를 직접 고치기 때문이다.

1. **새 키를 만든다** — `openssl rand -base64 32`. 아직 아무 데도 넣지 않는다.
2. **지금 쓰는 키를 `FUNDING_FIELD_KEY_OLD`로 복사해 둔다**(Vercel env와 로컬 `.env.local` 양쪽).
   `FUNDING_FIELD_KEY`는 아직 옛 키 그대로다 — 이 시점에 두 변수가 같은 값이다.
3. **`FUNDING_FIELD_KEY`를 새 키로 바꾸고 배포한다.** 이때부터 **새로 저장되는 값은 새 키**로
   잠기고(형식 v2), 이미 저장된 옛 값은 조회에서 `key_mismatch`로 막힌다 — **값은 멀쩡하다.**
   막히는 구간을 짧게 하려면 4·5를 바로 이어서 한다.
4. **dry-run으로 개수를 먼저 본다.** 쓰지 않는다.
   ```bash
   node --env-file=.env.local node_modules/.bin/tsx scripts/rotate-field-key.mjs
   ```
   `회전 예정 n · 건너뜀 n · 실패 n`이 나온다. 실패가 0이 아니면 그 id와 코드를 먼저 본다.
5. **같은 명령에 `--apply`를 붙여 실제로 돌린다.** 실패한 행이 있어도 멈추지 않고 끝까지 돈 뒤
   요약을 낸다. **다시 돌려도 안전하다** — 이미 새 키인 행은 건너뛴다.
6. **끝났는지 두 가지로 확인한다. `실패 0`은 증거가 아니다** — 한 건도 안 돈 경우에도 그렇게
   나오고, 무엇보다 **스크립트가 쓴 키가 프로덕션이 실제로 쓰는 키인지는 아무도 대조하지
   않는다**(로컬 `.env.local`과 Vercel env가 갈려 있으면 로컬만 맞고 끝난다).
   1. dry-run을 한 번 더 돌려 `회전 예정 0`이고 **`건너뜀`이 4번에서 본 대상 수와 같은 수**인지 본다.
   2. **프로덕션 관리자 화면에서 실제로 한 건을 열어 본다.** 로컬 env와 Vercel env가 갈린 경우는
      이것만 잡는다.
7. **그때서야 `FUNDING_FIELD_KEY_OLD`를 지운다.** 6이 끝나기 전에 지우면
   아직 옛 키로 잠긴 값을 열 수단이 사라진다 — 복구 경로는 개설자에게 재등록을 요청하는 것뿐이다.

⚠ **`FUNDING_FIELD_KEY`를 새 키로 바꾸기 전에 옛 키를 어디에도 남기지 않은 채 덮어쓰지 마라.**
2번이 그 사고를 막는 유일한 단계다. 그리고 **실패 목록에 남은 행의 값을 지우거나 덮어쓰지 마라** —
`key_mismatch`는 값이 멀쩡하고 키만 다르다는 뜻이다.

⚠ **두 키가 같으면 스크립트가 exit 2로 선다.** 같은 키로 돌면 모든 v2 행이 keyId가 맞아
건너뛰어져 `회전 0 · 건너뜀 n · 실패 0`이 나오는데, 그게 **회전이 끝난 상태와 글자 하나 다르지
않다.** 이 상태는 3번에서 Vercel env만 바꾸고 로컬 `.env.local`이 옛 키 그대로일 때 생긴다
(이 저장소는 `vercel env pull`·blob 명령이 `.env.local`을 통째로 덮어쓴 사고 이력이 있다).
판본 v1 값을 같은 키로 v2에 올리는 정당한 용법은 `--same-key`로만 연다 — **회전에는 쓰지 마라.**

⚠ **이 배포를 되돌리면 v2 값이 옛 배포에서 `malformed`로 읽힌다.** 옛 `parseStored`는 조각 수를
먼저 보므로 5조각을 "판본을 모른다"가 아니라 "형식이 아니다"로 분류하고, 그 화면 문구는
"개설자에게 주민등록번호를 다시 등록해 달라고 요청해 주세요"다. **그 안내를 따르지 마라 —
값은 멀쩡하다.** 롤백이 사고의 첫 대응이라 이 자리가 가장 위험하다.

**옛 키도 새 키도 아닌 키로 잠긴 행**(`code=key_mismatch`)이 남으면 5번은 영원히 exit 1이라
6번 조건이 성립하지 않는다. 그 행은 이 회전으로는 못 여는 값이다 — **옛 키는 오프라인으로
보관하고**(지우지 않는다) 해당 개설자에게 재등록을 요청한 뒤, 그 행을 뺀 나머지가 전부
건너뜀인 것을 확인하고 7번으로 간다.

**배포 중에 새 저장이 끼어들어도 안전한 이유**는 둘이다.
- **v2의 keyId.** 3번 배포 뒤에 개설자가 번호를 저장하면 그 값은 이미 새 키로 잠긴다.
  회전 스크립트는 keyId를 보고 그 행을 **복호화조차 하지 않고 건너뛴다** — 옛 키로 열려고
  시도해 실패하는 일이 없다.
- **낙관적 잠금.** 스크립트가 행을 읽은 **뒤에** 개설자가 그 행을 다시 저장하면, UPDATE의
  WHERE(`값 = 읽은 그 암호문`)가 0행을 맞춰 쓰지 않고 `code=changed`로 남긴다. 덮어썼다면
  방금 입력한 번호가 옛 번호로 조용히 되돌아갔을 것이다. 다시 돌리면 그 행은 건너뛴다.

**암호화 필드가 늘면 `ENCRYPTED_FIELD_TARGETS`(`lib/crypto/fieldKeyRotation.ts`)에 한 줄을
더한다.** 목록에 없는 컬럼은 회전되지 않고, 그 사실은 옛 키를 지운 뒤에야 드러난다.

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
  금액 90~140개 중 13~21종이 상수 밖인데 전부 정상이다 — 증분(정규 "12곡 +400만원"),
  환산(레슨 "회당 87,500원"), 외부 시세. 상수를 그대로 말해야 하는 키만 지정해 본다.
- 카피에 새 가격을 넣을 땐 리터럴 대신 `formatPriceLabel`로 상수에서 끌어온다.

### 발매 티어 하한 = 통합 번들 가격 (한쪽만 고치지 말 것)

`RELEASE_{SINGLE,EP,ALBUM}_FROM_PRICE`와 `{SINGLE,EP,ALBUM}_BUNDLE_PRICE`가 같은
값인 것은 우연이 아니라 **의도**다. 통합 번들이 발매 프로젝트의 **고정 구성 엔트리**이고,
발매 티어는 거기서 세션 편성·편곡 확장·PR 라운드를 올려 견적하는 같은 상품군이다.
한쪽을 바꾸면 다른 쪽도 함께 움직여야 하며, 위 가드가 그걸 강제한다.

세 번들 모두 **기획 · 녹음 · 믹싱 · 마스터링 · 디지털 유통 등록 · 발매 홍보**를 포함한다.
홍보는 보도자료 작성과 국내 음악 기자·평론가 + 해외 매체·라디오·플레이리스트 피칭까지다.
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

### 로컬 프로덕션 빌드로 화면을 확인하려면 VERCEL_ENV가 필요하다

`npx next start`만 하면 미들웨어의 canonical host 강제가 걸려 studionol.co.kr로 **308**
한다. 그대로 스크린샷을 찍으면 내 코드가 아니라 프로덕션을 보게 된다(2026-09-21에 한참
헤맸다 — 화면이 안 바뀌는 것이 아니라 다른 사이트를 보고 있었다).

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

## Architecture & Data Flow

### Image Optimization System
The project uses a custom optimization script `scripts/optimizeImages.js`:
1. **Source**: Original images in `public/images/`
2. **Process**: Converts JPG/PNG to WebP and AVIF (using Sharp)
3. **Artifacts**: Generates `utils/imageMetadata.json` for dimension hints
4. **Usage**: Use optimized formats (.webp/.avif) in content for better performance

### Contact Form Logic
- **Client**: `pages/[locale]/contact.tsx` captures user input
- **Server**: `pages/api/contact/send-email.ts` (API route)
- **Validation**: Honeypot and Rate Limiting implemented on server-side
- **Delivery**: Server-side request to Resend REST API (`lib/email/resend.ts`)

### Routing & i18n
- **Path structure**: `/[locale]/[path]`
- **Locale management**: `lib/i18n.ts` and `utils/localeUtils.ts`
- **Dynamic Routes**: Stories are loaded from `content/stories/` based on slug and locale

## Important Files & Directories

- `pages/[locale]/` - Localized page components
- `pages/api/` - Backend API routes (Serverless functions)
- `components/` - Reusable UI components
- `content/stories/` - Markdown files for studio news and stories
- `lib/i18n.ts` - Internationalization configuration
- `tailwind.config.ts` - Design system (colors, typography)
- `next.config.mjs` - Next.js configuration

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
  .glass-card는 blur 무비용이라 안전). 스펙큘러 포인터 하이라이트(.glass-card::after,
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
  어두운 히어로 사진 위에서 채도 높은 보라가 옐로와 경쟁해 위계가 뒤집힌다.
  2차는 `bg-black/30 + border-white/40 + text-shadow` 스크림 아웃라인
  (홈 히어로·ReleaseHeroCtas 공통). 흰 틴트(`bg-white/*`)는 배경을 밝혀
  흰 글씨 대비를 오히려 떨어뜨리므로 쓰지 않는다(HeaderActions와 동일 판단).
- 적용: HeaderActions, KakaoFab, 홈·pricing 히어로, HeroKakaoCta(onImage/onSurface 공통),
  ContactCTA, ReleaseHeroCtas, PricingCard, StickyBottomCTA, Inline{Booking,Price,Service}Callout,
  {Korean,English}FastContactActions, ContactFormCard, ContactFormErrorFallback,
  서비스 페이지(recording·lesson·voice-acting·wedding-song·cover-video) 섹션 CTA
- **헤더 CTA는 투명 상태에서도 옐로**(`kakaoCtaButtonClass`). 솔리드 옐로는 배경 사진
  밝기와 무관하게 `kakao-ink` 대비가 16:1로 고정되므로, 밝은 히어로에서 흰 글씨가
  흐려지던 스크림 방식보다 안정적이고 text-shadow도 필요 없다. 비-ko는 목적지가
  `/contact` 폼이라 기존 그라디언트/스크림을 그대로 쓴다(`formCtaButtonClass`) —
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
4. **CSV 집계는 `#` 앵커 행 제외 + `/ko/` 정본 필터.** 앵커는 목차 점프링크지 별개 페이지가 아니고
   (노출 ~13% 부풀림), slug로 키잡으면 uz/en 행이 ko 행을 덮어쓴다(mixing19가 9clk→0clk로 뒤집힌 적 있음).
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
아니다** — 실제로 `701233f0ac`에서 15.5.12 → 15.5.18로 올린 전례가 있다.

- 패치 상승(15.5.x → 15.5.y): 보안 권고가 있으면 올린다. 검증은
  `type-check` → `lint` → `test` → `build` → `middleware.test.ts` 순.
  **미들웨어에 `NextURL.pathname` setter 버그 워크어라운드가 있으므로**
  (`middleware.ts:207`, `701233f0ac`) 업그레이드 후 반드시 `middleware.test.ts`를 확인할 것.
- minor·major 상승: PSI 실측 없이 올리지 않는다(`optimizeCss`·Partytown 회귀 이력 참조).

`npm audit`에 남아 있는 항목과 남겨둔 이유:

| 패키지 | 경로 | 왜 안 올렸나 |
|---|---|---|
| `sharp` <0.35.0 | next 내부 + @vercel/og 내부 | 직접 의존은 0.35.3으로 올림(2026-08-24, libvips CVE 4건 해소 — `scripts/optimizeImages.js` 회귀 검증: WebP 표본 8개 파일 크기 델타 0.0%, 해상도·`imageMetadata.json` 불변). next(`^0.34.3` 고정, 15.5.x 라인 유지 중)와 `@vercel/og@0.11.1`이 각자 옛 sharp를 물고 있어 audit엔 여전히 뜬다 — 둘 다 major 업 없인 못 바꾼다(`@vercel/og@1.0.1`은 sharp를 아예 뺐지만 별도 업그레이드 필요, 이번 범위 밖). next 경유는 이미지 최적화 API 라우트에서만, @vercel/og 경유는 OG 이미지 생성에서만 타서 우리 직접 파이프라인과 무관 |
| `postcss` 8.4.31 | next 내부 번들 | 우리 직접 의존은 8.5.26으로 올림. next 번들본은 major 업 없이는 못 바꾼다. 빌드타임 CSS만 처리하고 입력이 우리 소스라 실위험 낮음 |
| `js-yaml` 3.x | gray-matter | frontmatter 파싱. 입력이 우리 저장소의 .md라 외부 입력 없음 |
| `ip-address` | puppeteer-core → socks-proxy-agent | 계약 PDF 렌더용. 프록시 경로를 쓰지 않음 |
| `undici` 6.27 | @vercel/blob | 업스트림이 올려야 함 |

## Deployment Notes

- **Hosting**: Vercel (Standard Next.js deployment)
- **Environment Variables**: Configure `RESEND_API_KEY` (and optional `RESEND_FROM`) in Vercel dashboard
- **Build**: Prebuild hook runs image optimization automatically