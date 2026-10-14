# CLAUDE.md — 상점(음반·굿즈)

`lib/shop/`·`components/shop/`·`pages/[locale]/shop/`·`pages/admin/shop/`·`data/shop/`를 만질 때 읽는 규칙이다.
설계 배경은 `docs/merch-shop-plan-2026-10.md`(§10이 최신 결정).

### 판매는 잠겨 있다 — `SHOP_SALES_OPEN`(data/shop/policy.ts)

false면 주문 API(`/api/shop/orders`)가 409 `sales_closed`로 거절하고, 상품 화면은 주문 폼 대신 "판매 준비 중"을 보이며,
목록·상세는 `noindex`다. **처리방침이 고지하지 않은 배송지를 받지 않으려고** 이 순서를 코드로 막는다.

#### 판매 개시 체크리스트 (위에서부터)

1. **운영 DB에 마이그레이션 0052(`shop_skus`·`shop_orders`·`shop_order_items`)를 적용한다** — 배포보다 먼저(루트 CLAUDE.md
   "운영 DB 마이그레이션 적용 방법", Turso CLI). 새 표뿐이라 순서를 어겨도 다른 결제는 안 깨지고 상점만 꺼진다.
2. **개인정보 처리방침을 고친다**(`data/privacyPolicy.ts`) — 수집 항목(상품 주문: 받는 분 이름·연락처·우편번호·주소·상세주소·
   배송 메모), 목적(상품 발송과 교환·반품 응대), 파기(자동 파기 ④의 "주문(예약·믹싱·펀딩·정기결제)"에 상품 주문을 더한다 —
   코드는 이미 `purgeShopPersonalDataOfPurgedOrders`가 돈다), **위탁(택배사 이름 — 운영자가 정한다)**. 처리방침 ko 전체가
   펀딩 약관 판본 해시 대상이라 `FUNDING_TERMS_VERSION`을 올리고 기준선을 갱신한다(루트 CLAUDE.md "약관·처리방침을 고치면…").
3. 이용약관(`/ko/terms`)에 상품 판매의 청약철회·교환·반품 조항이 있는지 본다. 화면의 규정 문구는 `lib/shop/policyCopy.ts` 한 곳이다.
   디지털 상품을 열 때는 **`/ko/terms`에 디지털 콘텐츠 청약철회 조항(내려받기를 시작하면 제한 — 전자상거래법 제17조 제2항 제5호)이 있는지** 따로 확인한다. 화면의 고지(`SHOP_DIGITAL_WITHDRAWAL_NOTICE`)가 약관과 같은 약속을 해야 한다.
4. 상품을 `data/shop/catalog.ts`에 올린다(머리 주석의 예시). 이미지는 `public/images/shop/<이름>-YYYYMMDD.webp`, **`git add -f`**.
   `UPDATE_SHOP_CATALOG_BASELINE=1 npx jest data/shop/catalog.baseline.test.ts`로 SKU 기준선을 싣고, 빌드 후 바뀐 히어로 폰트
   서브셋(woff2·chars.json)을 함께 커밋한다(상품 제목이 `/ko/shop/<slug>` h1이다 — `scripts/generate-hero-font.mjs` 7-1).
5. 배포 뒤 `/admin/shop`에서 SKU별 총 재고를 넣는다(행이 없으면 품절이다).
6. `SHOP_SALES_OPEN = true`로 바꿔 배포한다.
7. 그때 붙인다: 헤더·푸터 메뉴, 런타임 사이트맵(`/sitemap-shop.xml` — 공연 `pages/sitemap-shows.xml.ts`와 같은 방식,
   `next-sitemap.config.js`의 additionalSitemaps), `pages/api/llms.ts`.
8. 최소 금액으로 실결제 → 취소를 한 번씩, **계좌이체로도** 한다(토스 API 키 쌍에 계좌이체가 개통됐는지 이때 확인된다).

### 결제는 전부 토스다 — 계좌 입금(무통장) 없음

카드·간편결제·**토스 계좌이체**(`PaymentMethodPicker bankOption="toss_transfer"`). 직접 입금은 환불 때 고객 계좌를 받아
손으로 송금해야 해서 받지 않는다(운영자 결정 2026-10-12, 공연 예매도 같은 날 같은 결정). 그래서 `awaiting_deposit`·
환불 계좌(`refund_accounts`)·입금 안내 메일이 상점에는 없다. `tests/payments/sharedCheckout.guard.test.ts`가 폼에 직접 입금이
붙는 것을 막는다.

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

### 아티스트 상품(위탁 판매) — 판매자는 스튜디오, 발송도 스튜디오

운영자 결정 2026-10-14(계획 `docs/artist-store-plan-2026-10.md`). 아티스트가 재고를 맡기고, 스튜디오가 자기 이름으로 팔아
발송한 뒤 아티스트에게 정산한다. 결제·재고·배송·환불은 스튜디오 상품과 **같은 경로**다 — 아티스트 상품만의 주문 흐름은 없다.
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
- **승인 뒤 수정 알림**: 승인 상태에서 저장하면 `creator_edited_at`을 찍고 운영자에게 메일(`sendShopCreatorEditedNotice`) — 재심사 대기열은 없다.
  관리자 화면이 "승인 뒤 수정"과 "승인 대기 옵션"을 표시한다. 메일 실패는 저장·판정을 실패시키지 않는다(판정 메일은 운영자 폴백 메일이 있다).
- **재고는 관리자만**: 아티스트 쓰기 경로(`creatorProductWrite.ts`)에 `shop_skus`가 없다(테스트가 소스를 검사한다). `setSkuStock`은 잠긴 SKU만
  받고 `edition_size`가 있으면 그 상품 재고 합이 한정 수량을 넘지 못하게 한다. 승인하면 공개되므로 재고(0이면 품절)를 바로 넣는다.
- **관리자 액션**: `lock_new_skus`·`set_ships_on`·`set_published`·`set_internal_note`·`set_digital_files`(키는 `shop/` 접두사 + `isSafeObjectKey` +
  R2 존재 확인). 승인·공개 토글 뒤 그 아티스트가 `data/artists`와 연결돼 있으면 `/ko/artists/<slug>`를 재검증한다(실패는 `warnings`).
- **판매 현황**: 콘솔 상점 탭의 표(`creatorStats.ts`) — SKU별 맡긴 수량(`shop_skus.stock`)·결제 완료·발송 완료·남은 수량. 구매자 정보는 읽지 않는다.
  부분 환불 주문은 결제 완료로 센다(어느 줄이 환불됐는지 원장이 모른다).
- **이름 잠금**: 상점 상품이 심사 중·승인이면 아티스트 이름이 잠긴다(`hasReviewedProject`, `lib/funding/CLAUDE.md`).

**정산**
- 아티스트 몫 `SHOP_ARTIST_SHARE_PERCENT`(55%, 상품 판매가 VAT 포함 기준, 배송비 제외). 계산은 `lib/shop/artistPayout.ts` 하나. 개인 아티스트는
  부가세 상당액과 원천징수 3.3%를 뺀다(펀딩 정산과 같은 이유). `/admin/shop`의 "아티스트 정산 예정"이 그 달(KST)에 **발송한** 결제 완료 주문만
  센다 — 파일 갈래는 키 `file:<slug>`(세금 유형은 `data/artists`), DB 갈래는 `creator:<id>`(`sku_id → shop_product_skus → shop_products.creator_id`,
  세금 유형은 `funding_creators.tax_type`, 비어 있으면 "계산하지 않음"). DB 갈래는 별도 try라 실패해도 파일 갈래 표는 나온다.
  1단계는 운영자가 이 표를 보고 손으로 이체한다 — 정산 기록 표·정산 메일은 아직 없다.
- 이미 정산한 달의 반품 환불은 그 주문이 표에서 빠질 뿐 자동으로 차감되지 않는다. 다음 정산에서 손으로 뺀다.
  부분 환불 주문은 어느 줄이 환불됐는지 원장이 모르므로 계산에서 빼고 "직접 확인"으로 띄운다.

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

### 디지털 상품 (플랫폼 PR 5) — 배송 없는 주문과 내려받기 게이트

- **배송 없는 주문**: 실물(`kind !== 'digital'`) 줄이 하나도 없으면 배송지·배송비가 없다. 서비스(`createShopOrder`)가 SKU를 해석한 뒤 판정하고,
  실물이 있는데 `shipping`이 없으면 `shipping_required`(API 400). 디지털만이면 받은 배송지도 저장하지 않는다. 검증(`validation.ts`)에서 `shipping`은 선택 —
  있으면 전부 검증한다. 배송비 면제 기준(20만원)은 디지털 줄을 포함한 상품 합계로 센다.
- **배송지 없음 표식**: `shop_orders`의 받는 분·연락처·우편번호·주소가 NOT NULL이라 **`''`**를 넣는다. 판정은 `shopOrderShips(o) = o.postcode !== ''`
  (`lib/shop/shape.ts`) 하나 — 화면·메일·관리자·정산이 이걸 쓴다. 받는 분 이름·연락처는 주문자(`orders.customer_*`)가 따로 있어 `''`로 둔다.
  5년 파기(`purgeShopPersonalDataOfPurgedOrders`)는 `postcode <> ''`인 행만 덮는다(표식을 파기 표식으로 바꾸면 배송이 있던 주문으로 읽힌다).
- **내려받기 게이트** `pages/api/shop/download.ts`(펀딩 download를 본뜸): POST만(GET 405 — 링크 미리보기 봇이 기록을 남기지 못하게), 관리 토큰, 레이트리밋, no-store.
  `file`은 그 주문 줄의 `kind='digital'` 상품 `digital_files` 순번이고 화면에는 라벨·순번만 나간다(R2 키는 서버만). 순서는 서명 → 객체 존재 확인(없으면 기록 안 하고
  503 + 운영자 메일) → 기록 → 302. **메일에는 내려받기 주소를 싣지 않는다** — 주문 확인 페이지 링크만.
- **기록** `recordFirstDownload`(`lib/shop/downloads.ts`): `INSERT … SELECT … WHERE EXISTS(살아 있는 주문) ON CONFLICT DO NOTHING` + 같은 batch에서 디지털만 주문(`postcode=''`)을
  `delivered`로(`shipped_at`·`delivered_at`). 이미 기록된 주문은 행이 있고 주문이 아직 살아 있어야 통과한다(행만 보면 환불된 주문에도 통과).
- **청약철회 제한**: 고객 취소(`cancel.ts`)는 `db-` 줄이 있는 주문에서만 "내려받기 기록 없음"을 보고, 선점 UPDATE의 WHERE에 `NOT EXISTS(shop_order_downloads)`를 건다 —
  내려받기와 취소가 겹치면 어느 쪽이 먼저든 다른 쪽은 0행이다. 표가 없는 DB에서 파일 상품 주문 취소가 깨지지 않게 `db-` 줄이 있을 때만 새 표를 읽는다.
  운영자 환불은 내려받은 뒤에도 되고, 관리자 주문 화면이 "내려받음: 시각"을 경고한다. 디지털만 주문은 발송 처리를 거부한다(`markShopOrderShipped`).
- **큰 파일**은 함수 한도(4.5MB) 때문에 웹에서 올리지 않는다: 운영자가 R2에 `shop/` 접두사로 올리고 관리자 상품 화면(`set_digital_files`)에서 라벨·키를 넣는다.
- **정산 예정 표**: 배송 없는 주문은 발송이 없어 결제 승인 월(`payments.approved_at`)로 센다. 내려받기 전 주문은 고객이 철회할 수 있어 세지 않고 "철회 가능 N건"으로만 표시한다
  (정산 기록 표는 아직 없다).

### 화면

- `/ko/shop`(목록·분류 필터 음반/굿즈), `/ko/shop/<slug>`(사진·소개·주문 폼). ko 전용(다른 로케일은 `/ko/shop`으로).
- 주문 폼(`components/shop/ShopOrderForm.tsx`)은 공연 예매 폼의 장치(위젯 지연 로드·같은 입력이면 주문 재사용)와 펀딩 후원 폼의
  장치(카카오 주소 검색 — 공용 `components/common/ShippingAddressFields.tsx`, 이름·주소 초안 저장)를 합쳤다. 다른 상품도 같은 주문에
  담을 수 있다(배송비 한 번). 동의는 결제하기를 누르는 행위로 받는다.
- success·fail·manage는 비공개 경로다(`lib/analytics/privatePaths.ts`·`next.config.mjs` no-store·robots). 이탈 링크는 `<a href>` 문서 이동.
- 관리자 `/admin/shop`(재고 표·주문 목록), `/admin/shop/<주문번호>`(발송·운송장 고치기·배송 완료·전액 환불).
- 메일: 주문 접수(고객·운영자), 발송(고객), 취소·환불(고객·운영자) — `lib/shop/email.ts`. 실패는 `orders.notification_error`.
- 만료 정리는 공연 만료 크론(`/api/cron/expire-show-orders`)이 같이 돈다(크론을 늘리지 않으려고). 개인정보 파기는
  `purge-orders` 크론의 `purgeShopPersonalDataOfPurgedOrders`(5년 파기 결과를 따른다).
