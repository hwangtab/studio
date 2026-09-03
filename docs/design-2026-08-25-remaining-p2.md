# 남은 P2 3건 설계 — 2026-08-25

2차 리뷰(docs/code-review-2026-08-24-round2.md)에서 코드 수정만으로 안 끝나 미뤄 둔 3건.
각각 문제 → 선택지 → 권고 → 결정 필요 사항 순. 근거는 전부 현재 코드에서 확인한 것.

---

## #12 문서 지문(contentHash) 검증 경로 — **완료(2026-08-25), 설계와 달라진 점 포함**

### 설계 전제 두 가지가 틀렸었다 (착수 중 확인)
1. **"대조 코드가 프로덕션에 없다"는 낡은 정보였다.** 다른 세션이 `lib/contracts/audit-trail.ts`
   (`c738aaa2a9`)로 감사추적 화면을 이미 배포했고, 관리자 상세가 **페이지 로드마다 자동 대조**한다
   (unsigned/missing/purged/match/mismatch). 그래서 설계의 "관리자 버튼 + PATCH verify"는 **폐기**했다 —
   중복이다. 대신 그 `verifyFingerprint`가 가진 진짜 구멍을 고쳤다(아래 3).
2. **"DB 0건"이 아니었다.** 실 DB에 서명·미파기 `terminated` 계약 **1건**이 있고, 지문이 접두사 없는
   옛 형식(v3)이다. 마이그레이션 0이라는 전제가 깨졌지만, 오히려 v3 형식을 레지스트리에 남길
   이유가 생겼다.

### 실제로 한 것
- **저장 형식 `v4:<hex>`** — `computeContractFingerprint`가 버전을 접두사로 박는다. `parseFingerprint`가
  버전·hex를 분리.
- **버전별 canonical builder 레지스트리** `{ v3, v4 }` — v3는 `git 24d50cf49d^`에서 문자 단위로 복원
  (v4에서 `customerBirthdate`·`roomArea` 두 줄만 뺀 것). 앞으로 v5가 생겨도 v4 계약이 제 형식으로 대조된다.
- **4갈래 결과** `FingerprintCheck`: match / mismatch / unverifiable(none·malformed·unversioned·unknown-version).
  접두사 없는 옛 지문은 **v3로 재계산해 맞으면 `match(legacy)`**, 안 맞으면 `unverifiable/unversioned` —
  v2였을 수도 있어 **불일치(변조)로 단정하지 않는다.** 이것이 audit-trail이 갖고 있던 구멍이다: 예전엔
  현재 버전으로 계산해 `===`만 비교해서, 버전이 다른 지문이 전부 "변조"로 떴다.
- audit-trail의 `verifyFingerprint`가 위 검증기에 **위임**하고 `unverifiable` kind를 추가. `AuditTrail.tsx`가
  사유별 문구와 "옛 형식이지만 대조 확실" 안내를 렌더.
- **CLI `scripts/verify-contracts.ts`** (`node --env-file=.env.local --import tsx … --all | <id>`) —
  세션 없이 전건 대조. audit-trail 로직 재사용, PII 미출력, mismatch 있으면 exit 1.

### 증명
CLI를 실 DB에 돌려 그 실계약이 `검증불가(unversioned)` → **`일치 541C-1E62 (v3)`**로 바뀌는 것을 확인.
v3 복원이 바이트 단위로 정확하다는 뜻이고, 실제 법적 문서 1건이 진짜로 대조 가능해졌다.

### 원래 설계 (기록용)

### 설계

**1. 저장 형식을 `v4:<hex>`로 (지금, 0건일 때)**
- `computeContractFingerprint`가 `${FINGERPRINT_VERSION}:${hex}`를 반환.
- `verifyContractFingerprint`가 접두사를 파싱해 **그 버전의 canonical builder**로 재계산.
  `CANONICAL_BUILDERS: Record<'v4'|..., (input) => string>` — 앞으로 v5가 생겨도 v4 계약이 검증된다.
  v3 이전은 실계약이 없으므로 builder를 두지 않고 `{ ok:false, reason:'unsupported-version' }`.
- 접두사 없는 값(이론상 없음)은 `reason:'legacy-unversioned'`로 명시.
- `pdf-html.ts:197`·관리자 표시는 접두사 제거한 hex를 그대로 쓰면 되므로 화면 변화 없음.

**2. 검증 결과를 4갈래로 — "불일치=변조"라고 말하지 않는다**
```
type FingerprintVerdict =
  | { status: 'match' }
  | { status: 'mismatch'; expected; actual }          // 실제 변조 의심
  | { status: 'purged' }                              // 파기됨 — 검증 불가가 정상
  | { status: 'unverifiable'; reason: 'unsigned' | 'unsupported-version' | 'legacy-unversioned' }
```
`purgedAt`이 있으면 재계산 전에 `purged`로 끝낸다. 파기 시 `contentHash`도 함께 비우는 것보다
**남겨 두고 `purged`로 답하는 편**이 낫다 — "서명 당시 지문이 이것이었다"는 기록은 파기 대상
개인정보가 아니고, PDF 사본을 가진 고객이 나중에 대조할 근거가 된다.

**3. 재계산 입력은 이미 한곳에 모여 있다 → `verifyStoredContract(contractId)` 하나만 추가**
`buildFingerprintInput(contract, {attachments, clauses, signatureData, signer, signedAt, identityVerifiedAt})`
(integrity.ts:162)이 조립을 담당하므로, DB에서 계약 + `signatures`(customer, signed) +
`contractClauses` + `contractAttachments`를 읽어 넘기면 끝. signer는 서명행의
`signerName/signerEmail/ipAddress`, signedAt/identityVerifiedAt은 계약 컬럼. **새 조립 로직 없음.**

**4. 노출 경로 — 둘 다, 같은 함수 위에**
- 관리자 상세(`admin/contracts/[id]/index.tsx`) 지문 옆 **"지문 대조" 버튼** → `PATCH action:'verify'`
  (`[id].ts`의 `MUTABLE_ACTIONS` 패턴 그대로, 단 상태를 바꾸지 않으므로 `checkAction` 대상 아님).
  결과를 4갈래 문구로 표시: 일치 / **불일치(변조 의심, 즉시 확인)** / 파기됨 / 검증 불가(사유).
- `scripts/verify-contract.mjs <contractId|--all>` — 세션 없이 운영자가 돌리는 CLI.
  `scripts/test-turso.mjs`와 같은 env 패턴(`node --env-file=.env.local`). `--all`은 서명된 전건을
  순회해 mismatch만 출력 → 분기별 감사·백업 복구 후 무결성 확인용. **PII를 출력하지 않는다**
  (id·verdict만).
- 계약 "발송 완료 메일"에는 넣지 않는다 — 고객이 대조할 수단(공개 검증 페이지)을 만드는 건
  별도 상품 결정이고, 토큰 노출 면적을 늘린다.

### 작업량
- 저장 형식 + builder 레지스트리 + verdict 4갈래 + 테스트: 반나절
- `verifyStoredContract` + PATCH verify + 관리자 버튼: 반나절
- CLI: 1시간
**결정 필요**: 없음 — 전부 기술 판단. 단 **1번은 실계약 유입 전에** 넣어야 한다.

---

## #27 release 3 tier 페이지 — 디스코그래피가 tier 무관

### 지금 상태
- `album.tsx`·`ep.tsx`·`single.tsx`의 `getStaticProps`가 **문자 그대로 동일**(`featured` 필터만).
  `TierPage.tsx:89-91`도 `featured` 12개를 tier 인자 없이 다시 자른다.
- 데이터(`data/portfolio/items.ts`, 34건): `single 22 · album 8 · compilation 3 · commercial 1`.
  **`ep` 카테고리는 없다.** featured 13건 = single 6 · album 4 · compilation 3.
- 결과: 세 페이지가 같은 13건을 보여준다. 정규앨범 문의자가 보는 증빙이 싱글 6건이 섞인 목록.

### 선택지
| | 방식 | 장점 | 단점 |
|---|---|---|---|
| A | 현행 유지 | 0 | 상품과 증빙 불일치 |
| B | tier→category 정확 매핑 | 정합 | `ep`는 0건, `album`은 featured 4건뿐 |
| C | **매핑 + 부족분 폴백** | 정합하면서 빈 섹션 없음 | 폴백 규칙 설명 필요 |

### 권고: C
```ts
const TIER_CATEGORIES = {
  single: ['single'],
  album:  ['album', 'compilation'],   // 컴필레이션은 정규 분량의 완결 앨범 작업
  ep:     ['album', 'single'],        // EP는 둘 사이 — 데이터에 ep가 생기면 맨 앞에 추가
} as const;
```
- 우선 해당 카테고리의 featured, 부족하면 같은 카테고리의 non-featured, 그래도 12 미만이면
  featured 전체로 채움. **정렬은 항상 "카테고리 일치 우선"** — 정규앨범 페이지 상단 4장은 반드시 앨범.
- 세 `getStaticProps`를 `getTierPortfolioItems(locale, tier)` 헬퍼로 합친다(복제 제거).
  `TierPage`의 재필터(`:89-91`)는 제거 — 필터 책임은 한곳에.
- 컴필레이션 3건(`peace-and-music`, `fish-die`, `gentrification`)이 실제로 "정규 앨범급 작업"인지는
  운영자만 안다. 아니면 `album:['album']`만.

### 결정 필요 (운영자)
1. **EP 정의** — 현재 `album` 8건 중 EP(4~6곡)로 분류돼야 할 것이 있는가? 있으면 데이터에
   `"category":"ep"`를 부여하는 것이 근본 해결(코드 매핑에 `ep:['ep', ...]`가 먼저 걸린다).
   없으면 위 폴백으로 간다.
2. 컴필레이션을 앨범 티어 증빙으로 쓸지.
3. (선택) 12건 캡을 tier별로 달리할지 — 앨범은 4건뿐이라 12 캡이 의미 없음. 8 정도 권고.

### 작업량
헬퍼 + 매핑 + TierPage 정리 + 3페이지 통합 + 테스트: 2~3시간. 데이터 재분류는 별도(운영자).

---

## #28 maskable 아이콘 세이프존

### 지금 상태
- `manifest.ts:66-71`이 `icon-192/512.png`를 `purpose:'any'`와 `'maskable'` **양쪽에 같은 파일**로 등록.
- 그 파일은 **스튜디오 콘솔 실사진**이 캔버스에 꽉 찬 것(확인함). 세이프존(중앙 ~80%) 없음.
- Android "홈 화면에 추가" 시 원형/스퀴클 마스크가 가장자리(믹서·스피커 모서리)를 잘라낸다.

### 더 근본적인 관찰
사진은 애초에 **앱 아이콘 재료가 아니다** — 48px로 줄면 뭔지 알아볼 수 없다. 저장소에
`public/images/email-logo.png`(studio NOL 워드마크, 흰 배경)가 있다. 아이콘은 이걸 써야 한다.

### 선택지
| | 방식 | 결과 |
|---|---|---|
| A | `maskable` 항목만 제거 | 잘림은 사라지지만 Android가 `any`를 마스크에 억지로 씀 → 여전히 잘림(플랫폼 기본) |
| B | 사진에 여백만 추가해 maskable 별도 생성 | 잘림 해결, 알아볼 수 없는 아이콘은 그대로 |
| C | **워드마크 기반 아이콘 신규 제작 (any + maskable 각각)** | 둘 다 해결 |

### 권고: C — `sharp` 스크립트로 생성 (수동 디자인 툴 불필요)
- 소스: `email-logo.png`(워드마크). 배경은 브랜드 다크 또는 화이트 — 워드마크의 노란 `NOL`이
  살아야 하므로 **화이트 배경 + 워드마크**를 1안, 다크 배경은 2안.
- `any` 512/192: 워드마크를 캔버스 ~86% 폭으로, 사방 여백 7%.
- `maskable` 512/192: 워드마크를 **중앙 60% 안**에 두고 배경을 캔버스 전체에 채움
  (마스크 세이프존 규격은 중앙 80% 원 → 텍스트는 그보다 안쪽이 안전).
- 파일: `icon-192.png`·`icon-512.png`(any, 기존 경로 유지) + `icon-192-maskable.png`·`icon-512-maskable.png`.
  `manifest.ts`의 maskable 두 항목만 새 파일로. 단축 아이콘(shortcuts)은 any 그대로.
- 생성 스크립트 `scripts/generate-app-icons.mjs`를 남겨 워드마크가 바뀌면 재생성. `prebuild`에는
  넣지 않는다(원본이 바뀔 때만 손으로, CLAUDE.md "한 번 쓰고 말 일에 빌드 훅 금지").
- 검증: 생성 후 `maskable.app` 에디터에 올려 원형/스퀴클 마스크 미리보기 확인(1분).

### 작업량
스크립트 + 생성 + manifest 수정: 1~2시간.
**결정 필요**: 배경색(화이트 / 브랜드 다크). 워드마크 자체를 아이콘으로 쓰는 데 이견이 없다면 화이트로 진행.

---

## 실행 순서 권고
1. **#12-1 저장 형식 `v4:<hex>`** — DB 0건인 지금. 나머지 #12는 이어서.
2. #28 — 결정 1개(배경색)만 받으면 바로.
3. #27 — 결정 2개(EP 정의·컴필레이션) 받은 뒤. 결정 전이라도 헬퍼 통합(복제 제거)은 먼저 가능.
