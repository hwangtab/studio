# CLAUDE.md — 상점(음반·굿즈)

`lib/shop/`·`components/shop/`·`pages/[locale]/shop/`·`pages/admin/shop/`·`data/shop/`를 만질 때 읽는 규칙이다.
설계 배경은 `docs/merch-shop-plan-2026-10.md`(§10이 최신 결정).

### 판매는 잠겨 있다 — `SHOP_SALES_OPEN`(data/shop/policy.ts)

false면 주문 API(`/api/shop/orders`)가 409 `sales_closed`로 거절하고, 상품 화면은 주문 폼 대신 "판매 준비 중"을 보이며,
목록·상세는 `noindex`다. **처리방침이 고지하지 않은 배송지를 받지 않으려고** 이 순서를 코드로 막는다.

#### 판매 개시 체크리스트 (위에서부터)

1. **운영 DB에 마이그레이션 0052(`shop_skus`·`shop_orders`·`shop_order_items`)를 적용한다** — 배포보다 먼저(루트 CLAUDE.md
   "운영 DB 마이그레이션 적용 방법", Turso CLI). 새 표뿐이라 순서를 어겨도 다른 결제는 안 깨지고 상점만 꺼진다.
2. ~~개인정보 처리방침을 고친다~~ — **완료(2026-10-14, `funding-terms-2026-10-14-r3`)**. `data/privacyPolicy.ts` ko: 1항 수집 항목(주문자·받는 분·
   택배사/운송장·디지털 첫 내려받기 시각), 2항 목적(발송·교환·반품·환불·디지털 전달), 3항 보유(받는 분 정보는 ④와 함께), 4항 판매자·로젠택배 발송·
   **아티스트 직접 발송 시 그 주문의 발송 정보만 제공**(배송 완료 30일 뒤 가림, 열람 기록) + 수탁자 표(로젠택배·아티스트·Cloudflare), 16항 내려받기,
   18항 ④ 상품 주문(받는 분 정보 덮기) · 보존 항목, 19항 아티스트 열람 기록. **택배사를 바꾸거나 아티스트 발송 화면의 제공 항목·가림 기간·열람 기록을
   바꾸면 4항과 수탁자 표를 같이 고치고 판본을 올린다**(ko 처리방침 전체가 펀딩 약관 판본 해시 대상 — 루트 CLAUDE.md "약관·처리방침을 고치면…").
3. 이용약관(`/ko/terms`)의 "상품 판매" 절은 **이미 `SHOP_SALES_OPEN`에 묶여 있다 — 켜면 함께 열린다.** 문구는 `lib/shop/policyCopy.ts`의
   **`SHOP_TERMS_SECTIONS`(약관 문체 — 합니다체·조항체)**를 렌더한다(판매자·배송·예약 판매 공급 시기·실물 청약철회·디지털 청약철회·한정판 번호).
   상점 화면의 해요체 문구(`SHOP_REFUND_RULES`·`SHOP_DIGITAL_RULES` 등)와 **같은 약속**만 하고, 기간·금액은 같은 상수(`SHOP_WITHDRAWAL_DAYS`·
   `SHOP_DEFECT_WITHDRAWAL_*`·`SHOP_SHIPPING_FEE`·`SHOP_FREE_SHIPPING_FROM`)에서 끌어 쓴다. 약속을 바꾸면 두 벌을 함께 고친다 — 약관에 화면 해요체를 그대로 싣지 않는다.
4. **상품은 관리자 화면에서 등록한다**(`/admin/shop` → "상품 등록" — 스튜디오 상품도 같다. 아래 "관리자 직접 등록"). 제목·본문·사진·옵션·가격을 채워
   저장하고 "바로 승인"한다. `data/shop/catalog.ts`는 이미 있는 파일 상품을 위해 남아 있을 뿐 새 상품은 거기 올리지 않는다(파일 상품을 올리면
   `public/images/shop/…webp`를 `git add -f`하고 SKU 기준선·히어로 폰트 서브셋을 함께 커밋해야 한다 — DB 상품에는 그 절차가 없다).
5. 승인한 뒤 같은 상품 화면(`/admin/shop/products/<id>`)의 옵션 표에서 SKU별 총 재고를 넣는다(행이 없으면 품절이다). `/admin/shop`의 재고 표에서도 된다.
6. `SHOP_SALES_OPEN = true`로 바꿔 배포한다.
7. 헤더·푸터 메뉴(`SHOP_NAV_LABEL`), 런타임 사이트맵(`/sitemap-shop.xml` — robots의 `additionalSitemaps`는 `next-sitemap.config.js`가
   `data/shop/policy.ts`의 선언을 읽어 싣는다), `pages/api/llms.ts`·`llms-full.ts`의 상점 절, `/ko/terms` 상품 판매 절은 **이미 `SHOP_SALES_OPEN`에
   묶여 있다 — 켜면 함께 열린다.** 켠 뒤 `/sitemap-shop.xml`이 상품·아티스트 URL을 내는지 한 번 열어 본다.
8. 최소 금액으로 실결제 → 취소를 한 번씩 한다(카드·간편결제).

### 결제 — 카드·간편결제(토스) / 계좌로 직접 입금 (2026-10-14)

운영자 결정(2026-10-14): 토스 계좌이체는 뱅크페이가 떠 고령층이 쓰지 못해 뺐고, 계좌 수단은 우리 계좌번호를 안내하는 직접 입금이다
(2026-10-12 "상점은 직접 입금을 받지 않는다"를 뒤집었다 — 환불 때 운영자가 고객 계좌를 받아 손으로 송금하는 부담은 알고 내린 결정).
규칙은 공연·예약과 같다(`lib/payments/bankDeposit.ts` 머리 주석). 상점 고유 사항만 적는다:

- **생성**: `/api/shop/orders`가 `paymentMethod: 'bank_transfer'`를 받으면 `createShopOrder(…, { paymentMethod })`가 주문을 `awaiting_deposit`으로 **바로**
  만든다(토스 홀드를 거치지 않는다). 입금 안내 메일(고객+운영자, `deliverShopDepositGuide`)을 보내고 **주문 확인 주소**(`/ko/shop/manage/…?token=`)를
  돌려준다 — 그 화면이 입금 안내(`BankDepositGuide`)다.
- **재고는 기한 없이 점유한다** — `lib/shop/stock.ts`의 점유 판정에 `awaiting_deposit`이 들어 있다. 화면의 남은 수량·생성 게이트·한정판 번호 게이트가 모두
  같은 식을 쓴다. `expireStaleShopOrders`(크론)는 `pending`만 봐서 입금 대기를 건드리지 않는다(자동 취소 없음). **새 만료·점유 경로를 만들면 이 규칙을 지킬 것.**
- **입금 확인**(`confirmShopBankDeposit`, 관리자 `/admin/shop/<주문번호>`의 "입금 확인"): `awaiting_deposit → paid` + 결제 행(`bank-deposit:<주문번호>`) +
  한정판 번호 배정을 한 batch로, 이어서 토스 확정과 같은 확정 메일(디지털 상품이면 내려받기 안내 포함). 재고를 다시 세지 않는다(대기 내내 점유했다).
  **미입금 취소**(`cancelAwaitingShopDeposit`, 관리자·고객 공용)는 `deposit_cancelled`로 닫고 재고를 푼다 — 닫힌 신청은 입금 확인할 수 없다.
  고객이 입금 전에 취소하면(`/api/shop/cancel`이 입금 대기 주문을 이 길로 보낸다) 운영자에게만 알린다.
- **환불은 운영자가 송금한다 — 계좌는 화면에서 받는다**(마이그레이션 0061: `refund_accounts.order_kind`에 `merch` 추가 — SQLite는 CHECK를 못 고쳐 표를 다시 만들었다).
  입금으로 확정된 주문은 고객이 주문 확인 화면에서 **환불 계좌**(은행·계좌번호·예금주, `RefundAccountFields`)를 적고 취소한다 — `cancelShopOrder`가 선점 **전에**
  계좌를 검증·암호화하고(`planBankRefund`, 키가 없거나 형식이 틀리면 주문을 건드리지 않는다), 선점 뒤 `refund_accounts`(kind `merch`)에 저장하고, 토스를 부르지 않고
  환불 기록만 남긴다(`settleRefund`의 계좌 입금 경로). 돈은 아직 안 나갔다 — 운영자 알림 메일이 "환불 송금 필요"로 오고, 관리자 `/admin/shop/<주문번호>`의
  **환불 계좌 → 계좌 보기(접속기록) → 송금 후 "송금 완료"**(`mark_refund_sent`)를 누른다. 안 누르면 헬스체크가 48시간 뒤 알린다(예약·공연과 같은 기한: 접수일부터 3영업일).
  운영자 "전액 환불"(계좌 입금 주문)은 이미 송금한 뒤 기록하는 것이라 계좌를 받지 않는다. 발송 뒤 반품은 고객 셀프 취소가 아니라 운영자 환불로 한다(기존 규칙 그대로).
  주문 확인 메일·취소 메일·화면 문구는 계좌 입금 주문일 때 "입금하신 계좌로"·"접수일부터 3영업일 이내"로 바뀐다. 파기는 주문의 5년 파기를 따른다(`purgeRefundAccountsOfPurgedOrders`에 `merch` 포함).
- `tests/payments/sharedCheckout.guard.test.ts`는 `merch`에 `withBank`를 요구한다.

- 승인은 `lib/shop/confirm.ts` — 예약금 결제 링크(`lib/booking/confirmDeposit.ts`)의 안전장치 + **재고 재판정**(아래).
- 웹훅(`lib/booking/webhook.ts`)에 `merch` 분기가 있다. **없으면 모르는 type이 `'session'`으로 떨어져 예약 확정으로 간다.**
  새 주문 종류를 만들면 이 두 분기(DONE·CANCELED)부터 넣는다.
- 환불은 전액만(`lib/shop/cancel.ts`, 돈이 움직이는 구간은 예약·믹싱과 같은 `settleRefund`). 고객은 발송 전에만, 운영자는
  발송 뒤 반품도. 부분 환불은 토스 콘솔에서 하면 웹훅 대사(`reconcileRefunds`)가 원장을 맞춘다.
- 주문번호 `SHP-YYYYMMDD-XXXXXXXX`. 결제 실패 기록 패턴(`lib/payments/recordFailure.ts`)에 SHP가 들어 있다 — 빼면 실패 사유가 조용히 안 남는다.

### 재고는 계산값이다 — 차감·복원 쓰기가 없다

`shop_skus.stock`은 "지금까지 내놓은 총수량"이고, 남은 수량은 매번 주문에서 뺀다(`lib/shop/stock.ts`). 점유로 세는 것:
`paid`·`partially_refunded`·`auto_cancel_pending`, 그리고 홀드(10분)가 안 끝난 `pending`. `refunded`·`expired`·`failed`는
세지 않는다 — **환불·만료가 겹쳐도 재고가 두 번 돌아오는 일이 구조적으로 없다.** 대신:

- **발송 뒤 반품 환불도 재고로 돌아온다.** 되팔 수 없으면 관리자에서 총 재고를 줄인다.
- 생성 게이트는 홀드가 끝난 주문을 세지 않는다(새 손님에게 자리를 연다). 그래서 홀드가 지난 뒤 결제를 마친 주문과 그 사이 같은
  재고를 잡은 주문이 동시에 승인될 수 있다 — 확정 UPDATE의 WHERE가 **나를 뺀 나머지로 다시 센다**(공연 `excludeOrderNo`와 같은 자리).
  걸리면 승인된 돈을 전액 자동 취소한다(`autocancel:` 멱등키). 이 게이트를 빼면 초과 판매다.
- 화면의 남은 수량(`getRemainingStock`)과 게이트(`stockGateSql`)는 같은 점유 판정(`occupyingCondition`)을 쓴다. 한쪽만 고치지 말 것.

### 상품 정본은 둘 — 파일이 먼저, 그다음 DB (`repository.ts`가 유일한 입구)

아티스트 상점 플랫폼(설계 `docs/shop-artist-platform-design-2026-10.md`)부터 상품 정본이 둘이다. 상품을 읽는 서버 코드는
`data/shop/catalog.ts`나 `lib/shop/catalog.ts`의 동기 조회를 직접 부르지 말고 `lib/shop/repository.ts`를 거친다.

- 순서는 **파일 먼저, 그다음 DB.** 같은 slug가 양쪽에 있으면 파일이 이긴다(비공개 파일 상품의 slug도 DB가 가로채지 못한다).
  공개 목록·상세는 DB 오류를 삼키고 파일 상품만 돌려준다(빌드는 TURSO 없이 성공해야 한다). 주문 생성만
  `findSellableSkuAsync`가 `{found}`/`{lookupFailed}`로 나눠 `lookup_failed` → API 503.
- **`db-` 접두사**: DB 상품의 SKU id는 서버가 `db-` + hex10으로 만든다. 파일 SKU는 못 쓴다(`validateShopCatalog`가 거부) —
  두 정본의 SKU 충돌이 구조적으로 불가능하고, **`db-`로 시작하지 않는 SKU는 새 표를 조회하지 않는다.** 새 표에 닿는 확정·취소·생성
  문장은 `db-` 줄이 있을 때만 돌게 만들 것(`isDbSkuId`, `lib/shop/productRules.ts`).
- DB 상품 공개 = `review_status='approved' AND published=1`, 판매 가능 SKU = `locked_at IS NOT NULL AND retired=0`.
  공개 객체(`ShopProduct`)에 `digital_files`(R2 키)를 싣지 않는다 — `hasDownloads`만. `kind: 'digital'`·`editionSize`는 DB 상품 전용.
- 마이그레이션 **0053은 새 표 다섯 개뿐**(`shop_artists`·`shop_products`·`shop_product_skus`·`shop_serials`·`shop_order_downloads`)이다.
  기존 표에 컬럼을 더하지 않았고 새 표를 기존 `relations()`에 잇지 않았다(0022 함정). 그래도 순서는 **마이그레이션 → 배포**.
  뒤집어도 파일 상품 결제는 안 깨진다(새 표를 안 읽는다) — 목록·상세는 DB 오류를 삼키고, `db-` SKU만 503.
- slug 예약어에 `artist`가 늘었다(`/ko/shop/artist/<slug>`).

### 아티스트 등재·공개 상점·콘솔 탭·미디어 청소 (플랫폼 PR 2)

- **등재는 관리자만**: `/admin/shop/artists` → `createShopArtist`가 이메일(소문자 정규화, 로그인과 같은 방식)로 `funding_creators`를 찾거나
  만들고 `shop_artists` 행을 만든다. 이미 있는 계정의 이름은 건드리지 않는다(기본 이름일 때만 채운다). slug가 `data/artists` slug와
  같으면 "같은 사람" 확인 없이는 거부(사칭 방지)하고 확인하면 `curated_slug_linked=1`. slug 변경(`updateShopArtistSlug`)은 승인된
  상품이 하나라도 있으면 거부한다(주소가 이미 퍼졌다).
- **공개 상점 `/ko/shop/artist/<slug>`**: SSR, `s-maxage=30`, ko 전용. `resolveShopArtist`가 `data/artists` 먼저, 없으면
  `shop_artists`+`funding_creators`. **아티스트가 없거나 공개 상품이 0개면 404**, 판매 닫힘이면 noindex. props에는 slug·이름·소개·링크(http(s)만)·
  사진·`curatedSlug`만 싣는다 — `creatorId`는 서버 전용(`tests/pages/shop/artistPage.test.ts`가 고정). 상품 목록은
  `listShopProductsByArtist` = 파일 상품(`artist===slug`) + 그 slug 소유자의 공개 DB 상품(파일 slug에 가려지는 것은 뺀다, DB 오류는 삼킨다).
  상품 상세의 아티스트 링크는 `/ko/shop/artist/<slug>`(DB 상품은 `findShopArtistOfDbProduct`로 올린 아티스트를 찾는다).
- **개설자 콘솔 상점 탭** `/ko/funding/creator/shop`(no-store, noindex, ko 전용): `shop_artists` 행이 없으면 안내만. 있으면 프로필(이름·소개·링크는
  펀딩과 같은 `funding_creators`라 `saveCreatorSection`을 그대로 쓴다 — 이름 잠금 포함)과 프로필 사진. 사진은 업로드 라우트
  `target=shop-profile`(권한 = `shop_artists` 행, 정사각 640px)로 올리고 `profile.ts`의 `section:'image'`가 저장한다(`isOwnUploadedMedia`로 자기 업로드만).
- **미디어 공개 판정은 펀딩과 별도 문장·별도 try**(`lib/shop/mediaAccess.ts`): 승인·공개 상품의 `images`, 그리고 승인 상품이 하나라도 있는 아티스트의
  프로필 사진. 펀딩 판정이 false일 때만 이어서 본다 — 한 쿼리에 OR로 붙이면 상점 표가 없는 DB에서 펀딩 이미지까지 404가 된다.
- **월간 청소가 상점 참조도 본다**(`lib/funding/mediaRetention.ts`): `shop_products.images` 전부(초안 포함)와 `shop_artists.profile_image_url`을 별도 쿼리로.
  표가 없으면(`no such table`) 빈 집합, **그 밖의 오류는 던져 청소를 중단**한다 — 삼키면 공개 중인 사진을 지운다.

### 상품 정의는 파일, 재고·주문은 DB

`data/shop/catalog.ts`가 이름·옵션·가격의 정본이고 **아무것도 import하지 않는다**(클라이언트가 값으로 쓴다). 주문 API는 요청의
금액·이름을 보지 않는다. 주문 줄은 주문 시점의 상품명·옵션·단가를 스냅샷한다.

- **판매를 시작한 SKU의 id·가격은 바꾸지 않는다** — 가격은 새 id로 더하고 옛 SKU는 `retired: true`. `catalog.baseline.test.ts`가
  지우기·가격 변경을 막고, 갱신 경로도 같은 위반을 거부한다.
- slug `success`·`fail`·`manage`는 페이지 이름이라 못 쓴다(`SHOP_RESERVED_SLUGS`, 검사기가 막는다).
- 배송비 4,000원·상품 20만원 이상 무료(운영자 결정 2026-10-12)는 `data/shop/policy.ts`. 카피·FAQ·폼은 그 상수로 문구를 만든다.

### 아티스트 상품(위탁 판매) — 판매자는 스튜디오, 발송은 상품별(기본은 스튜디오)

운영자 결정 2026-10-14(계획 `docs/artist-store-plan-2026-10.md`). 아티스트가 재고를 맡기고, 스튜디오가 자기 이름으로 팔아
발송한 뒤 아티스트에게 정산한다. 결제·재고·배송·환불은 스튜디오 상품과 **같은 경로**다 — 아티스트 상품만의 주문 흐름은 없다.
다만 상품에 따라 **아티스트가 직접 발송**하기도 한다(아래 "발송 주체"). 그때도 판매자·결제·환불·고객 응대는 스튜디오다.
상품의 출처는 둘이다: 파일 상품(`artist: '<data/artists slug>'`)과 아티스트가 콘솔에서 등록한 **DB 상품**(`creator:<id>`).

**파일 상품**
- 상품에 `artist` 하나를 붙인다. 그 아티스트 페이지 `/ko/artists/<slug>`에 상품이 모이고(판매가 열려 있을 때만), 상품 화면에 아티스트
  링크가 붙는다. 등재 아티스트가 아니면 `catalog.test.ts`가 선다. 판매를 시작한 SKU의 아티스트는 바꾸지 않는다 —
  정산이 SKU → 상품의 `artist`로 찾는다(`catalog.baseline.json`이 SKU마다 `{ price, artist }`를 고정한다).

**DB 상품 — 등록·심사·잠금 (플랫폼 PR 3)**
- **등록**: 개설자 콘솔 상점 탭(`/ko/funding/creator/shop`)의 "새 상품" → `/ko/funding/creator/shop/<id>`. `shop_artists` 행이 있는
  계정만(`createDraftProduct`), 미심사(작성 중·심사 대기·보완 요청) 10개까지. 초안 주소는 `draft-<uuid>` 임시값이고 `draft-` 접두사는 실제
  주소로 못 쓴다. 한도·가격 규칙(1,000~1,000,000원, 10원 단위, 사진 8장, 옵션 12개)은 `SHOP_CREATOR_LIMITS`(`productRules.ts`) 한 벌 —
  화면과 서버가 같이 쓴다. 입력 검증은 순수 모듈 `creatorValidation.ts`, 쓰기는 `creatorProductWrite.ts`.
- **심사**: `decideShopProduct`(`reviewDecision.ts`), 관리자 `/admin/shop/products`. 전이는 펀딩의 `nextReviewStatus` 재사용.
  승인은 **한 묶음**(slug 확정 · SKU `locked_at` · 승인+공개)이고, SKU 잠금 UPDATE의 `EXISTS`가 `p.updated_at = <이 배치의 epoch>`까지 요구한다 —
  남이 먼저 승인했으면 이 호출은 conflict이면서 잠그지 않는다. 시각 칸은 전부 **초 단위 정수**다. 거부 조건: 파일 slug 충돌·예약어·다른 DB 상품의
  slug 점유·사진/소개/옵션 없음·옵션이 여럿인데 이름 없음·이름 미설정(기본값)·`shop_artists` 없음·디지털인데 파일 없음.
  보완 요청·반려는 메모 필수이고 **`review_note`는 아티스트 화면에 그대로 보인다**(내부 메모가 아니다). 내부 메모는 `internal_note`(관리자 전용) —
  아티스트 조회(`loadProductForCreator`)는 그 칸과 `digital_files`를 읽지도 않고, 테스트가 응답에 없음을 고정한다.
- **승인 뒤 잠금**: 열린 칸은 부제·소개·사진·공개 여부·새 옵션·판매 종료(`SHOP_PRODUCT_EDITABLE`). 제목·주소·분류·종류·한정 수량·예약 발송일(관리자만)과
  **잠긴 SKU의 id·가격·옵션명·삭제**는 거부한다. 쓰기 UPDATE의 WHERE에 `locked_at IS NULL`을 한 번 더 건다(읽은 뒤 승인이 잠근 경합은 0행).
  가격 변경은 새 옵션. 승인 뒤 더한 옵션은 안 잠긴 채라 **팔리지 않고**, 관리자 "새 옵션 승인"(`lock_new_skus`)이 잠그는 순간 팔린다.
  "새 옵션 승인"은 화면이 본 미잠금 옵션 목록(`{id, price, optionLabel}`)을 함께 보내고, 지금 미잠금 옵션 집합·값이 그 목록과 다르면 **하나도 잠그지 않고** conflict다
  (UPDATE 문장 하나가 `id IN (본 목록)` + 가격·옵션명 일치 + "미잠금 전체 = 본 목록"을 판정한다 — 운영자가 보지 않은 옵션·가격이 팔리기 시작하지 않게).
- **심사 대기·승인 상품은 소개(첫 문단)·사진을 비울 수 없다**(`saveProduct`가 `findMissingShopProductFields`의 같은 정의로 거부) — 상세의 검색 요약·대표 사진이 그 칸을 읽는다.
  상세 페이지는 빈 소개도 견딘다(요약은 부제·제목으로 대신).
- **관리자 저장·바로 승인은 화면을 연 판본(`updated_at`)을 싣는다**(`expectedUpdatedAt`) — 그 사이 아티스트가 고쳤으면 conflict(덮어쓰기·못 본 판본 승인 방지). 라우트는 값이 없으면 400.
- **승인 뒤 수정 알림**: 승인 상태에서 저장하면 `creator_edited_at`을 찍고 운영자에게 메일(`sendShopCreatorEditedNotice`) — 재심사 대기열은 없다.
  관리자 화면이 "승인 뒤 수정"과 "승인 대기 옵션"을 표시한다. 메일 실패는 저장·판정을 실패시키지 않는다(판정 메일은 운영자 폴백 메일이 있다).
- **재고는 관리자만**(스튜디오가 보관·발송하는 상품): 아티스트 쓰기 경로(`creatorProductWrite.ts`)에 `shop_skus`가 없다(테스트가 소스를 검사한다). 아티스트가 직접 보내는 상품만 예외로 `creatorStock.ts`가 자기 옵션의 총 재고를 넣게 한다(아래 "발송 주체"). `setSkuStock`은 잠긴 SKU만
  받고 `edition_size`가 있으면 그 상품 재고 합이 한정 수량을 넘지 못하게 한다 — **INSERT … SELECT의 WHERE 하나가** "다른 옵션 합 + 이 값 ≤ 한정 수량"을 판정한다(읽고 쓰는 사이 경합 없음, 0행이면 거부).
  승인하면 공개되므로 재고(0이면 품절)를 바로 넣는다.
- **관리자 액션**: `lock_new_skus`·`set_ships_on`·`set_published`·`set_internal_note`·`set_digital_files`(키는 `shop/` 접두사 + `isSafeObjectKey` +
  R2 존재 확인). 승인·공개 토글 뒤 그 아티스트가 `data/artists`와 연결돼 있으면 `/ko/artists/<slug>`를 재검증한다(실패는 `warnings`). 아티스트 콘솔의 공개 토글·승인 상태 저장도
  같은 `revalidateShopArtistPages`를 부른다(실패는 로그만).
- **판매 현황**: 콘솔 상점 탭의 표(`creatorStats.ts`) — SKU별 맡긴 수량(`shop_skus.stock`)·결제 완료·발송 완료·남은 수량. 구매자 정보는 읽지 않는다.
  부분 환불 주문은 결제 완료로 센다(어느 줄이 환불됐는지 원장이 모른다).
- **이름 잠금**: 상점 상품이 심사 중·승인이면 아티스트 이름이 잠긴다(`hasReviewedProject`, `lib/funding/CLAUDE.md`).

**정산**
- 아티스트 몫 `SHOP_ARTIST_SHARE_PERCENT`(55%, 상품 판매가 VAT 포함 기준). 스튜디오가 보낸 주문의 배송비는 정산에 넣지 않고(스튜디오 몫), **아티스트가 직접 보낸 주문은 배송비 전액을 더한다**(상품 55% + 배송비 100%, 주문당 한 번). 계산은 `lib/shop/artistPayout.ts` 하나. 개인 아티스트는
  부가세 상당액과 원천징수 3.3%를 뺀다(펀딩 정산과 같은 이유). `/admin/shop`의 "아티스트 정산 예정"이 그 달(KST)에 **발송한** 결제 완료 주문만
  센다 — 파일 갈래는 키 `file:<slug>`(세금 유형은 `data/artists`), DB 갈래는 `creator:<id>`(`sku_id → shop_product_skus → shop_products.creator_id`,
  세금 유형은 `funding_creators.tax_type`, 비어 있으면 "계산하지 않음"). DB 갈래는 별도 try라 실패해도 파일 갈래 표는 나온다.
  **정산은 이제 기록한다**(P1, 마이그레이션 `0067_partner_payouts` — 설계 `docs/settlement-record-design-2026-10.md`): 시스템은 계산하고 기록하고, **송금은 운영자가 은행 앱으로** 한 뒤 "지급 완료"를 누른다.
  `/admin/shop`의 같은 표(`components/admin/ShopPayoutSection.tsx`) 각 행에 [정산 기록] [지급 완료] [기록 취소(이체 전)] [계좌 보기] [조정 추가]. 규칙은 `lib/partnerPayouts/`에 있다:
  - **단위는 아티스트 × 달(KST)**: `partner_payouts(kind='shop', subject_key='creator:<id>'|'file:<slug>', period='YYYY-MM')`, `UNIQUE(kind, subject_key, period)`가 이중 기록을 막는다(`already_recorded`).
    기록은 **불변 스냅샷**이다(금액·세금 구분·수취인 이름). 이체 전(`pending`)에 한해 "기록 취소"로 지우고 다시 기록한다 — 이체한 기록은 못 지운다.
    미리보기 `buildShopPayoutPreview(s)` → `recordShopPayout(subjectKey, period, now, expected)` → `markPartnerPayoutPaid(id, memo, now)` / `deletePartnerPayoutIfPending(id)`(`store.ts`).
    `expected`(화면이 보여 준 실이체액·조정액)가 지금 계산과 다르면 `amount_changed`로 거절한다(펀딩 정산과 같은 낙관적 대조).
  - **막는 조건**(펀딩과 같은 틀, 미리보기가 `blockers`로 보인다): 세금 구분 없음 · 정산 계좌 없음 · 사업자인데 사업자 정보 없음/못 읽음 · 위탁 약관 현재 판본 미동의 · 이미 기록 · 판매 없음.
    **주민등록번호 미등록은 막지 않고 경고**(지급명세서 때 필요하지 송금에는 불필요). 계좌·번호는 **존재만** 본다 — 값은 props에 안 나가고, "계좌 보기"는 개설자 단위 열람 라우트(`/api/admin/creators/<id>/payout-account`, 접속기록)를 버튼으로 쓴다.
    **파일 갈래 아티스트(`file:<slug>`)는 계정이 없어** 계좌·약관·사업자 막음이 없고 `creator_id`는 NULL, 계좌 보기 버튼이 없다(기록·지급 완료는 된다).
  - **이월 조정**(`partner_payout_adjustments`, 부호 있음, **아티스트 몫(VAT 포함) 기준**): 정산 뒤 환불 등을 다음 정산에 싣는다. 기록할 때 그 수취인의 미적용 조정이 한 batch로 그 정산에 실리고(`applied_payout_id`),
    기록 취소 때 풀린다. 몫이 모자라 음수가 되면 **실이체 0원 + 남은 음수는 다음 정산으로 이월**(새 조정 `carryover:<정산 id>` + 기록의 `shortfall_amount`). 계산은 `computeShopArtistPayout`의 `adjustmentAmount`(몫에 더한 뒤 부가세 상당액·원천징수) — `shopCalc.ts`.
  - **정산 뒤 환불 자동 조정**(`shopLateRefund.ts`, reason `late_refund`): 전액 환불로 `refunded`가 된 주문이 **이미 기록된 정산의 스냅샷에 들어 있었으면**(발송 달 기록 + 기록 시각 ≥ 발송, 환불 완결 시각 ≥ 기록 시각) −(판매가×55% + 아티스트 직접 발송이면 배송비) 조정을 쌓는다.
    호출처는 `cancelShopOrder` 끝과 웹훅 전액 취소 대사(`closeShopFulfillmentOnFullCancel`)이고, `(kind, payee_key, reason, source_ref=주문번호)` UNIQUE라 멱등이다. **환불은 이 조정이 실패해도 성공한다**(`safeSync…`가 던지지 않고 로그 `[partner-payouts]`) —
    못 쌓은 조정은 그 아티스트의 다음 정산 기록 직전 보충(`syncShopLateRefundAdjustments({ subjectKey })`)이 메운다. **부분 환불(`partially_refunded`)은 만들지 않는다**(원장이 어느 줄인지 모른다 — 정산 예정 표의 "직접 확인"과 같다).
    이체 전 기록을 지우면 그 정산을 바로잡던 환불 조정(`origin_payout_id`)도 지워진다(다시 기록하는 스냅샷이 이미 반영 — 이중 공제 방지). 그 조정이 다른 달 정산에 이미 실렸으면 취소를 거절한다(`adjustment_applied`).
    시스템이 만든 조정은 지우지 않는다 — 잘못 생긴 것은 반대 부호의 **수기 조정**(`add_adjustment`)으로 상쇄한다.
  - **표가 없는 DB(0067 전)**: 정산 표는 "마이그레이션 0067 필요" 안내와 함께 예전 읽기 전용 "정산 예정" 표로 되돌아가고 `/admin/shop`의 재고·주문은 그대로다. 환불 경로는 조용히 건너뛰고, 대시보드 두 카드는 0, API는 503 `migration_needed`.
  - 대시보드: 「정산 기록 대기 상점(지난 달)」(이번 달 이전 `SHOP_PAYOUT_RECORD_FROM_MONTH`(2026-10)부터 판매가 있었는데 기록이 없는 아티스트×달, 최대 12달) · 「이체 대기 상점 정산」. **기한 알림(헬스체크)은 없다** — 위탁 약관은 시기를 "스튜디오가 따로 알린다"고만 한다(권장: 매월 10일까지 전월분, 코드로 강제하지 않는다).
  - **정산 안내 메일**(P3, `lib/partnerPayouts/notify.ts`의 `sendPartnerPayoutNotice(payoutId, 'recorded'|'paid', { req, actor })` — 종류(shop/show)를 가리지 않는 단일 진입점, 공연 라우트도 이 한 줄이면 된다): 기록·지급 완료 뒤 수취인(개설자 이메일)에게 펀딩 `payoutEmail`과 같은 틀로 보낸다.
    **계좌는 은행명·예금주·뒤 4자리뿐**(번호 전체 금지), 계좌를 연 일은 접속기록 `partner_payout_account_email`(대상 = 정산 기록 id)에 남는다. **운영자 메모는 지급 완료 메일에만 실린다**(펀딩과 같다 — 화면의 메모 입력 문구가 "아티스트에게 보여도 되는 말만"이라고 안내한다).
    **메일 실패는 기록·지급을 실패시키지 않는다**: 함수는 던지지 않고 `warnings`를 돌려주며 라우트가 응답에 `warnings`로 싣고(화면은 새로고침하지 않고 안내를 띄운다) 운영자 폴백 메일을 보낸다. 계정 없는 수취인(`file:<slug>`)·수기 플레이스홀더 주소(`isManualPlaceholderRecipient`)에는 보내지 않고 "직접 알려 달라"는 warning만 낸다.
  - **정산 CSV**(P3, `GET /api/admin/partner-payouts/export?kind=shop|show|all&from=YYYY-MM&to=YYYY-MM`, 최대 24개월, `lib/partnerPayouts/export.ts`): 세무사용. 열은 상수 목록 하나로 고정(`PARTNER_PAYOUT_EXPORT_COLUMNS`) — **수취인 이름·금액·상태뿐이고 주민등록번호·계좌·이메일·연락처는 싣지 않는다**(새 칸을 `select *`로 흘려 넣지 말 것).
    기준월은 상점 = 정산 달(`period`), 공연 = 정산을 기록한 달(KST, `period`가 'all'이라). 내려받음은 접속기록 `partner_payout_export`(대상 `종류_시작월_종료월`, 행 수만 — 성공·오류 모두, 형식 400은 안 남김). 진입점: `/admin/shop` 정산 절의 폼, `/admin/revenue` 결제 내역 링크.
  - 보존·파기 코드는 이 표를 본다(`lib/partnerPayouts/creatorPayouts.ts` — 루트·`lib/funding/CLAUDE.md`).
  (위탁 약관 제7조·처리방침 14·15항은 2026-10-16부터 "달 단위 정산·이월·정산 기록 보관"을 약속한다 — 코드가 그 약속을 따라가는 곳이 위 규칙이다.)
- 이미 정산한 달의 반품 환불은 위 "정산 뒤 환불 자동 조정"으로 다음 정산에서 빠진다. 기록 전(미기록 달)에 환불된 주문은 그냥 표에서 빠진다.
  부분 환불 주문은 어느 줄이 환불됐는지 원장이 모르므로 계산에서 빼고 "직접 확인"으로 띄운다(조정도 만들지 않는다 — 운영자가 수기 조정으로 맞춘다).

### 위탁 약관 — 콘솔 전자 동의 (마이그레이션 0059)

아티스트와의 위탁 판매 계약은 개설자 콘솔의 **클릭 동의**로 맺는다(연습실 전자계약 `lib/contracts`는 쓰지 않는다). 본문은
`lib/shop/artistTerms.ts`의 `SHOP_ARTIST_TERMS_SECTIONS`(순수 모듈 — 정산 비율·원천징수율·택배사·가림 기간·사업자 정보를 상수에서 보간),
판본은 `SHOP_ARTIST_TERMS_VERSION`. 펀딩 개설자 약관·공연 주최자 약관과 같은 해시 게이트(`content/shopArtistTerms.baseline.test.ts`,
갱신 `UPDATE_SHOP_ARTIST_TERMS_BASELINE=1` — 판본을 안 올린 내용 변경은 갱신 경로가 거부한다)를 탄다. 제9조가 처리방침 4항이 약속한
"위탁 계약"이다 — 아티스트에게 주는 항목·가림 기간을 바꾸면 처리방침 4항과 이 약관을 함께 고치고 둘 다 판본을 올린다(테스트가 두 문서의 항목 문자열을 대조한다).

- **기록**: 새 표 `shop_artist_terms_agreements(creator_id, terms_version, agreed_at)`, PK가 두 칸이라 판본마다 한 행이 쌓이고 옛 행은 남는다
  (`lib/shop/artistTermsAgreement.ts`). 남기는 것은 펀딩·공연 약관 동의와 같은 판본·시각뿐이다(IP를 남기려면 처리방침 13항부터 고친다).
- **판정**은 "현재 판본 행이 있는가" 하나. 판본을 올리면 모든 아티스트가 다시 동의 화면을 본다.
- **fail-closed**: 표가 없는 DB는 미동의다 — 콘솔은 동의 화면(저장은 503), 쓰기 API는 403, 아티스트 상품 승인은 `terms_not_agreed`.
  그래서 순서는 **마이그레이션 → 배포**(뒤집어도 결제·주문은 안 깨지고 아티스트 상점 쓰기·승인만 멈춘다).
- **동의 전 막는 것(서버)**: 상품 생성·저장·제출·공개 토글(`products`·`products/[id]`), 상품 사진 업로드(`upload?productId=`), 재고 입력(`stock`),
  발송 처리(`shipping`) — `rejectUnlessShopArtistTermsAgreed`(`creatorWriteHttp.ts`). 화면은 `/ko/funding/creator/shop`이 상품·판매 현황·발송 대신
  `ArtistTermsConsent`를 보이고, 편집·발송 화면은 상점 탭으로 돌려보낸다(발송 화면은 받는 분 정보를 싣기 전에 판정한다). 프로필 저장은 막지 않는다.
- **승인 게이트**: `decideShopProduct` 승인(관리자 "바로 승인"도 이 함수를 지난다)이 미동의면 `terms_not_agreed`. **스튜디오 상품 계정
  (`STUDIO_SHOP_ARTIST_SLUG`)은 예외**(스튜디오 자신이라 위탁 계약이 없다). 이미 승인된 상품은 판본이 바뀌어도 내리지 않는다.
- **동의 API** `POST /api/funding/creator/shop/terms { version, agreed: true }` — 화면이 본 판본이 지금과 다르면 409, `shop_artists` 행이 없으면 403.
- 관리자: `/admin/shop/artists` 목록과 상품 심사 상세에 "위탁 약관: 동의(판본·일시) / 옛 판본 동의 / 미동의"(`describeShopArtistTerms`).

### 발송 주체 — 아티스트가 직접 보내는 상품 (마이그레이션 0057)

운영자 결정 2026-10-14. 판매자(결제·환불·고객 응대)는 언제나 스튜디오이고, **포장해 보내는 쪽**만 상품마다 다르다. 택배사는 스튜디오 발송분이 로젠택배다
(`SHOP_STUDIO_COURIER` — 관리자 발송 칸의 기본값). 설계는 `docs/shop-artist-platform-design-2026-10.md` §10.

- **저장**: 새 표 `shop_product_fulfillment(product_id PK, mode 'studio'|'artist')` 하나(`lib/shop/fulfillmentMode.ts`). 기존 표에 컬럼을 더하지 않았다.
  행이 없으면 'studio', **표가 없는 DB(0057 전 배포)에서도 모든 읽기가 'studio'로 돌아 기존 주문 경로가 그대로다** — 순서는 마이그레이션 → 배포가 맞지만
  뒤집어도 상점은 안 깨진다(아티스트 발송이 안 켜질 뿐). `no such table`을 삼킬 때는 **그 표 이름을 확인한다**(`isMissingTableError(error, table)`) — 다른 표가 없는 것까지
  삼키면 섞임 판정이 조용히 빠진다. 그 밖의 오류는 던진다(주문 생성은 `lookup_failed` 503).
- **정하는 사람과 시점**: 관리자만, 상품 상세 "운영" 칸(`set_fulfillment_mode`). **승인 뒤에는 바꿀 수 없다** — 쓰기 문장의 WHERE가 `review_status <> 'approved'`를 같이 걸어
  사전 검사 뒤 승인이 끼어도 0행이다. 이유: 이미 들어온 주문의 발송 책임·받는 분 정보 제공 범위가 갈린다. 그래서 "바로 승인" 전에 정해야 한다. 아티스트 폼에는 읽기 전용 표시.
  디지털 상품·스튜디오 계정(`studio-nol`) 상품·`shop_artists` 미등재 계정은 'artist'로 못 정한다. 파일 카탈로그 상품은 항상 스튜디오 발송(`validateShopCatalog`가 `shippedByArtist`를 거부).
  **디지털에는 발송 주체가 없다**: 저장 때 종류가 디지털이면 아티스트 발송 행을 지우고(`clearArtistFulfillmentOfDigital`), 승인은 디지털 + 'artist' 행이면 거부한다(`digital_shipper`).
  아티스트 발송을 읽는 조회(발송 목록·건수·관리자 목록·정산 배송비·`canSetStock`·`creatorStock`·공개 객체의 `shippedByArtist`)는 전부 `p.kind <> 'digital'`을 건다 — `resolveOrderShipper`와 같은 기준.
- **한 주문 = 실물만 또는 디지털만**: 섞이면 `createShopOrder`가 `mixed_kind`(API 400)로 거절하고 주문 폼도 같은 판정(`canShareOrder`·`hasMixedKinds`)으로 거른다. 약관·화면·메일이 "발송 전이면 취소·전액 환불"을
  약속하는데, 디지털을 내려받으면 청약철회가 제한돼 같은 주문의 실물까지 고객 취소가 막히기 때문이다. 약관 디지털 절·`SHOP_DIGITAL_RULES`에 "따로 주문" 한 줄.
- **한 주문 = 한 발송 주체**(`lib/shop/shipper.ts`, 순수 모듈): 실물은 'studio' 또는 `artist:<slug>`로 묶인다(디지털은 발송 주체가 없다). 아티스트 직접 발송 실물이 다른 실물과 섞이면
  `createShopOrder`가 `mixed_shipper`(API 400, 사람이 읽는 문구)로 거절한다 — 주문 폼은 함께 담을 상품을 같은 묶음으로 거르고(`canShareOrder`), 담은 뒤에도 같은 판정(`hasMixedShippers`)으로
  결제를 막는다. 서버 판정이 최종이다. 공개 상품 객체는 `shippedByArtist`(아티스트 상점 slug)를 싣고 **creatorId는 싣지 않는다**. 상품 상세에 "직접 발송" 한 줄, 주문 폼 배송지 아래에
  받는 분 정보가 그 아티스트에게 전달된다는 고지(`SHOP_ARTIST_SHARING_NOTICE`).
- **아티스트 콘솔 `/ko/funding/creator/shop/shipping`**(`lib/shop/artistShipping.ts`): 그 아티스트가 직접 보내는 상품의 **결제 완료 주문**만(조회 SQL의 EXISTS가
  `p.creator_id = ? AND f.mode = 'artist'`를 건다 — 다른 아티스트·스튜디오 주문은 구조적으로 못 들어온다). 주문번호·내 줄(상품·수량·한정판 번호)·받는 분 이름·연락처·주소·배송 메모·예약 발송일을
  싣고, **주문자 이메일·관리 토큰·결제 금액은 읽지 않는다**. 발송 처리는 관리자와 **같은 함수**(`markShopOrderShipped`·`markShopOrderDelivered`)에 `actor: { kind: 'artist', creatorId }`를 넘겨
  지난다 — 소유(`resolveOrderShipper`)를 라우트가 아니라 거기서 다시 판정하고, 남의 주문·스튜디오 주문·없는 주문은 같은 404 문구다. 고객 발송 메일도 그대로 나간다.
  일부 환불(`partially_refunded`) 주문은 어느 줄이 환불됐는지 원장이 모르므로 아티스트는 발송 처리를 못 하고 스튜디오가 확인한다.
- **열람 기록**: 받는 분 정보가 실린 만큼 `privacy_access_logs`에 `shop_artist_shipping_view`(수행자 `creator:<id>`, 대상 개설자 id, 건수, 값은 담지 않음)를 남긴다.
  가려진 행만 있거나 주문이 0건이면 남기지 않는다(펀딩 개설자 배송 화면과 같은 규칙). 새 action을 더했으니 **처리방침 19항의 열거도 함께 고친다**.
- **받는 분 정보 가림**: 배송 완료 표시(`delivered_at`) **30일 뒤**, 완료 표시를 안 했으면 발송 **60일 뒤**에 서버가 이름·연락처·주소·메모를 **비워서** props에 싣는다(화면에서 숨기는 게 아니다).
  주문번호·상품·운송장은 남는다. 펀딩 개설자 배송 열람에는 이런 가림이 없어(전달 1년·결제 5년 파기뿐) 같은 규칙을 옮기지 않고 새로 정했다. 스튜디오의 주문 원본은 5년 보관 그대로.
- **메일**: 주문 접수 때(`sendShopOrderConfirmedEmails`) 아티스트 직접 발송 주문이면 그 아티스트에게 "발송할 주문" 메일(콘솔 링크, **주소·연락처 없음**). 실패는 `notification_error`.
- **재고**: 아티스트 직접 발송 상품의 옵션은 콘솔 판매 현황 표에서 아티스트가 총 재고를 넣는다(`creatorStock.ts` → 관리자와 같은 `setSkuStock` — 잠긴 SKU만·한정 수량 합 상한).
  소유(내 상품·`mode='artist'`·승인·잠김)만 이 파일이 판정한다. 스튜디오 발송 상품은 지금처럼 관리자만.
- **정산**: 위 "정산"의 배송비 가산. 계산식은 `artistPayout.ts` 머리 주석, 배송비 조회는 DB 갈래와 **별도 try**(표가 없으면 건너뛴다).
- 관리자 화면: 주문 목록·상세에 "아티스트 발송: 이름", 상세의 발송 칸 택배사 기본값은 스튜디오 발송이면 로젠택배. 관리자는 아티스트 발송 주문도 대신 처리할 수 있다.
- 발송 상태를 **누가** 바꿨는지는 `shop_orders`에 기록하지 않는다(기존 표에 컬럼을 더하지 않으려고). 필요해지면 새 표로.

### 관리자 직접 등록 — 스튜디오 상품도 DB로

`/admin/shop/products/new`(상점·상품 심사 화면의 "상품 등록")에서 판매 주체(스튜디오 또는 등재된 아티스트)를 고르면 빈 초안이 생기고
(`createDraftProductAsAdmin`), `/admin/shop/products/<id>`의 "편집"에서 아티스트 콘솔과 **같은 폼**(`components/shop/creator/ProductForm.tsx`의
`admin` 모드)으로 채운다. 저장은 `PUT /api/admin/shop/products/<id>` → `saveProductAsAdmin` → 아티스트와 같은 `validateShopProductInput`·`saveProduct`
(`{ admin: true }`)다 — 쓰기·잠금 규칙이 한 벌이라 **관리자도 승인된 SKU의 가격·옵션명·삭제와 승인 뒤의 제목·주소·분류·종류·한정 수량을 못 바꾼다.**

- 열린 칸 표는 `canAdminEditShopField`(`productRules.ts`): 아티스트 표에서 ① 심사 대기도 작성 중처럼 열려 있고 ② 승인 뒤에도 예약 발송일을 바꿀 수 있고
  ③ 반려는 닫힌다. 관리자 저장은 `creator_edited_at`을 찍지 않고 "승인 뒤 수정" 메일도 보내지 않는다. 미심사 10개 상한은 관리자에게 적용하지 않는다.
- **바로 승인**(`approve_now`, `approveShopProductNow`): 작성 중·보완 요청 상품을 심사 대기로 올린 뒤 기존 `decideShopProduct` 승인 배치를 부른다 — 거부 조건
  (주소 충돌·사진/소개/옵션/디지털 파일 없음 등)이 심사 승인과 같고, **거부되면 올려 둔 심사 대기를 되돌려** 아티스트 쪽에 "심사 대기"가 남지 않는다.
  아티스트 대신 만든 상품은 그 아티스트 콘솔에도 보이고, 승인 메일이 그 아티스트에게 간다(스튜디오 상품은 안 간다).
- **사진 업로드** `POST /api/admin/shop/upload?productId=`: 같은 sharp 재인코딩·private Blob이고 **키 앞부분이 상품 소유자(`creator_id`)**라
  소유 판정(`isOwnUploadedMedia`)·공개 판정(`isApprovedShopMedia`)·월간 청소(`mediaRetention`)가 그대로 통한다. 키를 관리자 id 같은 다른 접두사로 바꾸지 말 것.
- **스튜디오 상품 계정**: `shop_artists.slug = 'studio-nol'`(`STUDIO_SHOP_ARTIST_SLUG`, `studioArtist.ts`) 한 행 + `funding_creators`(이름 "스튜디오 놀",
  이메일은 운영자 받은편지함의 plus 별칭 — 운영자 본인의 개설자 계정과 겹치지 않게). 처음 스튜디오 초안을 만들 때 `ensureStudioShopArtist`가 만든다(동시 호출에도 한 벌).
  이 slug 판정 하나로: 정산 예정 표(`listShopArtistSales`)에서 빠지고(스튜디오 몫), `resolveShopArtist`가 null이라 `/ko/shop/artist/studio-nol`이 404이며
  상품 상세에 아티스트 링크가 없고(`findShopArtistOfDbProduct`) 사이트맵·llms에도 안 들어가고, 일반 아티스트 등재·slug 변경이 이 주소를 못 쓴다. 스튜디오 상품은 `/ko/shop`에만 나온다.
- 상품 화면의 옵션 표에서 잠긴 옵션의 총 재고를 바로 넣는다(`setSkuStock` 재사용). 대시보드(`/admin`)에 "심사 대기 상점 상품"·"발송 대기 상점 주문" 카드가
  있고(`countPendingShopProducts`·`countShopAwaitingShipment`), 표가 없거나 조회가 실패하면 그 카드만 숨는다. "발송 대기"는 **스튜디오가 지금 보낼 주문만**이다 —
  아티스트 발송 주문(`resolveOrderShipper`와 같은 기준)·예약 발송일 전 주문은 따로 센다(`{ studio, preorder, artist }`, 0이 아니면 카드가 따로 뜬다).

### 예약 판매·한정판 넘버링 (플랫폼 PR 4)

**예약 판매** — `ships_on`(KST 날짜)이 오늘보다 뒤면 예약 판매(`lib/shop/preorder.ts` `isPreorder`, 순수 모듈). 발송일 당일부터는 보통 상품이다.
결제·재고 경로는 그대로다. 카드 배지·상세 "YYYY년 M월 D일 발송 예정"·주문 폼 안내(섞어 담으면 가장 늦은 날에 함께)·주문 메일(고객·운영자)·
관리 페이지·관리자 주문 화면이 이 날짜를 읽는다. **날짜는 주문에 스냅샷하지 않는다** — 주문 줄 sku_id로 상품의 현재 값을 읽는다
(`loadShipsOnBySku`, 오류는 삼킨다). 그래서 운영자가 `set_ships_on`으로 발송일을 **미루면** 이미 들어온 주문의 화면은 바뀌지만 고객에게 메일은
가지 않는다 — 미룬 날짜는 운영자가 고객에게 직접 안내한다. 발송일이 지나면(오늘 이하) 화면에서 예약 표시가 사라진다.

**한정판 넘버링** — `edition_size`가 있는 DB 상품. `lib/shop/serials.ts`가 확정 배치(`confirm.ts`)의 `orders.status='paid'` UPDATE **뒤에**
줄 수량만큼 INSERT를 붙인다(같은 batch — 재고 게이트가 0행이면 번호도 0행). 결번 중 가장 작은 번호이고 `edition_size IS NOT NULL`·`db-` 줄만이다.
웹훅 확정도 같은 `confirmShopOrder`를 지나므로 확정 경로는 하나다.
- 번호가 모자라면(재고 합이 한정 수량을 넘은 경우) 확정은 성공하고 확정 뒤 개수 점검(`alertIfSerialsMissing`)이 운영자에게 메일을 보낸다. 배치에서
  NOT NULL 위반으로 실패시키지 않는 이유다(돈만 들어온 주문이 된다).
- **반납은 발송 전 전액 취소만.** `cancel.ts`는 `settleRefund` 성공 뒤 선점 전 fulfillment가 `preparing`이었을 때, `webhookSync.ts`는
  `shipped_at IS NULL`일 때 `DELETE FROM shop_serials WHERE order_no=?`. 둘 다 `db-` 줄이 있을 때만, 실패는 로그(환불은 성공 유지).
  **발송 뒤 반품 환불은 번호를 남긴다** — 이미 나간 물건의 번호라 다시 팔면 같은 번호가 둘이 된다. 되팔려면 운영자가 DB에서 직접 지운다.
- 표시: 주문 접수 메일(줄별 "한정판 번호 7/100"), `/ko/shop/manage/<주문번호>`, 관리자 주문 화면("포장할 번호"). 조회는 오류를 삼킨다.
- `setSkuStock`이 그 상품 SKU 재고 합 ≤ `edition_size`로 막는다(PR 3).
- **판매 가능 수량은 남은 번호로 한 번 더 자른다**(`lib/shop/stock.ts`): `min(재고 계산값, edition_size − 부여된 번호 수 − 점유 중 줄이 아직 못 받은 번호 수)`.
  발송 뒤 반품은 재고를 돌려주지만 번호는 남기므로, 이 상한이 없으면 새 구매자가 번호 없이 확정된다. 화면(`remainingStockSql`)·생성 게이트·확정 게이트(`editionGates`, 상품별로 옵션 수량 합)가
  같은 식이고, 확정 게이트에 걸리면 재고 부족과 같이 자동 전액 취소다. `alertIfSerialsMissing`은 게이트 밖 이상 상태를 위한 최후 방어로 남겨 둔다.

### 디지털 상품 (플랫폼 PR 5) — 배송 없는 주문과 내려받기 게이트

- **배송 없는 주문**: 실물(`kind !== 'digital'`) 줄이 하나도 없으면 배송지·배송비가 없다. 서비스(`createShopOrder`)가 SKU를 해석한 뒤 판정하고,
  실물이 있는데 `shipping`이 없으면 `shipping_required`(API 400). 디지털만이면 받은 배송지도 저장하지 않는다. 검증(`validation.ts`)에서 `shipping`은 선택 —
  있으면 전부 검증한다. 무료 배송 기준(`SHOP_FREE_SHIPPING_FROM`)은 **실물 줄 합계**로 센다 — 디지털을 얹어 배송비를 없애지 않게(`computeShopTotals`).
- **넘버링은 실물만**: 디지털 상품에는 `edition_size`를 받지 않는다(입력 검증·승인 둘 다). (실물·디지털을 따로 주문하게 한 뒤에도 유지한다 — 옛 섞인 주문은
  내려받은 뒤에도 `preparing`이라, 발송 전 환불이 번호를 반납해 이미 전달된 번호가 다시 나갈 수 있었다.)
- **배송지 없음 표식**: `shop_orders`의 받는 분·연락처·우편번호·주소가 NOT NULL이라 **`''`**를 넣는다. 판정은 `shopOrderShips(o) = o.postcode !== ''`
  (`lib/shop/shape.ts`) 하나 — 화면·메일·관리자·정산이 이걸 쓴다. 받는 분 이름·연락처는 주문자(`orders.customer_*`)가 따로 있어 `''`로 둔다.
  5년 파기(`purgeShopPersonalDataOfPurgedOrders`)는 `postcode <> ''`인 행만 덮는다(표식을 파기 표식으로 바꾸면 배송이 있던 주문으로 읽힌다).
- **내려받기 게이트** `pages/api/shop/download.ts`(펀딩 download를 본뜸): POST만(GET 405 — 링크 미리보기 봇이 기록을 남기지 못하게), 관리 토큰, 레이트리밋, no-store.
  `file`은 그 주문 줄의 `kind='digital'` 상품 `digital_files` 순번이고 화면에는 라벨·순번만 나간다(R2 키는 서버만). 순서는 서명 → 객체 존재 확인(없으면 기록 안 하고
  503 + 운영자 메일) → 기록 → 302. **메일에는 내려받기 주소를 싣지 않는다** — 주문 확인 페이지 링크만.
- **일부 환불(`partially_refunded`) 주문은 내려받지 못한다** — 어느 줄이 환불됐는지 원장이 몰라 환불한 음원을 계속 받아 갈 수 있다. "살아 있는 주문"은 `paid`만이고(`liveOrderSql`),
  download API가 409, 관리 페이지는 버튼 대신 문의 안내를 보인다.
- **기록** `recordFirstDownload`(`lib/shop/downloads.ts`): `INSERT … SELECT … WHERE EXISTS(살아 있는 주문) ON CONFLICT DO NOTHING` + 같은 batch에서 디지털만 주문(`postcode=''`)을
  `delivered`로(`shipped_at`·`delivered_at`). 이미 기록된 주문은 행이 있고 주문이 아직 살아 있어야 통과한다(행만 보면 환불된 주문에도 통과).
- **청약철회 제한**: 고객 취소(`cancel.ts`)는 `db-` 줄이 있는 주문에서만 "내려받기 기록 없음"을 보고, 선점 UPDATE의 WHERE에 `NOT EXISTS(shop_order_downloads)`를 건다 —
  내려받기와 취소가 겹치면 어느 쪽이 먼저든 다른 쪽은 0행이다. 표가 없는 DB에서 파일 상품 주문 취소가 깨지지 않게 `db-` 줄이 있을 때만 새 표를 읽는다.
  운영자 환불은 내려받은 뒤에도 되고, 관리자 주문 화면이 "내려받음: 시각"을 경고한다. 디지털만 주문은 발송 처리를 거부한다(`markShopOrderShipped`).
- **미리듣기는 필수다**(전자상거래법 제17조 제6항 — 청약철회를 제한하려면 시험 사용 상품을 제공해야 한다). `digital_files` 항목의 `preview: true`가 미리듣기 파일이고(마이그레이션 없음),
  관리자 상품 화면의 "미리듣기 파일" 칸에 넣는다. **판매 파일과 다른 키**여야 한다(같은 키면 `set_digital_files`가 거부 — 전곡을 공짜로 받게 된다). **다른 상품의
  `digital_files`에 있는 키(판매·미리듣기 모두)도 거부한다** — 남의 판매 파일 키를 미리듣기에 넣으면 그 전곡이 공개된다. 판매 파일·미리듣기가 각각 1개 이상이어야
  승인되고(`decideShopProduct`·"바로 승인" 같은 경로), 승인된 상품은 어느 쪽도 비울 수 없다. 30초~1분 발췌본은 운영자가 만들어 R2 `shop/` 아래에 올린다.
  미리듣기는 구매자 내려받기 목록(`loadOrderDownloadFiles`)과 `hasDownloads`에 들어가지 않는다. 재생은 `GET /api/shop/preview?product=<slug>&i=<미리듣기 순번>` —
  승인·공개된 디지털 상품의 `preview` 항목만 5분 서명 주소(inline)로 302, IP 레이트리밋, no-store. 공개 상품 객체에는 라벨(`previews`)만 싣고 키는 싣지 않는다.
  화면은 `<audio preload="none">`(재생 전에는 한 바이트도 받지 않는다). 302 목적지가 R2라 CSP `media-src`에 R2 오리진이 열려 있다(`middleware.ts`).
- **큰 파일**은 함수 한도(4.5MB) 때문에 웹에서 올리지 않는다: 운영자가 R2에 `shop/` 접두사로 올리고 관리자 상품 화면(`set_digital_files`)에서 라벨·키를 넣는다.
- **정산 예정 표**: 배송 없는 주문은 발송이 없어 결제 승인 월(`payments.approved_at`)로 센다. 내려받기 전 주문은 고객이 철회할 수 있어 세지 않고 "철회 가능 N건"으로만 표시한다
  (내려받은 뒤에는 그 주문의 결제 승인 월 정산에 들어간다 — 이미 그 달을 기록했다면 기록 시각 이후 내려받은 주문은 그 스냅샷에 없다. 기록 규칙은 위 "정산" 절.)

### 화면

- `/ko/shop`(목록·분류 필터 음반/굿즈), `/ko/shop/<slug>`(사진·소개·주문 폼). ko 전용(다른 로케일은 `/ko/shop`으로).
- 주문 폼(`components/shop/ShopOrderForm.tsx`)은 공연 예매 폼의 장치(결제 스크립트 지연 로드·같은 입력이면 주문 재사용)와 펀딩 후원 폼의
  장치(카카오 주소 검색 — 공용 `components/common/ShippingAddressFields.tsx`, 이름·주소 초안 저장)를 합쳤다. 다른 상품도 같은 주문에
  담을 수 있다(배송비 한 번). 동의는 결제하기를 누르는 행위로 받는다.
- success·fail·manage는 비공개 경로다(`lib/analytics/privatePaths.ts`·`next.config.mjs` no-store·robots). 이탈 링크는 `<a href>` 문서 이동.
- 관리자 `/admin/shop`(재고 표·주문 목록), `/admin/shop/<주문번호>`(발송·운송장 고치기·배송 완료·전액 환불).
- 메일: 주문 접수(고객·운영자), 발송(고객), 취소·환불(고객·운영자) — `lib/shop/email.ts`. 실패는 `orders.notification_error`.
- 만료 정리는 공연 만료 크론(`/api/cron/expire-show-orders`)이 같이 돈다(크론을 늘리지 않으려고). 개인정보 파기는
  `purge-orders` 크론의 `purgeShopPersonalDataOfPurgedOrders`(5년 파기 결과를 따른다).
