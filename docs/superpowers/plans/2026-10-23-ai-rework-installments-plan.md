# AI 리워크 3회차 결제·단계별 환불 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 리워크 계약(100만원 이상)을 50/30/20 3회차로 받고, 해지 시 "받은 돈 × 단계 비율"로 환불액을 계산한다.

**Architecture:** 새 결제 시스템을 만들지 않는다. 기존 제작 계약 엔진(`production_contracts` + 진행 기록 + 결제 링크)에 2차 금액(`second`)과 `paid_ratio` 정산 모드를 더한다. 3회차는 리워크 기본 조건에서만 켠다 — 다른 계약 종류의 50/50·일시불 동작은 바꾸지 않는다.

**Tech Stack:** Next.js Pages Router, TypeScript, Drizzle ORM(SQLite/libSQL), Jest, Toss Payments(기존 결제 링크 경유).

**Spec:** `docs/superpowers/specs/2026-10-23-ai-rework-installments-and-refunds-design.md`

## Global Constraints

- 금액은 **VAT 포함 총액**, 원 단위 정수. 회차 합계는 항상 `amount.total`과 정확히 같다.
- 3회차는 **1,000,000원 이상** 리워크 계약만. `single·ep·album·mixmaster`의 기본 분할(50만 이하 일시불, 초과 50/50)은 **바꾸지 않는다**.
- 2차 링크는 **편곡·데모 승인 기록 전에는 열지 않는다**.
- 환불은 **받은 돈 기준**. PG 수수료는 공제하지 않는다. 받은 돈을 넘겨 환불하지 않는다.
- `terms` v2로 저장된 기존 계약은 읽기만으로 v3처럼 동작해야 한다(저장 문자열·지문 불변).
- 기존 계약 종류의 정산·계약서·링크 동작에 회귀가 없어야 한다.
- 10개 이상 파일을 건드리는 커밋은 본문에 변경·규칙·검증을 적는다(AGENTS.md).
- 커밋은 태스크마다. 테스트 없이 다음 태스크로 넘어가지 않는다.

**시작 전:** `origin/main`(0c0136 이후)에서 `feat/ai-rework-installments` 브랜치를 만든다. 이 계획 문서와 설계 문서를 먼저 커밋한다.

## Review Focus

1. **경계 금액**: 999,999원은 2회차, 1,000,000원은 3회차여야 한다. 반올림 때문에 합계가 1원이라도 어긋나면 안 된다.
2. **기존 계약 회귀**: EP·정규 앨범(총액 100만 초과)이 3회차로 바뀌면 안 된다. `splitPayment` 호출부는 그대로 둔다.
3. **v2 계약 읽기**: `second`·`secondDueDays`가 없는 저장 JSON을 읽고 링크·정산이 죽지 않아야 한다.
4. **2차 링크 조기 노출**: 편곡 승인 전·계약금 미납 상태에서 2차 링크가 생기면 안 된다. 부분 입금·과입금 후에도 금액이 받은 돈을 넘지 않아야 한다.
5. **환불 상한**: 어떤 단계·추가 비용 조합에서도 `refundable <= received`이고 음수가 아니어야 한다.

---

### Task 1: 분할 규칙과 terms v3

**Files:**
- Modify: `lib/contracts/production/terms.ts`
- Test: `lib/contracts/production/terms.test.ts`

**Interfaces:**
- Produces:
  - `THREE_INSTALLMENT_MIN = 1_000_000`
  - `splitThreeInstallments(total: number): { deposit: number; second: number; balance: number }`
  - `ProductionTerms.version: 3`, `amount.second: number`, `amount.secondDueDays: number`
  - `refundPolicy?: { mode: 'paid_ratio'; stages: Array<{ event: RefundMilestoneEvent; ratio: number }> }`
  - `isSinglePayment(terms)` → `second === 0 && balance === 0`

- [ ] **Step 1: Write failing tests**

Add to `terms.test.ts`:

```ts
describe('splitThreeInstallments', () => {
  it.each([
    [500_000, 500_000, 0, 0],
    [999_999, 500_000, 0, 499_999],
    [1_000_000, 500_000, 300_000, 200_000],
    [1_100_000, 550_000, 330_000, 220_000],
    [1_500_000, 750_000, 450_000, 300_000],
  ])('%i원 → %i / %i / %i', (total, deposit, second, balance) => {
    expect(splitThreeInstallments(total)).toEqual({ deposit, second, balance });
  });
  it('합계는 항상 총액과 같다', () => {
    for (const total of [500_001, 777_777, 999_999, 1_000_001, 1_333_333]) {
      const parts = splitThreeInstallments(total);
      expect(parts.deposit + parts.second + parts.balance).toBe(total);
    }
  });
  it('1,000,000원 미만은 2회차(second=0)다', () => {
    expect(splitThreeInstallments(999_999).second).toBe(0);
  });
});
```

Add v3 validation/parse tests: `second` 포함 합계 불변식, `second=0`이면 `secondDueDays` 없이도 통과, v2 JSON을 읽으면 `second=0`·`secondDueDays=7`로 보정되고 `version===3`이다. 저장 문자열을 다시 쓰지 않는 것은 `parseStoredTerms`가 순수 함수라는 기존 테스트로 충분하다.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath lib/contracts/production/terms.test.ts`
Expected: FAIL — `splitThreeInstallments is not exported`.

- [ ] **Step 3: Implement**

- `splitThreeInstallments`: `total <= SINGLE_PAYMENT_MAX` → `{total,0,0}`; `total < THREE_INSTALLMENT_MIN` → `{round(total/2),0,rest}`; 그 외 `{round(total*0.5), round(total*0.3), rest}`.
- `ProductionTerms`: `version: 3`, `amount.second`, `amount.secondDueDays`.
- `validateProductionTerms`: `second`(0 이상)·`secondDueDays`(1~90) 읽기, `deposit+second+balance === total` 검사, `second > 0 && secondDueDays 없음`이면 오류. 반환 `version: 3`.
- `parseStoredTerms`: v2면 `amount.second ??= 0`, `amount.secondDueDays ??= 7`로 보정한 객체를 반환. v1 경로도 같은 보정을 거친다.
- `refundPolicy` 검증: `mode === 'paid_ratio'`일 때 stages 1~5개, `RefundMilestoneEvent`만, 비율은 **내림차순**이고 마지막이 **0**.
- `isSinglePayment`: `balance === 0 && second === 0`.

- [ ] **Step 4: Run tests**

Run: `npm test -- --runTestsByPath lib/contracts/production/terms.test.ts lib/contracts/production/ledger.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contracts/production/terms.ts lib/contracts/production/terms.test.ts
git commit -m "feat(contracts): add second installment and terms v3"
```

---

### Task 2: 장부 — 2차 납부·연체와 `paid_ratio` 정산

**Files:**
- Modify: `lib/contracts/production/ledger.ts`
- Test: `lib/contracts/production/ledger.test.ts`

**Interfaces:**
- Consumes: Task 1의 `amount.second`, `amount.secondDueDays`, `refundPolicy`.
- Produces:
  - `ledger.payments.secondMetAt: Date | null`, `secondLastDay: Date | null`, `secondOverdueDays: number`
  - `ledger.refund.basis: 'work' | 'paid_ratio'`, `ledger.refund.ratio: number`
  - `paid_ratio`일 때 `refund.lines = []`, `deduction = received − refundable`, `refundableIfStudio = received`

- [ ] **Step 1: Write failing tests**

- 3회차 terms(1,000,000원)에서 계약금 500,000 입금 후 편곡 승인 → `secondLastDay`는 승인일 + `secondDueDays`, 2차 미납이면 연체일이 계산된다.
- 2차까지 입금하면 `secondMetAt`이 채워지고 `paidInFull`은 아직 false.
- `paid_ratio`: 착수 전 → `refundable === received`; `kickoff` 후 → `round(received*0.7)`; `recording_completed` 후 → 40%; `stage_delivered(mixing)` 후 → 20%; `stage_delivered(mastering)` 후 → 0.
- 받은 돈이 0원이면 어떤 단계에서도 `refundable === 0`, 음수 없음.
- `extras`(추가 비용)는 의뢰인 귀책에서만 공제되고, `studio` 귀책이면 `refundable === received`.
- `refund.basis === 'paid_ratio'`, `refund.lines`는 빈 배열.

Test helper: `buildDefaultProductionTerms('rework')`는 Task 4에서 생기므로, 이 태스크에서는 `const terms = { ...buildDefaultProductionTerms('single'), amount: { total: 1_000_000, deposit: 500_000, second: 300_000, balance: 200_000, depositDueDays: 3, secondDueDays: 7, balanceDueDays: 7 }, refundPolicy: {...}, refundSchedule: [{key:'planning',label:'AI 리워크 제작 일체',amount:1_000_000,milestones:[{event:'mastering_delivered',ratio:1}]}] }`를 지역 상수로 쓴다.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --runTestsByPath lib/contracts/production/ledger.test.ts`
Expected: FAIL — `secondMetAt` undefined.

- [ ] **Step 3: Implement**

- 누적 입금 `running`으로 `did`(계약금), `dsecond`(계약금+2차) 도달 사건을 찾는다. `secondMetAt`은 계약금과 같은 방식(2차가 0이면 null).
- `secondLastDay`는 `findStage(stages,'arrangement')?.approved`가 있을 때만 `kstDay(approved.at) + secondDueDays`.
- `secondOverdueDays`는 미납 && 기한 존재일 때만. 연체 todo는 계약금 문구를 복제해 "중간금"으로.
- 정산: `terms.refundPolicy?.mode === 'paid_ratio'`면 기존 항목표 계산을 건너뛴다. `ratio = !kickedOff ? 1 : stages.reduce((best, s) => reached ? Math.min(best, s.ratio) : best, 1)`. `refundable = max(0, round(received*ratio) − (cause==='studio' ? 0 : extras))`, `deduction = received − refundable`, `refundableIfStudio = received`.
- 기존 항목표 경로는 `basis: 'work'`, `ratio: 0`으로 그대로 둔다.

- [ ] **Step 4: Run tests**

Run: `npm test -- --runTestsByPath lib/contracts/production/ledger.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contracts/production/ledger.ts lib/contracts/production/ledger.test.ts
git commit -m "feat(contracts): track second installment and paid-ratio settlement"
```

---

### Task 3: 결제 링크 2차와 유통 게이트

**Files:**
- Modify: `lib/contracts/production/payment-link.ts`, `lib/contracts/production/events.ts`, `pages/admin/contracts/production/[id]/index.tsx` (purpose 타입만)
- Test: `lib/contracts/production/payment-link.integration.test.ts`, `lib/contracts/production/flow.test.ts`

**Interfaces:**
- Consumes: Task 2의 `payments.secondMetAt`, `secondLastDay`.
- Produces: `ContractPaymentLink['purpose'] = 'deposit' | 'second' | 'balance'`; dueNow가 2차를 돌려준다.

- [ ] **Step 1: Write failing tests**

- 계약금 납부 + 편곡 승인 전 → 열린 링크 없음.
- 편곡 승인 후 → `purpose='second'`, `amount === 300_000`(1,000,000 계약).
- 2차 결제 확정 → 링크 닫힘, 다음 링크 없음(잔금 기한 전).
- 2차 일부만 입금(예: 100,000) → 2차 링크 금액 200,000, 잔금 링크는 없음.
- 계약금만 일부 입금(예: 100,000) → 2차 링크 없음, 계약금 링크 금액 400,000.
- `distribution_submitted`를 잔금 전에 기록하면 거절 문구.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --runTestsByPath lib/contracts/production/payment-link.integration.test.ts lib/contracts/production/flow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `Due`/`ContractPaymentLink` purpose에 `'second'`.
- `dueNow`: 계약금 미납 → deposit. 계약금 납부 && `second > 0` && `!secondMetAt` && 편곡 승인 존재 → `second = max(0, deposit+second − received)`. 잔금은 **2차가 없거나 이미 납부됐을 때만**(`second === 0 || secondMetAt`) 현행 조건으로 계산한다.
- 링크 상품명: `... 중간금`.
- `events.ts`의 `distribution_submitted` 판정에 `!ledger.payments.paidInFull` 거절 추가 — 문구는 최종 인도와 같은 톤("잔금이 들어오기 전에는 유통 등록을 시작하지 않습니다").
- 관리자 상세 props 타입에 `'second'`.

- [ ] **Step 4: Run tests**

Run: `npm test -- --runTestsByPath lib/contracts/production/payment-link.integration.test.ts lib/contracts/production/flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/contracts/production/payment-link.ts lib/contracts/production/events.ts "pages/admin/contracts/production/[id]/index.tsx" lib/contracts/production/payment-link.integration.test.ts lib/contracts/production/flow.test.ts
git commit -m "feat(contracts): open second installment link after arrangement approval"
```

---

### Task 4: `rework` 계약 종류·기본 조건·마이그레이션

**Files:**
- Modify: `db/schema.ts`, `lib/contracts/production/terms.ts`, `lib/contracts/production/template.ts`, `components/admin/ProductionContractForm.tsx` (종류 라디오·기본 곡 수만)
- Create: `lib/contracts/production/rework-template.md`, `drizzle/migrations/0086_production_rework_kind.sql`
- Test: `lib/contracts/production/terms.test.ts`, `lib/contracts/production/template.test.ts`

**Interfaces:**
- Produces: `ProductionKind`에 `'rework'`; `buildDefaultReworkTerms(scope: 'none' | 'small' | 'band'): ProductionTerms`; `KIND_LABEL.rework === 'AI 리워크'`; `sourceLabelFor('rework') === 'AI 데모 파일'`.

- [ ] **Step 1: Write failing tests**

- `buildDefaultReworkTerms('none')` → total 500,000, `second 0`, `balance 0`, `refundPolicy.mode==='paid_ratio'`.
- `'small'` → 1,000,000 / 500,000 / 300,000 / 200,000, `scope.arrangementTracks === 10`.
- `'band'` → 1,500,000 / 750,000 / 450,000 / 300,000, `arrangementTracks === 11`.
- `validateProductionTerms(buildDefaultReworkTerms('small'), 'rework')` → ok.
- `readProductionTemplate('rework')`가 `rework-template.md`를 읽고 `{{paymentSummaryRows}}`를 포함한다.
- `buildProductionContent`(rework)에 "중간금"이 인쇄되고, 환불 표에 "받은 금액"·70%가 인쇄되며 항목표 라벨("편곡 (제2조 2호)")은 없다.
- 기존 `buildDefaultProductionTerms('single')`·`'ep'`의 `second`가 0인지(회귀 가드).

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --runTestsByPath lib/contracts/production/terms.test.ts lib/contracts/production/template.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `db/schema.ts`: `productionContractKindEnum`에 `'rework'`.
- `terms.ts`: `SONG_COUNT_RANGE.rework={min:1,max:1}`, `KIND_LABEL.rework='AI 리워크'`, `isOneSongKind`에 포함, `DEFAULT_WORK_WEEKS.rework=6`, `BUNDLE_PER_SONG.rework=0`(기본 조건 빌더가 이 표를 쓰지 않는다는 표시), `refundItemKeysFor('rework')=['planning']`, `refundLabelFor` 라벨 `'AI 리워크 제작 일체 (제2조)'`, `sourceLabelFor('rework')='AI 데모 파일'`.
- `buildDefaultReworkTerms`: 금액은 `AI_REWORK_RELEASE_BUNDLE_PRICE` + (`none` 0 / `small` `AI_REWORK_REWRITE_ADD_PRICE` / `band` `AI_REWORK_REWRITE_LARGE_ADD_PRICE`). `splitThreeInstallments` 사용. `refundSchedule`은 `planning` 한 항목(금액=total, milestones `mastering_delivered:1`)로 채운다(정산은 `refundPolicy`가 담당). `refundPolicy.stages`는 spec §6 값.
- `buildDefaultProductionTerms`는 **그대로** 둔다(다른 종류 second=0).
- `template.ts`: `TEMPLATE_FILE.rework='rework-template.md'`, 대금 표·문장에 2차 행/문장 분기, `refundPolicy`가 있으면 항목표 대신 비율표를 인쇄하는 `refundRows` 분기.
- `rework-template.md`: `single-template.md`를 복제하고 spec §7의 7개 항목 반영.
- `ProductionContractForm.tsx`: `DEFAULT_SONG_COUNT.rework=1`, 종류 라디오에 자동 노출(맵 기반).
- 마이그레이션: `0078_production_mixmaster_kind.sql`을 복제해 `production_contracts`를 재생성하고 kind CHECK를 `('single','ep','album','mixmaster','rework')`로. `npm run db:generate`를 실행해 새 스키마와 어긋나는 diff가 없는지 확인(빈 마이그레이션이 생기면 삭제).

- [ ] **Step 4: Run tests + type-check**

Run: `npm test -- --runTestsByPath lib/contracts/production/terms.test.ts lib/contracts/production/template.test.ts && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts lib/contracts/production/terms.ts lib/contracts/production/template.ts lib/contracts/production/rework-template.md lib/contracts/production/terms.test.ts lib/contracts/production/template.test.ts components/admin/ProductionContractForm.tsx drizzle/migrations/0086_production_rework_kind.sql
git commit -m "feat(contracts): add AI rework contract kind and template"
```

---

### Task 5: 관리자 화면·해지 미리보기·CLI

**Files:**
- Modify: `components/admin/ProductionContractForm.tsx`, `components/admin/ProductionProgressPanel.tsx`, `pages/admin/contracts/production/[id]/index.tsx`, `pages/[locale]/contracts/production/[id]/progress.tsx`, `lib/contracts/production/progress-email.ts`, `scripts/contract-link.ts`
- Test: `lib/contracts/production/progress.test.ts`, `components/admin/ProductionProgressPanel.test.tsx` (없으면 생성)

**Interfaces:**
- Consumes: `refund.basis`, `refund.ratio`, `amount.second`, `purpose='second'`.

- [ ] **Step 1: Write failing tests**

- 작성 폼에서 `rework` 선택 시 범위 라디오(편곡 없음/소편성/풀밴드)가 보이고, 금액이 50만/100만/150만으로 채워진다.
- 상세 대금 표에 3행(계약금·중간금·잔금)과 회차별 상태가 보인다.
- `paid_ratio` 해지 미리보기: "받은 금액 500,000원 × 70% = 환불 350,000원"이 보이고, 항목표 행이 없다.
- `work` 모드는 기존 문구 그대로(회귀).
- CLI `--kind rework --scope small`이 100만 계약을 만든다.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --runTestsByPath lib/contracts/production/progress.test.ts components/admin/ProductionProgressPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

- 폼: `rework`일 때만 범위 라디오, 변경 시 `buildDefaultReworkTerms(scope)`로 금액·항목 재계산.
- 상세: 대금 표를 `second > 0 ? [계약금, 중간금, 잔금] : [계약금, 잔금]`로. 링크 라벨 `second → 중간금`.
- `ProductionProgressPanel`: `refund.basis==='paid_ratio'`면 `lines` 대신 받은 금액·단계 비율·환불액을 표시.
- 고객 진행 페이지·해지 메일: `paid_ratio`일 때 "받은 금액의 N%" 문구로 분기.
- CLI: `--scope none|small|band`, 기본 조건은 `buildDefaultReworkTerms`.

- [ ] **Step 4: Run tests**

Run: `npm test -- --runTestsByPath lib/contracts/production/progress.test.ts components/admin/ProductionProgressPanel.test.tsx && npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/ProductionContractForm.tsx components/admin/ProductionProgressPanel.tsx "pages/admin/contracts/production/[id]/index.tsx" "pages/[locale]/contracts/production/[id]/progress.tsx" lib/contracts/production/progress-email.ts scripts/contract-link.ts lib/contracts/production/progress.test.ts components/admin/ProductionProgressPanel.test.tsx
git commit -m "feat(admin): show three installments and paid-ratio refund preview"
```

---

### Task 6: 전체 검증·PR

**Files:** 없음(검증만).

- [ ] **Step 1: Run full suite**

Run: `npm test -- --watchAll=false`
Expected: 0 failures.

- [ ] **Step 2: Type-check, lint, build**

Run: `npm run type-check && npm run lint && npm run generate:manifests && npm run build`
Expected: type-check clean, lint 0 errors(기존 경고 허용), build 성공.

- [ ] **Step 3: Verify generated artifacts**

`git status --short`로 `lib/story-catalog.json` 등 생성물 변경이 이번 작업과 무관하면 되돌린다. PR에는 계약 관련 파일만.

- [ ] **Step 4: Push (사용자 확인 후 PR)**

```bash
git push -u origin feat/ai-rework-installments
```

PR 생성은 사용자에게 확인한 뒤에 한다. PR 본문에 3회차 규칙, v2 호환, 기존 계약 무회귀, 검증 결과를 적는다.
