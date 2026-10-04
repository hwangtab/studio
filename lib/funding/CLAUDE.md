# CLAUDE.md — 펀딩·개설자

`lib/funding/` 등 펀딩 코드를 만질 때 읽는 규칙이다. 루트 CLAUDE.md에서 옮겨 왔다.

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

### 펀딩 설계 대행·발매 연계 표시는 별도 테이블이다 (마이그레이션 0037)

스튜디오가 설계를 맡은 프로젝트(`design`, 설계비 50만원)와 발매 프로젝트에 이어진 프로젝트
(`release`)는 `funding_project_services`(`lib/funding/projectServices.ts`)에 적는다. 운영자
전용이다 — 관리자 심사 상세의 "스튜디오 서비스" 칸과 목록의 "서비스" 열에서만 보이고, 개설자
조회에는 어떤 경로로도 실리지 않는다. `internal_note`에 "설계 대행"이라고 적는 방식은 쓰지 않는다
(자유 텍스트라 목록에서 걸러 볼 수 없고 입금 여부를 담을 칸이 없다).

- **`funding_projects`에 컬럼을 더하지 않고 테이블을 따로 둔 이유는 배포 순서다.** 0020·0023
  절처럼 컬럼을 더하면 컬럼 지정 없는 `select()`가 전부 새 컬럼을 요구해, 마이그레이션 전에
  배포하면 공개 상세·결제까지 깨진다. 별도 테이블이면 미적용 DB에서도 이 칸만 "미적용(0037)"으로
  꺼진다. 그래도 **적용은 해야 한다** — 방법은 아래 "운영 DB 마이그레이션 적용 방법" 절(Turso CLI).
  운영 DB에는 2026-09-26에 적용을 확인했다.
- **읽기 실패는 두 갈래다.** 테이블 부재(`missing_table`)는 마이그레이션 안내, 그 밖의 DB 장애
  (`error`)는 "불러오지 못함"으로 띄우고 서버 로그에 남긴다. 둘을 합치면 진짜 장애가
  "마이그레이션을 돌리세요"로 가려진다. 어느 쪽이든 심사·정산 화면은 열린다.
- **설계비는 약정 시점의 값을 행에 복사한다**(`design_fee`). 처음 지정할 때만 그때의
  `FUNDING_DESIGN_PRICE`를 넣고, 종류를 `design → release`로 바꿔도 약정가·입금 시각은 그대로다.
  정가를 나중에 바꿔도 이미 약정한 프로젝트의 청구액이 따라 움직이지 않는다.
- **설계비는 성공 수수료가 아니다.** 요율이 아니라 약정 금액이고, 정산 때 모금액에서 뺄 뿐이다(아래).
  직접 개설(`none`)로 되돌려도 행은 지우지 않고 옛 약정을 보존한다 — 그 행은 정산에서 빼지 않는다.
- **받는 시점은 정산 때 모금액에서다**(2026-09-28 운영자 결정). 발매 프로젝트와 묶으면 설계비·제작·홍보·유통을
  **한 견적**으로 내고, 설계비와 제작비를 모두 모금액 정산 때 받는다(목표 미달이어도 모인 금액으로 집행 —
  Keep-it-All). 단계별 추가 할인은 없다. 이 약속은 `data/releasePipeline.ts`·`data/crowdfundingDesign.ts`·
  `lib/quote/estimate.ts` 카피에 있다. 개설자 약관 제6조(판본 `funding-creator-terms-2026-09-29`)와
  `payout.ts`가 이 공제를 한다: **원천징수까지 뺀 금액에서** 설계비 → 제작비 순으로 뺀다(수수료·원천징수 기준에는
  넣지 않는다 — 개설자가 스튜디오에 치르는 비용이다). 넘는 부분은 실지급 0원 + `shortfall_amount`(차액 청구나 규모
  조정을 협의할 금액)로 기록한다. 약정 제작비는 관리자 심사 화면의 "약정 제작비"(`production_fee`, 공급가)로 적고,
  설계비를 정산 밖에서 받았으면 "따로 입금 확인"을 눌러 두면 빼지 않는다. 서비스 기록을 못 읽으면 정산 기록은
  `services_unavailable`로 거부된다 — 합의한 공제를 모른 채 전액을 불변으로 기록하지 않는다.
  **마이그레이션 0041(`production_fee`·정산 공제 칸)은 배포보다 먼저다** — `funding_project_payouts`를 전체 컬럼으로
  읽는 조회(관리자 정산·대시보드·크론 점검)가 새 칸을 요구한다.

### 원천징수 개설자의 정산은 부가세 상당액을 뺀다 (2026-09-29)

판매자가 스튜디오라 후원금 전체의 부가가치세(10/110)를 스튜디오가 낸다. 사업자 개설자는 받은 정산금에
세금계산서를 발행하므로 그만큼 매입세액으로 공제되지만, 원천징수 개설자에게서는 세금계산서가 없다. 그래서
`computeFundingPayout`은 원천징수 개설자에 한해 수수료를 뗀 금액에서 부가세 상당액(`vatDeductionAmount`)을 빼고
그 나머지에 3.3%를 원천징수한다. 이 식이 없던 동안은 100만원 모금마다 스튜디오에 남는 금액(부가세 정산 뒤,
PG 비용 전)이 사업자 개설자 80,000원 대 원천징수 개설자 −2,909원이었다. 불변식은
`shareAmount + vatDeductionAmount + feeAmount === netGross`이고, `funding_project_payouts`에는 컬럼 없이
`recordedVatDeduction`으로 되살린다. **정산 식을 새로 만드는 도메인(공연 예매 등)도 같은 축을 써야 한다** —
아티스트 구독 정산(`lib/artistSupport/payout.ts`)은 처음부터 공급가 기준이었다.

### 한 주문에 여러 리워드 — 줄은 `pledgeLines`로만 읽는다 (마이그레이션 0042)

후원 폼과 리워드 모달에서 여러 리워드를 **담는다**(2026-09-28, 세트 리워드는 경우의 수가 많아
두지 않기로 운영자 결정). 리워드가는 배송비 포함 최종가라 담은 만큼 더할 뿐, 배송비 줄은 없다.

- **`funding_pledges`는 여전히 주문당 1행**이고, 리워드 줄은 `funding_pledge_items`에 있다.
  후원 행을 줄마다 만들지 않은 이유: 모금액·건수·정산·명단이 전부 `orders JOIN funding_pledges`를
  합산하므로 행이 늘면 조용히 곱해진다. 배송지·발송 상태·내려받기 기록·메시지는 주문 단위다.
- **줄이 없는 후원은 옛 단일 리워드 칸이 곧 한 줄이다.** 옛 후원을 옮겨 담지 않았고 관리자 수기
  등록도 옛 칸만 쓴다. 그래서 줄은 TS에서 `pledgeLines(pledge)`(lib/funding/pledgeLines.ts),
  SQL에서 `fundingPledgeLinesSql()`(lib/funding/pledgeLinesSql.ts)로만 읽는다. 새 후원은 옛 칸에도
  첫 줄을 복사해 두므로(NOT NULL), `fp.reward_id`·`pledge.rewardId`를 직접 읽으면 에러 없이
  **첫 리워드만** 보인다.
- 재고는 담은 한정 리워드마다 조건을 AND로 묶어 **주문 전체가 들어가거나 전혀 안 들어간다**.
  줄 INSERT들은 새 주문 자신을 재고 집계에서 빼고(`excludeOrderNo`) 같은 조건을 본다.
- 셀프 취소는 주문 전체만 된다. **줄 단위 부분 환불은 관리자 후원 상세의 "리워드별 일부
  환불"**(lib/funding/lineRefund.ts, 마이그레이션 0044 `refunded_quantity`). 돌려준 수량은
  `pledgeLinesSql`의 `quantity`(살아 있는 수량)에서 빠져 재고로 돌아가고, `activePledgeLines`를
  쓰는 내려받기·배송 목록·"전부 디지털인가" 판정에서도 빠진다. 기록은 웹훅 동기화와 같은
  델타 INSERT라 웹훅이 먼저 와도 이중 기록이 없다. 토스가 **응답을 안 준** 실패는 선점을
  되돌리지 않는다(취소가 됐을 수 있다). 계좌 입금·수기 등록 후원은 토스 결제가 없어 줄 환불이
  없다 — **전액 취소만** 된다(아래 "계좌 입금" 절).
  토스 콘솔에서 직접 부분 취소하면 금액은 웹훅이 맞추지만 **어느 리워드인지는 남지 않는다** —
  줄 환불은 반드시 관리자 화면에서 할 것.
- 관리자 수기 등록도 `items`로 여러 리워드를 받는다(온라인과 같은 재고 조건).
- **0042·0044는 배포보다 먼저 적용한다.** 결제 확인 경로(`findFundingOrderByOrderNo`)가 관계 조회로
  `items`를 함께 읽으므로, 표가 없으면 0020 절과 같은 이유로 결제 확인 전체가 깨진다.

### 결제 화면은 담은 것만 먼저, 결제창 열기는 기록한다 (마이그레이션 0043)

2026-09-29 회의 결정. 후원 폼 맨 위에는 **담은 리워드만** 보이고 나머지는 "다른 리워드 함께
담기"로 접는다 — 카드·모달에서 고르고 온 사람에게 전체 목록을 다시 펼치면 같은 결정을 두 번
하게 되고 결제위젯이 밀린다(결제 완료 12건이 전부 리워드 1개였다). 담지 않은 리워드 중
frontmatter에 **`addOn: true`로 표시한 추가 상품만** "…함께 받기" 한 줄 제안으로 보인다.
티어(서로 대체)와 추가 상품(보완)은 코드가 가릴 수 없다 — "배송이면 제안"으로 추론했다가
사바하의 CD 티어에서 CD를 고른 사람에게 상위 티어를 권했다. 새 프로젝트에 시집·굿즈 같은
곁들이 상품이 있으면 그 리워드에 `addOn: true`를 적을 것. DB(개설자) 프로젝트는 늘 false다.

**펀딩 화면의 버튼 규칙(2026-09-29 통일).** 말은 셋만 쓴다 — "담기"(결제 화면 안에서 리워드를
더함), "펀딩하기"(결제 화면으로 가는 모든 버튼: 카드·모달 상세·히어로·모바일 하단 바), "결제하기"
(결제창을 여는 마지막 버튼). 모바일 주 버튼은 늘 **바닥 고정 바**에 "금액 · 동작"으로 둔다 —
모달 상세("13,000원 · 펀딩하기"), 결제 화면("36,000원 · 결제하기", 모달·/pledge 공통, 약관 고지를
같은 바에). **모든 "펀딩하기"는 같은 결제 화면에 닿는다** — 히어로·하단 바는 스크롤하지 않고
리워드 없이 결제 모달을 연다(빈 채로 목록을 펼침). 주 버튼은 공용 `Button`(카드 안은
`buttonVariants`)을 쓴다 — 손으로 적은 클래스는 포커스 표시가 빠졌다.

`payment_window_opens`(0043)는 결제창을 열기 직전에 비콘(`/api/payments/opened`)으로 남긴다.
만료 주문이 "폼에서 떠났나, 결제창까지 갔다가 떠났나"를 가르는 근거이고, 관리자 후원 상세의
"결제창 열기" 줄에 보인다. 원문 User-Agent는 저장하지 않고 인앱 여부만 분류한다. 기록은
best-effort라 표가 없어도 결제는 깨지지 않지만, 기록이 쌓이려면 적용해야 한다.

### 계좌 입금(무통장)은 자동 취소가 없다 — 운영자가 통장을 보고 확인한다 (마이그레이션 0048)

2026-09-11에 걷어냈다가(PR #77) 2026-10-04에 되살렸다 — 은행·ATM에서 직접 보내는 노년층
후원자를 위해서다. 계좌·안내 기한·입력 상한의 정본은 **결제 공용** `lib/payments/bankAccount.ts`이고
(공연·예약·믹싱도 같은 계좌 입금을 쓴다 — 그쪽 규칙은 `lib/payments/bankDeposit.ts`), 펀딩 고유 규칙(한정 리워드
불가·온라인 판정)은 `lib/funding/bankAccount.ts`다. 결제 공용 부품: 안내 화면
`components/payments/BankDepositGuide.tsx`(금액·기한·이름·호칭을 props로), 결제수단 고르기
`components/payments/PaymentMethodChoice.tsx`(위젯 화면) · `PaymentMethodPicker.tsx`(결제수단 목록 화면 — 루트 CLAUDE.md "토스 키는 두 쌍이다"), 환불 계좌 입력 `components/payments/RefundAccountFields.tsx`,
관리자 "계좌 보기" 핸들러 `lib/payments/refundAccountView.ts`. 펀딩은 결제 행 없이 `funding_pledges.payment_method`로
가르고, 공연·예약·믹싱은 상태(`awaiting_deposit`)와 결제 행(`bank-deposit:` 키)으로 가른다 — 같은 판정 함수를
섞어 쓰지 말 것. 약관·처리방침 본문에는 계좌번호를 쓰지 않는다("안내 화면·메일에 표시된 계좌").

- **한정 수량 리워드는 계좌 입금 불가.** `bankTransferBlockReason`을 서버 검증(validation.ts)과 후원
  폼(PledgeWizard)이 같은 인자로 부른다. 그래서 입금 확인 때 재고를 다시 셀 필요가 없다.
- **자동 취소가 없다.** `hold_expires_at`에 신청 + 3일(안내 기한)을 적지만 `expireStalePledges`와
  토스 재제출의 자기 홀드 해제가 `bank_transfer`를 건너뛴다. 만료 메일도 없다 — SAF2026에서 중복
  신청 중 버려진 쪽이 자동 만료되며 이미 입금한 사람에게 "취소됨"이 갔다. 신청을 닫는 길은 관리자
  "미입금 취소"와 후원자의 "입금 전 신청 취소"(둘 다 pending → expired, 메일 없음)뿐이다. 기한이 지나도
  안내 화면은 계좌를 계속 보여 준다. 그래서 입금 대기 건은 기한과 무관하게 쌓인다 — 관리자 목록
  "입금 대기" 필터(`?deposit=pending`)는 기간·기한으로 거르지 않는다.
- **입금 확인**(`lib/funding/bankTransfer.ts` `confirmBankDeposit`)은 pending과 **expired**(늦은 입금)를
  paid로 바꾸는 낙관적 UPDATE 한 문장에 `send_pending` 센티널을 함께 적고 `deliverConfirmedEmailsOnce`로
  확정 메일을 보낸다(수기 등록과 같은 규약). 두 번 눌러도 한 번만 전이한다.
- **열린 계좌 입금 대기는 입금 확인 전에도 공개 집계에 들어간다**(운영자 결정 2026-10-04, SAF 방식) —
  모금액·후원 건수/인원·명단·응원 메시지·개설자 판매 수량·관리자 상단 지표가 전부
  `countedFundingPledgeSql()`(lib/funding/refundable.ts — LIVE + pending·bank_transfer·online) 하나를 본다.
  새 집계 쿼리를 만들면 이 함수를 쓸 것. **정산·발송(CSV·개설자 배송 목록)·내려받기·환불 판정은 받은 돈만**
  (LIVE 그대로) — 정산 미리보기는 빠진 입금 대기 건수·금액을 따로 알린다. 미입금 취소·입금 전 신청
  취소·입금 확인·신청 생성 뒤에는 `revalidateFundingPaths`로 목록·상세를 다시 만든다(ISR에 첫 화면 숫자가
  박힌다). 열린 입금 대기는 재고도 차지한다(새 계좌 입금은 한정 리워드를 못 받아 옛 무통장 행만 해당).
- **온라인 계좌 입금과 관리자 수기 등록을 가른다.** 둘 다 `payment_method='bank_transfer'`이고
  `entry_source`('online'/'manual')만 다르다. `assessSelfCancel`·`canWithdrawBeforeDeposit`은
  `entrySource`를 **필수 인자**로 받고, manage SSR과 cancel.ts가 같은 함수를 쓴다(판정 테스트
  policy.test.ts와 SSR 배선 테스트 tests/pages/funding/manage/[orderNo].test.ts를 따로 둔다 — PR #77은
  배선에서 났다). 온라인 계좌 입금은 셀프 취소 시 **환불 계좌**를 받고, 수기 등록은 문의로 돌린다.
- **환불 계좌는 결제 공용 표 `refund_accounts`**(`lib/payments/refundAccount.ts`)다 — (`order_kind`
  'funding'|'session'|'mixing'|'show', `order_no`) UNIQUE로 주문을 가리키고(공연은 `show_orders`에 있어
  FK로 못 묶는다), 요청 시각(`requested_at`)·송금 완료 시각(`refunded_at`)을 남긴다. 계좌번호만
  fieldCrypto로 암호화, 은행명·예금주는 평문. 기존 주문 표에 컬럼을 더하지 않은 것과 relation을 두지
  않은 것은 0037 절과 같은 배포 순서 이유다. 접수는 `refund_requested_at` 선점이 이긴 요청만 계좌를 쓴다
  (같은 초의 두 번째 요청이 계좌를 덮어쓰던 것을 테스트로 잡았다). 관리자는 "계좌 보기"를 누를 때만
  복호화한 값을 받는다(`pages/api/admin/funding/pledges/[id]/refund-account.ts`, no-store, 접속기록
  `refund_account_view` — 결제 공용 이름. 2026-10-04 하루 동안 쓴 `funding_refund_account_view`는 이미 남은 행 때문에
  enum에 남겨 두었다). 송금한 뒤 "송금 완료(환불 기록)" = 기존 `refund` 액션의 기록 경로.
  환불 요청 철회 처리 시 계좌를 지우고, 그 밖에는 주문 5년 파기 때 지운다(orderRetention.ts).
- **취소(환불)를 요청하면 내려받기가 닫힌다.** 계좌 입금 셀프 취소는 송금 전까지 paid로 남으므로
  내려받기 API·확인 페이지가 `refund_requested_at`을 함께 본다(API는 기록 UPDATE의 WHERE에도). 요청 뒤
  내려받기가 찍힌 옛 행은 "송금 완료(환불 기록)" 때 확인창·응답 warnings로 알린다.
- **신청을 닫으면 `notification_error`도 비운다**(미입금 취소·입금 전 신청 취소). 닫힌 신청에 보낼 메일이
  없는데 재발송 버튼은 둘 다 409라, 입금 안내 실패 사유가 남으면 헬스체크 경보를 끌 길이 없었다.
  헬스체크에서 제외하는 쪽보다 이쪽이 단순하다 — 경보 판정을 상태별로 가르지 않아도 된다.
- **입금 확인은 한정 리워드 재고를 다시 센다**(옛 무통장 행은 한정 리워드를 담을 수 있었다) — 온라인
  생성과 같은 재고 식을 전이 UPDATE의 WHERE에 싣고, 넘치면 `sold_out`으로 사유를 돌려준다. 정산이 기록된
  프로젝트의 확정은 확인창·응답 warnings로 알리고, 이체를 마친 정산 뒤의 확정은 헬스체크가 30일 동안 보고한다.
- **계좌 입금 전용 남용 상한은 두지 않는다**(운영자 결정 2026-10-04 — 이메일 시간당·열린 대기 건수 상한을 걷어냈다).
  남는 것은 원래 있던 IP 단위 일반 레이트리밋뿐이다. 공연·예약·믹싱도 같다.
  대신 **안내 메일만** 같은 주소(정규화)로 시간당 3통까지 보낸다(`lib/payments/depositGuideThrottle.ts`) —
  남의 주소로 신청을 되풀이해 메일을 퍼붓지 못하게. 신청·좌석·시간대 점유는 막지 않고, 관리자 재발송은 상한을 타지 않는다.
- **수기 등록도 같은 이름의 계좌 입금 신청이 있으면 막는다** — `acknowledgeExisting: true` 없이는 409 + 후보.
- **환불 계좌 경로의 DB 오류는 `safeDbErrorSummary`로만 로그한다** — drizzle 메시지에 바인딩 값(계좌번호
  암호문·예금주)이 실린다.
- **줄 단위 환불(lineRefund.ts)은 토스 전용** — 계좌 입금은 전액 취소만.
- **정산**: 계좌 입금 몫도 PG를 거치지 않았으므로 결제 수수료에서 뺀다 — `payout.ts`가
  `payment_method='bank_transfer'`로 고른다(수기 등록 포함). 개설자 약관도 같은 말을 한다.
- 입금 안내 화면은 새 페이지가 아니라 **펀딩 확인 페이지**(`/ko/funding/manage/[orderNo]?token=`)다.
  이미 비공개 경로(privatePaths·no-store·사이트맵 제외)라 새로 등록할 곳이 없고, 메일 링크·입금 전
  취소·입금 뒤 환불 요청이 한 주소에서 이어진다. 화면 크기 위계는 SAF2026 `BankDepositGuideView`를
  옮겼다(계좌번호·금액 text-3xl→4xl 굵게) — 줄이지 말 것.
- **0048은 배포보다 먼저 적용한다.** 결제 확인은 이 표를 읽지 않아 안 깨지지만, 표가 없으면 계좌
  입금 환불 접수(후원자는 "지금은 접수할 수 없습니다")·관리자 계좌 보기·5년 파기의 계좌 삭제가 실패한다.

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

**전달 표시를 한 번도 안 한 후원**은 위 기산점이 생기지 않는다. 그 후원의 배송지·메모·응원
메시지·명단 표시 이름은 5년 파기로 결제자 이름이 지워질 때 함께 지운다
(`purgeFundingPersonalDataOfPurgedOrders`, `lib/privacy/orderRetention.ts`, `purge-orders` 크론).
**어느 경로든 결제 후 5년 안에는 지우지 않는다** — 전달 뒤에도 오배송·민원 대응에 배송지가
필요하다(운영자 결정, 2026-09-26). 기간을 줄이자는 제안은 이 결정을 먼저 볼 것.

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
