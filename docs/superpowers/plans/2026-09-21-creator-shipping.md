# 개설자 배송지 열람·직접 발송 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개설자가 자기 프로젝트의 배송지를 마감 뒤에 보고, 직접 부치고, 송장을 넣는다.

**Architecture:** 조회는 `creatorId`를 인자로 요구하는 전용 함수 하나로만 한다(`creatorProjectList.ts`의 관례). 발송 상태 전환은 **관리자 라우트에 이미 있는 로직을 공유 서비스로 뽑아** 두 주체가 같은 경합 방지·같은 `delivered_at` 규칙을 지나게 한다. 문서 넷과 판본 둘은 코드가 끝난 뒤 **한 커밋에서** 함께 뒤집는다.

**Tech Stack:** Next.js 15 Pages Router, React 19, TypeScript, Turso(libSQL) + Drizzle ORM, iron-session, Jest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-09-21-creator-shipping-design.md`

## Global Constraints

- **워크트리**: `/Users/hwang-gyeongha/studio-worktrees/funding-truth`, 브랜치 `feat/creator-shipping`. **다른 디렉터리를 건드리지 않는다** — `/Users/hwang-gyeongha/studio`는 오래된 브랜치에 멈춰 있고 다른 worktree는 다른 세션이 쓴다.
- **마이그레이션은 생성·커밋만.** `npm run db:migrate`를 절대 실행하지 않는다. 프로덕션 DB에 접속하지 않는다.
- **`git commit -a` 금지.** 변경한 파일만 경로로 지정. **푸시하지 않는다.**
- 커밋 메시지는 한국어. 끝에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **개설자 화면 props에 실리는 것은 발송에 필요한 필드만.** 결제 금액·결제 수단·주문번호·서포터 이메일·`adminMemo`·`internalNote`·정산 필드(`taxType`·`payoutBankName`·`payoutAccount`·`payoutHolder`)는 **어떤 경로로도** 싣지 않는다 — `__NEXT_DATA__`로 페이지 소스에 실린다.
- **조회 함수는 `creatorId`를 인자로 요구한다.** "전체를 가져와 화면에서 거른다"는 모양의 함수를 만들지 않는다(`lib/funding/creatorProjectList.ts` 주석의 규칙).
- **`pages/`·`components/`를 건드린 작업은 `npm run build`까지 돈다** — 타입 검사·테스트를 통과하고 빌드만 잡는 클라이언트 번들 파손이 이 저장소에서 실제로 났다.
- `lib/funding/projects.ts`에서는 **타입만** import한다(모듈 최상위에서 `process.cwd()`를 실행한다). 클라이언트와 공유하는 순수 함수는 `lib/funding/shape.ts`에 둔다.
- **Task 6 전까지 약관 본문과 판본 상수를 건드리지 않는다.** `FUNDING_TERMS_VERSION`·`FUNDING_CREATOR_TERMS_VERSION`을 올릴 일이 없어야 한다 — 올려야 할 것 같으면 멈추고 보고한다.
- 없는 사실을 코드 주석·화면 문구·약관에 적지 않는다.
- `utils/imageMetadata.json`이 워킹트리에 수정돼 있으면 **스테이징하지 않는다**(빌드 부산물).

---

### Task 1: 조회 계층 — 마감 전 집계 / 마감 뒤 배송 목록

**Files:**
- Create: `lib/funding/creatorShipping.ts`
- Test: `lib/funding/creatorShipping.integration.test.ts`

**Interfaces:**
- Consumes: `computeProjectState(project, now)` (`lib/funding/projects.ts` — **타입만** import하지 말고 이 함수는 값으로 필요하다. 서버 전용 모듈에서만 쓰므로 안전하다), `LIVE_FUNDING_ORDER_STATUSES`·`isLiveFundingOrderStatus` (`lib/funding/service.ts` 또는 그것이 재수출되는 곳 — 실제 위치를 grep으로 확인할 것)
- Produces:
  - `CreatorShippingRow` — `{ pledgeId: string; rewardId: string; rewardTitle: string; quantity: number; shippingName: string | null; shippingPhone: string | null; shippingPostcode: string | null; shippingAddress1: string | null; shippingAddress2: string | null; shippingMemo: string | null; fulfillmentStatus: string; trackingCompany: string | null; trackingNumber: string | null }`
  - `CreatorShippingSummary` — `{ backerCount: number; shippingRequiredCount: number; byReward: Array<{ rewardId: string; rewardTitle: string; quantity: number; requiresShipping: boolean }> }`
  - `CreatorShippingView` — `{ state: 'before_close'; summary: CreatorShippingSummary } | { state: 'open'; summary: CreatorShippingSummary; rows: CreatorShippingRow[] }`
  - `loadCreatorShipping(creatorId: string, projectId: string, now?: Date): Promise<CreatorShippingView | null>` — 소유가 아니거나 프로젝트가 없으면 `null`

**배경**: 스펙 §2. 마감 전에는 개인정보를 한 줄도 내보내지 않고 집계만 준다. 마감 뒤에 배송지가 열린다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/creatorShipping.integration.test.ts`. 이 저장소의 integration 테스트가 DB를 어떻게 세우는지 `lib/funding/creatorProjectList.integration.test.ts`를 먼저 읽고 **그 방식을 그대로** 쓴다.

```ts
it('남의 프로젝트는 null이다', async () => {
  const { projectId } = await seedApprovedProject({ creatorId: creatorA });
  expect(await loadCreatorShipping(creatorB, projectId)).toBeNull();
});

it('모금 중에는 집계만 주고 배송지를 한 줄도 내보내지 않는다', async () => {
  // 모금 중 셀프 취소가 자유로워 주소가 들어왔다 나갔다 한다. 그때 개설자가 볼 이유가 없다.
  const { creatorId, projectId } = await seedLiveProjectWithPledge({
    shippingName: '홍길동', shippingAddress1: '서울시 은평구 어딘가',
  });

  const view = await loadCreatorShipping(creatorId, projectId);

  expect(view!.state).toBe('before_close');
  expect(JSON.stringify(view)).not.toContain('홍길동');
  expect(JSON.stringify(view)).not.toContain('은평구');
  expect(view!.summary.backerCount).toBe(1);
});

it('마감 뒤에는 배송지를 준다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({
    shippingName: '홍길동', shippingAddress1: '서울시 은평구 어딘가',
  });

  const view = await loadCreatorShipping(creatorId, projectId);

  expect(view!.state).toBe('open');
  const rows = (view as { rows: CreatorShippingRow[] }).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].shippingName).toBe('홍길동');
  expect(rows[0].shippingAddress1).toBe('서울시 은평구 어딘가');
});

it('배송이 필요 없는 리워드는 목록에 없다', async () => {
  // 디지털 전용 리워드는 배송지 자체가 없다.
  const { creatorId, projectId } = await seedClosedProjectWithPledge({ requiresShipping: false });
  const view = await loadCreatorShipping(creatorId, projectId);
  expect((view as { rows: CreatorShippingRow[] }).rows).toHaveLength(0);
});

it('환불된 후원은 목록에 없다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({ orderStatus: 'refunded' });
  const view = await loadCreatorShipping(creatorId, projectId);
  expect((view as { rows: CreatorShippingRow[] }).rows).toHaveLength(0);
});

it('결제 정보와 서포터 이메일은 어떤 경로로도 실리지 않는다', async () => {
  // 발송에 필요 없다. props에 실리면 __NEXT_DATA__로 페이지 소스에 나간다.
  const { creatorId, projectId } = await seedClosedProjectWithPledge({
    supporterEmail: 'backer@example.com', orderNo: 'FND-20260921-ABCD1234', unitAmount: 33000,
  });

  const view = await loadCreatorShipping(creatorId, projectId);
  const json = JSON.stringify(view);

  expect(json).not.toContain('backer@example.com');
  expect(json).not.toContain('FND-20260921-ABCD1234');
  expect(json).not.toContain('33000');
});

it('행에 실리는 키가 화이트리스트와 정확히 같다', async () => {
  const { creatorId, projectId } = await seedClosedProjectWithPledge({});
  const view = await loadCreatorShipping(creatorId, projectId);
  const rows = (view as { rows: CreatorShippingRow[] }).rows;
  expect(Object.keys(rows[0]).sort()).toEqual([
    'fulfillmentStatus', 'pledgeId', 'quantity', 'rewardId', 'rewardTitle',
    'shippingAddress1', 'shippingAddress2', 'shippingMemo', 'shippingName',
    'shippingPhone', 'shippingPostcode', 'trackingCompany', 'trackingNumber',
  ]);
});
```

⚠️ **`supporterMessage`는 화이트리스트에 없다 — 싣지 않는 것이 이 태스크의 결정이다.** 스펙 §2가 열어 둔 판단이고, 이 설계의 원칙("발송에 필요한 것만")대로면 응원 메시지는 발송에 필요하지 않다. 개설자가 읽고 싶어 할 값이라는 것은 맞지만, 그건 별도 화면의 몫이지 배송 목록에 끼워 넣을 이유가 아니다. 그 사실을 `creatorShipping.ts` 주석에 적는다.

⚠️ 시드 헬퍼(`seedApprovedProject` 등)는 **이름을 지어내지 말고** 그 파일 계열에 이미 있는 것을 찾아 쓴다. 없으면 기존 방식대로 만들되, 이름을 보고서에 적는다. 화이트리스트 배열은 실제 구현의 키와 맞춘다 — **목이 비어 있으면 스프레드 회귀를 못 잡으므로 모든 필드에 실제 값을 심는다.**

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest lib/funding/creatorShipping.integration.test.ts`
Expected: FAIL — `loadCreatorShipping is not a function`

- [ ] **Step 3: 구현한다**

`lib/funding/creatorShipping.ts`:

```ts
/**
 * 개설자가 보는 자기 프로젝트의 후원 집계와 배송지.
 *
 * **creatorId를 인자로 요구하는 것이 이 함수의 전부다**(`creatorProjectList.ts`와 같은
 * 규칙). "전체를 가져와 화면에서 거른다"는 모양의 함수를 이 파일에 두지 않는다 — 한
 * 번이라도 그런 함수가 있으면 언젠가 소유 조건 없이 호출된다.
 *
 * 마감 전(`upcoming`·`live`)에는 개인정보를 한 줄도 내보내지 않는다. 모금 중에는 셀프
 * 취소가 자유로워(`assessSelfCancel`은 live에서만 통과) 주소가 들어왔다 나갔다 하고,
 * 물량 준비에는 집계면 충분하다.
 *
 * 필드를 하나씩 골라 담는다 — 스프레드를 쓰지 않는다. 결제 금액·결제 수단·주문번호·
 * 서포터 이메일은 발송에 필요 없고, 이 화면의 props는 `__NEXT_DATA__`로 페이지 소스에
 * 실린다.
 */
```

판정 순서: 프로젝트를 `creatorId`와 함께 조회 → 없으면 `null` → `computeProjectState`로 상태 판정 → 집계는 항상 → `closed`일 때만 행을 만든다.

행 조건은 셋을 모두 만족하는 것만: 주문이 살아 있는 상태(`isLiveFundingOrderStatus` — `paid` 하나로 굳히지 않는다. 관리자 라우트가 같은 집합을 쓰는 이유가 `pages/api/admin/funding/pledges/[id].ts`에 주석으로 적혀 있으니 읽고 따른다), 리워드가 `requiresShipping`, `fulfillmentStatus`가 취소가 아닌 것.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx jest lib/funding/creatorShipping.integration.test.ts`
Expected: PASS

- [ ] **Step 5: 검증과 커밋**

```
npm run type-check && npm run lint && npm test
```

`lib/` 아래만 건드렸으므로 빌드는 Task 2에서 함께 돈다.

```bash
git add lib/funding/creatorShipping.ts lib/funding/creatorShipping.integration.test.ts
git commit -m "$(cat <<'MSG'
feat(funding): 개설자가 자기 프로젝트의 후원 집계·배송지를 읽는 조회 계층

마감 전에는 집계만 준다 — 모금 중에는 셀프 취소가 자유로워 주소가 들어왔다 나갔다
하고, 물량 준비에는 집계면 충분하다. 마감 뒤에 배송지가 열리고, 대상은 살아 있는
주문 + 배송이 필요한 리워드 + 취소되지 않은 건으로 좁힌다.

creatorId를 인자로 요구하고 필드를 하나씩 골라 담는다. 결제 금액·수단·주문번호·
서포터 이메일은 발송에 필요 없고, 이 값들은 화면 props로 __NEXT_DATA__에 실린다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: 개설자 화면

**Files:**
- Create: `pages/[locale]/funding/creator/[id]/shipping.tsx`
- Create: `components/funding/creator/ShippingTable.tsx`
- Test: `tests/pages/funding/creator/shipping.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `loadCreatorShipping`·`CreatorShippingView`·`CreatorShippingRow`·`CreatorShippingSummary`
- Produces: 화면 경로 `/ko/funding/creator/{projectId}/shipping`

**배경**: 스펙 §4. 개설자 세션은 매직링크 기반이고 쿠키가 `SameSite=lax`다(관리자는 `strict`). 관리자 화면보다 한 겹 얇은 자리에 배송지를 놓으므로 좁게 연다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`pages/[locale]/funding/creator/[id]/preview.tsx`와 `tests/pages/funding/creator/` 아래 기존 테스트를 먼저 읽고 GSSP 목 방식을 그대로 쓴다.

```tsx
it('모금 중에는 집계만 보이고 배송지 칸이 없다', () => {
  render(<CreatorShippingPage view={{ state: 'before_close', summary: SUMMARY }} projectTitle="제목" />);
  expect(screen.getByText(/마감 뒤에 열립니다/)).toBeInTheDocument();
  expect(screen.queryByText('배송지')).not.toBeInTheDocument();
});

it('마감 뒤에는 배송지가 보인다', () => {
  render(<CreatorShippingPage view={{ state: 'open', summary: SUMMARY, rows: [ROW] }} projectTitle="제목" />);
  expect(screen.getByText('홍길동')).toBeInTheDocument();
  expect(screen.getByText(/서울시 은평구/)).toBeInTheDocument();
});

it('GSSP는 남의 프로젝트에 404를 낸다', async () => {
  mockAuth('creator-b');
  const result = await getServerSideProps({ params: { locale: 'ko', id: 'proj-of-a' } } as never);
  expect(result).toEqual({ notFound: true });
});

it('GSSP 응답은 no-store다', async () => {
  // 배송지가 담긴 화면이다. 중간 캐시에 남으면 안 된다.
  const setHeader = jest.fn();
  await getServerSideProps({ params: { locale: 'ko', id: 'proj-1' }, res: { setHeader } } as never);
  expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('비-ko 로케일은 ko로 보낸다', async () => {
  const result = await getServerSideProps({ params: { locale: 'en', id: 'proj-1' } } as never);
  expect(result).toMatchObject({ redirect: { destination: expect.stringContaining('/ko/') } });
});
```

`ROW`·`SUMMARY` 픽스처는 Task 1의 타입을 그대로 쓴다. 로케일·`no-store` 처리는 **기존 개설자 화면이 하는 방식을 그대로 옮긴다** — 새 방식을 만들지 않는다.

- [ ] **Step 2: 실패를 확인하고 구현한다**

Run: `npx jest tests/pages/funding/creator/shipping.test.tsx` → FAIL

화면이 보여 줄 것:
- 항상: 후원자 수, 리워드별 수량, 배송이 필요한 건수
- 마감 전: 배송지가 **마감 뒤에 열린다**는 안내 한 줄(왜 지금 안 보이는지 — 모금 중에는 취소가 자유롭다)
- 마감 뒤: 표로 배송지와 리워드·수량, 현재 발송 상태

`components/funding/creator/ShippingTable.tsx`가 표를 그린다. 기존 개설자 컴포넌트들의 스타일 관례를 따른다.

편집 화면(`pages/[locale]/funding/creator/[id].tsx`)에서 이 화면으로 가는 링크를 단다. **승인된 프로젝트에서만** 보이게 한다 — 승인 전에는 후원이 있을 수 없다.

- [ ] **Step 3: 통과를 확인한다**

Run: `npx jest tests/pages/funding/creator/shipping.test.tsx`
Expected: PASS

- [ ] **Step 4: 검증과 커밋**

```
npm run type-check && npm run lint && npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

빌드 필수 — `pages/`·`components/`를 건드렸다.

```bash
git add 'pages/[locale]/funding/creator/[id]/shipping.tsx' components/funding/creator/ShippingTable.tsx \
        tests/pages/funding/creator/shipping.test.tsx 'pages/[locale]/funding/creator/[id].tsx'
git commit -m "$(cat <<'MSG'
feat(funding): 개설자 배송 화면 — 마감 전 집계, 마감 뒤 배송지

개설자 세션은 매직링크 기반이고 쿠키가 SameSite=lax라 관리자 화면보다 한 겹 얇다.
소유를 GSSP에서 다시 대조하고 응답을 no-store로 둔다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: 발송 상태 전환을 공유 서비스로 뽑는다

**Files:**
- Create: `lib/funding/fulfillment.ts`
- Modify: `pages/api/admin/funding/pledges/[id].ts` (`set_fulfillment` 분기를 새 함수 호출로)
- Test: `lib/funding/fulfillment.integration.test.ts`

**Interfaces:**
- Consumes: 없음(기존 관리자 로직을 옮긴다)
- Produces:
  - `type FulfillmentActor = { kind: 'admin' } | { kind: 'creator'; creatorId: string }`
  - `type FulfillmentResult = { ok: true } | { ok: false; code: 'not_found' | 'invalid_status' | 'not_live' | 'refund_requested' | 'conflict' | 'forbidden'; message: string }`
  - `setFulfillment(input: { pledgeId: string; status: string; trackingCompany?: string | null; trackingNumber?: string | null; actor: FulfillmentActor; now?: Date }): Promise<FulfillmentResult>`

**배경**: `pages/api/admin/funding/pledges/[id].ts`의 `set_fulfillment` 분기에는 **주석으로 이유가 적힌 규칙이 넷** 들어 있다 — 살아 있는 주문 집합(`paid` 하나로 굳히면 부분환불 건이 영구 미발송으로 남는다), 환불 요청 건 차단, `delivered_at`의 `COALESCE`/`NULL` 규칙(기산점은 항상 현재 상태와 일치시킨다), 그리고 경합을 막는 `UPDATE ... WHERE`.

**개설자 경로가 이것을 다시 구현하면 안 된다.** 그 순간 두 벌이 갈라지고, 한쪽만 고쳐진다.

⚠️ **이 태스크는 동작을 바꾸지 않는다.** 관리자 경로의 결과가 이전과 **똑같아야** 한다. 기존 테스트(`tests/api/admin/funding/pledges/setFulfillment.integration.test.ts`)가 그대로 초록이어야 하고, **그 기대를 고쳐야 한다면 멈추고 보고한다.**

- [ ] **Step 1: 기존 동작을 고정하는 테스트가 있는지 먼저 확인한다**

`tests/api/admin/funding/pledges/setFulfillment.integration.test.ts`를 읽는다. 위 네 규칙을 각각 덮는지 확인하고, **빠진 규칙이 있으면 리팩터링 전에 그 테스트를 먼저 더한다**(리팩터링의 안전망이 없으면 옮기다 깨진 것을 알 수 없다). 무엇을 더했는지 보고서에 적는다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`lib/funding/fulfillment.integration.test.ts`:

```ts
it('개설자는 자기 프로젝트의 후원만 바꿀 수 있다', async () => {
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  const result = await setFulfillment({
    pledgeId, status: 'shipped', actor: { kind: 'creator', creatorId: creatorB },
  });
  expect(result).toMatchObject({ ok: false, code: 'forbidden' });
});

it('개설자도 관리자와 같은 경합 방지를 지난다', async () => {
  // 환불 요청이 들어온 건은 누가 눌러도 막힌다.
  const { pledgeId } = await seedPledge({ creatorId: creatorA, refundRequestedAt: new Date() });
  const result = await setFulfillment({
    pledgeId, status: 'delivered', actor: { kind: 'creator', creatorId: creatorA },
  });
  expect(result).toMatchObject({ ok: false, code: 'refund_requested' });
});

it('delivered로 가면 delivered_at이 찍히고 되돌리면 지워진다', async () => {
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  await setFulfillment({ pledgeId, status: 'delivered', actor: { kind: 'admin' } });
  expect(await readDeliveredAt(pledgeId)).not.toBeNull();
  await setFulfillment({ pledgeId, status: 'shipped', actor: { kind: 'admin' } });
  expect(await readDeliveredAt(pledgeId)).toBeNull();
});

it('운송장만 고쳐 다시 저장해도 첫 전달 시각이 밀리지 않는다', async () => {
  const { pledgeId } = await seedPledge({ creatorId: creatorA });
  await setFulfillment({ pledgeId, status: 'delivered', actor: { kind: 'admin' } });
  const first = await readDeliveredAt(pledgeId);
  await setFulfillment({ pledgeId, status: 'delivered', trackingNumber: '1234', actor: { kind: 'admin' } });
  expect(await readDeliveredAt(pledgeId)).toEqual(first);
});
```

- [ ] **Step 3: 로직을 옮긴다**

`lib/funding/fulfillment.ts`로 옮기되 **SQL과 주석을 그대로 가져온다.** 주석이 왜 그런지를 담고 있으므로 요약하지 않는다.

`actor`가 `creator`면 소유 검사를 **UPDATE의 WHERE에도** 싣는다 — 읽고-검사-쓰기 사이를 막는 것이 이 코드의 관례다:

```sql
AND EXISTS (
  SELECT 1 FROM funding_projects p
  WHERE p.slug = funding_pledges.project_slug AND p.creator_id = ${creatorId}
)
```

⚠️ `funding_pledges.project_slug`는 **문자열**이고 승인 시 확정된다. 마크다운 프로젝트의 후원은 `funding_projects`에 대응 행이 없으므로 이 EXISTS가 거짓이 되어 개설자 경로로는 절대 닿지 않는다 — **스펙 §1이 말한 격리가 여기서 나온다. 그 사실을 주석으로 적고 테스트로 고정한다:**

```ts
it('마크다운 프로젝트의 후원은 개설자 경로로 닿지 않는다', async () => {
  // 기존 26건이 "배송지는 개설자에게 제공되지 않는다"에 동의한 사람들이다.
  const { pledgeId } = await seedMarkdownProjectPledge();
  const result = await setFulfillment({
    pledgeId, status: 'shipped', actor: { kind: 'creator', creatorId: creatorA },
  });
  expect(result).toMatchObject({ ok: false });
});
```

- [ ] **Step 4: 관리자 라우트가 새 함수를 부르게 한다**

`set_fulfillment` 분기를 `setFulfillment({ ..., actor: { kind: 'admin' } })` 호출로 바꾸고, `FulfillmentResult`의 `code`를 HTTP로 매핑한다(그 파일의 기존 매핑 관례를 따른다).

- [ ] **Step 5: 기존 테스트가 그대로 초록인지 확인한다**

Run: `npx jest tests/api/admin/funding/pledges/setFulfillment.integration.test.ts lib/funding/fulfillment.integration.test.ts`
Expected: 둘 다 PASS. **관리자 테스트의 기대를 고쳐야 했다면 멈추고 보고한다.**

- [ ] **Step 6: 검증과 커밋**

```
npm run type-check && npm run lint && npm test
```

```bash
git add lib/funding/fulfillment.ts lib/funding/fulfillment.integration.test.ts \
        'pages/api/admin/funding/pledges/[id].ts' tests/api/admin/funding/pledges/setFulfillment.integration.test.ts
git commit -m "$(cat <<'MSG'
refactor(funding): 발송 상태 전환을 관리자·개설자가 함께 쓰는 서비스로

관리자 라우트에만 있던 규칙 넷(살아 있는 주문 집합·환불 요청 차단·delivered_at의
COALESCE/NULL 규칙·경합을 막는 WHERE)을 그대로 옮긴다. 개설자 경로가 이것을 다시
구현하면 두 벌이 갈라지고 한쪽만 고쳐진다.

개설자 actor는 소유 조건을 UPDATE의 WHERE에도 싣는다. project_slug가 문자열이라
마크다운 프로젝트의 후원은 EXISTS가 거짓이 되어 개설자 경로로 닿지 않는다 — 기존
후원자의 동의를 소급해 뒤집지 않는 격리가 여기서 나온다.

동작은 바꾸지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: 개설자 쓰기 경로와 누가 바꿨는지 기록

**Files:**
- Create: `pages/api/funding/creator/projects/[id]/fulfillment.ts`
- Modify: `components/funding/creator/ShippingTable.tsx` (상태 전환·송장 입력)
- Modify: `components/funding/creator/api.ts` (클라이언트 호출)
- Test: `tests/api/funding/creator/fulfillment.test.ts`, `tests/pages/funding/creator/shipping.test.tsx`

**Interfaces:**
- Consumes: Task 3의 `setFulfillment`·`FulfillmentResult`
- Produces: `POST /api/funding/creator/projects/{id}/fulfillment` — body `{ pledgeId: string; fulfillmentStatus: string; trackingCompany?: string; trackingNumber?: string }`

**배경**: 스펙 §3·§5.

- [ ] **Step 1: 누가 바꿨는지 어디에 남길지 정한다**

스펙 §5가 열어 둔 판단이다. `funding_pledges.admin_memo`는 운영자 전용이라 후보였는데, **파기 크론의 파기 대상**이다(`lib/funding/retention.ts`). 감사 기록을 파기 대상 칸에 남기면 5년 뒤 함께 사라진다.

`lib/funding/retention.ts`를 열어 `admin_memo`가 정말 파기 대상인지 확인하고 판정한다:

- **발송 기록이 개인정보와 함께 지워지는 것이 맞다**고 보면 `admin_memo`에 append한다(`clear_refund_request`가 쓰는 append 방식을 그대로 따른다 — 덮어쓰지 않는다).
- **남아야 한다**고 보면 컬럼을 하나 더한다. `npm run db:generate`로 SQL을 **생성·커밋만** 하고 적용하지 않는다.

**고른 쪽과 근거를 보고서에 적는다.** 확신이 안 서면 멈추고 보고한다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```ts
it('남의 프로젝트 후원은 403이다', async () => {
  const { req, res } = mockPost({ creatorId: 'creator-b', pledgeId: pledgeOfA, fulfillmentStatus: 'shipped' });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(403);
});

it('마감 전에는 발송 상태를 바꿀 수 없다', async () => {
  // 화면이 마감 뒤에만 목록을 보여주므로 서버도 같은 선을 지켜야 한다.
  const { req, res } = mockPost({ creatorId, pledgeId: pledgeOfLiveProject, fulfillmentStatus: 'shipped' });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(409);
});

it('발송 상태와 송장을 저장한다', async () => {
  const { req, res } = mockPost({ creatorId, pledgeId, fulfillmentStatus: 'shipped', trackingCompany: 'CJ', trackingNumber: '1234' });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(200);
  const row = await readPledge(pledgeId);
  expect(row.fulfillmentStatus).toBe('shipped');
  expect(row.trackingNumber).toBe('1234');
});

it('응답에 다른 후원의 정보가 실리지 않는다', async () => {
  const { req, res } = mockPost({ creatorId, pledgeId, fulfillmentStatus: 'shipped' });
  await handler(req, res);
  expect(JSON.parse(res._getData())).toEqual({ ok: true });
});
```

- [ ] **Step 3: 구현한다**

라우트는 `authenticateCreatorApi`로 세션을 얻고(`lib/funding/creatorAuth.ts`), `res.setHeader('Cache-Control', 'no-store')`를 걸고, Origin 검사를 기존 개설자 쓰기 라우트와 **같은 방식으로** 건다(`pages/api/funding/creator/projects/[id].ts`를 보고 따른다).

**마감 여부를 서버에서 다시 본다** — 화면만 믿지 않는다. Task 1의 `loadCreatorShipping`이 쓰는 것과 같은 `computeProjectState` 판정을 쓴다.

그다음 `setFulfillment({ ..., actor: { kind: 'creator', creatorId } })`를 부르고 결과를 HTTP로 매핑한다.

화면 쪽은 표의 각 행에 상태 선택과 송장 입력칸을 두고, 저장하면 이 라우트를 부른다. 기존 개설자 폼들의 저장 상태 표시 관례(`SaveState`)를 따른다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx jest tests/api/funding/creator/fulfillment.test.ts tests/pages/funding/creator/shipping.test.tsx`
Expected: PASS

- [ ] **Step 5: 검증과 커밋**

```
npm run type-check && npm run lint && npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

빌드 필수. 마이그레이션을 만들었다면 `drizzle/`도 함께 커밋한다.

```bash
git add 'pages/api/funding/creator/projects/[id]/fulfillment.ts' \
        components/funding/creator/ShippingTable.tsx components/funding/creator/api.ts \
        tests/api/funding/creator/fulfillment.test.ts tests/pages/funding/creator/shipping.test.tsx
git commit -m "$(cat <<'MSG'
feat(funding): 개설자가 발송 상태와 송장을 직접 넣는다

Task 3의 공유 서비스를 개설자 actor로 부른다 — 살아 있는 주문 집합·환불 요청 차단·
delivered_at 기산점·경합 WHERE를 관리자와 똑같이 지난다.

마감 여부를 서버에서 다시 본다. 화면이 마감 뒤에만 목록을 보여주더라도 그 선은
서버가 지켜야 한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: CSV 내려받기

**Files:**
- Create: `pages/api/funding/creator/projects/[id]/shipping.csv.ts`
- Modify: `components/funding/creator/ShippingTable.tsx` (내려받기 버튼)
- Test: `tests/api/funding/creator/shippingCsv.test.ts`

**Interfaces:**
- Consumes: Task 1의 `loadCreatorShipping`
- Produces: `GET /api/funding/creator/projects/{id}/shipping.csv`

**배경**: 스펙 §4. 실무상 필요하다. 관리자 계약서 다운로드(`lib/contracts/admin-rate-limit.ts`)처럼 레이트리밋을 건다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it('남의 프로젝트는 404다', async () => {
  const { req, res } = mockGet({ creatorId: 'creator-b', projectId: projectOfA });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(404);
});

it('마감 전에는 배송지를 내려받을 수 없다', async () => {
  const { req, res } = mockGet({ creatorId, projectId: liveProjectId });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(409);
});

it('CSV에 담기는 열이 화면과 같다', async () => {
  const { req, res } = mockGet({ creatorId, projectId });
  await handler(req, res);
  const header = res._getData().split('\n')[0];
  expect(header).not.toContain('금액');
  expect(header).not.toContain('이메일');
  expect(header).toContain('배송지');
});

it('레이트리밋을 넘으면 429다', async () => {
  (consumeRateLimit as jest.Mock).mockResolvedValue(false);
  const { req, res } = mockGet({ creatorId, projectId });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(429);
});
```

- [ ] **Step 2: 실패를 확인하고 구현한다**

Run: `npx jest tests/api/funding/creator/shippingCsv.test.ts` → FAIL

CSV 생성은 `pages/api/admin/funding/export.ts`가 쓰는 방식을 보고 **같은 방식으로** 만든다(인코딩·BOM·줄바꿈 처리가 이미 정해져 있다). 담는 열은 **Task 1의 화이트리스트와 같다** — 화면과 CSV가 갈라지면 한쪽으로만 정보가 샌다.

레이트리밋 키는 개설자별로 잡는다(`funding_creator_csv:{creatorId}`). 한도와 창은 상수로 두고 근거를 주석에 적는다.

`Cache-Control: no-store`와 `Content-Disposition`을 건다.

- [ ] **Step 3: 통과를 확인한다**

Run: `npx jest tests/api/funding/creator/shippingCsv.test.ts`
Expected: PASS

- [ ] **Step 4: 검증과 커밋**

```
npm run type-check && npm run lint && npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

```bash
git add 'pages/api/funding/creator/projects/[id]/shipping.csv.ts' \
        components/funding/creator/ShippingTable.tsx tests/api/funding/creator/shippingCsv.test.ts
git commit -m "$(cat <<'MSG'
feat(funding): 개설자 배송 목록 CSV 내려받기

담는 열은 화면과 같은 화이트리스트다 — 갈라지면 한쪽으로만 정보가 샌다. 관리자
계약서 다운로드와 같이 레이트리밋을 건다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: 문서 넷과 판본 둘 — 한 커밋에

**Files:**
- Modify: `pages/[locale]/funding/creator-terms.tsx` (제8조)
- Modify: `pages/[locale]/funding/terms.tsx` (제7조)
- Modify: `data/privacyPolicy.ts` (수탁자·시행일)
- Modify: `lib/funding/policy.ts` (`FUNDING_DATA_PROCESSORS`, 판본 둘)
- Modify: `pages/[locale]/funding/apply.tsx` (안내 문구)
- Modify: `content/funding-terms.baseline.json`, `content/creator-terms.baseline.json` (**갱신 절차로**)

**Interfaces:**
- Consumes: Task 1~5가 확정한 실제 동작
- Produces: 없음

**배경**: 스펙 §1. **코드가 끝난 뒤에 문서를 고치는 것이 이 태스크가 마지막인 이유다** — 그 전에 고치면 또 코드보다 앞서 나간 약속이 된다. 이 저장소가 이번 회차에만 두 번 겪은 실패다.

- [ ] **Step 1: 구현된 것을 먼저 읽는다**

Task 1~5의 코드를 열어 **실제로 무엇이 열렸는지** 확인한다 — 언제부터 보이는지, 어떤 필드가 가는지, 누가 발송하는지, 개설자가 무엇을 쓸 수 있는지. 문서는 그것만 적는다.

- [ ] **Step 2: 개설자 약관 제8조를 다시 쓴다**

지금은 "서포터의 개인정보는 스튜디오가 보유하며, 개설자에게 제공하지 않습니다"다. 담을 것:

- 제공 범위(실제 필드)와 **시점**(마감 뒤)
- 목적은 리워드 발송에 한정된다는 것
- **목적 외 이용 금지, 제3자 재제공 금지**
- 발송을 마친 뒤 파기해야 한다는 것
- 개설자가 발송과 송장 기록의 주체가 된다는 것

- [ ] **Step 3: 후원자 약관 제7조를 고친다**

지금은 "배송 리워드의 발송은 스튜디오가 처리하며, 서포터의 배송지는 개설자에게 제공되지 않습니다"다. 발송 주체가 개설자이고 배송지가 제공된다는 사실로 바꾸되, **판매자와 대외 계약 책임이 스튜디오라는 것은 그대로 둔다**(그건 안 바뀐다).

- [ ] **Step 4: 처리방침을 고친다**

`FUNDING_DATA_PROCESSORS`(`lib/funding/policy.ts`)에 개설자를 더한다. 개설자는 프로젝트마다 다르고 미리 열거할 수 없으므로 **유형으로 적는다**(예: "프로젝트 개설자"). 위탁 업무는 실제로 하는 일만 — 리워드 발송.

ko 본문의 `lastUpdatedValue`를 **오늘 날짜로 올린다**(다른 로케일은 건드리지 않는다). 이 값을 빠뜨리면 시행일이 옛날에 머문 채 내용만 바뀐다 — 직전 회차에 실제로 났던 실수다.

- [ ] **Step 5: 신청 화면을 고친다**

`pages/[locale]/funding/apply.tsx`의 "리워드의 제작은 개설자가, 발송은 스튜디오 놀이 맡습니다. 서포터의 배송지는 개설자에게 제공되지 않습니다." 불릿을 사실에 맞게 바꾼다.

- [ ] **Step 6: 판본을 올리고 기준선을 갱신한다**

**순서를 지킨다.** 상수를 먼저 올린 뒤 갱신한다:

```
UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts
UPDATE_CREATOR_TERMS_BASELINE=1 npx jest content/creatorTerms.baseline.test.ts
```

판본 형식과 같은 날 재개정 규칙(`-r2`·`-r3`)은 `CLAUDE.md`의 "약관·처리방침을 고치면 FUNDING_TERMS_VERSION을 함께 올린다" 절을 읽고 따른다. 현재 값을 먼저 확인하고 다음 값을 그 규칙대로 정한다.

기준선 JSON을 손으로 편집하지 않는다.

- [ ] **Step 7: 게이트를 양방향으로 손 확인한다**

판본을 안 올린 채 갱신 경로가 거부하는지, 본문을 임시로 고치면 검사 모드가 빨개지는지 확인하고 임시 수정을 되돌린다.

- [ ] **Step 8: 검증과 커밋**

```
npm run type-check && npm run lint && npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
npx jest content/fundingTerms.baseline.test.ts content/creatorTerms.baseline.test.ts
```

커밋 메시지에 **어느 조항·어느 항이 어떻게 바뀌었는지**와 **"변호사 확인 전에는 첫 DB 프로젝트를 공개하지 않는다"**를 적는다.

---

### Task 7: 전체 검증과 문서

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-21-creator-shipping-design.md`

- [ ] **Step 1: 전체 검사**

```
npm run generate:manifests
npm run type-check
npm run lint
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
npm run check:funding-baseline
```

- [ ] **Step 2: 공개 화면 불변 확인**

스펙 §6이 "공개 화면에 변화 없음"을 선언했다. 확인한다:

```bash
git diff origin/main --stat -- 'pages/[locale]/funding/[slug].tsx' components/funding/ProjectDetailView.tsx lib/funding/dbProjects.ts
grep -c "배송지" .next/server/pages/ko/funding/keep-singing-for-palestine.html
```

첫 명령이 비어 있고 둘째가 `0`이어야 한다.

- [ ] **Step 3: `CLAUDE.md`에 규칙을 더한다**

"승인 뒤에 열리는 것과 잠기는 것" 절 뒤에 붙인다. 담을 것:

- 배송지는 **마감 뒤에만** 개설자에게 열린다는 것과 그 이유(모금 중 셀프 취소)
- 발송 상태 전환이 `lib/funding/fulfillment.ts` **한 곳**이고 관리자·개설자가 같은 함수를 지난다는 것. 거기 있는 네 규칙(살아 있는 주문 집합·환불 요청 차단·`delivered_at` 기산점·경합 WHERE)을 둘로 나누면 한쪽만 고쳐진다는 것.
- **마크다운 프로젝트의 후원은 개설자 경로로 닿지 않는다**는 것과 그것이 `project_slug` 문자열 대조에서 나온다는 것 — 기존 후원자의 동의를 소급해 뒤집지 않는 장치다.
- 개설자가 `delivered`를 누를 수 있고 그것이 파기 기산점이라는 것, 다만 법정 보존 5년이 하한을 잡는다는 것.

**각 주장을 코드에서 확인한 뒤 쓴다.**

- [ ] **Step 4: 스펙을 갱신한다**

§10 구현 순서에 완료 표시를 하고, §8의 변호사 확인 항목 중 **이번에 답이 나온 것이 있으면** 표시한다(없으면 그대로 둔다). Task 4에서 감사 기록을 어디에 남기기로 했는지도 스펙에 반영한다.

- [ ] **Step 5: 커밋**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-21-creator-shipping-design.md
git commit -m "$(cat <<'MSG'
docs(funding): 개설자 배송 규칙을 CLAUDE.md에, 스펙 구현 순서 갱신

발송 상태 전환이 lib/funding/fulfillment.ts 한 곳이고 관리자·개설자가 같은 함수를
지난다는 것, 배송지가 마감 뒤에만 열리는 이유, 마크다운 프로젝트의 후원이 개설자
경로로 닿지 않는 장치를 적는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

**푸시하지 않는다.** 컨트롤러가 전체 리뷰 뒤에 한 번에 한다.

---

## 배포 전 운영자 확인 항목

PR 본문에 반드시 적을 것:

1. **판본 둘이 오른다.** 이 배포 뒤의 후원·심사 신청은 새 판본으로 기록된다.
2. **변호사 확인 항목** — 스펙 §8. 특히 배송지 제공이 **처리위탁인지 제3자 제공인지**. 제3자 제공이면 후원 화면에 동의 절차가 하나 더 필요하다.
3. Task 4에서 마이그레이션을 만들었다면 **적용 순서**: 마이그레이션 먼저, 배포 나중.
4. 개설자가 `delivered`를 누를 수 있게 된다 — 파기 기산점이 개설자 손에 들어간다(법정 보존 5년이 하한을 잡는다).
