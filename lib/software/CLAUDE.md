# CLAUDE.md — 소프트웨어(플러그인·툴) 판매

`lib/software/`·`data/software/`·`pages/[locale]/software/`·`pages/api/software/`·`pages/admin/software/`를 만질 때 읽는 규칙이다.
계획·단계는 `docs/software-sales-plan-2026-10.md`, 플러그인 쪽 연동은 `docs/software/license-integration.md`(형식의 정본).

## 지금 상태 — 단계 1(라이선스 코어 + 체험판), 판매 잠김

- 상품 정본 `data/software/catalog.ts`(비어 있음), 판매 스위치 `SOFTWARE_SALES_OPEN = false`(`data/software/policy.ts`).
- 라이선스는 관리자 `/admin/software`의 **수동 발급**으로만 생긴다. 결제(국내 토스 → 해외 토스 페이팔)는 단계 2·3.
- 공개 화면 `/ko/software`·`/en/software`(다른 로케일은 /en으로)는 판매 전 `noindex`, 메뉴·사이트맵에 없다.

## 켜기 전에 (위에서부터)

1. **운영 DB에 마이그레이션 0054(`software_licenses`·`software_activations`)을 적용한다** — 배포보다 먼저(루트 CLAUDE.md
   "운영 DB 마이그레이션 적용 방법"). 새 표뿐이라 순서를 어겨도 다른 결제는 안 깨지고 소프트웨어 기능만 500/503이다.
2. **서명키를 만든다**: `node scripts/software/generate-license-key.mjs k1` → 비밀키를 Vercel env `SOFTWARE_LICENSE_SIGNING_KEY`
   (Sensitive)와 **오프라인 백업** 두 곳에, `SOFTWARE_LICENSE_KEY_ID=k1`, 공개키를 `data/software/publicKeys.ts`에 커밋.
   셋 중 하나라도 빠지면 활성화 API가 503으로 닫힌다(의도 — 플러그인이 검증하지 못하는 파일을 내주지 않는다).
3. 상품을 `data/software/catalog.ts`에 올린다(머리 주석의 예시). 설치 파일은 버전이 박힌 주소로.
4. 관리자에서 시험 키를 발급해 `docs/software/license-integration.md` §7 순서로 실제 DAW에서 확인한다.

## 바꾸면 안 되는 것 (어겨도 에러가 안 나는 것)

- **라이선스 파일 형식과 활성화 API 응답 코드.** 이미 배포된 플러그인이 오프라인으로 이 형식을 검증하고 이 코드값을 읽는다.
  바꾸려면 `v`를 올리고 옛 형식을 계속 받는다. `tests/api/software/activate.test.ts`가 응답 코드를 고정한다.
- **서명 대상은 payload의 원래 바이트다.** 서버·플러그인 어디서도 payload JSON을 다시 직렬화해 서명·검증하지 않는다.
- **`publicKeys.ts`의 kid는 지우지 않는다.** 키 회전은 새 kid를 더하고 env를 새 kid로 — 옛 플러그인은 옛 kid로 검증한다.
  비밀키를 잃으면 새 키로 바꿀 수밖에 없고, 그러면 **모든 플러그인을 다시 배포**해야 한다. 백업이 그래서 필수다.
- **상품 slug와 판매를 시작한 가격 id는 바꾸지 않는다.** 라이선스 행·라이선스 파일·플러그인이 slug로 상품을 가리킨다.
  가격 변경은 새 id(`data/software/catalog.baseline.test.ts`).
- **활성화 한도는 조건부 INSERT 한 문장으로 지킨다**(`activateLicense`). 개수를 읽고 따로 넣는 식으로 바꾸면 동시 요청이 한도를 넘는다.
- **없는 키와 다른 상품의 키는 같은 `invalid_key`(404)다.** 키가 어느 상품 것인지 드러내지 않는다.
- **라이선스 취소는 새 기기만 막는다.** 이미 활성화한 기기는 오프라인 파일이라 계속 돈다 — 의도한 동작이고, 상시 온라인 확인을
  넣지 않는다(스튜디오 컴퓨터는 인터넷을 끄는 일이 많다. 계획서 §8).
- 라이선스 키는 **평문 저장**이다 — 구매자 화면에서 다시 보여 줘야 한다. 새어도 기기 수 한도가 피해를 묶는다.
- `orders`에 칸을 더하지 않는다. 단계 2의 주문 정보(통화·금액)는 새 표 `software_orders`에(루트 CLAUDE.md 0022 절의 배포 순서 함정).

## 단계 2(국내 결제)에서 할 일

계획서 §3-5의 배선 목록(webhook DONE·CANCELED 두 분기, salesLedger, recordFailure 접두사 `SWR`, privatePaths·no-store,
orderRetention, cancel 경로, 메일, 결제 화면 `sharedCheckout.guard`)과 §4(청약철회 표시·`first_activated_at` 판정, 약관·처리방침,
`FUNDING_TERMS_VERSION`)를 따른다. 관리자 라이선스 목록은 이메일을 보여 주므로, 결제로 고객 라이선스가 쌓이기 시작하면
개인정보 접속기록(`lib/privacy/accessLog.ts`)에 열람 기록을 더할지 함께 정한다(처리방침 19항 열거와 같이 움직인다).
