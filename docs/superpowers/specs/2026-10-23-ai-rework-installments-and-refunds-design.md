# AI 데모 리워크 — 3회차 분할 결제·단계별 환불 (Plan B)

작성: 2026-10-23. 상태: **설계 승인 대기**.

이 문서는 `2026-10-23-ai-demo-to-release-rework-design.md`의 **§6.4(분할 결제)·§6.5(환불)** 를 대체한다. Plan A(랜딩 페이지)는 PR #889로 머지됐고, 가격 체계는 PR #894에서 25만/50만/100만/150만으로 바뀌었다. 이 설계는 그 가격을 전제로 한다.

운영자 결정(2026-10-23):
- **관리자만 추적한다.** 고객용 진행 페이지는 만들지 않는다. 고객은 기존 결제 링크(`/ko/pay/<slug>`)만 받는다.
- 새 시스템을 만들지 않고 **제작 계약 엔진을 확장**한다.
- 3회차는 **100만원 이상만** 적용한다(50만 이하 일시불 원칙 유지).
- 환불 비율은 **그때까지 받은 돈 기준**이다.

---

## 0. 결론

이미 있는 것:

- 제작 계약의 **진행 기록**(`production_contract_events`)과 **마일스톤별 해지 정산**(`lib/contracts/production/ledger.ts`) — 받은 돈, 작업분, 스튜디오/의뢰인 귀책을 계산한다.
- 계약에 묶인 **결제 링크**(`production_contract_payment_links`) — 카드·간편결제·계좌 입금을 그대로 처리하고, 결제되면 계약에 입금을 기록하고 링크를 닫는다.
- 계약서 생성·서명·PDF·의뢰인 포털.

없는 것: **3회차**, 그리고 **"받은 돈 × 단계 비율" 환불 모드**.

그래서 이 설계는 네 가지를 더한다.

1. 계약 종류 `rework`(1곡) — AI 리워크 전용 기본 조건·계약서 문안.
2. `terms`에 **2차(중간금)** 를 더해 1~3회차를 표현.
3. 결제 링크 purpose에 `second`를 더하고, "지금 받을 돈" 판정을 회차 기준으로 바꾼다.
4. 리워크 전용 **`paid_ratio` 해지 정산** — 받은 돈 × 단계 비율.

---

## 1. 현행 확인 (근거)

| 사실 | 근거 |
|---|---|
| 계약 종류는 `single·ep·album·mixmaster`, DB CHECK로 고정 | `db/schema.ts:260`, `drizzle/migrations/0078_production_mixmaster_kind.sql:33` |
| 결제는 계약금/잔금 2회. 50만 이하 일시불, 초과 시 절반 | `lib/contracts/production/terms.ts:53-61` (`SINGLE_PAYMENT_MAX`, `splitPayment`) |
| "지금 받을 돈"은 계약금 미납 → 계약금, 마스터 승인 후 잔금 기한 → 잔금 | `lib/contracts/production/payment-link.ts:51-63` |
| 결제 확정 시 계약에 `payment_received`를 남기고 링크를 닫음 | `lib/contracts/production/payment-link.ts:127-170` |
| 해지 정산은 항목표(`refundSchedule`) × 마일스톤 비율로 **작업분**을 빼고, 스튜디오 귀책이면 작업분을 빼지 않음 | `lib/contracts/production/ledger.ts:358-460` |
| 링크 결제 금액은 서버가 링크 정의에서만 읽음(VAT 포함) | `pages/api/payment-links/order.ts`, `lib/payments/paymentLinks.ts` |
| 최종 인도는 잔금 전 금지, 유통 등록은 막지 않음 | `lib/contracts/production/events.ts:233-238` |

즉 환불 계산 코드를 새로 쓰는 게 아니라, **정산 모드 하나를 더하는 것**이 이 작업의 핵심이다.

---

## 2. 범위

### 한다
- `rework` 계약 종류와 기본 조건.
- 100만원 이상 3회차(50/30/20), 50만원 초과~100만원 미만 2회차(50/50), 50만원 이하 일시불.
- 회차별 결제 링크, 회차별 입금·연체 상태, 관리자 화면.
- `paid_ratio` 해지 정산과 관리자 미리보기.
- 리워크 계약서 조항(AI 표기·권리·유통 미보장·자료 책임·환불표).
- 유통 등록 전 잔금 확인.

### 안 한다
- 고객용 분할 결제 계획 페이지, 진행률 페이지.
- 자동 청구(정기결제), 자동 독촉, 카카오 알림. (기존 이메일만)
- 25만원 보컬만 상품의 계약화 — **기존 보컬 녹음 상품**(`data/pricing.ts:22`, 250,000원)을 그대로 쓴다.
- 유통사 반려 사유별 자동 정산 — 운영자가 사유를 보고 수동으로 환불 기록.

---

## 3. 상품 → 계약 금액

가격은 `data/aiRework.ts`와 `data/pricing.ts`가 정본이다. 계약 금액도 **VAT 포함 총액**이다(기존 계약과 같다).

| 고객이 사는 것 | 금액 | 계약 | 회차 |
|---|---|---|---|
| 보컬만 다시 녹음 | 250,000 | 없음(기존 녹음 상품) | — |
| 발매까지 | 500,000 | `rework`, 편곡 없음 | 1회(일시불) |
| 발매까지 + 재편곡·재작곡(10트랙 이하) | 1,000,000 | `rework`, 소편성 | **3회 500,000 / 300,000 / 200,000** |
| 발매까지 + 재편곡·재작곡(11트랙 이상) | 1,500,000 | `rework`, 풀밴드 | **3회 750,000 / 450,000 / 300,000** |

`rework` 계약의 `scope`:
- `arrangementTracks`: 0(편곡 없음) / 10(소편성) / 11 이상(풀밴드)
- `recordingHours`: 3
- `mixingTracks`: 10
- `songs`: 1곡 고정

금액은 기본값으로 채우되 운영자가 견적에 맞게 고칠 수 있다(기존 계약과 같다).

---

## 4. 분할 규칙

```ts
// lib/contracts/production/terms.ts
export const splitInstallments = (total: number): { deposit: number; second: number; balance: number } => {
  if (total <= SINGLE_PAYMENT_MAX) return { deposit: total, second: 0, balance: 0 };
  if (total < THREE_INSTALLMENT_MIN) {
    const deposit = Math.round(total / 2);
    return { deposit, second: 0, balance: total - deposit };
  }
  const deposit = Math.round(total * 0.5);
  const second = Math.round(total * 0.3);
  return { deposit, second, balance: total - deposit - second };
};
```

- `THREE_INSTALLMENT_MIN = 1_000_000`.
- **나머지는 마지막 회차**가 받는다. 합계는 항상 총액과 정확히 같다.
- VAT는 회차마다 `splitInclusiveAmount`로 나눈다. 회차별 반올림 때문에 공급가·VAT 합이 일시불 계산과 1~2원 어긋날 수 있다 — 원 단위 합계는 맞고, 장부는 회차별 값을 쓴다.

### terms 형식 (v3)

```ts
interface ProductionTerms {
  version: 3;
  amount: {
    total: number;
    deposit: number;
    second: number;          // 0이면 2회차 없음
    balance: number;         // 0이면 일시불
    depositDueDays: number;  // 체결일 기준
    secondDueDays: number;   // 편곡·데모 승인일 기준
    balanceDueDays: number;  // 마스터링 승인일 기준
  };
  // ...
  refundPolicy?: { mode: 'paid_ratio'; stages: Array<{ event: RefundMilestoneEvent; ratio: number }> };
}
```

- **v2 읽기 호환**: `second`가 없으면 0, `secondDueDays`는 7로 채운다. 저장 문자열은 바꾸지 않는다.
- 불변식(검증): `deposit + second + balance === total`, 각 금액 ≥ 0, 기한 1~90일. `second > 0`이면 `secondDueDays` 필수.
- 기존 `isSinglePayment`는 `second === 0 && balance === 0`으로 유지한다.

---

## 5. 회차별 결제 링크

`production_contract_payment_links.purpose`에 `second`를 더한다(DB CHECK 없음 — 앱 enum만).

### 지금 받을 돈

| 상태 | 링크 |
|---|---|
| 서명 완료, 계약금 미납 | `deposit` = 계약금 − 받은 금액 |
| 계약금 납부, `second > 0`, 2차 미납, 편곡 승인됨 | `second` = 2차 금액 − (받은 금액 − 계약금) |
| 2차(또는 일시불) 납부, 마스터 승인 후 | `balance` = 총액(추가 비용·초과 수정 포함) − 받은 금액 |
| 그 밖(작업 중·완납·종료) | 없음 |

- 2차는 **편곡·데모 승인 기록(`stage_approved` + `stage='arrangement'`)이 있을 때만** 뜬다. 승인 전에 링크를 미리 보내지 않는다.
- 2차 금액은 `max(0, second − (received − deposit))`이다. 계약금을 더 냈으면 2차는 0이 되고 잔금 계산으로 넘어간다.
- 금액이 바뀌면(계좌 입금 수동 기록, 추가 비용 동의) 열린 링크를 닫고 새로 만든다 — 기존 동작 그대로.
- 결제가 확정되면 링크를 닫고, 다음 회차 링크를 다시 맞춘다 — 기존 `recordContractPaymentFromLinkOrder` 흐름을 그대로 쓴다.
- 관리자 상세에는 회차 표를 둔다: 회차 / 금액 / 기한 / 상태(미납·연체·납부일) / 링크 복사.
- 2차 연체는 계약금 연체와 같은 방식으로 `payments.secondOverdueDays`로 계산해 관리자 화면과 할 일에 표시한다.

---

## 6. 환불·해지 (`paid_ratio`)

리워크 계약은 **받은 돈 × 단계 비율**로 돌려준다. 기존 계약(`single·ep·album·mixmaster`)은 항목표 방식 그대로다.

```ts
refundPolicy: {
  mode: 'paid_ratio',
  stages: [
    { event: 'kickoff', ratio: 0.7 },                 // 착수 후
    { event: 'recording_completed', ratio: 0.4 },     // 녹음 완료 후
    { event: 'mixing_delivered', ratio: 0.2 },        // 믹싱 결과물 전달 후
    { event: 'mastering_delivered', ratio: 0 },       // 마스터 납품 후
  ],
}
```

| 시점(기록된 사건) | 환불 |
|---|---|
| 착수 기록 전 | 받은 돈 100% |
| `kickoff` 이후 ~ 녹음 완료 전 | 받은 돈 70% |
| `recording_completed` 이후 ~ 믹싱 결과물 전 | 받은 돈 40% |
| `stage_delivered(mixing)` 이후 ~ 마스터 전 | 받은 돈 20% |
| `stage_delivered(mastering)` 이후 | 0% |
| 스튜디오 귀책 중단 | 받은 돈 100% (작업분 공제 없음) |
| 유통사 반려 — 스튜디오 귀책/시스템 | 받은 돈 100% |
| 유통사 반려 — 아티스트 자료 미비 | 0% (계약서에 명시) |

- **계산식**: `refundable = received × stageRatio − extras(의뢰인 귀책일 때만)`. 받은 돈을 넘지 않는다.
- `extras`는 기존과 같이 동의한 추가 비용·이행한 초과 수정 요금만 공제한다.
- **PG 수수료는 공제하지 않는다.** "100% 환불"은 받은 금액 전액을 돌려준다는 뜻이고, 토스 수수료는 스튜디오가 부담한다(기존 전액 환불과 같다).
- 단계 판정은 기존 `refundSchedule` 마일스톤과 같은 사건 이름(`kickoff`·`recording_completed`·`mixing_delivered`·`mastering_delivered`)을 쓰되, 계산식만 `received − 작업분`이 아니라 `received × 비율`이다. 장부가 이미 계산하는 단계 상태를 재사용한다.
- **"믹싱 착수" 기록은 없다.** v1은 `stage_delivered(mixing)`(믹싱 결과물 전달)을 20% 경계로 쓴다. 그 전 구간은 40%다 — 스튜디오에 불리하지 않은 쪽(고객에게 유리)으로 근사한 것이다. 별도 `mixing_started` 사건은 v2 후보.
- 유통 반려는 자동 판정하지 않는다. 관리자가 해지 사유를 `client|studio`로 고르고, 자료 미비면 `client`, 시스템/우리 귀책이면 `studio`로 기록한다. 계약서 환불표가 두 경우를 명시한다.
- 관리자 해지 화면은 회차별로 "받은 돈, 단계, 환불 예정액"을 먼저 보여 준다. 실제 송금은 기존 카드 부분취소·계좌 환불 기록을 쓴다.

### 유통 등록 게이트

`distribution_submitted`는 **완납 이후에만** 기록할 수 있게 한다(§6.4 "유통 등록은 잔금 이후"). 잔금이 남아 있으면 기존 최종 인도와 같은 문구로 거절한다.

---

## 7. 계약서 (`rework-template.md`)

`single-template.md`를 복제해 다음을 바꾼다.

1. **제1조(목적·범위)**: AI 데모를 기반으로 보컬 재녹음·편곡(선택)·믹싱·마스터링·유통 등록·발매 홍보. 편곡 없음/소편성/풀밴드를 범위 칸에 명시.
2. **제2조(의뢰인 진술·보증)**: AI 데모에 제3자 권리 침해가 없고, 상업적 사용 권한을 보유한다. 침해 분쟁은 의뢰인 책임.
3. **AI 표기**: 스튜디오는 AI 사용 범위(반주 유지/AI-assisted)를 고지하고, 의뢰인은 플랫폼 정책에 따라 표기한다. **"AI 곡 아님"을 보장하지 않는다.**
4. **유통**: 게재·승인·차트·스트리밍 수치를 보장하지 않는다. 자료 미비로 인한 반려는 의뢰인 책임.
5. **대금**: 1~3회차 금액·기한. 2차는 편곡·데모 승인 후, 잔금은 마스터 승인 후. 미납 시 다음 단계 중단.
6. **해지·환불**: §6 표를 그대로 인쇄. `paid_ratio` 문구는 "받은 금액의 …%"로 쓴다.
7. **크레딧**: 기존 `credits` 필드 유지.

> 문안은 법률 검토 전 초안이다. 운영자 확인 후 확정한다.

---

## 8. 관리자 화면

- `/admin/contracts/new`: 종류에 **AI 리워크** 추가. 선택 시 범위(편곡 없음/소편성/풀밴드)와 곡 제목만 받고 금액을 자동 채운다. 금액 수정 가능.
- `/admin/contracts/production/[id]`: 대금 표를 1~3회차로. 회차별 상태·기한·연체일·링크.
- 목록: `rework` 라벨. 2차 연체 계약은 기존 계약금 연체와 같은 배지.
- 해지 폼: `paid_ratio` 미리보기(위 §6).
- `scripts/contract-link.ts`: `--kind rework`, `--scope none|small|band` 지원.

고객 포털(`/contracts/production/[id]/progress`)은 **문구만** 3회차에 맞춘다. 새 페이지는 없다.

---

## 9. 마이그레이션·호환

- `drizzle/migrations/0086_production_rework_kind.sql`: `production_contracts` 테이블 재생성 + kind CHECK에 `'rework'` 추가(0073·0078과 같은 방식).
- `production_contract_payment_links.purpose`는 CHECK가 없어 마이그레이션 불필요. 앱 enum만 확장.
- `terms`는 v3. 기존 v2는 읽을 때 `second=0`, `secondDueDays=7`로 올린다. 저장된 계약 본문·지문은 바꾸지 않는다.
- `refundPolicy`가 없는 계약은 기존 항목표 정산을 쓴다 — 기존 계약 회귀 없음.
- 25만 보컬만은 계약을 만들지 않으므로 데이터 이관 없음.

---

## 10. 테스트

- `splitInstallments`: 500,000 / 500,001 / 999,999 / 1,000,000 / 1,100,000 / 1,500,000, 합계 불변, 나머지 마지막 회차.
- terms v3 검증: 합계 불변식, 2차 기한 필수, v2 → v3 읽기.
- 결제 링크: 2차는 편곡 승인 전에 안 뜸, 승인 후 금액 정확, 결제 후 닫힘·다음 회차로 이동, 계좌 입금 수동 기록 후 재계산.
- ledger: 2차 연체일, `paid_ratio` 각 단계·extras·스튜디오 귀책.
- `distribution_submitted` 잔금 전 거절.
- 관리자 화면: 3회차 표, 해지 미리보기.
- 기존 계약(single·ep·album·mixmaster) 전체 회귀 — `npm test`, `npm run type-check`, `npm run build`.

---

## 11. 미결정·위험

1. **25만 보컬만을 계약 없이 두는 것** — 확인 필요. 계약을 원하면 `rework` + 일시불로 1회차만 쓰면 된다(구조는 이미 지원).
2. **"믹싱 착수" 경계** — v1은 믹싱 결과물 전달로 근사. 정확히 나누려면 `mixing_started` 사건 추가(DB CHECK·UI·알림)가 필요하다.
3. **유통 반려 정산** — 자동 판정 없음. 관리자가 귀책을 고른다. 원안의 "등록비 환불 + 단계별 제작비"는 가격에 등록비가 분리돼 있지 않아 v1에서 "스튜디오 귀책 = 받은 돈 100%"로 단순화했다. 반려 사유를 데이터로 남기려면 별도 필드가 필요하다.
4. **미납 독촉 없음** — 이메일 안내만 있고 자동 독촉은 없다. 3회차 운영에서 연체가 늘면 v2에서 다룬다.
5. **법률 검토** — AI 데모 권리 보증·AI 표기 조항은 검토 전 초안이다.

---

## 12. 구현 순서

1. **T1** `splitThreeInstallments` + terms v3 타입·검증·v2 호환.
2. **T2** ledger: 2차 납부·연체, `paid_ratio` 정산.
3. **T3** 결제 링크: `second` purpose, dueNow, 관리자 타입, 유통 게이트.
4. **T4** `rework` 종류·기본 조건·계약서·마이그레이션 0086.
5. **T5** 관리자 작성 폼·상세·해지 미리보기, CLI.
6. **T6** 전체 검증 + PR.
