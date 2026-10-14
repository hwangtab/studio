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

- 상품에 `artist: '<slug>'`(`data/artists`의 등재 아티스트)를 붙인다. 그 아티스트 페이지 `/ko/artists/<slug>`에 상품이 모이고
  (판매가 열려 있을 때만), 상품 화면에 아티스트 링크가 붙는다. 등재 아티스트가 아니면 `catalog.test.ts`가 선다.
  등재는 후원 멤버십과 같은 목록이다 — 멤버십을 안 하는 아티스트는 `supportActive: false`.
- **판매를 시작한 SKU의 아티스트는 바꾸지 않는다.** 정산이 주문 줄의 SKU → 상품의 `artist`로 아티스트를 찾는다.
  `catalog.baseline.json`이 SKU마다 `{ price, artist }`를 고정한다.
- 정산: 아티스트 몫 `SHOP_ARTIST_SHARE_PERCENT`(55%, 상품 판매가 VAT 포함 기준, 배송비 제외). 계산은
  `lib/shop/artistPayout.ts` 하나. 개인 아티스트는 부가세 상당액과 원천징수 3.3%를 뺀다(펀딩 정산과 같은 이유).
  `/admin/shop`의 "아티스트 정산 예정"이 그 달(KST)에 **발송한** 결제 완료 주문만 센다. 1단계는 운영자가 이 표를 보고
  손으로 이체한다 — 정산 기록 표·정산 메일은 아직 없다(아티스트가 늘면 2단계).
- 이미 정산한 달의 반품 환불은 그 주문이 표에서 빠질 뿐 자동으로 차감되지 않는다. 다음 정산에서 손으로 뺀다.
  부분 환불 주문은 어느 줄이 환불됐는지 원장이 모르므로 계산에서 빼고 "직접 확인"으로 띄운다.

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
