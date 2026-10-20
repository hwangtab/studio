# 세션 연주자 등록 페이지 — 설계 (2026-10-20)

방문객 중 세션 연주자로 일하고 싶은 사람이 스스로 프로필을 등록하고, 운영자가 그 명단에서 녹음·편곡·발매 프로젝트에
맞는 연주자를 찾아 섭외하는 흐름이다. 지금은 "15년간 함께 일해 온 전문가와 연결"(`data/services.ts`)이 운영자 머릿속과
카카오톡에만 있다. 이 문서는 그 명단을 DB에 두는 1단계를 설계한다.

> **구현 현황 (2026-10-20, PR #789 머지·운영 반영):** 0장은 권장안 그대로 확정. 현재 동작의 정본은 코드(`lib/sessionMusicians/`)와
> CLAUDE.md "세션 연주자 등록" 절이다. 이 문서와 다른 점:
> - 관리 토큰은 base64url이 아니라 **소문자 hex 64자**(미들웨어가 대문자 경로를 소문자로 308한다). 재발송하면 새 토큰이 나가고 옛 링크는 끊긴다.
> - `purged_at` 칸은 없다(파기는 행 삭제). 대신 `adult_confirmed`·`reconfirm_sent_at` 칸을 더했다.
> - 다른 로케일은 `/ko`로 보내지 않고 **404**다(다른 ko 전용 페이지 `/shows/host`와 같다).
> - 더한 것: 관리 링크의 "계속 활동 중" 확인 버튼(`POST {action:'confirm'}`), 링크를 잃은 사람을 위한 관리자 삭제(접속기록 `session_musician_delete`, 판본 `-r2`).
> - 이메일 해시 키는 `ADMIN_SESSION_SECRET`에서 갈라 낸다. 요청 제한(`consumeRateLimit`)은 DB 장애 때 통과시킨다(사이트 공용 동작).

## 0. 먼저 정할 것 (운영자 결정)

| # | 질문 | 권장안 | 이유 |
|---|---|---|---|
| D1 | 등록한 프로필을 사이트에 **공개**하나? | **1단계는 비공개 명단**(운영자만 봄) | 공개 디렉터리는 검수·사칭·사진 권리·노출 동의가 함께 온다. 섭외 권한은 운영자에게 두고, 공개는 2단계에서 "공개 동의"를 받은 사람만 |
| D2 | 연주 샘플을 **파일로** 받나? | **링크만**(유튜브·사운드클라우드·드라이브 등, 1~5개) | 저장소에 공개 사용자의 직접 업로드 경로가 없다. 함수 본문 4.5MB 한도로 음원을 받으려면 새 패턴(클라이언트 직행 업로드)을 만들어야 하고, 파기·용량 관리도 따라온다 |
| D3 | 나이 제한 | **만 19세 이상만** | 만 14세 미만은 법정대리인 동의가 필요하고, 미성년 섭외는 제작 계약에서도 대리인 서명을 따로 받는다. 1단계는 단순하게 |
| D4 | 로그인이 필요한가? | **로그인 없이**, 접수 메일의 관리 링크로 수정·삭제 | 개설자 매직 링크 계정까지 만들 이유가 없다. 삭제 요구(열람·정정·삭제권)는 관리 링크로 즉시 처리 |
| D5 | 연주비·정산 | **이 페이지에서 다루지 않는다** | 가격 정본은 "세션 연주비는 연주자 실비만, 섭외 수수료 없음"(`data/pricing.ts`). 희망 단가는 참고용 선택 칸으로만 받고 화면에 금액을 약속하지 않는다. 지급·원천징수는 2단계 |

아래 설계는 권장안을 전제로 한다. 바뀌면 해당 절만 갈아 끼운다.

## 1. 주소와 화면

| 주소 | 용도 | 색인 |
|---|---|---|
| `/ko/session-musicians` | 모집 소개 + 등록 폼 한 화면 | **색인**(ko). `pageRouteMap` 등록 + `npm run generate:page-lastmod` |
| `/ko/session-musicians/thanks` | 접수 완료 | noindex, 사이트맵 제외 |
| `/ko/session-musicians/manage/[token]` | 본인 수정·삭제 | noindex, no-store, `PRIVATE_ROUTE_BODIES` 등록 |
| `/admin/session-musicians`, `/[id]` | 운영자 명단·상세 | 관리자 |

- ko 전용이다. 다른 로케일은 `/ko/...`로 보낸다(연주자는 국내 섭외 대상).
- 진입점: 푸터 "함께 일하기" 한 줄, `/about` 전문가 연계 문단 아래 텍스트 링크. 헤더 메뉴에는 넣지 않는다(고객 동선이 아니다).
- **CTA는 노란색 금지** — 목적지가 카카오톡이 아니라 폼이다(카카오 CTA 배색 규칙). 제출 버튼은 파랑 solid.
- 뼈대는 `PageShell` + `PageHeader`, 선택 항목은 `ChoiceCard`·`Checkbox`, 안내는 `Notice`(design-system §3·§4, `pageScaffold.test.ts`).

### 소개 영역 (폼 위, 짧게)

- 어떤 일인가: 녹음실 세션, 편곡 실연(스트링·브라스·밴드), 원격 녹음.
- 등록 = 섭외 약속이 아니다. 맞는 프로젝트가 생기면 운영자가 먼저 연락한다.
- 연주비는 프로젝트마다 합의하고, 스튜디오는 연주비에서 수수료를 떼지 않는다(정본 문장과 같은 뜻으로만 — 새 수치 금지).
- 확인한 사실만 쓴다. "최고의 세션 네트워크" 같은 주장은 `check:claims` 대상이 아니어도 넣지 않는다.

### 폼 항목

| 묶음 | 항목 | 필수 | 저장 |
|---|---|---|---|
| 기본 | 활동명 | ● | 평문 |
| | 실명 | ● | 암호화 |
| | 만 19세 이상 확인(체크) | ● | 평문(bool) |
| 연주 | 주 악기(1개) | ● | 평문 |
| | 다룰 수 있는 악기(복수, 목록 + 기타 직접 입력) | | 평문 JSON |
| | 장르(복수) | | 평문 JSON |
| | 경력(년) | | 평문 |
| | 악보 리딩: 코드 차트 / 오선보 / 안 함 | | 평문 |
| | 원격 녹음 가능(자기 장비로 녹음해 파일 전달) | | 평문(bool) |
| | 스튜디오 방문 가능 지역(시·도) | | 평문 |
| 소개 | 경력·참여작 소개(1,000자) | | 평문 |
| | 샘플 링크 1~5개(https만) | ● 1개 이상 | 평문 JSON |
| | 희망 단가 메모(선택, 200자) | | 평문 |
| 연락 | 휴대전화 | ● | 암호화 |
| | 이메일 | ● | 암호화 + 검색용 해시 |
| | 카카오톡 ID | | 암호화 |
| 동의 | 개인정보 수집·이용 동의(필수) | ● | 판본 문자열 |

- 사진은 1단계에서 받지 않는다(D1·D2와 같은 이유).
- 성별·생년월일·주소·주민번호는 받지 않는다 — 섭외에 필요 없는 정보다.
- 악기·장르 목록은 `data/sessionMusicians.ts` 상수 하나. 관리자 필터와 폼이 같은 목록을 쓴다.

## 2. 데이터 (마이그레이션 0077 — 새 표 하나)

```
session_musicians
  id                text pk
  stage_name        text not null
  primary_instrument text not null
  instruments_json  text            -- ["electric-guitar","bass", {"other":"우쿨렐레"}]
  genres_json       text
  years_experience  integer
  reading           text            -- 'chart' | 'staff' | 'none'
  remote_recording  integer (bool)
  region            text
  bio               text
  sample_links_json text not null   -- [{url, label}]
  rate_note         text
  private_enc       text not null   -- {realName, phone, email, kakaoId} 를 JSON째 encryptField
  email_hash        text not null   -- 소문자 정규화 후 HMAC — 중복 등록·횟수 제한용
  manage_token_hash text not null unique  -- 원문은 메일에만, DB엔 sha256
  status            text not null default 'new'  -- new | reviewed | active | inactive
  operator_memo     text            -- 개인정보로 취급, 파기 대상
  consent_version   text not null
  created_at, updated_at, last_confirmed_at  integer
  purged_at         integer
```

- **어떤 `relations()`에도 잇지 않는다.** 그래서 마이그레이션 → 배포 순서가 뒤집혀도 다른 화면은 안 깨진다. 표가 없으면
  등록 API는 503 `migration_needed`, 관리자 화면은 적용 안내(0067과 같은 방식). 그래도 순서는 마이그레이션 → 배포.
- `private_enc`는 `ENCRYPTED_FIELD_TARGETS`(`lib/crypto/fieldKeyRotation.ts`)에 등록 — 키 회전 대상(`lib/crypto/CLAUDE.md`).
- 관리 토큰은 해시만 저장한다(기존 `orders.manage_token`은 원문 저장이지만 따라 하지 않는다 — 백업에서 빼는 번거로움도 없다).
- 원장 백업(`lib/ops/ledgerBackup.ts`)에는 넣지 않는다. 돈과 무관하고, 넣으면 28일짜리 개인정보 사본이 생긴다.

## 3. 서버 (`lib/sessionMusicians/`)

| 파일 | 하는 일 |
|---|---|
| `validate.ts` | 순수 검증·정규화(zod 없음 — `lib/contact/payload.ts`처럼 손으로 + `validator`). 링크는 https·호스트 있음·2,048자 이하, 제어·양방향 문자 제거 |
| `repository.ts` | 쓰기·읽기, 표 없음 감지 |
| `email.ts` | 운영자 알림·접수 확인 메일(`buildEmailLayout`) |
| `retention.ts` | 파기 |

**`POST /api/session-musicians`** (공개)

1. 출처 확인 `isAllowedContactRequestOrigin`, 허니팟 칸·작성 시간(`_formFillMs`) — 걸리면 가짜 200(문의 폼과 같다).
2. 횟수 제한 `consumeRateLimit`(`lib/booking/rate-limit.ts`): IP당 3건/시간, 이메일 해시당 2건/일, 전체 50건/일.
   마지막 칸은 봇이 IP를 돌려도 접수 확인 메일이 대량 발송되지 않게 하는 상한이다.
3. 같은 `email_hash`가 이미 있으면 **새 행을 만들지 않고** 그 주소로 "이미 등록돼 있어요 — 관리 링크" 메일을 다시 보낸다.
   응답은 새 등록과 똑같이 준다(이메일 존재 여부를 화면으로 알려주지 않는다).
4. 저장 → 운영자 알림 → 접수 확인 메일. 메일 실패는 접수를 되돌리지 않는다(로그 + 운영자 알림 실패면 `operatorAlert`).

**`GET/PATCH/DELETE /api/session-musicians/manage`** — 헤더로 토큰을 받아 해시 대조. DELETE는 행을 즉시 지운다(소프트 삭제 아님 — 본인 삭제 요구다).
수정하면 `last_confirmed_at`을 갱신한다.

**관리자 API** `pages/api/admin/session-musicians/` — 목록(필터), 상태·메모 변경, 연락처 보기(버튼을 누른 순간의 응답으로만, 아래 4장).

## 4. 관리자

- 메뉴: `ADMIN_NAV_ENTRIES`의 **녹음실** 묶음에 "세션 연주자". 섭외는 녹음·편곡 작업에서 일어난다.
- 목록: 활동명·주 악기·악기·장르·리딩·원격·지역·상태·등록일. 필터는 악기·장르·원격·상태. **연락처·실명은 props에 싣지 않는다.**
  대시보드 "처리할 일"에 `status='new'` 건수.
- 상세: 위 항목 + 샘플 링크(새 창, `rel="noopener noreferrer"`) + 운영자 메모 + 상태 변경. 상세 열람은
  `logAdminView(ctx, actor, 'session_musician_view', id, …)`. "연락처 보기" 버튼은 `session_musician_private_view`로 따로 기록
  (월 입주 `tenancy_private_view`와 같은 구조). 새 액션 두 개는 `privacyAccessActionEnum`·`accessLogLabels.ts`·처리방침 접속기록 목록에 함께.
- 운영자 알림 메일: `audience: 'operator'`, rows = 활동명·주 악기·지역·샘플 링크 수, 버튼 = `adminUrl('/admin/session-musicians/{id}')`.
  **연락처는 메일에 싣지 않는다**(메일함은 접속기록이 없다).

## 5. 개인정보·약관

- 새 수집 목적이 생기므로 **처리방침 개정이 먼저다.** 수집 항목(실명·휴대전화·이메일·카카오톡 ID·연주 이력·샘플 링크),
  목적("세션 연주 섭외 연락"), 보유 기간, 파기 방법을 처리방침 2항·보유 표에 더하고 `FUNDING_TERMS_VERSION`을 올린 뒤
  `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`(CLAUDE.md "약관·처리방침" 절 순서대로).
- 폼의 동의 문구는 처리방침 전체가 아니라 **이 목적의 요약 4줄**(항목·목적·보유 기간·거부 권리와 불이익 — "등록할 수 없다")을
  보여 주고 처리방침에 링크한다. `consent_version`에는 위 판본 문자열을 저장한다.
- 수탁자: 새로 생기지 않는다(Turso·Resend·Vercel은 이미 표에 있다). 확인만 한다.
- **보유 기간: 마지막 확인일(`last_confirmed_at`)로부터 2년.** 권장 이유 — 섭외 명단은 오래될수록 쓸모가 없고, "계속 활동 중"
  응답이 곧 재동의 역할을 한다.
  - 1년 9개월째: "아직 세션 연주 하세요?" 메일(관리 링크 → 확인 버튼 한 번으로 `last_confirmed_at` 갱신). 광고성 문구 금지.
  - 2년 경과: 월간 파기 크론(`purge-contracts`에 단계 추가 — 새 크론을 만들지 않는다)이 행을 지운다. 실패하면 운영자 메일 + 500.
  - `inactive`(운영자가 내린 것)도 같은 기한을 탄다.

## 6. 남용·안전

- 샘플 링크는 열기만 하고 사이트에 임베드하지 않는다(외부 스크립트·CSP 변경 없음). 관리자 화면에서도 링크 텍스트로만.
- 소개 글은 화면에 그대로 찍을 때 React 기본 escape, 메일에 넣을 때 `escapeHtml`.
- 접수 확인 메일은 남의 주소로 보내질 수 있다(누구나 아무 주소를 적을 수 있다). 그래서 메일에는 사용자가 적은 자유 서술을
  싣지 않고(활동명만), 관리 링크와 "본인이 아니면 이 링크로 지워 주세요"만 둔다. 2장의 전체 상한이 대량 발송을 막는다.

## 7. 2단계 이후 (이번 범위 아님)

- **공개 디렉터리**(D1): "공개 동의" 칸을 따로 받고, 운영자가 `active`로 올린 사람만 `/ko/session-musicians/roster`에. 사진·임베드는 그때.
- **프로젝트 연결**: 제작 계약(`production_contract_events`)이나 견적에 "섭외한 연주자"를 잇고, 연주비 지급·원천징수(3.3%)를
  개설자 정산(`creator_tax_profile`)과 같은 방식으로. 이때 주민번호가 필요해지므로 별도 설계.
- 파일 업로드 샘플(D2 재검토).

## 8. 구현 순서와 점검

1. 처리방침 개정 + 판본 + 기준선 (단독 커밋)
2. 0077 + `lib/sessionMusicians/` + 공개 API + 테스트(검증, 중복 이메일, 횟수 제한, 토큰 해시, 표 없음 503)
3. 공개 페이지·관리 페이지 + `pageRouteMap`·lastmod·`privatePaths` 등록
4. 관리자 목록·상세·접속기록 + 대시보드 건수
5. 파기 단계 + 재확인 메일 + 메일 미리보기(`scripts/preview-emails.ts`로 눈 확인)
6. 배포 순서: `npm run db:migrate -- --yes` → 머지·배포 → 실제 등록 1건 → 관리 링크로 삭제까지 확인

CI가 잡는 것: `pageScaffold`·`uiPatterns` 기준선, `routes.test.js` lastmod 커버리지, `fundingTerms.baseline`, 접속기록 라벨 짝,
메일 레이아웃 가드. CI가 **안** 잡는 것: 처리방침 문구와 실제 보유 기간·파기 코드가 같은 약속을 하는지 — 5장 숫자를 바꾸면 셋을 함께.
