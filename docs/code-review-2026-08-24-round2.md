# 2차 전방위 코드리뷰 — 2026-08-24 (라운드 2)

1차(docs/code-review-2026-08-24.md) 후속으로 6개 축 병렬 리뷰. 1차에서 클린 판정된
축(SEO 구현·접근성 기본기·보안 인증 구조)은 재검토하지 않고, **얕게 지나간 곳 +
이번 주 새로 들어간 코드(93a588428c..cf78deefed)**를 겨냥했다.

## 사전 확인: 실제 피해 여부 (Turso 직접 조회, PII 미열람)

계약 테이블 **현재 0건**(테스트 계약 정리 완료 상태). 따라서:
- 오파기된 활성 계약: 0
- 9/1 크론 파기 예정: 0
- 보증금≠월이용료: 0

→ **계약 도메인 P0들은 실계약이 쌓이기 전에 고치면 완전한 사전 예방이 된다. 지금이 최적기.**

---

## P0 — 즉시 (실계약 유입 전에)

### 1. 개인정보 파기 기산점이 틀렸다 — 활성 계약 오파기 + 12조 위반  [계약도메인]
`lib/contracts/retention.ts:43-71` — 파기 대상을 `endDate` 기준 3년으로 세는데,
이 시스템은 호실 점유를 `terminatedAt` 기준으로 판정한다(`db/schema.ts:104-105`,
`service.ts:61-64`). 두 시계가 어긋나:
- (A) 자동 갱신으로 **현재 이용 중인** 계약(endDate 지남, terminatedAt=null)이 파기됨
  → 이름·연락처·PDF·서명 소거 → 청구·통지 불능
- (B) 중도 종료 계약이 실제 종료 3개월 만에 파기 → 계약서 12조 "종료 후 3년 보관" 위반
`terminated` 추가 커밋(49d2f079f4, 8/13)이 상태 목록만 넣고 기산점을 안 고침. 테스트 0건.
**수정**: 기산점을 `COALESCE(terminatedAt, endDate)`로, `status='signed' AND terminatedAt IS NULL`
(이용 중)은 파기 대상에서 원천 제외. RETENTION_YEARS=3과 12조 문구는 그대로 정확.

### 2. rate limit 두 개가 주석과 정반대로 동작 — 이번 주 내가 넣은 코드  [적대리뷰 H1·H2]
- **H1 다운로드 잠금**: `admin-rate-limit.ts:265-288`이 누적 카운터를 **검증 전 무조건**
  증가, `resetIdentityAttempts`(:303-313)가 `download_identity*` 키를 안 지움.
  → 링크 소지자가 빈 요청 101회로 당사자를 **30일 잠금**. 주석 :244-250이 "영구 잠금
  두지 않는다"고 명시한 것과 정반대.
  **수정**: (a) 대조 실패일 때만 카운트, (b) `resetIdentityAttempts`에 download 키 추가,
  (c) 성공 시 window 리셋.
- **H2 관리자 봉쇄**: `admin/auth.ts:12-19`가 전역 상한을 비밀번호 검사보다 앞에 두고,
  `resetAdminLoginRateLimit`(:322-331)이 GLOBAL_KEY를 안 지움.
  → 무인증 공격자가 101회/시간으로 **정확한 비밀번호를 가진 운영자를 무기한 봉쇄**.
  **수정**: 전역 상한을 loginAdminSession 뒤(실패만 카운트)로, 성공 시 GLOBAL_KEY 리셋,
  유효 세션 쿠키 보유 요청은 예외.

### 3. 새벽 서명 시 계약일이 하루 어긋난 채 contentHash에 박힘  [계약도메인 P0-2]
`lib/contracts/template.ts:25-32`의 formatDate만 `timeZone` 미지정(UTC). 9/1 01:00 KST
서명 시 같은 PDF 안에서 계약일="8월 31일", 서명 일시="9월 1일 01:00". 그 본문이
contentHash에 박혀 사후 수정 불가. `format.ts`는 이 사고를 이미 고쳐놨는데 template.ts에 미적용.
**수정**: template.ts의 formatDate·통화 포맷터를 지우고 format.ts 것을 import.
회귀 테스트에 `2026-08-31T16:00:00Z`(9/1 01:00 KST) 케이스 + jest `TZ=UTC` 고정.

---

## P1 — 이번 주

### 4. 사실 오류: es/vi/th/uz가 "프로듀싱 레슨"을 "보컬 레슨"으로 오역  [사실정합]
없는 서비스를 4개 언어로 광고 중. `/stories` 허브 히어로 + fallback 키워드.
- es `common.json:870,874`("clases vocales/de canto"), vi `:870,874`("học thanh nhạc"),
  th `:874,878`("เรียนร้องเพลง"), uz `:870,874`("vokal darslari")
- ko="프로듀싱 레슨", en="production lessons", zh="制作课程"는 정확
2026-02~04 도입분, 6월 이후 보컬레슨 재발 방지 커밋들이 안 다룬 영역.

### 5. 사실 오류: 중국어 스토리에 "중문 어시스턴트·직원 영어 유창" 잔존  [사실정합]
`content/stories/recording-in-seoul-for-chinese-musicians.zh.md:28,40`. 같은 파일을
89ebc023e8·53b0567c63이 두 번 고쳤으나 FAQ만 고치고 본문 두 줄을 놓침.
factGuards CI 8건 전부 통과하는데도 라이브 = 가드를 빠져나간 회귀.

### 6. factGuards 룰 갭 3개 (5번이 통과한 원인)  [사실정합]
- `non-english-staff-claim`(factGuards.ts:155)에 `中文助理` 계열 부재
- `english-engineer-claim`(:163)이 "엔지니어" 한정 → 일반 직원 영어 유창 주장 통과
- 보컬 레슨 룰이 한국어 전용/1인칭 마커 필요 → es/vi/th/uz 단순 카테고리 라벨 빠짐
  신규 룰 정규식 + 오탐 방지 allow(vi "Hướng dẫn thanh nhạc"=정당한 보컬 디렉팅) 필요

### 7. 태국어 스토리 OG 카드가 전부 제네릭 이미지  [공개API H1]
`og/story.tsx:215-222`가 Pretendard-Bold 단일 폰트만 등록. cmap 실측: 태국 문자
128자 중 1자만 커버. th 스토리 28편 전부 satori 렌더 실패 → `og-default.webp`로 302.
카톡·페북·트위터에서 제목·카테고리 사라지고 서로 구분 불가.
**수정**: Noto Sans Thai 폴백 폰트 추가 또는 로케일별 폰트 분기.

### 8. ContractForm 파생 상태 오용 — 다른 고객 정보로 계약 생성 가능  [React M1]
`ContractForm.tsx:130`이 initialValues를 useState 초기값으로만 복사. `_app.tsx:278`의
remount key가 쿼리스트링 제외 경로라, `?from=A`→`?from=B` 재진입 시 폼 state가 A 데이터
유지. "B님 계약 복제" 배너 아래 A의 이름·금액. 복제 링크(index.tsx:464) 실재.
**수정**: `<ContractForm key={...}>`로 remount 강제 또는 initialValues 변경 감지 useEffect.

### 9. terminated 상태가 서명본 접근 3곳에서 누락  [계약도메인 P1-3]
`sign.tsx:86-107`(종료 계약이 빈 서명 패드 재노출), `download.ts:67-72`·`pdf.ts:41-43`
(status!=='signed'로 게이트 → 종료 즉시 PDF 접근 끊김, 보관 의무 3년인데). 고객은
"서명 완료 후 받으실 수 있습니다"라는 사실과 반대 메시지.
**수정**: 게이트를 `signedAt !== null`(또는 `['signed','terminated']`)로. purgedAt 게이트는 유지.

### 10. safeLinks 백슬래시 오픈리다이렉트 우회  [미커버 H1]
`safeLinks.ts:4-36` — `[텍스트](\\evil.com)`(선행 슬래시 없는 백슬래시)가 fall-through로
허용됨. 브라우저 URL 스펙상 `\\`=`//` → origin 교체. 현재 저자가 신뢰됨이라 당장 표면
아니나 함수 이름부터 보안 경계. **수정**: `compact.includes('\\')` 차단 한 줄 + 테스트.

---

## P2 — 여유 있을 때

| # | 항목 | 근거 | 축 |
|---|---|---|---|
| 11 | 파기가 terminationReason·description 안 지움 | retention.ts:84-111 | 계약 P1-4 |
| 12 | contentHash 검증 경로가 프로덕션에 없음 | integrity.ts, 호출부 테스트뿐 | 계약 P1-5 |
| 13 | 재발송 토큰 회전이 서명 트랜잭션 조건에 없음 | sign-transaction.ts:115 (경합 시 옛 토큰으로 커밋) | 계약 P1-6 |
| 14 | needsTermination이 종료일 당일 오전 9시에 참 | status.ts:64-75 (UTC자정=KST9시) → 하루 겹친 이중배정 | 계약 P1-7 |
| 15 | ContractForm 특약 목록 index key | ContractForm.tsx:381-406 (중간행 삭제 시 값 어긋남) | React M2 |
| 16 | middleware 대소문자 → 리눅스 404 | middleware.ts:165-193 (`/Pricing/`→`/ko/Pricing`→404) | 공개API M2 |
| 17 | RSS가 HEAD 거부 (llms.ts는 허용) | rss.ts:35-38 | 공개API M3 |
| 18 | 메타 description이 목록 번호에서 잘림 | storySeoData.ts:41 (1.·2.를 문장종결 오인, 실측 18편/광역허브6) | 적대 M1 |
| 19 | 카테고리 페이지가 마운트마다 catalog 재요청 | category/[key].tsx:109-145 (1페이지도 무조건 fetch+플리커) | 미커버 H2 |
| 20 | AudioPlayer 시크바 드래그↔timeupdate 경쟁 | useAudioPlayer.ts:68-75 (isSeeking 가드 없음) | 미커버 M1 |
| 21 | generate-story-listing --check가 readdir 순서 의존 | :183,315 (CI 오탐, 로컬 재현 불가) | 적대 M2 |
| 22 | page-cache를 next.config로 옮기면 프록시 무관하게 성립 | M5 (현재 코드는 Vercel 프록시 우선순위 미검증) | 적대 M5 |
| 23 | getStoryListing 로케일 미검증 + 로드 실패가 빈목록+200+캐시 | stories.ts:564, catalog.ts:67 | 적대 M3 |
| 24 | identity rate limit DB장애 시 무제한 대입 | admin-rate-limit.ts:201-205 (폴백 없음) | 적대 M4 |
| 25 | jest 커버리지 임계값이 실측의 1/3 | jest.config.js (lines 18 vs 실측 52.8) | 미커버 M6 |
| 26 | contentSegments가 본문 첫 줄 shortcode 무력화 | contentSegments.ts:8 (현재 0건) | 미커버 M3 |
| 27 | release 3 tier 페이지 getStaticProps 중복 + discography tier 무관 | album/ep/single.tsx | 미커버 M2 |
| 28 | maskable 아이콘 세이프존 없음 | manifest.ts:66-71 (안드로이드 가장자리 잘림) | 공개API M5 |
| 29 | 계좌 3중화(컬럼·템플릿·이메일) | schema.ts:47-49 죽은 컬럼 | 계약 P2-13 |
| 30 | fingerprint가 birthdate·roomArea 미포함 | integrity.ts:107-140 | 계약 P2-8 |

## P3 — 관찰/잠재 (현재 미발현, 재발 방지 가치)

- llms.txt 5MB 캡이 UTF-16 길이 기준 (한글 3배, 현재 미발동) — 공개API M4
- useContactForm 제출 fetch에 unmount abort 가드 없음 — React Low
- _app.tsx가 unregister 성공 전 플래그 세움 + .catch 없음 — 적대 L4
- MediaGallery role=status + aria-live 중복 통지 — 적대 L5
- complete.tsx가 IDENTITY_DIGITS 대신 4 하드코딩 — 적대 L1
- extractHeadings HTML 엔티티 미디코드 (TOC 앵커 깨짐, 현재 0건) — 미커버 L1
- inline 콜아웃 비-ko 분기 도달 불가 죽은 코드 — 미커버 M4
- status.test.ts가 terminated 안 돎 (enum 순회로 바꾸면 재발방지) — 계약 P2-14

---

## 확인 필요 (운영자 판단)

1. **`practiceRoom.residentBenefits.calendarLinkUrl` = kosmart.co.kr/calendar** — 실접속
   확인 결과 살아있는 예술인 지원사업 캘린더, 카피도 외부 리소스로 정확히 프레이밍(모조직
   주장 아님). 계속 링크할지만 판단.
2. **release tier 페이지 discography가 tier 무관** (P2 #27) — "ep" 카테고리가 데이터에
   없어 tier 필터가 단순치 않음. 정규앨범 문의자에게 싱글 위주 증빙이 보여도 되는지 판단.

## 검토했으나 문제없음 (다음 라운드 재검 방지)

- 적대리뷰: GET→302 오픈리다이렉트 없음(encodeURIComponent가 /·?·#·: 인코딩),
  req.body 문자열/버퍼 크래시 없음, complete fetch↔서버 형식 일치, GSSP setHeader가
  모든 반환 경로보다 앞섬(Next 15 소스 확인), cron auth 판정 동등, middleware admin
  조기반환 부작용 없음(원래 안 돌던 경로), ServiceQuickLinks 5페이지 문자단위 동일,
  getRelatedStories content 부재 무영향.
- 계약: checkAction↔UPDATE 6액션 1:1 일치, 일할계산 없음(2조④ 일치), 보증금=월이용료
  구조 정확, Intl ko-KR 고정, 파기 재실행 안전, 백업 signToken 제외.
- 사실: 0507 잔재 0건, 전화 SSOT 일관, parentOrganization=자기참조(정상), 7월 스토리
  8편 무결, 가격 SSOT CI 통과, 수상 표기 원칙 준수.
- 공개API: RSS 이스케이프(실제 특수문자 제목 추적), pubDate RFC호환, 사이트맵 hreflang
  상호참조 대칭(빌드산출물 확인), catalog 페이지네이션 경계 clamp.
- React: useAudioPlayer 이중가드, ensureLocaleReady isCancelled, ImageHero 하이드레이션,
  eslint-disable 억제 0건.
