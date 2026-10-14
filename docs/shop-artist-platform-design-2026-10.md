# 아티스트 상점 플랫폼 설계 — 2026-10-14

계획(`docs/artist-store-plan-2026-10.md`)의 플랫폼 부분 구현 설계. 운영자 결정: 판매자·발송은 스튜디오, 아티스트 몫 55%,
**정산·세무는 운영자가 따로 한다**(정산 기록·이체·세금 정보 수집은 범위 밖), 실제 아티스트 등재는 나중.

## 0. 원칙

1. **새 주문 종류를 만들지 않는다.** 실물·디지털·예약·한정판 모두 `orders.type = 'merch'`, 주문번호 `SHP-`. 웹훅 분기
   (`lib/booking/webhook.ts`)·`orderTypeEnum`·`sharedCheckout.guard`·`recordFailure`·매출장부 라벨은 그대로.
2. **신원**: 로그인 계정 정본은 `funding_creators`(펀딩 개설자와 같은 계정·세션). 상점 공개 정체성(slug·등재·프로필 사진)은 새 표
   `shop_artists`이고 **관리자만 만든다**(위탁은 실물 인수·계약이 먼저라 초대제). 이름·소개·링크는 `funding_creators.name/bio/links`.
   `data/artists`는 후원 멤버십·큐레이션 페이지의 정본으로 남는다.
3. **상품 정본은 "파일이 먼저, 그다음 DB"**(펀딩 `repository.ts`와 같다). DB 상품의 SKU id는 서버가 `db-` 접두사로 만들고, 파일 SKU는
   이 접두사를 못 쓴다 → 두 정본의 SKU 충돌이 구조적으로 불가능하고, "이 주문 줄이 새 표를 건드리는가"도 접두사로 판정한다
   (마이그레이션 전 배포에서도 기존 결제 경로가 안 깨진다).
4. **재고는 지금 그대로** — `shop_skus`가 정본, 계산값, 관리자만 쓴다. 아티스트 쓰기 경로에는 `shop_skus`에 닿는 코드가 없다.
5. **마이그레이션 0053 하나에 새 표 다섯 개.** 기존 표에 컬럼을 더하지 않고, 새 표를 기존 표의 drizzle `relations()`에 잇지 않는다
   (`findShopOrderByOrderNo`의 관계 조회가 전체 컬럼을 SELECT한다 — 0022 함정).

## 1. 아티스트 정체성

| 대상 | 정본 | 쓰는 쪽 |
|---|---|---|
| 로그인 계정 | `funding_creators` | 매직링크·세션 판본 그대로 |
| 공개 이름·소개·링크 | `funding_creators.name/bio/links` | 펀딩과 상점이 같은 이름 |
| 상점 등재·slug·프로필 사진 | `shop_artists`(관리자만 생성) | `/ko/shop/artist/<slug>` |
| 후원 멤버십·큐레이션 | `data/artists`(그대로) | `/ko/artists/<slug>`, 파일 상품의 `artist` |

- 등재: `/admin/shop/artists`에서 이메일·이름·slug → `funding_creators`를 찾거나 만들고(`insert … onConflictDoNothing`) `shop_artists` 행.
- slug 잠금: 그 아티스트의 상품이 하나라도 승인되면 관리자도 못 바꾼다.
- `shop_artists.slug`가 `data/artists` slug와 같으려면 관리자가 "같은 아티스트로 연결"을 체크해야 한다(없으면 거부, 사칭 방지).
- 표시: `resolveShopArtist(slug)`는 `data/artists` 먼저, 없으면 `shop_artists` + `funding_creators`.
- 정산 예정 키: 파일 상품 `file:<data/artists slug>`, DB 상품 `creator:<creator_id>`(세금 유형은 `funding_creators.tax_type`,
  비어 있으면 "계산하지 않음"). 세금 정보는 받지 않는다.
- 상품 화면의 아티스트 링크는 `/ko/shop/artist/<slug>`로 옮긴다. `/ko/artists/[slug]`의 상품 그리드는 저장소에서 읽는다.

## 2. 상품 정본 공존

- 읽는 입구 `lib/shop/repository.ts`(서버 전용). 파일 먼저, 같은 slug면 파일이 이긴다. 공개 목록은 DB 오류를 삼키고 파일만.
  주문 생성처럼 권리를 판정하는 자리는 `{ found } | { lookupFailed }`로 부재와 실패를 나눈다 → API 503.
  **`db-`로 시작하지 않는 SKU id는 DB를 조회하지 않는다.**
- 클라이언트 번들: `data/shop/catalog.ts`는 import 없는 채로, 타입만 넓힌다. DB 상품은 서버에서 `ShopProduct` 모양으로 정규화해
  props로 넘긴다. `lib/shop/catalog.ts`는 순수 모듈 유지(repository를 import하지 않는다).
- 상태별 편집 가능 칸 표는 순수 모듈 `lib/shop/productRules.ts` 한 벌(펀딩처럼 클라이언트에 복제하지 않는다). 심사 상태 유니온은
  리터럴로 적고 테스트가 `fundingReviewStatusEnum`과 같은지 대조한다.
- `ShopProduct` 확장(전부 선택): `kind?: 'physical'|'digital'`, `shipsOn?: string`(YYYY-MM-DD KST), `editionSize?: number`,
  `hasDownloads?: boolean`, `source?: 'file'|'db'`. 공개 객체에 R2 키를 싣지 않는다. 디지털·넘버링은 **DB 상품 전용**
  (`validateShopCatalog`가 파일 상품의 `kind: 'digital'`·`editionSize`를 거부).
- 잠금(DB 상품, baseline 대체): 승인 때 SKU 전부 `locked_at`. 잠긴 SKU는 id·가격·옵션명 변경·삭제 불가, `retired`만 가능.
  가격 변경은 새 SKU. 승인 뒤 더한 SKU는 `locked_at IS NULL`이고 **잠긴 SKU만 판매 가능** — 관리자 "새 옵션 승인"으로 잠근다.
  쓰기 UPDATE의 WHERE에 `locked_at IS NULL`(펀딩 `upsertReward`의 두 겹과 같다).

## 3. 마이그레이션 0053 (`shop_artist_platform`)

반드시 최신 main에서 `drizzle-kit generate`(루트 CLAUDE.md `when` 함정). 직전은 `0052_shop`.

```
shop_artists
  creator_id TEXT PK → funding_creators.id
  slug TEXT NOT NULL UNIQUE
  curated_slug_linked INTEGER NOT NULL DEFAULT 0   -- data/artists와 같은 slug를 쓰도록 관리자가 연결 확인
  profile_image_url TEXT
  created_at, updated_at INTEGER

shop_products
  id TEXT PK (hex32)
  creator_id TEXT NOT NULL → funding_creators.id   (index)
  slug TEXT NOT NULL      -- 부분 유니크: WHERE review_status <> 'rejected'
  category TEXT CHECK in ('album','goods')
  kind TEXT NOT NULL DEFAULT 'physical' CHECK in ('physical','digital')
  title, subtitle, description(빈 줄로 나눈 문단), images(JSON 배열, 기본 '[]')
  ships_on TEXT
  edition_size INTEGER CHECK > 0
  digital_files TEXT       -- [{label,key}] JSON, 관리자만
  review_status TEXT DEFAULT 'draft'  -- fundingReviewStatusEnum과 같은 값
  published INTEGER DEFAULT 0
  review_note, internal_note
  submitted_at, approved_at, rejected_at, creator_edited_at INTEGER
  created_at, updated_at INTEGER

shop_product_skus
  id TEXT PK              -- 'db-' + hex10, 서버 생성
  product_id TEXT NOT NULL → shop_products.id (index)
  option_label TEXT, price INTEGER CHECK > 0, sort_order INTEGER DEFAULT 0
  retired INTEGER DEFAULT 0, locked_at INTEGER
  created_at, updated_at
  -- 재고는 shop_skus(id 같음)

shop_serials
  product_id TEXT NOT NULL, serial INTEGER NOT NULL,
  order_no TEXT NOT NULL → orders.order_no, order_item_id TEXT NOT NULL, created_at
  UNIQUE(product_id, serial), index(order_no), index(order_item_id)

shop_order_downloads
  order_no TEXT PK → orders.order_no, first_downloaded_at INTEGER NOT NULL, created_at
```

새 표를 읽는 기존 경로는 모두 ① `db-` SKU가 있을 때만 실행되거나 ② 오류를 삼키고 파일만 돌려주거나 ③ 표가 없으면 "없음"으로 본다.
그래도 순서는 마이그레이션 → 배포.

## 4. 서버 모듈 (lib/shop/)

| 파일 | 책임 |
|---|---|
| `productRules.ts`(순수) | 심사 상태 유니온, `SHOP_PRODUCT_EDITABLE`(상태 × 칸), `SHOP_CREATOR_LIMITS`, `DB_SKU_PREFIX='db-'`, `isDbSkuId()` |
| `creatorValidation.ts`(순수) | 상품 입력 검증 — 자기 업로드 이미지(`lib/funding/creatorValidation.ts`의 `isOwnUploadedMedia` export), slug 규칙·예약어, 정수 가격·상한, 첫 문단 평문. 본문은 평문 문단(`whitespace-pre-line`)이라 숏코드 벗기기 불필요 |
| `dbProducts.ts` | DB 행 → `ShopProduct`, `listDbPublishedProducts`, `findDbProductBySlug`, `findDbSellableSku`, `listDbSkusForAdmin`. 공개 = `review_status='approved' AND published=1`, 잠긴 SKU만 |
| `repository.ts` | `listPublishedShopProducts`, `findShopProductAsync`, `findSellableSkuAsync`(`{found}`/`{lookupFailed}`), `listShopProductsByArtist`, `resolveShopArtist`, `listAllSkusForAdmin` |
| `artists.ts` | `shop_artists` 조회, `createShopArtist`, slug 잠금 판정 |
| `creatorProductWrite.ts` | 초안 생성, `loadProductForCreator`(남의 것이면 null → 404), 저장(상태별 칸 + SKU 잠금), 제출·철회·공개 토글, 프로필 사진 |
| `reviewDecision.ts` | 승인·보완 요청·반려(`nextReviewStatus` 재사용). 승인 배치 = 상품 UPDATE(`updated_at=epoch`) + SKU 잠금 UPDATE(`EXISTS … p.updated_at = epoch`) — `lib/funding/reviewDecision.ts` 본뜸. 거부: 파일 slug 충돌·예약어·승인 DB slug 중복·사진/SKU 없음·디지털인데 파일 없음·`shop_artists` 없음·기본 이름. 관리자 액션: `lock_new_skus`, `set_digital_files`(`isSafeObjectKey`+`fundingDownloadObjectExists`), `set_ships_on`, `set_published`, `set_internal_note` |
| `reviewEmail.ts` | 제출 알림(운영자)·판정 결과(아티스트)·승인 뒤 수정 알림(운영자). `buildEmailLayout`, 운영자는 `adminUrl('/admin/shop/products/{id}')`, `escapeHtml`, `scripts/preview-emails.ts` 등록 |
| `creatorStats.ts` | 아티스트 SKU별 맡긴 수량·결제·발송·남은 수량. 구매자 정보 없음 |
| `mediaAccess.ts` | `isApprovedShopMedia(filename)` — 승인 상품 `images`, 승인 상품이 있는 아티스트의 프로필 사진. 오류면 false. **펀딩 쿼리와 별도 문장·별도 try** |
| `serials.ts` | 넘버링 문장, 번호 반납, 주문별 번호 조회 |
| `downloads.ts` | 주문의 내려받기 목록, 기록 SQL |

승인 뒤 아티스트가 고칠 수 있는 것: 부제·본문·사진·공개 여부·SKU 추가·`retired`. 잠기는 것: 제목·slug·분류·`kind`·`ships_on`
(관리자만)·`edition_size`·잠긴 SKU. 승인 뒤 수정은 `creator_edited_at` + 운영자 메일.

기존 파일 수정 요지:
- `lib/shop/catalog.ts`: `SHOP_RESERVED_SLUGS`에 `artist`, `db-` SKU·파일 상품의 `kind`/`editionSize` 거부.
- `lib/shop/service.ts`: `findSellableSkuAsync`, `lookup_failed` → `pages/api/shop/orders.ts` 503.
- `lib/shop/adminQueries.ts`: 저장소 사용(DB는 잠긴 SKU만), `setSkuStock`의 `edition_size` 상한, `listShopArtistSales`에 DB 갈래(별도 try).
- `lib/funding/creatorProjectWrite.ts` `hasReviewedProject`: `shop_products`(submitted/approved)도 본다. 표가 없으면 false.
- `pages/api/funding/creator/upload.ts`: `productId`(상품 사진)·`target=shop-profile`. 키 규칙·Blob 접두사 그대로.
- `pages/api/funding/media/[...path].ts`: 펀딩 판정이 false면 `isApprovedShopMedia`.
- `lib/funding/mediaRetention.ts`: `referencedFilenames`에 상점 참조를 **별도 쿼리**로. 표 없음 → 빈 집합, **그 밖의 오류는 던져 청소 중단**
  (빼먹으면 월간 크론이 공개 중인 상품 사진을 지운다).
- `ImageUploadField`: `projectId` 대신 `uploadQuery`. `CreatorSectionForm`: 선택 `onSave`. `PageHeader`: `titleFallbackFont`.
- `pages/[locale]/shop/[slug].tsx`: DB 제목이면 `fitsDisplayFont`로 h1을 `font-sans`.

## 5. 화면

- 공개 아티스트 상점 `pages/[locale]/shop/artist/[slug].tsx`(SSR, `s-maxage=30`, ko 전용). `PageShell`+`PageHeader`, 프로필·소개·링크,
  `ShopProductCard` 그리드, 큐레이션 연결이면 `/ko/artists/<slug>` 링크. 공개 상품 0개면 404, 판매 닫힘이면 noindex. "판매·발송: 스튜디오 놀".
- 아티스트 콘솔 = 펀딩 콘솔에 탭(`CreatorConsoleTabs`: 펀딩 프로젝트 | 상점).
  - `pages/[locale]/funding/creator/shop/index.tsx`: `shop_artists` 없으면 안내(`EmptyState`)만. 있으면 프로필·상품 목록(상태 `Badge`,
    `review_note`는 `Notice`)·판매 현황·새 상품. `no-store`, noindex.
  - `pages/[locale]/funding/creator/shop/[id].tsx`: 편집 폼(분류·종류 `ChoiceCard`, SKU 행 — 잠긴 행은 읽기 전용, 예약 발송일, 한정 수량,
    사진), 제출·철회, 미리보기.
- 공용 상세 뷰 `components/shop/ShopProductDetail.tsx`(공개 상세·미리보기·관리자 심사 공용).
- 관리자: `pages/admin/shop/artists.tsx`(등재), `pages/admin/shop/products/index.tsx`(심사 대기열, 파일 slug에 가려진 DB 상품 경고),
  `pages/admin/shop/products/[id].tsx`(판정·slug·새 옵션 승인·디지털 키·발송 예정일·공개·메모), `/admin/shop`에 링크·대기 건수.
- API: `pages/api/funding/creator/shop/products.ts`(GET·POST), `.../products/[id].ts`(PUT·POST action), `.../shop/profile.ts`,
  `pages/api/admin/shop/artists.ts`, `pages/api/admin/shop/products/[id].ts`. 아티스트 쓰기는 `isAllowedContactRequestOrigin` +
  `authenticateCreatorApi` + `consumeRateLimit`, 관리자는 `authenticateAdminApi`.

## 6. 특수 상품

### 예약 판매(`ships_on`)
`ships_on`이 오늘(KST)보다 뒤면 예약 판매. 결제·재고 경로 불변. 카드 배지 "예약 판매", 상세 "YYYY년 M월 D일 발송 예정", 주문 폼 안내
(섞어 담으면 가장 늦은 날에 함께 발송), 주문 메일, 관리자 주문 화면. `policyCopy.ts`에 공급 시기 문장. 날짜는 주문에 스냅샷하지 않는다.

### 한정판 넘버링(`edition_size`)
`lib/shop/confirm.ts` 확정 배치에서 `UPDATE orders SET status='paid'` **뒤에** 줄 수량만큼 INSERT(같은 트랜잭션 — 재고 게이트가 0행이면
넘버링도 0행). **`db-` SKU 줄에만.** 결번 중 가장 작은 번호:

```sql
WITH RECURSIVE seq(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq
  WHERE n < (SELECT p.edition_size FROM shop_products p JOIN shop_product_skus k ON k.product_id = p.id WHERE k.id = :sku))
INSERT INTO shop_serials (product_id, serial, order_no, order_item_id)
SELECT k.product_id,
       (SELECT MIN(n) FROM seq WHERE n NOT IN (SELECT serial FROM shop_serials WHERE product_id = k.product_id)),
       :orderNo, :itemId
FROM shop_product_skus k JOIN shop_products p ON p.id = k.product_id
WHERE k.id = :sku AND p.edition_size IS NOT NULL
  AND EXISTS (SELECT 1 FROM orders WHERE id = :orderId AND status = 'paid')
  AND (SELECT COUNT(*) FROM shop_serials WHERE order_item_id = :itemId) < :quantity
  AND (SELECT MIN(n) FROM seq WHERE n NOT IN (SELECT serial FROM shop_serials WHERE product_id = k.product_id)) IS NOT NULL
```

- `edition_size IS NOT NULL`을 빼면 넘버링 아닌 상품에 1번이 붙는다.
- 빈 번호가 없으면 0행이고 확정은 성공 → 운영자 알림(`lib/email/operatorAlert.ts`). NOT NULL 위반으로 배치가 실패하면 돈만 들어온 주문이 된다.
- 반납: 발송 전 전액 취소만(`cancel.ts` — 선점 전 `preparing`, `webhookSync.ts` — `shipped_at IS NULL`). `db-` 줄이 있을 때만, try 안에서.
- 표시: 주문 메일, 관리 페이지("한정판 7/100"), 관리자 주문 화면.
- `setSkuStock`: 그 상품 SKU stock 합계 ≤ `edition_size`.

### 디지털 상품(`kind='digital'`, `digital_files`)
- `needsShipping` = 실물 줄이 하나라도 있는가. 디지털만이면 배송지·배송비 없음. `validation.ts`의 `shipping` 선택화, 서비스가
  `shipping_required` 거절, `computeShopTotals`가 `needsShipping`을 받는다.
- 배송지 없음 표식: 주소 칸 NOT NULL이라 `''`, `shopOrderShips(o) = o.postcode !== ''`(`lib/shop/shape.ts`).
- 게이트 `pages/api/shop/download.ts`(펀딩 download 본뜸): POST만, 관리 토큰 `isTokenMatch`, 레이트리밋, 주문 `paid`/`partially_refunded` +
  `cancelled` 아님, 키가 그 주문 줄 상품의 `digital_files`에 있어야. `presignFundingDownload` → `fundingDownloadObjectExists`(키 접두사 `shop/`)
  → 기록(`INSERT … WHERE EXISTS(살아 있는 주문) ON CONFLICT DO NOTHING`, 확인 0행이면 409) → 302. 디지털만인 주문은 첫 기록 때
  `delivered`.
- 청약철회 제한: 고객 취소에 "내려받기 기록 없음"을 더하고 선점 UPDATE WHERE에 `NOT EXISTS (shop_order_downloads)`. 관리자 환불은
  가능하되 내려받음 시각 경고.
- 관리 화면에 내려받기 버튼(form POST)과 고지(전자상거래법 제17조 제2항 제5호). 주문 폼은 디지털 담으면 고지, 디지털만이면 주소 숨김.
  메일에는 관리 페이지 링크만. `policyCopy.ts` 디지털 규정.
- 정산 예정 표: 배송 없는 주문은 결제 승인 월, 내려받기 전은 "철회 가능 N건" 표시.
- 큰 음원은 운영자가 R2에 올리고 키를 넣는다.

## 7. PR 분할

| PR | 내용 | 배포 순서 |
|---|---|---|
| 1 | 스키마 0053 + 저장소 읽기 경로 공존(화면 변화 없음) | 0053 적용 → 배포(뒤집어도 안전) |
| 2 | 아티스트 등재·공개 아티스트 상점·콘솔 탭(프로필만)·미디어 공개 판정·**미디어 청소 참조** | |
| 3 | 상품 등록·심사·판매 현황 | |
| 4 | 예약 판매·넘버링 | |
| 5 | 디지털 상품 | 0053 적용돼 있어야 |
| 판매 개시 | `/sitemap-shop.xml`(파일·DB 상품·아티스트 상점), `llms`, 메뉴 | |

## 8. 놓치기 쉬운 곳

- 웹훅 type 분기: 변경 없음(전부 `merch`).
- `SHOP_RESERVED_SLUGS`에 `artist`. 펀딩 `reservedSlugs`는 변경 없음(`creator/shop` 리터럴이 `[id]`를 이긴다).
- `pageScaffold`: 새 공개·콘솔 페이지는 v2·`PageShell`·`<main>` 없음.
- 제목 서체: DB 제목·아티스트 이름은 `fitsDisplayFont` → `font-sans`.
- 미디어 공개 판정과 월간 청소: 상점 참조를 넣지 않으면 공개 사진이 404이거나 7일 뒤 삭제.
- 관계 조회 함정: `shop_orders`·`shop_order_items`·`orders`·`funding_creators`에 컬럼 추가 금지.
- `db-` 접두사: 새 표에 닿는 확정·취소·생성 문장은 `db-` 줄이 있을 때만.
- `hasReviewedProject`: 상점 제출·승인도 이름을 잠근다.
- `components/`를 고친 PR은 `npm run build`. jest는 디렉터리를 좁히지 않는다.

## 9. 위험

1. `data/artists` slug와 `shop_artists` slug가 나중에 겹치는 것은 빌드가 못 잡는다(표시는 파일이 이김, 정산 키는 분리). `data/artists`에
   추가하기 전에 `/admin/shop/artists`에서 slug를 확인한다.
2. 파일 상품 slug가 승인된 DB 상품 slug를 가리는 역방향 충돌 — 주문은 `sku_id`로 이어져 기록은 안전, 관리자 목록이 경고.
3. 상점만 하는 아티스트는 세금 유형이 비어 정산 예정 표가 "계산하지 않음".
4. 로그인 입구가 `/ko/funding/apply` — 상점 아티스트에게는 운영자가 안내.
5. 발송 뒤 반품된 넘버링 실물을 다시 팔면 빈 번호가 모자랄 수 있다(확정은 성공, 운영자 알림).

## 10. 아티스트 직접 발송 (2026-10-14, 마이그레이션 0057)

판매자·결제·환불·고객 응대는 스튜디오 그대로, **발송만** 상품별로 스튜디오 또는 아티스트.

- 표: `shop_product_fulfillment(product_id PK → shop_products.id, mode 'studio'|'artist', created_at, updated_at)`. 행 없음·표 없음 = 'studio'. 승인 전에 관리자만 정하고 승인 뒤 변경 거부.
- 한 주문 = 한 발송 주체: 아티스트 직접 발송 실물은 같은 아티스트의 실물끼리만(디지털은 제외). 주문 폼이 거르고 서버(`createShopOrder`)가 `mixed_shipper`로 거절.
- 콘솔 `/ko/funding/creator/shop/shipping`: 자기 직접 발송 상품의 결제 완료 주문(받는 분·주소·메모)을 보고 택배사·운송장 입력 → 관리자와 같은 발송 처리 함수. 열람 기록 `shop_artist_shipping_view`,
  배송 완료 30일 뒤(미표시면 발송 60일 뒤) 받는 분 정보를 서버에서 비운다. 접수 시 아티스트에게 "발송할 주문" 메일(주소 없음).
- 아티스트 직접 발송 상품은 아티스트가 자기 옵션의 총 재고를 넣는다. 정산은 상품 55% + 배송비 100%(주문당 한 번).
- 구현 규칙과 함정은 `lib/shop/CLAUDE.md`의 "발송 주체".
