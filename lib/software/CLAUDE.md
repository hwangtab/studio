# CLAUDE.md — 소프트웨어(플러그인·툴) 판매

`lib/software/`·`data/software/`·`pages/[locale]/software/`·`pages/api/software/`·`pages/admin/software/`를 만질 때 읽는 규칙이다.
계획·단계는 `docs/software-sales-plan-2026-10.md`, 플러그인 쪽 연동은 `docs/software/license-integration.md`(형식의 정본).

## 지금 상태 — 단계 2(국내 결제) 코드 완료, 판매 잠김

- 상품 정본 `data/software/catalog.ts`(비어 있음), 판매 스위치 `SOFTWARE_SALES_OPEN = false`(`data/software/policy.ts`).
- 국내 결제: 상세 화면(ko)의 구매 폼(`components/software/SoftwareOrderForm.tsx`) → `orders(type='software')` + `software_orders`(0056)
  → 토스 승인(`lib/software/confirm.ts`)이 **결제 기록·paid·라이선스 발급을 한 batch로** → 확정 메일(키 포함).
- 구매자 화면 `/ko/software/manage/<주문번호>?token=` — 키·활성 기기 해제·설치 파일·셀프 환불. 링크를 잃으면 `/ko/software/find`(이메일로 재발송).
- 관리자(`/admin/software`): 결제 없는 발급(시험·리뷰어·증정, 받는 분에게 키 메일 선택), **결제됐는데 라이선스가 없는 주문 보충 발급**(주문번호로 —
  그 주문의 상품·구매자로 발급하고 키 메일), 라이선스별 "키 메일 보내기"(결제분은 구매 내역 링크 포함, 증정분은 키와 사용법), 기기 해제·취소·주문 환불.
- 매일 운영 점검(`lib/ops/healthCheck.ts`)이 결제됐는데 라이선스가 발급되지 않은 주문을 high로 알린다.
- 메일 미리보기: `npx tsx scripts/preview-emails.ts`에 키 메일 두 종(구매자·증정)이 있다.
- 해외(토스 페이팔, USD)는 단계 3.

## 판매를 열기 전에 (위에서부터)

1. **운영 DB에 마이그레이션 0054·0056을 적용한다** — 배포보다 먼저(루트 CLAUDE.md "운영 DB 마이그레이션 적용 방법"). 0054는 2026-10-14 적용됨.
   새 표뿐이라 순서를 어겨도 다른 결제는 안 깨지고 소프트웨어 기능만 꺼진다.
2. 서명키 — k1은 2026-10-14에 만들어 넣었다(Vercel production·preview, 운영자 맥 키체인 `studio-nol-software-license-k1`). 맥 밖 백업은 운영자 몫.
   `SOFTWARE_LICENSE_SIGNING_KEY`·`SOFTWARE_LICENSE_KEY_ID`·`publicKeys.ts` 중 하나라도 빠지면 활성화 API가 503으로 닫힌다(의도).
3. 이용약관 — **소프트웨어 절이 준비돼 있다**(`/ko/terms#software`, 문구 정본 `lib/software/policyCopy.ts`, `SOFTWARE_SALES_OPEN`일 때만 보인다).
   구매 폼·구매 내역·메일·`lib/software/cancel.ts`와 같은 약속이어야 한다 — 한쪽을 바꾸면 다른 쪽도.
4. 개인정보 처리방침 — **반영됨**(2026-10-14, `funding-terms-2026-10-14-r2`): 1항 수집 항목, 2항 목적, 3항 보유, 4항 Resend 업무, 18항 ④·⑭.
5. 상품을 `data/software/catalog.ts`에 올린다 — 가격은 `prices` **맨 앞이 지금 가격**. 기준선 갱신(`UPDATE_SOFTWARE_CATALOG_BASELINE=1`).
   설치 파일은 코드서명·공증을 마친 최종본을 `node --env-file=.env.local scripts/software/publish-installer.mjs --slug … --version … --platform … --file …`로
   R2(펀딩·상점과 같은 비공개 버킷, `software/<slug>/<version>/`)에 올리고, 스크립트가 찍은 `downloads` 줄을 붙인다. 같은 키 덮어쓰기는 거부한다.
   화면·구매 내역은 `/api/software/download/<slug>/<version>/<platform>`(카탈로그 키로 10분 서명 주소에 302, 인증 없음 — 체험판과 같은 파일)을 건다.
6. `SOFTWARE_SALES_OPEN = true`로 배포 — 이 한 줄로 헤더·푸터 메뉴(스튜디오 묶음, ko·en), 런타임 사이트맵(`/sitemap-software.xml`, robots에 실림),
   llms.txt·llms-full(ko·en)의 소프트웨어 절, 목록·상세의 색인 허용, 이용약관 소프트웨어 절이 함께 켜진다.
7. 최소 금액으로 실결제 → 키 수령 → 활성화 전 셀프 환불 → 키 거절까지 한 바퀴, 카드·간편결제 각 1건.

## 바꾸면 안 되는 것 (어겨도 에러가 안 나는 것)

- **라이선스 파일 형식과 활성화 API 응답 코드.** 이미 배포된 플러그인이 오프라인으로 이 형식을 검증하고 이 코드값을 읽는다.
  바꾸려면 `v`를 올리고 옛 형식을 계속 받는다. `tests/api/software/activate.test.ts`가 응답 코드를 고정한다.
- **서명 대상은 payload의 원래 바이트다.** 서버·플러그인 어디서도 payload JSON을 다시 직렬화해 서명·검증하지 않는다.
- **`publicKeys.ts`의 kid는 지우지 않는다.** 키 회전은 새 kid를 더하고 env를 새 kid로 — 옛 플러그인은 옛 kid로 검증한다.
  비밀키를 잃으면 새 키로 바꿀 수밖에 없고, 그러면 **모든 플러그인을 다시 배포**해야 한다. 백업이 그래서 필수다.
- **상품 slug와 판매를 시작한 가격 id는 바꾸지 않는다.** 라이선스 행·라이선스 파일·플러그인이 slug로 상품을 가리킨다.
  가격 변경은 새 id(`data/software/catalog.baseline.test.ts`).
- **서명키는 kid뿐 아니라 공개키와 짝인지까지 본다**(`isSignerPublished`) — 짝이 아니면 활성화 API가 503. 회전 실수로 다른 키가 env에 들어가면
  플러그인이 검증하지 못하는 파일을 200으로 내주게 된다.
- **기기 식별값은 소문자 hex 64자만 받는다**(`MACHINE_ID_PATTERN`) — 처리방침이 "원래 값이 아니라 변환한 값"을 약속한다.
- **활성화 한도는 조건부 INSERT 한 문장으로 지킨다**(`activateLicense`). 개수를 읽고 따로 넣는 식으로 바꾸면 동시 요청이 한도를 넘는다.
- **없는 키와 다른 상품의 키는 같은 `invalid_key`(404)다.** 키가 어느 상품 것인지 드러내지 않는다.
- **라이선스 취소·환불은 새 활성화를 막는다**(같은 기기의 재설치 재활성화도 403). 이미 받은 서명 파일은 오프라인이라 계속 돈다 — 의도한 동작이고,
  상시 온라인 확인을 넣지 않는다(스튜디오 컴퓨터는 인터넷을 끄는 일이 많다. 계획서 §8).
- 라이선스 키는 **평문 저장**이다 — 구매자 화면에서 다시 보여 줘야 한다. 서명 파일이 오프라인이라 기기 수 한도는 "동시에 활성"만 센다 —
  활성화→해제 되풀이로 한도를 넘기지 못하게 **고객 쪽 해제를 30일 5번으로 묶는다**(`SOFTWARE_DEACTIVATIONS_PER_30_DAYS`, 같은 UPDATE의 WHERE).
  이 한도를 없애면 새어 나간 키 하나로 기기를 무제한 늘릴 수 있다(2026-10-14 감사 재현). 운영자 해제는 한도 없음.
- `orders`에 칸을 더하지 않는다. 단계 2의 주문 정보(통화·금액)는 새 표 `software_orders`에(루트 CLAUDE.md 0022 절의 배포 순서 함정).

## 결제 쪽 규칙 (어겨도 에러가 안 나는 것)

- **한 주문 = 상품 하나 = 라이선스 하나.** 승인 batch의 라이선스 INSERT는 "paid인 주문에만, 그 주문에 라이선스가 없을 때만" — 새로고침·웹훅 재생이
  키를 더 만들지 않는다. 발급이 실패한 주문은 운영자 메일이 경고한다(관리자에서 수동 발급).
- **지금 가격(맨 앞)만 주문을 받는다**(`createSoftwareOrder`) — 옛 가격 id로 싸게 사는 길을 막는다.
- **청약철회 동의는 체크박스로 받고 서버가 시각을 남긴다**(`software_orders.withdrawal_ack_at`). 다른 결제 흐름처럼 "결제하기 = 동의"로 바꾸지 말 것 —
  디지털콘텐츠 철회 제한은 사업자가 고지·동의를 증명해야 성립한다.
- **고객 셀프 환불의 선점은 라이선스 UPDATE이고, 활성화 INSERT도 `status='active'`일 때만 들어간다** — 둘이 겹치면 한쪽만 이긴다. 활성화 행과
  `first_activated_at`은 한 batch로 쓴다(사이에 환불이 끼지 않게). 운영자 환불은 활성화 뒤에도 된다.
- **토스가 환불을 거절해도, 그 사이 돈이 다른 길(늦게 온 CANCELED 웹훅·동시 운영자 환불)로 돌아갔으면 라이선스를 되살리지 않는다**(`revertClaim`이
  주문을 다시 읽는다). 웹훅의 라이선스 닫기(`refundLicensesOnFullCancel`)는 실패를 던져 토스가 다시 보내게 한다.
- 결제수단은 토스뿐(`tossOnly`) — 계좌 입금은 키 즉시 발급과 맞지 않아 넣지 않았다.
- 결제 대기 정리는 공연 만료 크론(`/api/cron/expire-show-orders`)이 같이 한다(1시간 지난 pending → expired).
- 관리자 라이선스 목록은 이메일을 보여 준다 — 결제로 고객 라이선스가 쌓이기 시작하면 개인정보 접속기록(`lib/privacy/accessLog.ts`)에 열람 기록을
  더할지 함께 정한다(처리방침 19항 열거와 같이 움직인다).
