# 펀딩 셀프 개설 — 아티스트가 직접 신청·등록하는 흐름 설계

작성 2026-09-17. 상태: **설계안 — 운영자 확인 대기**(§2의 결정 항목).
전제 문서: [2026-09-08-funding-design.md](2026-09-08-funding-design.md)(이하 "펀딩 1차"),
[2026-09-08-artist-support-design.md](2026-09-08-artist-support-design.md)(이하 "아티스트 구독").

## 1. 배경과 목표

펀딩 1차는 "개설 주체 = 운영자가 저장소 파일로 등록"이었고 크리에이터 셀프 개설·심사·정산은
범위 밖(§14)이었다. 이제 텀블벅처럼 **아티스트가 스스로 신청하고 프로젝트 내용을 등록**하게
한다. 텀블벅의 흐름을 그대로 옮기되 우리 규모에 맞게 줄인다.

| 텀블벅 | 이 설계 |
|---|---|
| 회원가입 → 프로젝트 만들기 | 이메일 매직링크로 개설자 세션 발급, 계정·비밀번호 없음 |
| 기본정보·스토리·리워드·창작자 정보 탭 | 같은 4구획의 편집 화면 하나 |
| 심사 신청 → 승인/반려(보완 요청) | 같음. 운영자가 관리자 화면에서 판정 |
| 공개 후 스토리 수정 가능, 리워드·목표는 잠김 | 같음 |
| 크리에이터 정산 | 아티스트 구독의 정산 계산기를 재사용(수수료율은 §2 결정) |

바뀌지 않는 것: **판매자(자금 수취·통신판매업자)는 계속 스튜디오 놀**이다. 후원자의 결제·환불·
약관·관리 링크·관리자 화면은 지금 그대로다. 아티스트는 "프로젝트 개설자"이고 리워드의
공급자이며, 모금액은 스튜디오 놀이 받아 정산으로 지급한다. 이 구조라 개설자 본인확인·
사업자 검증 없이도 열 수 있다(전자계약 감사 결론과 같은 판단: 휴대폰 본인인증은 도입하지 않는다).

목표:

1. 아티스트가 운영자 손을 거치지 않고 프로젝트를 작성·제출한다.
2. 운영자는 심사·승인·정산만 한다. 파일 편집·커밋·배포가 프로젝트 개설 경로에서 사라진다.
3. 후원자 쪽 경험과 데이터 무결성 게이트(리워드 id·단가 불변, 재고 집계)는 그대로 유지한다.

## 2. 운영자가 정해야 하는 것 (코드 밖)

설계는 아래를 가정하고 진행한다. 다르면 여기만 고치면 된다.

| # | 항목 | 이 문서의 가정 | 왜 물어보는가 |
|---|---|---|---|
| D1 | **플랫폼 수수료** | 모금액(VAT 제외)의 **10%** — 기존 "펀딩 설계 대행"의 성공 수수료와 같은 숫자 | 텀블벅 5%+PG 3%대. 우리는 PG 수수료(3.4%)를 스튜디오 몫에서 낸다. 셀프 개설이 "설계 대행 없는 10%"가 맞는지, 아니면 아티스트 구독처럼 90/10인지 |
| D2 | **정산 시점** | 종료일 + 7일(청약철회 기간) 뒤, 환불 확정분을 뺀 1회 정산. 배송 완료를 정산 조건으로 걸지 않는다 | 배송 리워드는 아티스트가 보내므로, 미발송 리스크를 누가 지는지 |
| D3 | **배송 주체와 후원자 개인정보** | 물리 리워드는 **아티스트가 발송**한다. 배송지는 정산 계약에 "개인정보 처리위탁"을 넣고, 운영자가 관리자 CSV로 넘긴다(1차). 개설자 화면에서 직접 내려받기는 2차 | 개설자에게 주소를 보이려면 후원자 약관에 제3자 제공 조항이 들어가야 하고 `FUNDING_TERMS_VERSION`이 오른다 |
| D4 | **개설 자격** | 누구나 신청 가능, 심사에서 거른다. 스튜디오 놀 제작 음반이 아니어도 된다 | 1차 스펙 §1은 "제작한 음반의 펀딩"이었다. 개방하면 llms.txt·홈 OfferCatalog 문구가 바뀐다 |
| D5 | **기존 md 프로젝트 처리** | 진행 중인 `keep-singing-for-palestine`(~10/19)은 md로 두고, 새 프로젝트만 DB. 10/19 이후 md 경로를 걷어내고 그 프로젝트는 DB로 옮긴다 | 진행 중 캠페인의 저장소를 바꾸지 않기 위해 한시적으로 두 경로가 공존한다 |
| D6 | **디지털 리워드 파일** | 1차는 운영자가 R2에 올리고 관리자 화면에서 키를 넣는다. 아티스트 직접 업로드(수 GB, presigned multipart)는 2차 | 업로드 인프라가 1차 범위를 두 배로 키운다 |

## 3. 접근 비교와 선택

**A. 프로젝트를 DB로 옮긴다(선택).** `funding_projects`·`funding_rewards` 테이블이 정본,
공개 페이지는 정적 생성 대신 DB를 읽는다. 아티스트 편집·운영자 심사·공개가 한 저장소 안에서
돈다. 이미지는 Vercel Blob(무작위 접미사 URL이라 `immutable` 캐시 문제가 원천적으로 없다).
리워드 불변식은 파일 기준선 대신 **서비스 계층 + 통합 테스트**로 옮긴다.

**B. 신청은 DB, 발행은 md 파일로 내보낸다.** 아티스트가 DB에 초안을 쓰고, 승인 시 운영자가
스크립트로 md·이미지를 생성해 커밋·배포한다. 렌더 경로와 세 기준선 게이트를 전혀 안 건드린다.
하지만 (1) 공개 뒤 스토리 수정·새소식마다 운영자 커밋이 필요해 "셀프"가 아니고, (2) 기준선
`--update`를 자동화하면 그 게이트가 막으려던 것을 자동으로 통과시키게 되며, (3) DB 초안과 md가
갈라진 뒤 어느 쪽이 정본인지 흐려진다. 텀블벅 흐름의 절반만 된다.

**C. GitHub API로 봇이 md를 커밋한다.** B의 자동화판. 편집 한 번이 프로덕션 빌드 한 번이고
(푸시 규칙이 막으려는 바로 그 상태), 실패 지점이 git·CI·Vercel 세 군데로 는다. 기각.

A를 고른 이유는 "이미 있는 것으로 왜 안 되는가"에 대한 답이 분명해서다 — 파일 정본은
**편집자가 운영자 한 명**이라는 전제 위에 세운 설계이고, 그 전제가 이번 요청으로 바뀐다.

## 4. 데이터 모델 (`db/schema.ts`, 마이그레이션 0017)

### 4.1 `funding_creators` — 개설자

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text PK (hex randomblob) | 기존 테이블 관례 |
| email | text unique, 소문자 정규화 | 로그인 식별자 |
| name | text | 아티스트·팀 이름(공개) |
| contactName / phone | text | 운영자 연락용(비공개) |
| taxType | `'withholding' \| 'invoice' \| null` | 정산 시 세금 처리. `data/artists`와 같은 두 값. 심사 승인 전엔 null 허용 |
| payoutBankName / payoutAccount / payoutHolder | text null | 정산 계좌. 승인 후 개설자가 입력 |
| createdAt / updatedAt / lastLoginAt | integer(ms) | |

### 4.2 `funding_creator_tokens` — 매직링크

| 컬럼 | 비고 |
|---|---|
| tokenHash text PK | sha256(원문). 원문은 메일에만 실린다 |
| creatorId FK | |
| purpose | `'login'` 하나. 확장 여지만 둔다 |
| expiresAt / usedAt | 15분, 1회용 |

### 4.3 `funding_projects` — 프로젝트

md frontmatter와 **같은 필드명**을 쓴다. 후원·상태·관리자 코드가 `FundingProject` 타입 하나를
계속 쓰게 하기 위해서다.

| 컬럼 | 비고 |
|---|---|
| id text PK | |
| slug text unique | 승인 시 확정. 확정 뒤 변경 불가(후원 행이 문자열로 참조). `content/funding/*.md`와 충돌 금지 |
| creatorId FK | |
| title / summary / content(markdown) | |
| coverUrl / ogImageUrl / heroImageUrl | Blob URL. `cover`·`ogImage`·`heroImage`로 매핑 |
| goalAmount / startAt / endAt | endAt > startAt |
| reviewStatus | `draft \| submitted \| changes_requested \| approved \| rejected` |
| status | `auto \| draft \| closed` — 기존 공개 상태 필드. 승인 전엔 항상 `draft` |
| hidden | 기존과 같음 |
| reviewNote | 운영자 → 개설자 메시지(보완 요청·반려 사유) |
| submittedAt / approvedAt / rejectedAt | |
| creatorTermsVersion / creatorTermsAgreedAt | 개설자 약관 판본 |
| lastmod | 사이트맵용. 공개 필드가 바뀔 때 갱신 |
| createdAt / updatedAt | |

### 4.4 `funding_rewards` — 리워드

| 컬럼 | 비고 |
|---|---|
| projectId FK + rewardId text | 복합 PK. `rewardId`가 md의 `rewards[].id` 역할(후원 행의 `reward_id`) |
| title / description / amount / totalQuantity / requiresShipping / estimatedDelivery / imageUrl | |
| sortOrder | |
| downloads json | `[{label, key}]`. 1차는 운영자만 편집(D6) |
| lockedAt | 승인 시각. **null이 아니면 `rewardId`·`amount`·`totalQuantity`의 유무를 바꿀 수 없다.** 행 삭제도 불가. 가격을 바꾸려면 새 행을 추가한다 |

### 4.5 `funding_project_payouts` — 정산 (아티스트 구독 `artist_payouts`와 같은 꼴)

projectId unique(프로젝트당 1회), gross/refund/supply/fee/share/withholding/net, recordedAt,
paidAt, memo. 계산은 `computeArtistPayout`를 수수료율만 바꿔 재사용한다(§8).

### 4.6 후원 테이블

`funding_pledges`는 **변경 없음**. `project_slug`·`reward_id` 문자열 결합이 그대로 DB 프로젝트에도
맞물린다. 이것이 md와 필드명을 맞춘 이유다.

## 5. 정본 로더 — `lib/funding/repository.ts`

지금 `getFundingProject(slug)`는 동기 fs 호출이고 호출처가 14곳이다. 전부 비동기로 바꾼다.

```ts
export const getFundingProjectAsync = async (slug: string): Promise<FundingProject | null>;
export const getListableFundingProjectsAsync = async (now?: Date): Promise<FundingProject[]>;
export const getAllFundingProjectsAsync = async (): Promise<FundingProject[]>;
```

- 조회 순서: md 파일 → DB. md가 있으면 그것을 쓰고 DB는 보지 않는다(D5 공존 기간).
  DB 행은 `reviewStatus = approved`인 것만 `FundingProject`로 변환한다. 그 외는 공개 경로에서
  존재하지 않는 프로젝트다(404).
- DB 행 → `FundingProject` 변환은 `parseFundingProject`와 **같은 검증 함수**를 탄다
  (`validateFundingProjectShape`로 추출). 심사 승인 API도 이 함수를 통과해야 승인된다 — md에서
  파서가 하던 엄격 검증을 DB 경로에서도 잃지 않는다.
- md 로더의 동기 함수는 `content/funding.baseline.test.ts`·사이트맵 스크립트가 계속 쓴다.
  10/19 이후 D5에 따라 md 경로를 걷어낼 때 함께 정리한다.

공개 페이지의 렌더 방식이 바뀐다:

| 페이지 | 지금 | 뒤 |
|---|---|---|
| `/ko/funding` 목록 | SSG | ISR `revalidate: 60` |
| `/ko/funding/[slug]` 상세 | SSG(`fallback: false`) | ISR `revalidate: 60`, `fallback: 'blocking'`. 승인·스토리 수정 시 `res.revalidate()` 온디맨드 |
| pledge · manage · success | SSR | 그대로, 로더만 비동기 |
| `/api/funding/[slug]/status`, `pledges`, `download` | 동기 로더 | 비동기 로더 |
| `pages/api/llms.ts` | md만 | md + DB(런타임이라 그냥 비동기 로더) |
| 사이트맵 | postbuild `next-sitemap`이 md를 읽어 정적 생성 | 빌드는 DB에 접근하지 않는다(다른 정적 페이지도 그렇다). DB 프로젝트는 동적 라우트 `pages/sitemap-funding.xml.ts`(`s-maxage=600`)로 내보내고, `next-sitemap.config.js`의 `additionalSitemaps`로 인덱스에 싣는다. `normalize-sitemap-hreflang.js`의 "sitemap 0개" 게이트는 정적 파일 기준이라 영향 없음 |

상세 페이지가 공개 화면에 **개설자**를 표시한다: "개설자 {creator.name} · 판매자 스튜디오 놀
(통신판매업 신고 {번호})". 판매자·개설자를 구분해 보여주는 것이 전자상거래법상 필요하고
텀블벅도 같은 구조다.

## 6. 개설자 흐름 (전부 `/ko/` 전용, 비-ko 내비에 넣지 않는다)

### 6.1 인증 — 매직링크 + 개설자 세션

- `POST /api/funding/creator/login` `{ email }` → 개설자 행이 없으면 만들고, 토큰(32바이트)을
  발급해 sha256만 저장, 원문을 `/ko/funding/creator/auth?token=`로 메일. 응답은 존재 여부와
  무관하게 200("메일을 보냈습니다"). IP·이메일당 분당 3회(`lib/rate-limit/redisRest` 재사용).
- `GET /ko/funding/creator/auth?token=` → 검증·소진 → iron-session 쿠키 `creator_session`
  (httpOnly, sameSite=lax — 메일 링크에서 넘어오므로 strict 불가, 7일). 비밀은 새 env
  `CREATOR_SESSION_SECRET`(관리자와 분리해야 한쪽 유출이 다른 쪽을 열지 않는다).
- `lib/funding/creator-auth.ts`: `authenticateCreatorRequest(ctx)` / `authenticateCreatorApi(req)`
  — 관리자 인증과 같은 모양. 프로젝트 접근은 항상 `creatorId` 소유 조건을 쿼리에 넣는다.

### 6.2 페이지

| 경로 | 역할 |
|---|---|
| `/ko/funding/apply` | 안내 랜딩: 조건(누가·수수료·정산·심사 기간·판매자 구조), 이메일 입력. 펀딩 목록 하단과 `/ko/funding/terms` 옆에 링크 |
| `/ko/funding/creator` | 내 프로젝트 목록(상태 배지), 새 프로젝트 |
| `/ko/funding/creator/[id]` | 편집 화면. 4구획 탭: 기본정보 · 스토리 · 리워드 · 개설자 정보. 하단 "임시저장" / "심사 신청" |
| `/ko/funding/creator/[id]/preview` | 공개 상세 페이지와 같은 컴포넌트로 미리보기(승인 전 유일한 확인 수단) |
| `/ko/funding/creator/[id]/stats` | 공개 뒤: 모금액·후원 수·리워드별 수량·이름 공개 동의한 후원자 이름. 배송지는 없음(D3) |

편집 화면 구획:

- **기본정보** — 제목, 한 줄 요약, 커버 이미지(업로드), 목표 금액, 시작·종료(종료 ≤ 시작+60일,
  시작 ≥ 오늘+3일: 심사 시간 확보).
- **스토리** — 마크다운 textarea + 미리보기(`MarkdownRenderer`). 이미지 삽입은 업로드 버튼이
  Blob URL을 `![]()`로 넣는다. 본문은 **개설자 콘텐츠 모드**로 렌더: `disableParsingRawHTML`은
  이미 켜져 있고, 추가로 `%%숏코드%%`와 인라인 디렉티브(가격·예약 콜아웃)를 렌더 전에 벗긴다
  (`stripTrustedDirectives`). 스튜디오 상품 카드를 개설자가 자기 글에 박을 수 있으면 안 된다.
- **리워드** — 카드 목록 추가·삭제·정렬. 필드는 §4.4. `rewardId`는 제목에서 자동 생성한
  슬러그(수정 가능, 승인 뒤 잠김). 최소 1개, 리워드 없는 순수 후원 티어 금지 규칙은 안내 문구로
  ("반대급부가 없는 모금은 받지 않습니다").
- **개설자 정보** — 공개 이름, 담당자 이름·연락처, 소개(공개, 짧게), 링크. 세금 처리·정산
  계좌는 **승인 뒤** 이 탭에 나타난다(승인 전엔 안 받는다 — 반려될 신청서에 계좌를 남기지 않는다).
- **심사 신청** — 개설자 약관(§9) 동의 체크 → `submitted`. 필수값 검증은 서버가 `validateFundingProjectShape`로
  한다. 제출 뒤 편집은 잠기고, 운영자가 `changes_requested`로 돌려주면 다시 열린다.

### 6.3 이미지 업로드 — `POST /api/funding/creator/upload`

- 세션 필수, 프로젝트 소유 확인, 프로젝트당 누적 30장·장당 8MB.
- 서버가 sharp로 디코드(그림이 아니면 거부) → 최대 1600px·webp 재인코딩 → `@vercel/blob` `put`
  (`funding/<projectId>/<random>.webp`, `access: 'public'`, `addRandomSuffix: true`). 원본 파일명은
  버린다. OG용은 1200×630으로 한 번 더 만든다(커버 업로드 시).
- 프로젝트 삭제·반려 30일 뒤 Blob 정리는 기존 cron(`/api/cron/*`)에 한 항목 추가.

### 6.4 공개 뒤 편집 권한

| 필드 | 승인 뒤 개설자 | 운영자 |
|---|---|---|
| 스토리·요약·이미지·개설자 소개 | 가능(저장 즉시 반영, `lastmod` 갱신, 온디맨드 revalidate) | 가능 |
| 제목 | 불가 | 가능 |
| 리워드 추가 | 가능(새 행만) | 가능 |
| 리워드 id·금액·한정 여부·삭제 | 불가 | 불가(코드가 막는다. 예외 없음) |
| 목표·기간·slug | 불가 | 기간 연장만 가능 |

"운영자도 불가"인 칸이 이 설계의 핵심이다. md 시절엔 기준선 파일이 CI에서 막았고, 이제는
`lib/funding/project-repo.ts`의 갱신 함수가 `lockedAt`을 보고 거부하며 통합 테스트가 그 거부를
고정한다.

## 7. 운영자 흐름 — 관리자 '펀딩' 구역 확장

`/admin/funding`은 지금 후원(pledge) 목록이다. 상단에 탭을 둔다: **후원** | **프로젝트**.

- `/admin/funding/projects` — 전 프로젝트(md 포함, md는 읽기 전용 표시). 심사 대기가 맨 위.
- `/admin/funding/projects/[id]` — 미리보기 링크, 전 필드 편집(승인 전), 개설자 연락처,
  판정 버튼: **승인**(slug 확정·`lockedAt` 기록·`status=auto`·`approvedAt`·revalidate) /
  **보완 요청**(메시지 필수 → `changes_requested`) / **반려**(메시지 필수). 승인 뒤: 리워드
  `downloads` 편집(D6), 기간 연장, `hidden`·`closed` 전환, 정산 탭(§8).
- 알림(Resend, 기존 `lib/funding/email.ts` 패턴): 제출 → 운영자에게 `[펀딩] 심사 요청 — {제목}`;
  판정 → 개설자에게 결과와 메시지; 공개 시작일 아침 → 개설자에게 "오늘 시작"; 종료 → 개설자에게
  결과 요약과 정산 안내. 대시보드에 "심사 대기 N건" 대기열 카드.

## 8. 정산 — `lib/funding/payout.ts`

아티스트 구독 `computeArtistPayout`를 일반화한다: `computeCreatorPayout({ grossAmount,
refundAmount, taxType, sharePercent })`. 구독은 `ARTIST_SUPPORT_SHARE_PERCENT`(90)를, 펀딩은
새 상수 `FUNDING_CREATOR_SHARE_PERCENT`(D1 가정 90 = 수수료 10%)를 넘긴다. 둘 다
`data/pricing.ts` SSOT 집합에 등록해 가격 드리프트 가드를 탄다.

```
gross    = 프로젝트의 paid 후원 합계(VAT 포함)
refund   = 그 후원들에 대한 환불 합계
supply   = (gross − refund) × 100/110
share    = supply × sharePercent / 100
withhold = taxType=withholding ? share × 3.3% : 0
net      = share − withhold
```

관리자 정산 탭: 종료 + 7일 뒤 활성. "정산 기록"(1회, unique) → 이체 후 "지급 완료". 기록 뒤
환불이 들어오면 표가 경고(아티스트 구독과 같은 UX). 원천징수 대상이면 기존 `withholding-tax`
운영 절차로 넘어간다 — 지급명세서에 필요한 인적 사항은 정산 계약서에서 받는다(§9).

## 9. 약관·법무

1. **개설자 약관** `/ko/funding/creator-terms` — 판매자는 스튜디오 놀이고 개설자는 리워드 공급·
   이행 책임을 진다는 구조, 수수료·정산 시점, 콘텐츠 권리 보증(사진·음원·타인 초상), 금지 콘텐츠,
   반려 재량, 미이행 시 환불 부담. 판본 문자열 `FUNDING_CREATOR_TERMS_VERSION`으로 프로젝트에 기록.
   후원자 약관과 같은 해시 게이트 방식은 쓰지 않는다 — 동의 주체가 개설자 수십 명이고 분쟁
   빈도가 낮다. 판본 문자열 + git 이력이면 충분하다.
2. **후원자 약관·처리방침 개정** — "프로젝트는 제3자 개설자가 운영할 수 있다", 리워드 이행 주체,
   배송을 위한 개인정보 처리위탁(D3). 내용이 바뀌므로 `FUNDING_TERMS_VERSION`을 올리고 해시
   기준선을 절차대로 갱신한다(CLAUDE.md "약관·처리방침을 고치면" 절). **변호사 확인 항목.**
3. **정산 계약** — 승인 시 기존 전자계약 시스템(`lib/contracts`)으로 "펀딩 프로젝트 진행 계약"을
   보낸다: 정산 조건, 개인정보 처리위탁, 원천징수 인적 사항. 1차는 템플릿만 추가하고 발송은
   운영자가 관리자 계약 화면에서 수동으로 한다(자동 발송은 2차).
4. 기부금품법 회피 규칙(반대급부 없는 티어 금지)은 심사 체크리스트에 명시한다.

## 10. 보안·오류 처리

- 매직링크: 토큰은 해시로만 저장, 15분·1회. 로그인 요청 응답은 이메일 존재 여부를 드러내지 않는다.
- 세션: 관리자와 다른 쿠키·다른 비밀. `creatorId` 소유 조건 없는 프로젝트 조회 함수를 개설자 API에
  두지 않는다(함수 시그니처 자체가 `creatorId`를 요구).
- 입력: 제목·요약 길이 제한, 마크다운 100KB, 리워드 20개, 금액 1,000원 단위·1천만원 이하,
  링크는 http(s)만. 저장 전 `validateFundingProjectShape`.
- 콘텐츠: raw HTML 비파싱(기존), 개설자 모드에서 숏코드·디렉티브 제거, `MarkdownRenderer`의
  안전 링크 검증 그대로. 이미지는 재인코딩만 저장(EXIF·스크립트 제거 효과).
- 상태 전이는 `lib/funding/review.ts`의 순수 함수 `transition(from, action)`으로만 — 허용되지 않는
  전이는 409. 승인은 slug 충돌(md 파일·기존 DB)을 검사한 뒤 트랜잭션으로 `lockedAt`을 찍는다.
- 레이트리밋: 로그인 메일, 업로드, 저장(분당 30회).
- 실패 원칙은 1차 스펙 §10 그대로: 메일 실패는 로그만, 결제·정산 계산은 트랜잭션.

## 11. 테스트 전략

| 층 | 대상 |
|---|---|
| 단위 | `transition` 상태표 전수, `validateFundingProjectShape`(md·DB 공통), `computeCreatorPayout`(구독 회귀 포함), `stripTrustedDirectives` |
| 통합(in-memory libSQL, 기존 `*.integration.test.ts` 패턴) | 매직링크 발급·소진·만료, 소유권 격리(남의 프로젝트 404), 승인 트랜잭션, **`lockedAt` 뒤 id·금액·삭제 거부**, 재고 조건이 DB 프로젝트에서도 기존 후원을 세는지(`fundingStockCondition`), 정산 1회 제한 |
| 기존 게이트 | `content/funding.baseline.test.ts`·`fundingImages.baseline.test.ts`는 md 경로에 그대로. DB 프로젝트는 대상이 아님을 주석으로 명시 |
| 페이지 | 상세 ISR이 승인 전 프로젝트를 404로, 승인 뒤 `revalidate`로 나타내는지(호출 검증) |
| 계약(스냅샷) | 개설자 약관 판본 문자열 존재, 후원자 약관 해시 게이트 갱신 |

## 12. 구현 순서 (구현 계획 문서에서 상세화)

1. 스키마·마이그레이션 0017, `validateFundingProjectShape` 추출, 비동기 로더와 14곳 호출처 전환
   (기능 변화 없음 — md만 있는 상태에서 전 테스트 초록). 여기까지가 첫 PR.
2. 개설자 인증(매직링크·세션·레이트리밋) + `/apply`·`/creator` 목록.
3. 편집 화면 4구획 + 업로드 + 미리보기 + 심사 신청.
4. 관리자 프로젝트 탭·판정·알림·revalidate. 여기서 첫 DB 프로젝트가 공개된다.
5. 공개 뒤 편집 규칙·`lockedAt` 가드·개설자 통계.
6. 정산 계산·관리자 정산 탭·약관·llms/사이트맵 반영.

각 단계가 독립 배포 가능하고, 3까지는 공개 화면에 아무 변화가 없다.

## 13. 이번 범위에서 하지 않는 것

- 개설자 직접 디지털 파일 업로드(R2 presigned multipart) — 2차
- 개설자 화면에서 배송지 내려받기 — 후원자 약관 개정과 함께 2차
- 새소식(업데이트 글)·후원자 댓글·응원 메시지 공개 벽
- All-or-Nothing, 정산 자동 이체, 세금계산서 자동 발행, 정산 계약 자동 발송
- 비-ko 로케일, 소셜 로그인, 비밀번호 계정
- 카테고리·검색·추천 등 마켓플레이스 기능 — 프로젝트가 수십 건이 되기 전엔 목록 하나면 된다
