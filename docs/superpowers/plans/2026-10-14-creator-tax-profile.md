# 개설자 세무 정보(사업자 정보·국세청 상태 조회·사업자등록증) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 펀딩 개설자·공연 주최자·상점 아티스트가 함께 쓰는 개설자 계정(`funding_creators`) 하나에 정산용 세무 정보를 받는다. 개인은 지금처럼 주민등록번호(암호화)로 원천징수하고, 사업자는 사업자등록번호·상호·대표자명을 적어 국세청 상태를 조회하며, 사업자등록증 사본은 원하면 올린다. 이 정보는 콘솔의 계정 단위 **정산 정보** 화면 하나에서 저장한다.

**Architecture:** 저장 경로는 지금의 `savePayoutSection`(`lib/funding/creatorProjectWrite.ts`) 하나를 넓힌다 — 계좌·세금 구분·주민등록번호는 그대로 `funding_creators`에, 사업자 정보는 새 표 `creator_business_profiles`(creator_id 키)에 같은 배치로 쓴다. 국세청 조회는 저장 직전에 한 번 하고, 실패해도 "미확인"으로 저장한다. 사업자등록증은 private Blob의 새 접두사 `tax-docs/`에 두고 관리자 전용 라우트만 내보내며 열람을 `privacy_access_logs`에 남긴다. 펀딩 편집기의 "정산 정보" 탭은 입력 폼 대신 요약과 계정 화면 링크를 보인다(저장 경로가 둘이 되지 않게).

**Tech Stack:** Next.js 15.5 Pages Router, drizzle-orm + Turso(libSQL), iron-session, @vercel/blob(private), sharp, Jest.

**Spec:** 이 파일의 "결정 사항" 절(2026-10-14 운영자 결정). 근거 조사: `lib/funding/CLAUDE.md`, `lib/crypto/CLAUDE.md`, 루트 `CLAUDE.md`(0022·0035 절, 약관 판본 절, 마이그레이션 절).

## 결정 사항 (운영자 2026-10-14)

| 항목 | 결정 |
|---|---|
| 신분증 | **받지 않는다.** 개인 원천징수는 지금처럼 이름 + 암호화한 주민등록번호만 쓴다 |
| 사업자 입력 | 사업자등록번호(10자리) · 상호 · 대표자명. 세금 구분이 사업자(`invoice`)면 셋 다 필수 |
| 국세청 조회 | 공공데이터포털 "국세청 사업자등록정보 진위확인 및 상태조회" 상태조회 API. 키는 env `NTS_BUSINESS_STATUS_API_KEY`. 키가 없거나 조회가 실패하면 **"미확인"으로 저장**하고 운영자 화면에 그 사실을 보인다. 저장을 막지 않는다 |
| 경고(막지 않음) | 휴업·폐업 → "세금계산서를 발행할 수 없다". 간이(세금계산서 미발급)·면세·고유번호 단체 → "세금계산서 발행이 어려울 수 있어 운영자가 확인한다". 미등록 번호 → "번호를 다시 확인해 달라" |
| 사업자등록증 | **선택** 업로드(이미지·PDF). private Blob `tax-docs/` 접두사, 관리자만 열람, 열람은 접속기록에 남긴다 |
| 화면 | 콘솔 탭에 "정산 정보" 추가(펀딩 프로젝트 \| 공연 \| 상점 \| 정산 정보). 승인된 펀딩 프로젝트·승인된 공연 등록·상점 아티스트 등록 중 **하나라도** 있으면 열린다 |

이 계획이 정한 것(운영자가 알아야 할 판단):

- **사업자 정보는 암호화하지 않는다.** 사업자등록번호·상호·대표자명은 고유식별정보가 아니고, 사업자가 세금계산서·영수증·통신판매 표시에 늘 공개로 적는 값이다. 국세청 조회에 평문이 필요하고 관리자 화면이 번호를 바로 보여야 하므로, 암호화하면 키 의존(키가 없으면 사업자 정산 전체가 멈춤)만 늘고 지키는 것이 거의 없다. 대신 계좌·주민번호와 같은 노출 규칙을 지킨다 — 공개 화면·관계 조회·목록에 싣지 않고, 개설자 본인과 관리자 화면에만 나온다. 사업자등록증 사본(사업장 주소·대표자 생년월일이 찍힐 수 있다)은 파일 자체를 private Blob에 두고 열람을 기록한다.
- **국세청 조회는 "제3자 제공"도 "처리위탁"도 아닌 "조회"로 적는다.** 보내는 것은 사업자등록번호 하나이고, 목적은 우리의 확인이며, 국세청은 이미 그 번호의 등록 정보를 갖고 있다. 위탁 표(`FUNDING_CREATOR_DATA_PROCESSORS`)에 넣으면 국세청이 우리 대신 처리하는 것으로 읽히므로 넣지 않고, 처리방침 14항 본문에 "무엇을 어디로 보내 무엇을 받는지"를 적는다(Task 10).
- **세금 구분을 개인(원천징수)으로 바꿔 저장하면 사업자 정보와 사업자등록증을 지운다** — 주민등록번호를 사업자 전환 때 지우는 규칙의 거울이다. 다만 사업자로 정산한 기록이 있으면 지우지 않는다(이미 받은 세금계산서와 대조할 근거).
- 펀딩 편집기 정산 탭은 **요약 + 링크**로 바꾼다. 같은 폼을 두 곳에 그리면 저장 경로는 하나여도 화면 상태(dirty 가드·경고 문구)가 두 벌이 된다.

**범위 밖:** 상점·공연 정산 기록 표(지금은 상점이 운영자 수기 이체, 공연은 3단계). 사업자 정보로 세금계산서를 자동 대조하는 일. 홈택스 연동.

## Global Constraints

- 새 표는 `creator_business_profiles` 하나다. **`funding_creators`에 컬럼을 더하지 않고, 새 표를 어떤 `relations()`에도 잇지 않는다.** `buildFundingPayoutPreview`(`lib/funding/payout.ts`)와 결제 확인 경로가 `db.query.fundingCreators.findFirst`·관계 조회로 전체 컬럼을 SELECT하므로, 컬럼을 더하면 마이그레이션 전 배포에서 결제 확인·정산·개설자 로그인이 깨진다(루트 CLAUDE.md 0022·0035 절, `lib/crypto/CLAUDE.md` 0023 절). 새 표는 항상 컬럼을 고른 `select({...})`로 읽는다.
- 표가 없을 때(마이그레이션 전): 개설자 정산 정보 화면의 **사업자 칸만** "준비 중"으로 꺼지고 계좌·주민번호 저장은 지금처럼 된다. 정산 미리보기는 사업자 정보를 "읽지 못함"으로 표시하고 사업자 정산 기록만 거부한다. 공개 화면·결제는 이 표를 읽지 않는다.
- 마이그레이션은 `npm run db:generate -- --name creator_business_profiles`로 만든다. 새 엔트리의 `when`이 저널 최댓값 `1791957424699`(0056_software_orders)보다 커야 하고, 번호는 `0057`이다. 운영 적용은 루트 CLAUDE.md "운영 DB 마이그레이션 적용 방법"대로 배포 **전에** 한다.
- 저장 함수는 `savePayoutSection` 하나다. 새 저장 함수·새 암호화 경로를 만들지 않는다. 계좌·주민번호 규칙(키 없으면 전체 거부, 빈 주민번호는 기존 값 유지, 사업자 전환 시 `hasWithheldPayout`이면 유지)은 그대로 둔다.
- 국세청 조회 실패는 **어떤 경우에도** 저장을 실패시키지 않는다. 조회는 4초 제한, 개설자당 시간당 10회(`consumeRateLimit`). 한도를 넘으면 조회를 건너뛰고 "미확인"으로 저장한다.
- 사업자등록증은 `tax-docs/<creatorId>/<uuid>.(webp|pdf)`. `/api/funding/media/`는 `resolveFundingBlobPath`가 `funding/` 접두사와 `.webp`를 강제하므로 이 접두사를 내보낼 수 없다 — 그 함수를 넓히지 않는다. 이미지 입력은 sharp로 다시 인코딩해 EXIF를 떨군다. 판정은 확장자·Content-Type이 아니라 **매직 바이트**다.
- 평문 주민등록번호·계좌번호를 로그·props·메일에 넣지 않는다(`lib/crypto/CLAUDE.md`). 사업자 정보는 개설자 본인 화면과 관리자 화면에만 싣는다.
- 새 페이지는 `docs/design-system.md` §8(`designEdition = 'v2'`, `PageShell`, `components/ui/` 프리미티브)을 따르고 `tests/pages/pageScaffold.test.ts`, `components/ui/uiPatterns.baseline.test.ts`를 통과해야 한다.
- 약관·처리방침을 고치면 판본을 먼저 올리고 기준선을 갱신한다(루트 CLAUDE.md). 오늘 `FUNDING_TERMS_VERSION`이 이미 `funding-terms-2026-10-14`이므로 같은 날이면 `-r2`.
- 검증 순서: `npm run type-check` → `npm run lint` → `npx jest`(전체 — 디렉터리로 좁히지 않는다) → `npm run build`.

## Review Focus

1. **사업자등록증 노출** — `/api/funding/media/tax-docs/...`·`/api/funding/media/..%2Ftax-docs...` 같은 요청이 404여야 하고, 관리자 열람 라우트는 무인증 401·남의 creatorId도 관리자만 연다. 열람은 성공·실패 모두 `creator_business_certificate_view`로 접속기록에 남는다(Task 4·7 테스트).
2. **국세청 실패가 저장을 막지 않음** — 키 없음·시간 초과·5xx·이상한 응답·한도 초과 다섯 경우 모두 저장은 `ok: true`, 행의 `nts_status`는 `unverified`, `nts_check_error`에 사유 코드가 남아야 한다(Task 2·3 테스트).
3. **배포 순서** — `funding_creators`에 컬럼이 없고 새 표가 relations에 없는지, 표가 없는 DB에서 `buildFundingPayoutPreview`·개설자 로그인·계좌만 저장이 지금처럼 되는지(Task 1·3·8 테스트).
4. **세금 구분 전환 시 파기 정합** — 개인으로 바꾸면 사업자 행과 Blob이 지워지고, 사업자 정산 기록이 있으면 남는다. 사업자로 바꿀 때의 주민번호 규칙은 바뀌지 않는다(Task 3 테스트). 월 1회 파기는 살아 있는 펀딩·공연·상점이 있는 계정을 건드리지 않는다(Task 9 테스트).
5. **열리는 조건** — 승인 프로젝트 없이 승인된 공연 등록만 있는 계정, 상점 아티스트로만 등록된 계정이 저장할 수 있고, 아무것도 승인 안 된 계정은 `not_editable`이다. 사업자인데 사업자등록번호가 없으면 펀딩 정산 기록이 `no_business_number`로 거부된다(Task 3·8 테스트).

---

### Task 1: 스키마 — `creator_business_profiles` + 마이그레이션 0057

**Files:**
- Modify: `db/schema.ts` (`fundingCreators` 정의 뒤)
- Create: `drizzle/migrations/0057_creator_business_profiles.sql`(generate 산출물), `drizzle/migrations/meta/0057_snapshot.json`, `_journal.json` 갱신
- Test: `lib/funding/businessProfile.schema.integration.test.ts`

**Interfaces:**
- Produces: `creatorBusinessProfiles`, `ntsBusinessStatusEnum`, `type CreatorBusinessProfileRow`

- [ ] **Step 1: 스키마 추가**

```ts
// db/schema.ts — fundingCreators 정의 뒤
/**
 * 국세청 상태조회 결과를 우리 말로 접은 값. `unverified`는 "조회하지 못했다"(키 없음·실패·한도)이고
 * 사유는 `nts_check_error`에 있다 — "등록되지 않은 번호"(`unregistered`)와 섞지 않는다.
 */
export const ntsBusinessStatusEnum = ['active', 'suspended', 'closed', 'unregistered', 'unverified'] as const;

/**
 * 사업자 개설자의 사업자 정보(2026-10-14). 계정(`funding_creators`) 하나에 한 행.
 *
 * **`funding_creators`에 컬럼을 더하지 않고 표를 따로 둔 이유는 배포 순서다**(0022·0035 절) — 그 표는
 * 결제 확인·정산·로그인 경로가 전체 컬럼으로 읽는다. 같은 이유로 이 표는 **어떤 relations()에도 잇지 않는다.**
 *
 * **암호화하지 않는다.** 고유식별정보가 아니고 사업자가 세금계산서·통신판매 표시에 공개로 적는 값이며,
 * 국세청 조회에 평문이 필요하다. 노출 규칙은 계좌와 같다 — 개설자 본인·관리자 화면에만 싣는다.
 * 세금 구분을 개인으로 바꾸면 `savePayoutSection`이 이 행과 사업자등록증 Blob을 지운다(사업자 정산 기록이 있으면 유지).
 */
export const creatorBusinessProfiles = sqliteTable('creator_business_profiles', {
  creatorId: text('creator_id').primaryKey().references(() => fundingCreators.id),
  /** 하이픈 없는 10자리. 검사는 lib/funding/businessStatus.ts의 normalizeBusinessNumber. */
  businessNumber: text('business_number').notNull(),
  businessName: text('business_name').notNull(),
  representativeName: text('representative_name').notNull(),
  ntsStatus: text('nts_status', { enum: ntsBusinessStatusEnum }).notNull().default('unverified'),
  /** 국세청 tax_type_cd 원문('01'…'07'). 조회 못 했으면 null. */
  ntsTaxTypeCode: text('nts_tax_type_code'),
  /** 국세청 tax_type 원문(화면 표시용). */
  ntsTaxTypeLabel: text('nts_tax_type_label'),
  /** 마지막으로 조회를 **시도한** 시각. */
  ntsCheckedAt: integer('nts_checked_at', { mode: 'timestamp' }),
  /** 마지막 시도가 실패했으면 사유 코드(missing_key·timeout·http_error·bad_response·network·rate_limited). 성공하면 null. */
  ntsCheckError: text('nts_check_error'),
  /** private Blob pathname(`tax-docs/<creatorId>/<uuid>.webp|pdf`). 주소가 아니라 경로다. */
  certificateKey: text('certificate_key'),
  certificateContentType: text('certificate_content_type'),
  certificateUploadedAt: integer('certificate_uploaded_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type CreatorBusinessProfileRow = typeof creatorBusinessProfiles.$inferSelect;
```

- [ ] **Step 2: 마이그레이션 생성**

Run: `npm run db:generate -- --name creator_business_profiles`
그다음 `node -e "const e=require('./drizzle/migrations/meta/_journal.json').entries;console.log(e.at(-1).tag,e.at(-1).when,e.at(-1).when>1791957424699)"`
Expected: `0057_creator_business_profiles <when> true`. SQL에 `CREATE TABLE creator_business_profiles` 외의 DDL이 없어야 한다(있으면 스냅샷 사슬 문제 — 루트 CLAUDE.md "병합 뒤의 두 번째 함정").

- [ ] **Step 3: 통합 테스트**

`lib/funding/creatorProjectWrite.integration.test.ts`가 쓰는 테스트 DB 준비(마이그레이션 디렉터리를 순서대로 적용)를 그대로 가져온다. 확인할 것:
- 개설자 한 명 + 사업자 행 하나를 넣고 다시 읽으면 `ntsStatus === 'unverified'`, `certificateKey === null`
- 같은 `creator_id`로 두 번째 insert는 PK 위반으로 던진다
- **회귀 고정:** `db.query.fundingCreators.findFirst()`가 반환한 객체의 키 목록에 사업자 칸이 하나도 없다(누가 relations에 이으면 선다)

- [ ] **Step 4: 실행** — `npx jest lib/funding/businessProfile.schema.integration.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts drizzle/migrations lib/funding/businessProfile.schema.integration.test.ts
git commit -m "feat(funding): 개설자 사업자 정보 표 creator_business_profiles (0057)"
```

---

### Task 2: 사업자등록번호 검사 · 국세청 상태조회 · 경고 문구 (순수 모듈)

**Files:**
- Create: `lib/funding/businessStatus.ts`
- Test: `lib/funding/businessStatus.test.ts`

**Interfaces:**
- Produces:
  - `normalizeBusinessNumber(raw: string): string | null` — 하이픈·공백 제거, 10자리 + 검증식
  - `formatBusinessNumber(digits: string): string` — `753-74-00653`
  - `type NtsBusinessStatus = (typeof ntsBusinessStatusEnum)[number]`
  - `type NtsLookupResult = { ok: true; status: Exclude<NtsBusinessStatus, 'unverified'>; taxTypeCode: string | null; taxTypeLabel: string | null } | { ok: false; error: NtsLookupError }`
  - `lookupBusinessStatus(businessNumber: string, deps?: { fetchImpl?: typeof fetch; apiKey?: string | undefined; timeoutMs?: number }): Promise<NtsLookupResult>` — **던지지 않는다**
  - `parseNtsStatusResponse(json: unknown): NtsLookupResult`
  - `businessStatusWarnings(input: { status: NtsBusinessStatus; taxTypeCode: string | null; taxTypeLabel: string | null }): string[]`
  - 상수 `NTS_BUSINESS_STATUS_API_KEY_ENV = 'NTS_BUSINESS_STATUS_API_KEY'`, `NTS_LOOKUP_TIMEOUT_MS = 4000`, `INVOICE_CAPABLE_TAX_TYPE_CODES = ['01', '07']`

이 파일은 `db/schema`를 **값으로** import하지 않는다(클라이언트 폼이 `businessStatusWarnings`·`formatBusinessNumber`를 쓴다 — `lib/funding/CLAUDE.md`의 클라이언트 번들 절). enum 값은 리터럴로 적고 테스트가 schema와 대조한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// lib/funding/businessStatus.test.ts
import { ntsBusinessStatusEnum } from '../../db/schema';
import {
  businessStatusWarnings, formatBusinessNumber, lookupBusinessStatus, normalizeBusinessNumber,
  NTS_BUSINESS_STATUS_LITERALS, parseNtsStatusResponse,
} from './businessStatus';

const OK_BODY = (row: Record<string, string>) => ({ status_code: 'OK', request_cnt: 1, match_cnt: 1, data: [row] });
const fakeFetch = (status: number, body: unknown) =>
  jest.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

test('enum 리터럴이 schema와 같다', () => {
  expect([...NTS_BUSINESS_STATUS_LITERALS]).toEqual([...ntsBusinessStatusEnum]);
});

describe('normalizeBusinessNumber', () => {
  test('스튜디오 놀 번호(검증식 성립)', () => {
    expect(normalizeBusinessNumber('753-74-00653')).toBe('7537400653');
    expect(normalizeBusinessNumber(' 7537400653 ')).toBe('7537400653');
  });
  test('검증 자리가 틀리면 거부', () => expect(normalizeBusinessNumber('7537400654')).toBeNull());
  test('자릿수·문자 거부', () => {
    expect(normalizeBusinessNumber('753740065')).toBeNull();
    expect(normalizeBusinessNumber('75374006a3')).toBeNull();
  });
  test('표시 형식', () => expect(formatBusinessNumber('7537400653')).toBe('753-74-00653'));
});

describe('parseNtsStatusResponse', () => {
  test('계속사업자 일반과세', () => {
    expect(parseNtsStatusResponse(OK_BODY({ b_no: '7537400653', b_stt: '계속사업자', b_stt_cd: '01', tax_type: '부가가치세 일반과세자', tax_type_cd: '01' })))
      .toEqual({ ok: true, status: 'active', taxTypeCode: '01', taxTypeLabel: '부가가치세 일반과세자' });
  });
  test('휴업·폐업', () => {
    expect(parseNtsStatusResponse(OK_BODY({ b_stt_cd: '02', tax_type_cd: '01', tax_type: 'x' }))).toMatchObject({ status: 'suspended' });
    expect(parseNtsStatusResponse(OK_BODY({ b_stt_cd: '03', tax_type_cd: '01', tax_type: 'x' }))).toMatchObject({ status: 'closed' });
  });
  test('미등록 번호는 b_stt_cd가 비고 tax_type에 안내문', () => {
    expect(parseNtsStatusResponse(OK_BODY({ b_stt_cd: '', tax_type_cd: '', tax_type: '국세청에 등록되지 않은 사업자등록번호입니다.' })))
      .toEqual({ ok: true, status: 'unregistered', taxTypeCode: null, taxTypeLabel: '국세청에 등록되지 않은 사업자등록번호입니다.' });
  });
  test('모양이 다르면 bad_response', () => {
    expect(parseNtsStatusResponse({ status_code: 'OK', data: [] })).toEqual({ ok: false, error: 'bad_response' });
    expect(parseNtsStatusResponse('<html>')).toEqual({ ok: false, error: 'bad_response' });
  });
});

describe('lookupBusinessStatus — 던지지 않는다', () => {
  test('키가 없으면 호출하지 않고 missing_key', async () => {
    const fetchImpl = fakeFetch(200, {});
    expect(await lookupBusinessStatus('7537400653', { fetchImpl, apiKey: undefined })).toEqual({ ok: false, error: 'missing_key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  test('5xx → http_error', async () => {
    expect(await lookupBusinessStatus('7537400653', { fetchImpl: fakeFetch(500, {}), apiKey: 'k' })).toEqual({ ok: false, error: 'http_error' });
  });
  test('네트워크 예외 → network', async () => {
    const fetchImpl = jest.fn(async () => { throw new TypeError('fetch failed'); });
    expect(await lookupBusinessStatus('7537400653', { fetchImpl, apiKey: 'k' })).toEqual({ ok: false, error: 'network' });
  });
  test('시간 초과 → timeout', async () => {
    const fetchImpl = jest.fn((_u: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    expect(await lookupBusinessStatus('7537400653', { fetchImpl, apiKey: 'k', timeoutMs: 10 })).toEqual({ ok: false, error: 'timeout' });
  });
  test('요청 모양 — POST, 키는 쿼리(인코딩), 본문 b_no 배열', async () => {
    const fetchImpl = fakeFetch(200, OK_BODY({ b_stt_cd: '01', tax_type_cd: '01', tax_type: 'x' }));
    await lookupBusinessStatus('7537400653', { fetchImpl, apiKey: 'a+b/c==' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=a%2Bb%2Fc%3D%3D');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ b_no: ['7537400653'] });
  });
});

describe('businessStatusWarnings', () => {
  test('정상 일반과세·세금계산서 발급 간이는 경고 없음', () => {
    expect(businessStatusWarnings({ status: 'active', taxTypeCode: '01', taxTypeLabel: '' })).toEqual([]);
    expect(businessStatusWarnings({ status: 'active', taxTypeCode: '07', taxTypeLabel: '' })).toEqual([]);
  });
  test('폐업·휴업은 세금계산서를 발행할 수 없다고 말한다', () => {
    expect(businessStatusWarnings({ status: 'closed', taxTypeCode: '01', taxTypeLabel: '' }).join()).toContain('세금계산서를 발행할 수 없');
    expect(businessStatusWarnings({ status: 'suspended', taxTypeCode: '01', taxTypeLabel: '' }).join()).toContain('세금계산서를 발행할 수 없');
  });
  test('간이(미발급)·면세는 "어려울 수 있어 운영자가 확인"', () => {
    const w = businessStatusWarnings({ status: 'active', taxTypeCode: '02', taxTypeLabel: '부가가치세 간이과세자' }).join();
    expect(w).toContain('어려울 수 있');
    expect(w).toContain('부가가치세 간이과세자');
    expect(businessStatusWarnings({ status: 'active', taxTypeCode: '04', taxTypeLabel: '면세' }).join()).toContain('확인');
  });
  test('미확인은 저장됐다고 말한다', () => {
    expect(businessStatusWarnings({ status: 'unverified', taxTypeCode: null, taxTypeLabel: null }).join()).toContain('저장');
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/businessStatus.test.ts` → FAIL(모듈 없음)

- [ ] **Step 3: 구현**

```ts
// lib/funding/businessStatus.ts
/**
 * 사업자등록번호 검사와 국세청 상태조회(공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스").
 *
 * 이 파일은 클라이언트 폼도 쓴다 — db/schema를 값으로 import하지 않는다(lib/funding/CLAUDE.md 클라이언트 번들 절).
 * **조회 실패는 저장 실패가 아니다**(운영자 결정 2026-10-14). 그래서 lookupBusinessStatus는 던지지 않고 사유 코드를 돌려준다.
 */
export const NTS_BUSINESS_STATUS_LITERALS = ['active', 'suspended', 'closed', 'unregistered', 'unverified'] as const;
export type NtsBusinessStatus = (typeof NTS_BUSINESS_STATUS_LITERALS)[number];
export type NtsLookupError = 'missing_key' | 'timeout' | 'http_error' | 'bad_response' | 'network' | 'rate_limited';
export type NtsLookupResult =
  | { ok: true; status: Exclude<NtsBusinessStatus, 'unverified'>; taxTypeCode: string | null; taxTypeLabel: string | null }
  | { ok: false; error: NtsLookupError };

export const NTS_BUSINESS_STATUS_API_KEY_ENV = 'NTS_BUSINESS_STATUS_API_KEY';
export const NTS_LOOKUP_TIMEOUT_MS = 4000;
const NTS_STATUS_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

/**
 * 세금계산서를 발급하는 과세 유형. 01 일반과세자, 07 간이과세자(세금계산서 발급사업자).
 * 그 밖(02 간이·03 과세특례·04 면세·05/06 고유번호 단체)은 경고만 한다.
 * ⚠ 구현 때 공공데이터포털 문서의 tax_type_cd 표로 다시 확인할 것.
 */
export const INVOICE_CAPABLE_TAX_TYPE_CODES: readonly string[] = ['01', '07'];

/**
 * 10자리 + 검증식. 사업자등록번호의 마지막 자리는 지금도 검증식으로 정해진다 —
 * 주민등록번호(2020-10 이후 뒤 6자리 난수, creatorValidation.ts 주석)와 다르다.
 * 가중치 1,3,7,1,3,7,1,3,5 + 9번째 자리×5의 십의 자리.
 */
export const normalizeBusinessNumber = (raw: string): string | null => {
  const digits = raw.replace(/[-\s]/g, '');
  if (!/^[0-9]{10}$/.test(digits)) return null;
  const d = digits.split('').map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const sum = weights.reduce((s, w, i) => s + d[i] * w, 0) + Math.floor((d[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === d[9] ? digits : null;
};

export const formatBusinessNumber = (digits: string): string =>
  /^[0-9]{10}$/.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : digits;

const LABEL_MAX = 100;
const clip = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, LABEL_MAX) : null);

export const parseNtsStatusResponse = (json: unknown): NtsLookupResult => {
  const bad: NtsLookupResult = { ok: false, error: 'bad_response' };
  if (!json || typeof json !== 'object') return bad;
  const body = json as { status_code?: unknown; data?: unknown };
  if (body.status_code !== 'OK' || !Array.isArray(body.data) || body.data.length !== 1) return bad;
  const row = body.data[0] as Record<string, unknown>;
  const code = typeof row.b_stt_cd === 'string' ? row.b_stt_cd : '';
  const taxTypeLabel = clip(row.tax_type);
  const taxTypeCode = clip(row.tax_type_cd);
  if (code === '01') return { ok: true, status: 'active', taxTypeCode, taxTypeLabel };
  if (code === '02') return { ok: true, status: 'suspended', taxTypeCode, taxTypeLabel };
  if (code === '03') return { ok: true, status: 'closed', taxTypeCode, taxTypeLabel };
  // 미등록 번호는 상태 코드가 비고 tax_type에 "등록되지 않은 사업자등록번호" 안내가 온다.
  if (code === '' && taxTypeLabel?.includes('등록되지 않은')) return { ok: true, status: 'unregistered', taxTypeCode: null, taxTypeLabel };
  return bad;
};

export const lookupBusinessStatus = async (
  businessNumber: string,
  deps: { fetchImpl?: typeof fetch; apiKey?: string | undefined; timeoutMs?: number } = {},
): Promise<NtsLookupResult> => {
  // 키는 호출 시점에 읽는다 — 모듈 최상위에서 읽지 않는다(FUNDING_FIELD_KEY와 같은 이유).
  const apiKey = 'apiKey' in deps ? deps.apiKey : process.env[NTS_BUSINESS_STATUS_API_KEY_ENV];
  if (!apiKey?.trim()) return { ok: false, error: 'missing_key' };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? NTS_LOOKUP_TIMEOUT_MS);
  try {
    // 공공데이터포털은 "Decoding" 키를 env에 두고 여기서 인코딩한다(이중 인코딩 방지).
    const res = await fetchImpl(`${NTS_STATUS_URL}?serviceKey=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ b_no: [businessNumber] }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: 'http_error' };
    let json: unknown;
    try { json = await res.json(); } catch { return { ok: false, error: 'bad_response' }; }
    return parseNtsStatusResponse(json);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return { ok: false, error: 'timeout' };
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 개설자에게 보일 경고 — **막지 않는다.** 법적 판단을 넓히지 않는다: 폐업·휴업은 "세금계산서를 발행할 수 없다"까지,
 * 과세 유형은 "어려울 수 있어 운영자가 확인한다"까지만 말한다(운영자 결정 2026-10-14).
 */
export const businessStatusWarnings = (input: {
  status: NtsBusinessStatus; taxTypeCode: string | null; taxTypeLabel: string | null;
}): string[] => {
  switch (input.status) {
    case 'closed':
      return ['국세청 조회 결과 폐업한 사업자로 나와요. 폐업한 사업자는 세금계산서를 발행할 수 없어요. 번호를 다시 확인해 주세요. 정산 방법은 스튜디오 놀이 확인해 연락드려요.'];
    case 'suspended':
      return ['국세청 조회 결과 휴업 중인 사업자로 나와요. 휴업 중에는 세금계산서를 발행할 수 없어요. 정산 전에 스튜디오 놀이 확인해 연락드려요.'];
    case 'unregistered':
      return ['국세청에 등록되지 않은 번호로 나와요. 사업자등록번호를 다시 확인해 주세요.'];
    case 'unverified':
      return ['지금은 국세청 조회를 하지 못해 사업자 상태를 확인하지 못했어요. 입력하신 정보는 저장됐고, 스튜디오 놀이 따로 확인해요.'];
    case 'active':
      if (input.taxTypeCode && !INVOICE_CAPABLE_TAX_TYPE_CODES.includes(input.taxTypeCode)) {
        const label = input.taxTypeLabel ? `「${input.taxTypeLabel}」` : '세금계산서 발급 대상이 아닌 유형';
        return [`국세청 조회 결과 과세 유형이 ${label}로 나와요. 이 유형은 세금계산서 발행이 어려울 수 있어, 정산 전에 스튜디오 놀이 확인해 연락드려요.`];
      }
      return [];
    default:
      return [];
  }
};
```

- [ ] **Step 4: 실행** — `npx jest lib/funding/businessStatus.test.ts` → PASS

- [ ] **Step 5: Commit** — `git add lib/funding/businessStatus.ts lib/funding/businessStatus.test.ts && git commit -m "feat(funding): 사업자등록번호 검사와 국세청 상태조회"`

---

### Task 3: 저장 경로 확장 — `validatePayoutSection`·`savePayoutSection`·`loadPayoutSummary`

**Files:**
- Create: `lib/funding/businessProfile.ts` (표 읽기·쓰기·파기 헬퍼 — `savePayoutSection`·관리자·파기가 함께 쓴다)
- Create: `lib/funding/creatorEligibility.ts` (`hasApprovedEngagement`)
- Modify: `lib/funding/creatorValidation.ts` (`PayoutSection`에 `business`)
- Modify: `lib/funding/creatorProjectWrite.ts` (`savePayoutSection`, `loadPayoutSummary`, `CreatorPayoutSummary`, `hasApprovedProject` 제거)
- Test: `lib/funding/creatorValidation.test.ts`(추가), `lib/funding/creatorProjectWrite.integration.test.ts`(추가), `lib/funding/creatorEligibility.integration.test.ts`

**Interfaces:**
- Consumes: `normalizeBusinessNumber`, `lookupBusinessStatus`, `NtsLookupResult` (Task 2), `consumeRateLimit` (`lib/booking/rate-limit.ts`), `@vercel/blob`의 `del`
- Produces:
  - `PayoutSection.business: { businessNumber: string; businessName: string; representativeName: string } | null` — `taxType === 'invoice'`면 필수, `withholding`이면 값이 와도 `null`로 버린다(주민번호와 거울)
  - `hasApprovedEngagement(creatorId: string): Promise<boolean>`
  - `loadBusinessProfile(creatorId): Promise<BusinessProfileView | null | 'unavailable'>` — 표 없음·DB 오류는 `'unavailable'`
  - `interface BusinessProfileView { businessNumber; businessName; representativeName; ntsStatus; ntsTaxTypeCode; ntsTaxTypeLabel; ntsCheckedAt: string | null; ntsCheckError: string | null; hasCertificate: boolean; certificateUploadedAt: string | null }` (날짜는 ISO 문자열 — props 직렬화)
  - `hasInvoicePayout(creatorId): Promise<boolean>` — `withholding_amount = 0`인 펀딩 정산 기록. 경계는 `hasWithheldPayout` 주석과 같다(둘을 함께 바꿀 것)
  - `deleteBusinessProfile(creatorId, deps?: { deleteBlob?: (key: string) => Promise<void> }): Promise<void>` — 행을 먼저 지우고 Blob은 최선 노력(실패는 로그, 고아는 Task 9 청소가 지운다)
  - `CreatorPayoutSummary.business: BusinessProfileView | null | 'unavailable'`
  - `WriteResult`의 ok 갈래에 `businessWarnings?: string[]`, `businessProfileRetained?: true`
  - `savePayoutSection(creatorId, value, deps?: { lookup?: typeof lookupBusinessStatus; now?: Date; deleteBlob?: ... })`

- [ ] **Step 1: 실패하는 테스트 작성**

`creatorValidation.test.ts`에 추가:

```ts
test('사업자는 사업자 정보 셋이 필수', () => {
  const base = { taxType: 'invoice', bankName: '농협', account: '1234-5678', holder: '놀' };
  expect(validatePayoutSection(base).ok).toBe(false);
  const ok = validatePayoutSection({ ...base, business: { businessNumber: '753-74-00653', businessName: '스튜디오 놀', representativeName: '황경하' } });
  expect(ok.ok && ok.value.business).toEqual({ businessNumber: '7537400653', businessName: '스튜디오 놀', representativeName: '황경하' });
});
test('검증식이 틀린 번호는 거부(메시지에 번호를 넣지 않는다)', () => {
  const r = validatePayoutSection({ taxType: 'invoice', bankName: '농협', account: '1234', holder: '놀', business: { businessNumber: '7537400654', businessName: 'a', representativeName: 'b' } });
  expect(r.ok).toBe(false);
  expect(!r.ok && r.message).not.toContain('7537400654');
});
test('원천징수면 사업자 정보는 버린다', () => {
  const r = validatePayoutSection({ taxType: 'withholding', bankName: '농협', account: '1234', holder: '놀', business: { businessNumber: '7537400653', businessName: 'a', representativeName: 'b' } });
  expect(r.ok && r.value.business).toBeNull();
});
```

`creatorProjectWrite.integration.test.ts`에 추가(기존 파일의 개설자·프로젝트 시드 헬퍼를 쓴다. `lookup`은 가짜를 주입):

```ts
const lookupOk = jest.fn(async () => ({ ok: true as const, status: 'active' as const, taxTypeCode: '01', taxTypeLabel: '부가가치세 일반과세자' }));
const lookupFail = jest.fn(async () => ({ ok: false as const, error: 'missing_key' as const }));
const invoice = (n = '7537400653') => ({
  taxType: 'invoice' as const, bankName: '농협', account: '1234-5678', holder: '놀', residentNumber: null,
  business: { businessNumber: n, businessName: '스튜디오 놀', representativeName: '황경하' },
});

test('사업자 저장 — 조회 성공이면 active로 남는다', async () => {
  const c = await seedCreatorWithApprovedProject();
  expect(await savePayoutSection(c.id, invoice(), { lookup: lookupOk })).toMatchObject({ ok: true });
  const [row] = await db.select().from(creatorBusinessProfiles).where(eq(creatorBusinessProfiles.creatorId, c.id));
  expect(row).toMatchObject({ businessNumber: '7537400653', ntsStatus: 'active', ntsTaxTypeCode: '01', ntsCheckError: null });
});

test('조회 실패는 저장을 막지 않는다 — unverified + 사유 코드 + 경고', async () => {
  const c = await seedCreatorWithApprovedProject();
  const r = await savePayoutSection(c.id, invoice(), { lookup: lookupFail });
  expect(r).toMatchObject({ ok: true });
  expect(r.ok && r.businessWarnings?.join()).toContain('저장');
  const [row] = await db.select().from(creatorBusinessProfiles).where(eq(creatorBusinessProfiles.creatorId, c.id));
  expect(row).toMatchObject({ ntsStatus: 'unverified', ntsCheckError: 'missing_key' });
});

test('번호가 같고 이미 확인됐으면 다시 조회하지 않는다', async () => {
  const c = await seedCreatorWithApprovedProject();
  await savePayoutSection(c.id, invoice(), { lookup: lookupOk });
  lookupOk.mockClear();
  await savePayoutSection(c.id, invoice(), { lookup: lookupOk });
  expect(lookupOk).not.toHaveBeenCalled();
});

test('개인으로 바꾸면 사업자 행과 Blob을 지운다', async () => {
  const c = await seedCreatorWithApprovedProject();
  await savePayoutSection(c.id, invoice(), { lookup: lookupOk });
  await db.update(creatorBusinessProfiles).set({ certificateKey: `tax-docs/${c.id}/x.pdf` }).where(eq(creatorBusinessProfiles.creatorId, c.id));
  const deleteBlob = jest.fn(async () => undefined);
  const r = await savePayoutSection(c.id, { ...invoice(), taxType: 'withholding', business: null }, { lookup: lookupOk, deleteBlob });
  expect(r).toEqual({ ok: true });
  expect(await db.select().from(creatorBusinessProfiles).where(eq(creatorBusinessProfiles.creatorId, c.id))).toEqual([]);
  expect(deleteBlob).toHaveBeenCalledWith(`tax-docs/${c.id}/x.pdf`);
});

test('사업자 정산 기록이 있으면 개인으로 바꿔도 사업자 행을 남긴다', async () => {
  const c = await seedCreatorWithApprovedProject();
  await savePayoutSection(c.id, invoice(), { lookup: lookupOk });
  await seedPayout(c.projectId, { withholdingAmount: 0 });
  const r = await savePayoutSection(c.id, { ...invoice(), taxType: 'withholding', business: null }, { lookup: lookupOk });
  expect(r).toEqual({ ok: true, businessProfileRetained: true });
});

test('승인된 공연 등록만 있어도 열린다 / 상점 아티스트만 있어도 열린다 / 아무것도 없으면 not_editable', async () => {
  const show = await seedCreatorWithApprovedShowSubmission();
  expect(await savePayoutSection(show.id, invoice(), { lookup: lookupOk })).toMatchObject({ ok: true });
  const shop = await seedCreatorWithShopArtist();
  expect(await savePayoutSection(shop.id, invoice(), { lookup: lookupOk })).toMatchObject({ ok: true });
  const none = await seedCreator();
  expect(await savePayoutSection(none.id, invoice(), { lookup: lookupOk })).toMatchObject({ ok: false, code: 'not_editable' });
});

test('사업자 표가 없는 DB에서도 원천징수 저장은 된다', async () => {
  const c = await seedCreatorWithApprovedProject();
  await client.execute('DROP TABLE creator_business_profiles');
  expect(await savePayoutSection(c.id, { ...invoice(), taxType: 'withholding', business: null }, { lookup: lookupOk })).toEqual({ ok: true });
  expect((await loadPayoutSummary(c.id)).business).toBe('unavailable');
});
```

마지막 테스트는 표를 지우므로 그 describe 안에서 맨 끝에 두거나 별도 DB로 돈다.

- [ ] **Step 2: 실패 확인** — 두 테스트 파일 FAIL

- [ ] **Step 3: `creatorEligibility.ts`**

```ts
// lib/funding/creatorEligibility.ts
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { fundingProjects, shopArtists, showSubmissions } from '../../db/schema';

/**
 * 정산 정보를 받아도 되는 계정인가 — 승인된 펀딩 프로젝트, 승인된 공연 등록, 상점 아티스트 등록 중 하나라도.
 * 반려될 신청서에 계좌·주민번호를 미리 받지 않는다는 원칙(스펙 §6.2)을 세 갈래로 넓힌 것이다.
 * 상점 아티스트는 관리자가 계약·실물 인수 뒤에 `shop_artists` 행을 만드는 것 자체가 승인이다(lib/shop/CLAUDE.md).
 *
 * 공연·상점 표는 각자 마이그레이션(0055·0053)에 달려 있어, 읽기 실패는 그 갈래만 false로 본다 — 펀딩 갈래는 던진다
 * (지금 동작과 같다).
 */
export const hasApprovedEngagement = async (creatorId: string): Promise<boolean> => {
  const db = getDb();
  const [project] = await db.select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.creatorId, creatorId), eq(fundingProjects.reviewStatus, 'approved'))).limit(1);
  if (project) return true;
  const soft = async (q: () => Promise<unknown[]>) => {
    try { return (await q()).length > 0; } catch (error: unknown) {
      console.error('[funding] 정산 자격 조회 실패(이 갈래는 없음으로 본다)', error);
      return false;
    }
  };
  if (await soft(() => db.select({ id: showSubmissions.id }).from(showSubmissions)
    .where(and(eq(showSubmissions.creatorId, creatorId), eq(showSubmissions.reviewStatus, 'approved'))).limit(1))) return true;
  return soft(() => db.select({ id: shopArtists.creatorId }).from(shopArtists).where(eq(shopArtists.creatorId, creatorId)).limit(1));
};
```

`creatorEligibility.integration.test.ts`: 세 갈래 각각 참, 반려된 공연·초안 프로젝트만 있으면 거짓, `show_submissions`를 DROP한 DB에서 상점 갈래가 여전히 참.

- [ ] **Step 4: `validatePayoutSection` 확장**

`PayoutSection`에 `business` 필드를 더하고(주석: invoice면 필수, withholding이면 `null`로 버림 — 주민번호와 거울), `CREATOR_LIMITS`에 `businessNameMax: 60`, `representativeNameMax: 30`. 오류 메시지에는 입력값을 넣지 않는다:

```ts
let business: PayoutSection['business'] = null;
if (taxType === 'invoice') {
  const b = (d.business ?? {}) as Record<string, unknown>;
  const businessNumber = normalizeBusinessNumber(str(b.businessNumber) ?? '');
  if (!businessNumber) return fail('사업자등록번호 10자리를 정확히 적어 주세요.');
  const businessName = str(b.businessName);
  if (!businessName || businessName.length > CREATOR_LIMITS.businessNameMax) return fail(`상호는 1~${CREATOR_LIMITS.businessNameMax}자로 적어 주세요.`);
  const representativeName = str(b.representativeName);
  if (!representativeName || representativeName.length > CREATOR_LIMITS.representativeNameMax) return fail(`대표자명은 1~${CREATOR_LIMITS.representativeNameMax}자로 적어 주세요.`);
  business = { businessNumber, businessName, representativeName };
}
```

- [ ] **Step 5: `businessProfile.ts`**

```ts
// lib/funding/businessProfile.ts — 핵심만
import { del } from '@vercel/blob';
import { and, eq, gt } from 'drizzle-orm';
// ...
export const TAX_DOCUMENT_PREFIX = 'tax-docs/';

const isMissingTable = (error: unknown) => /no such table: creator_business_profiles/i.test(String(error));

export const loadBusinessProfile = async (creatorId: string): Promise<BusinessProfileView | null | 'unavailable'> => {
  try {
    const [row] = await getDb().select({ /* 컬럼을 하나씩 고른다 — select() 금지 */ }).from(creatorBusinessProfiles)
      .where(eq(creatorBusinessProfiles.creatorId, creatorId)).limit(1);
    return row ? toView(row) : null;
  } catch (error: unknown) {
    if (!isMissingTable(error)) console.error('[funding] 사업자 정보 조회 실패', error);
    return 'unavailable';
  }
};

/** hasWithheldPayout(creatorProjectWrite.ts)의 거울 — 경계(세액 0원인 원천징수)도 같다. 둘을 함께 바꿀 것. */
export const hasInvoicePayout = async (creatorId: string): Promise<boolean> => { /* withholdingAmount = 0 */ };

/** Blob 키는 반드시 이 접두사 + creatorId/ 아래여야 지운다 — 남의 키·계약서 경로를 지우는 일을 막는다. */
export const isOwnTaxDocumentKey = (key: string, creatorId: string) =>
  key.startsWith(`${TAX_DOCUMENT_PREFIX}${creatorId}/`) && !key.includes('..');

export const deleteBusinessProfile = async (creatorId: string, deps: { deleteBlob?: (key: string) => Promise<void> } = {}) => {
  const db = getDb();
  const [row] = await db.select({ key: creatorBusinessProfiles.certificateKey }).from(creatorBusinessProfiles)
    .where(eq(creatorBusinessProfiles.creatorId, creatorId)).limit(1);
  await db.delete(creatorBusinessProfiles).where(eq(creatorBusinessProfiles.creatorId, creatorId));
  if (row?.key && isOwnTaxDocumentKey(row.key, creatorId)) {
    try { await (deps.deleteBlob ?? ((k) => del(k)))(row.key); }
    catch (error: unknown) { console.error('[funding] 사업자등록증 Blob 삭제 실패 — 월 1회 청소가 지운다', { creatorId }); }
  }
};
```

`@vercel/blob`의 `del`은 URL 또는 pathname을 받는다 — 구현 때 `lib/contracts/backup.ts`가 무엇을 넘기는지(현재 `blob.url`) 보고, pathname으로 지워지는지 확인한다. 안 되면 `head(pathname)`로 URL을 얻어 지운다.

- [ ] **Step 6: `savePayoutSection` 확장**

바꾸는 곳만 적는다. 기존 계좌·주민번호 암호화 블록은 그대로 둔다.

```ts
export const savePayoutSection = async (
  creatorId: string,
  value: PayoutSection,
  deps: { lookup?: typeof lookupBusinessStatus; now?: Date; deleteBlob?: (key: string) => Promise<void> } = {},
): Promise<WriteResult> => {
  // ...기존 not_found 검사
  if (!(await hasApprovedEngagement(creatorId))) {
    return deny('not_editable', '프로젝트·공연·상점 중 하나가 승인된 뒤에 정산 정보를 넣을 수 있어요.');
  }
  // ...기존 계좌·주민번호 암호화(실패 시 encryption_unavailable — 사업자 정보도 함께 저장하지 않는다)

  // 사업자 정보 — 국세청 조회는 DB 쓰기 **전에** 하고, 실패해도 계속한다.
  const now = deps.now ?? new Date();
  let businessWrite: typeof creatorBusinessProfiles.$inferInsert | null = null;
  let businessWarnings: string[] | undefined;
  if (value.taxType === 'invoice' && value.business) {
    const existing = await loadBusinessProfile(creatorId);
    if (existing === 'unavailable') {
      return deny('business_unavailable', '사업자 정보를 저장할 준비가 아직 안 됐어요. 이번 저장은 아무것도 반영되지 않았어요. 스튜디오 놀에 알려 주세요.');
    }
    const sameNumberChecked = existing && existing.businessNumber === value.business.businessNumber && existing.ntsStatus !== 'unverified';
    let nts: { ntsStatus: NtsBusinessStatus; ntsTaxTypeCode: string | null; ntsTaxTypeLabel: string | null; ntsCheckedAt: Date | null; ntsCheckError: string | null };
    if (sameNumberChecked) {
      nts = { ntsStatus: existing.ntsStatus, ntsTaxTypeCode: existing.ntsTaxTypeCode, ntsTaxTypeLabel: existing.ntsTaxTypeLabel,
        ntsCheckedAt: existing.ntsCheckedAt ? new Date(existing.ntsCheckedAt) : null, ntsCheckError: null };
    } else {
      const allowed = await consumeRateLimit(`nts_lookup:${creatorId}`, 10, 3600);
      const result = allowed ? await (deps.lookup ?? lookupBusinessStatus)(value.business.businessNumber) : { ok: false as const, error: 'rate_limited' as const };
      nts = result.ok
        ? { ntsStatus: result.status, ntsTaxTypeCode: result.taxTypeCode, ntsTaxTypeLabel: result.taxTypeLabel, ntsCheckedAt: now, ntsCheckError: null }
        : { ntsStatus: 'unverified', ntsTaxTypeCode: null, ntsTaxTypeLabel: null, ntsCheckedAt: now, ntsCheckError: result.error };
    }
    // 번호가 바뀌면 이전 번호의 사업자등록증은 맞지 않는다 — 키를 비우고 Blob은 아래에서 지운다.
    const numberChanged = Boolean(existing && existing.businessNumber !== value.business.businessNumber);
    businessWrite = { creatorId, ...value.business, ...nts, updatedAt: now,
      ...(numberChanged ? { certificateKey: null, certificateContentType: null, certificateUploadedAt: null } : {}) };
    const warnings = businessStatusWarnings({ status: nts.ntsStatus, taxTypeCode: nts.ntsTaxTypeCode, taxTypeLabel: nts.ntsTaxTypeLabel });
    if (warnings.length) businessWarnings = warnings;
  }

  // funding_creators UPDATE + 사업자 upsert를 한 배치로(db.batch — lib/booking/bankDeposit.ts에 전례).
  // 원천징수로 바꿀 때 사업자 행 삭제는 배치 뒤에 deleteBusinessProfile로 한다(Blob 삭제가 끼므로) — 단 hasInvoicePayout이면 남긴다.
  // ...
};
```

- `WriteResult`의 실패 코드에 `'business_unavailable'`을 더한다(`respondWriteResult`의 상태 코드 표도 — 503).
- 원천징수로 저장할 때: `loadBusinessProfile`이 `'unavailable'`이면 사업자 정리를 건너뛴다(표가 없으면 지울 것도 없다). 행이 있으면 `hasInvoicePayout`이면 남기고 `businessProfileRetained: true`, 아니면 `deleteBusinessProfile`.
- 번호가 바뀌어 비운 옛 사업자등록증 Blob은 배치 뒤 최선 노력으로 지운다(`deleteBusinessProfile`과 같은 헬퍼를 키 하나 지우기로 나눠 쓴다).

- [ ] **Step 7: `loadPayoutSummary`** — `CreatorPayoutSummary`에 `business: BusinessProfileView | null | 'unavailable'`을 더하고 `loadBusinessProfile`을 부른다. 계좌·주민번호 판정은 그대로.

- [ ] **Step 8: 실행** — `npx jest lib/funding/creatorValidation.test.ts lib/funding/creatorProjectWrite.integration.test.ts lib/funding/creatorEligibility.integration.test.ts` → PASS. 기존 테스트 중 "승인된 프로젝트가 없으면 not_editable" 메시지 문자열을 대조하는 곳이 있으면 새 문구로 고친다.

- [ ] **Step 9: Commit** — `git commit -m "feat(funding): 정산 정보 저장에 사업자 정보·국세청 조회, 공연·상점 승인 계정에도 열기"`

---

### Task 4: 사업자등록증 업로드 — 판정·재인코딩·업로드 API

**Files:**
- Create: `lib/funding/taxDocument.ts`
- Create: `pages/api/funding/creator/payout/certificate.ts` (POST 업로드, DELETE 삭제)
- Test: `lib/funding/taxDocument.test.ts`, `pages/api/funding/creator/payout/certificate.test.ts`

**Interfaces:**
- Consumes: `readBodyWithLimit`(`lib/funding/uploadBody.ts`), `authenticateCreatorApi`, `isAllowedContactRequestOrigin`, `consumeRateLimit`, `TAX_DOCUMENT_PREFIX`·`isOwnTaxDocumentKey`·`loadBusinessProfile`(Task 3)
- Produces:
  - `detectTaxDocumentType(buf: Buffer): 'jpeg' | 'png' | 'webp' | 'pdf' | null`
  - `processTaxDocument(buf: Buffer): Promise<{ buffer: Buffer; contentType: 'image/webp' | 'application/pdf'; ext: 'webp' | 'pdf' }>` — 판정 실패·디코드 실패는 `TaxDocumentError`
  - `TAX_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024`
  - `setBusinessCertificate(creatorId, key, contentType, now): Promise<{ previousKey: string | null } | null>` (`businessProfile.ts`에 추가 — 행이 없으면 null)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// lib/funding/taxDocument.test.ts
import sharp from 'sharp';
import { detectTaxDocumentType, processTaxDocument } from './taxDocument';
import { resolveFundingBlobPath } from './mediaPath';

const jpegWithExif = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#fff' } })
  .jpeg().withMetadata({ exif: { IFD0: { Copyright: 'secret-location' } } }).toBuffer();

test('매직 바이트로 판정 — 확장자를 보지 않는다', async () => {
  expect(detectTaxDocumentType(await jpegWithExif())).toBe('jpeg');
  expect(detectTaxDocumentType(Buffer.from('%PDF-1.7\n...'))).toBe('pdf');
  expect(detectTaxDocumentType(Buffer.from('<html><script>'))).toBeNull();
  expect(detectTaxDocumentType(Buffer.alloc(0))).toBeNull();
});

test('이미지는 webp로 다시 인코딩하고 EXIF를 떨군다', async () => {
  const out = await processTaxDocument(await jpegWithExif());
  expect(out.contentType).toBe('image/webp');
  const meta = await sharp(out.buffer).metadata();
  expect(meta.exif).toBeUndefined();
});

test('PDF는 그대로 두되 PDF 머리가 있어야 한다', async () => {
  const pdf = Buffer.from('%PDF-1.4\n%%EOF');
  expect(await processTaxDocument(pdf)).toEqual({ buffer: pdf, contentType: 'application/pdf', ext: 'pdf' });
});

test('미디어 라우트 판정은 tax-docs 경로를 내보내지 않는다', () => {
  expect(resolveFundingBlobPath('tax-docs')).toBeNull();
  expect(resolveFundingBlobPath(['tax-docs', 'abc', 'x.webp'])).toBeNull();
  expect(resolveFundingBlobPath('..%2Ftax-docs%2Fx.webp')).toBeNull();
});
```

API 테스트(`pages/api/funding/creator/upload` 테스트가 있으면 그 req/res 목업을 따른다): 무인증 401, 다른 Origin 403, 사업자 행이 없으면 409("사업자 정보를 먼저 저장해 주세요"), HTML 본문 400, 8MB 초과 413, 정상 PDF 200이면 `put`이 `tax-docs/<creatorId>/<uuid>.pdf`·`access: 'private'`로 불리고 옛 키가 있으면 `del`이 불린다. 응답에는 `{ ok: true, uploadedAt }`만 — 키·주소를 돌려주지 않는다. DELETE는 행의 키를 비우고 Blob을 지운다.

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

```ts
// lib/funding/taxDocument.ts
import sharp from 'sharp';

export const TAX_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
/** 글자가 읽혀야 하므로 본문 이미지(1600)보다 크게 둔다. */
const MAX_WIDTH = 2400;
const MAX_INPUT_PIXELS = 40_000_000; // creatorUpload.ts와 같은 이유

export class TaxDocumentError extends Error {}

export const detectTaxDocumentType = (b: Buffer): 'jpeg' | 'png' | 'webp' | 'pdf' | null => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  return null;
};

/**
 * 이미지는 sharp로 다시 인코딩한다 — 그림이 아니면 여기서 던지고, EXIF(촬영 위치 포함)가 떨어진다(creatorUpload.ts와 같은 이유).
 * PDF는 정화할 수단이 없어 바이트 그대로 둔다. 대신 관리자 열람 라우트가 `Content-Security-Policy: sandbox`로 내보낸다(Task 7).
 * HEIC는 받지 않는다(서버 sharp가 디코드를 보장하지 않는다) — 화면이 JPG·PNG·PDF로 안내한다.
 */
export const processTaxDocument = async (buf: Buffer) => {
  const type = detectTaxDocumentType(buf);
  if (!type) throw new TaxDocumentError('unsupported');
  if (type === 'pdf') return { buffer: buf, contentType: 'application/pdf' as const, ext: 'pdf' as const };
  try {
    const out = await sharp(buf, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return { buffer: out, contentType: 'image/webp' as const, ext: 'webp' as const };
  } catch {
    throw new TaxDocumentError('decode_failed');
  }
};
```

API 라우트는 `pages/api/funding/creator/upload.ts`의 순서를 그대로 따른다: `bodyParser: false` → Origin → 개설자 인증 → `hasApprovedEngagement` + 사업자 행 존재 확인 → IP·개설자 rate limit(`tax_doc_upload:*`, 시간당 20) → `readBodyWithLimit(req, TAX_DOCUMENT_MAX_BYTES)` → `processTaxDocument` → `put(`${TAX_DOCUMENT_PREFIX}${creatorId}/${randomUUID()}.${ext}`, buffer, { access: 'private', contentType })` → `setBusinessCertificate` → 옛 키 최선 노력 삭제. 키를 행에 쓰지 못하면 방금 올린 Blob을 지운다. 실패는 전부 `{ ok: false, message }` JSON.

- [ ] **Step 4: 실행** — 두 테스트 → PASS

- [ ] **Step 5: Commit** — `git commit -m "feat(funding): 사업자등록증 사본 업로드(private Blob tax-docs/, 매직 바이트 판정, EXIF 제거)"`

---

### Task 5: 계정 단위 정산 정보 화면 + 저장 API + 콘솔 탭

**Files:**
- Create: `pages/api/funding/creator/payout.ts` (POST 저장)
- Create: `pages/[locale]/funding/creator/payout.tsx`
- Modify: `components/funding/creator/PayoutSectionForm.tsx` (`projectId` 제거, 사업자 칸·경고·사업자등록증 업로드 추가)
- Modify: `components/funding/creator/api.ts` (`savePayoutSection(value)` → `/api/funding/creator/payout`, `uploadBusinessCertificate(file)`, `deleteBusinessCertificate()`)
- Modify: `components/funding/creator/types.ts` (`EditorPayoutSummary.business`)
- Modify: `components/funding/creator/CreatorConsoleTabs.tsx` (`'payout'` 탭)
- Modify: `pages/api/funding/creator/projects/[id].ts` (`section: 'payout'` 갈래 삭제)
- Test: `pages/api/funding/creator/payout.test.ts`, `components/funding/creator/PayoutSectionForm.test.tsx`

**Interfaces:**
- Consumes: `validatePayoutSection`, `savePayoutSection`, `loadPayoutSummary`, `hasApprovedEngagement`, `businessStatusWarnings`, `formatBusinessNumber`
- Produces: `CreatorConsoleTab = 'funding' | 'shows' | 'shop' | 'payout'`, 페이지 props `{ eligible: boolean; payout: EditorPayoutSummary | null }`

- [ ] **Step 1: API** — `projects/[id].ts`의 `section === 'payout'` 갈래(인증·Origin·검증·`respondWriteResult`)를 그대로 새 라우트로 옮긴다. URL에 프로젝트 id가 없다. 옛 갈래는 지운다(저장 경로를 하나로 — 화면이 더 이상 부르지 않는다). 응답은 `{ ok: true, residentNumberRetained?, businessProfileRetained?, businessWarnings? }`. 테스트: 무인증 401, 다른 Origin 403, 검증 실패 400(메시지에 입력값 없음), 성공 200, `projects/<id>`에 `section: 'payout'`을 보내면 400.

- [ ] **Step 2: 콘솔 탭** — `TABS`에 `{ key: 'payout', href: '/ko/funding/creator/payout', label: '정산 정보' }`. 탭은 늘 보인다(자격 판정은 페이지가 한다 — 다른 탭 페이지마다 자격 조회를 넣지 않는다).

- [ ] **Step 3: 페이지** — `pages/[locale]/funding/creator/shows/index.tsx`의 골격을 따른다: `designEdition = 'v2'`, `PageShell` + `PageHeader title="정산 정보"`, `<CreatorConsoleTabs current="payout" />`, noindex, `getServerSideProps`는 `authenticateCreatorRequest`(로그인 안 됐으면 기존 탭과 같은 리다이렉트) → `hasApprovedEngagement` → 참이면 `loadPayoutSummary`. 거짓이면 `EmptyState`("펀딩 프로젝트·공연·상점 중 하나가 승인되면 이곳에서 정산 계좌와 세금 정보를 등록할 수 있어요."). 참이면 `PayoutSectionForm`을 그린다. 이 경로는 `[id].tsx`보다 리터럴이 이기므로 라우팅 충돌이 없다(프로젝트 id는 hex 32자).

- [ ] **Step 4: 폼** — 지금 폼의 구조(계좌 세 칸 + 세금 구분 `Select` + 원천징수일 때 주민번호 칸, "다시 입력해 덮어쓴다" 안내, dirty 가드)를 유지하고 다음을 더한다.
  - 세금 구분이 사업자일 때만 `Field` 셋: 사업자등록번호(`inputMode="numeric"`, 하이픈 허용), 상호, 대표자명. **이 셋은 저장된 값을 미리 채운다**(계좌와 다르다 — 평문으로 다뤄도 되는 값이고, 국세청 조회를 매번 다시 부르지 않으려면 번호가 같아야 한다).
  - 저장된 국세청 상태 한 줄: `Badge`(정상 success / 휴업·폐업·미등록 error / 과세 유형 경고 warning / 미확인 neutral) + 조회 시각. 경고 문구는 `businessStatusWarnings`를 `Notice tone="warning"`으로. 저장 응답의 `businessWarnings`가 오면 그것으로 갈아 끼운다.
  - 사업자등록증(선택): 등록 여부와 올린 날짜, `<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf">` + 올리기/지우기. 사업자 정보를 저장하기 전에는 버튼을 끄고 "사업자 정보를 먼저 저장해 주세요"를 보인다. 파일은 `fetch(url, { method: 'POST', body: file })`(기존 `ImageUploadField`와 같은 방식). 이 파일은 운영자만 본다는 안내 한 줄.
  - 원천징수 → 사업자 전환 문구는 지금 것을 그대로. **사업자 → 원천징수 전환 확인 문구를 더한다**: "개인(원천징수)으로 바꿔 저장하면 사업자 정보와 사업자등록증이 지워져요." 응답에 `businessProfileRetained`가 오면 "사업자로 정산받은 기록이 있어 사업자 정보는 남겨 두었어요."
  - `business === 'unavailable'`이면 사업자 칸 대신 `Notice`("사업자 정보 칸은 준비 중이에요. 스튜디오 놀에 알려 주세요.")를 보이고, 사업자 저장 버튼을 끈다.
  - 신분증을 요구하는 문구는 어디에도 두지 않는다.
- [ ] **Step 5: 폼 테스트** — 사업자 고르면 칸 셋이 나오고 원천징수면 사라진다 / 경고 문구 렌더 / 업로드 버튼이 사업자 미저장이면 꺼진다 / `unavailable`이면 사업자 칸이 없다.
- [ ] **Step 6: 실행** — `npm run type-check && npx jest` (전체) → PASS. `tests/pages/pageScaffold.test.ts`가 새 페이지를 본다.
- [ ] **Step 7: Commit** — `git commit -m "feat(funding): 개설자 콘솔 정산 정보 탭 — 계정 단위 정산·사업자 정보 화면"`

---

### Task 6: 펀딩 편집기 정산 탭 → 요약 + 링크

**Files:**
- Create: `components/funding/creator/PayoutSummaryCard.tsx`
- Modify: `pages/[locale]/funding/creator/[id].tsx` (`PayoutSectionForm` → `PayoutSummaryCard`, `onDirtyChangeBySection.payout` 정리)
- Test: `components/funding/creator/PayoutSummaryCard.test.tsx`

**Interfaces:**
- Consumes: `EditorPayoutSummary`(Task 5), `formatBusinessNumber`
- Produces: `PayoutSummaryCard({ summary }: { summary: EditorPayoutSummary })`

- [ ] **Step 1:** 카드(`Panel`)에 등록 상태만 보인다 — 계좌 등록 여부·뒤 4자리, 세금 구분, 원천징수면 주민등록번호 등록 여부, 사업자면 사업자등록번호·상호·국세청 상태 배지·사업자등록증 등록 여부. 아래에 `Button` 링크 "정산 정보 고치기" → `/ko/funding/creator/payout`. "정산 정보는 계정에 한 벌이라 펀딩·공연·상점 정산에 함께 쓰여요" 한 줄.
- [ ] **Step 2:** `EDITABLE_SECTIONS`·`types.test.ts`의 `payout` 구획은 그대로 둔다(탭 표시 판정에 계속 쓰인다). 탭 패널이 폼 대신 카드를 그리므로 dirty 가드의 payout 항목은 늘 false다 — 지운다.
- [ ] **Step 3:** 테스트 — 사업자 요약이 번호를 `753-74-00653`으로 보이고, 링크 주소가 맞고, 입력 칸(`input`)이 하나도 없다.
- [ ] **Step 4:** `npx jest` 전체 → PASS, `npm run build`(components 변경 — `lib/funding/CLAUDE.md` 빌드 절)
- [ ] **Step 5: Commit** — `git commit -m "refactor(funding): 편집기 정산 탭은 요약과 계정 화면 링크로 — 저장 경로 하나"`

---

### Task 7: 운영자 — 사업자 정보 패널 · 국세청 재조회 · 사업자등록증 열람(접속기록)

**Files:**
- Modify: `db/schema.ts` (`privacyAccessActionEnum`에 `'creator_business_certificate_view'` — enum 문자열이라 마이그레이션 없음, 기존 주석 규칙대로 설명 주석)
- Modify: `pages/admin/privacy-logs.tsx` (`ACTION_LABEL`에 `'사업자등록증 열람'`)
- Create: `pages/api/admin/creators/[creatorId]/tax-profile.ts` (GET 요약, POST `{ action: 'recheck' }`)
- Create: `pages/api/admin/creators/[creatorId]/business-certificate.ts` (GET 파일)
- Create: `components/admin/CreatorTaxProfilePanel.tsx`
- Modify: `pages/admin/funding/projects/[id].tsx` (정산 절 위), `pages/admin/shows/submissions/[id].tsx` (주최자 절), `pages/admin/shop/artists.tsx` (아티스트 행 펼침 또는 행 아래) — 각 화면의 props에 `creatorId`가 없으면 더한다
- Test: `pages/api/admin/creators/tax-profile.test.ts`, `pages/api/admin/creators/business-certificate.test.ts`

**Interfaces:**
- Consumes: `authenticateAdminApi`, `recordAdminPrivacyAccess`, `loadBusinessProfile`, `lookupBusinessStatus`, `isOwnTaxDocumentKey`, `@vercel/blob`의 `get`
- Produces: `refreshBusinessStatus(creatorId, deps?): Promise<BusinessProfileView | null>` (`businessProfile.ts`), `<CreatorTaxProfilePanel creatorId={...} />`

- [ ] **Step 1: 실패하는 테스트**
  - `business-certificate`: 무인증 401(기록 없음) / 행 없음 404 + `not_found` 기록 / 키가 `tax-docs/<그 creatorId>/` 밖이면 404 + `error` 기록(값 조작 방어) / 정상 200 + `success` 기록 + 헤더 `Content-Type`(저장된 값), `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Content-Disposition: inline; filename="business-certificate.pdf"` / Blob `get` 실패 500 + `error` 기록. 접속기록에는 값·파일명·키를 남기지 않는다(대상은 creatorId).
  - `tax-profile` GET: 무인증 401 / 세금 구분 + 사업자 요약(번호·상호·대표자명·상태·조회 시각·사유 코드·사업자등록증 유무). 계좌·주민번호는 싣지 않는다(그건 기존 버튼 라우트가 연다). POST recheck: 가짜 lookup 주입으로 상태가 갱신되고, 실패면 `unverified` + 사유 코드로 갱신, 행이 없으면 404.
- [ ] **Step 2: 구현** — 열람 라우트는 `resident-number.ts`의 모양(로그 헬퍼를 한 겹 감싸 기록 실패가 열람을 끊지 않게, 실패도 기록)을 그대로 따른다. 파일은 `get(key, { access: 'private' })`(`lib/contracts/pdf-storage.ts`가 쓰는 방식)으로 받아 스트림/버퍼로 내보낸다. `refreshBusinessStatus`는 운영자 경로라 rate limit을 걸지 않는다.
- [ ] **Step 3: 패널** — 마운트 때 GET으로 읽는 클라이언트 컴포넌트(세 화면의 SSR을 건드리지 않으려고). 보이는 것: 세금 구분, 사업자등록번호(하이픈 형식)·상호·대표자명, 국세청 상태 배지 + 과세 유형 원문 + 조회 시각, 미확인이면 사유("API 키 없음"·"시간 초과"·"국세청 응답 오류"·"응답 형식 이상"·"연결 실패"·"조회 한도")를 `Notice tone="warning"`으로, "국세청 다시 조회" 버튼, 사업자등록증이 있으면 "사업자등록증 보기"(새 탭 링크 — 누르면 접속기록에 남는다는 안내 한 줄). 원천징수 개설자면 "개인(원천징수) — 사업자 정보 없음" 한 줄.
- [ ] **Step 4: 세 화면에 끼운다** — 펀딩 상세는 `FundingPayoutSection` 바로 위(승인된 프로젝트일 때), 공연 제출 상세는 "주최자" 절 아래, 상점 아티스트 화면은 각 아티스트 아래 접기(`Disclosure`). 화면마다 정보를 따로 조립하지 않는다.
- [ ] **Step 5:** `npx jest` 전체 → PASS(`privacy-logs` 라벨 표가 enum 전부를 덮는지 보는 테스트가 있으면 함께 통과)
- [ ] **Step 6: Commit** — `git commit -m "feat(admin): 개설자 사업자 정보 패널 — 국세청 재조회·사업자등록증 열람(접속기록)"`

---

### Task 8: 정산 게이트 — 사업자인데 사업자등록번호가 없으면 펀딩 정산 기록 거부

**Files:**
- Modify: `lib/funding/payout.ts` (`FundingPayoutPreview`에 `hasBusinessNumber: boolean | null`, `RecordFundingPayoutResult`에 `'no_business_number'`·`'business_profile_unavailable'`)
- Modify: `pages/api/admin/funding/projects/[id].ts` (오류 코드 → 운영자 문구 표)
- Modify: `components/admin/FundingPayoutSection.tsx` (서버 판정과 같은 식으로 기록 버튼 막기 + 안내)
- Modify: `lib/shop/adminQueries.ts`·`pages/admin/shop/index.tsx` (정산 예정 표의 DB 갈래 행에 "사업자등록번호 미등록" 표시)
- Modify: `pages/[locale]/funding/creator-terms.tsx`는 Task 10에서
- Test: `lib/funding/payout.integration.test.ts`, `components/admin/FundingPayoutSection.test.tsx`

- [ ] **Step 1: 실패하는 테스트**

```ts
test('사업자인데 사업자 정보가 없으면 no_business_number', async () => {
  const project = await seedClosedProjectWithCreator({ taxType: 'invoice', account: true });
  expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'no_business_number' });
});
test('사업자 정보가 있으면 국세청 상태와 무관하게 기록된다(휴업·폐업은 운영자 판단)', async () => {
  const project = await seedClosedProjectWithCreator({ taxType: 'invoice', account: true });
  await db.insert(creatorBusinessProfiles).values({ creatorId: project.creatorId, businessNumber: '7537400653', businessName: 'a', representativeName: 'b', ntsStatus: 'closed' });
  expect(await recordAsAdmin(project.id, new Date())).toMatchObject({ ok: true });
});
test('사업자 표가 없으면 사업자 정산만 business_profile_unavailable, 원천징수 정산은 그대로', async () => { /* DROP TABLE 뒤 두 경우 */ });
test('미리보기는 표가 없어도 던지지 않는다', async () => { /* hasBusinessNumber === null */ });
```

- [ ] **Step 2: 구현** — `buildFundingPayoutPreview`에서 `creator.taxType === 'invoice'`일 때만 `loadBusinessProfile(creator.id)`를 부른다. `'unavailable'` → `hasBusinessNumber: null`, 행 없음 → `false`, 있음 → `true`. `recordFundingPayout`의 `no_tax_type` 검사 바로 뒤:

```ts
if (preview.taxType === 'invoice') {
  if (preview.hasBusinessNumber === null) return { ok: false, code: 'business_profile_unavailable' };
  if (!preview.hasBusinessNumber) return { ok: false, code: 'no_business_number' };
}
```

국세청 상태(휴업·폐업·미확인)로는 막지 않는다 — 판단은 운영자가 패널(Task 7)을 보고 한다. 운영자 문구: `no_business_number` → "사업자로 등록한 개설자인데 사업자등록번호·상호·대표자명이 없습니다. 개설자에게 콘솔의 정산 정보 화면에서 등록을 요청해 주세요." / `business_profile_unavailable` → "사업자 정보 표(마이그레이션 0057)를 읽지 못했습니다."
- [ ] **Step 3: 상점 정산 예정 표** — DB 갈래 쿼리는 그대로 두고, 세금 유형이 `invoice`인 creator id 목록으로 `creator_business_profiles`를 한 번 더 읽어(별도 try — 실패하면 표시만 생략) 행에 `businessNumberMissing: boolean`을 싣는다. 화면은 세금 유형 줄 옆에 "사업자등록번호 미등록". 상점은 기록 경로가 없으니 표시만 한다.
- [ ] **Step 4:** `npx jest` 전체 → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(funding): 사업자 개설자 정산 기록은 사업자등록번호가 있어야 — no_business_number"`

---

### Task 9: 보존·파기 — 사업자 정보·사업자등록증 자동 파기 + 고아 파일 청소

**Files:**
- Modify: `lib/funding/retention.ts` (`purgeExpiredBusinessProfiles`, `BUSINESS_PROFILE_RETENTION_YEARS = 5`, 살아 있는 계정 조건 공용화)
- Create: `lib/funding/taxDocumentRetention.ts` (`purgeOrphanTaxDocuments`)
- Modify: `pages/api/cron/purge-funding.ts` (두 단계 추가 — 기존 `run(...)` 모양 그대로, 서로의 실패에 걸리지 않게)
- Test: `lib/funding/retention.integration.test.ts`(추가), `lib/funding/taxDocumentRetention.test.ts`

**Interfaces:**
- Produces: `purgeExpiredBusinessProfiles(now?: Date, deps?: { deleteBlob? }): Promise<FundingPurgeResult>`, `purgeOrphanTaxDocuments(deps?: { list?, del?, now? }): Promise<{ deleted: number }>`

규칙(주민등록번호 파기 `purgeExpiredResidentNumbers`의 거울 — 전부 AND):

1. 사업자 행이 있다.
2. **살아 있는 일이 없다** — 지금의 `liveProjects`(정산이 끝나지 않은 심사 중·승인 펀딩 프로젝트)에 더해, `show_submissions`가 `submitted`·`changes_requested`·`approved`인 것, `shop_artists` 행. 공연·상점은 정산 기록 표가 없어 "정산이 끝났다"를 알 수 없으므로 승인·등록돼 있는 동안은 지우지 않는다(정산 표가 생기면 이 조건을 고친다).
3. 그리고 둘 중 하나:
   - (A) 사업자 정산 기록(`withholding_amount = 0`)이 있고, 그중 미지급이거나 지급일이 5년 안인 것이 없다.
   - (B) 사업자 정산 기록이 한 번도 없고, 계정 최종 활동(`funding_creators.updated_at`)이 1년(`RESIDENT_NUMBER_DORMANT_YEARS` 재사용)보다 오래됐다.

행을 지운 뒤 사업자등록증 Blob을 지운다(실패는 로그, 고아 청소가 다음 달에 지운다).

**같은 "살아 있는 일" 조건을 주민등록번호 파기 (B)에도 쓴다.** 정산 정보 화면이 공연·상점 계정에 열리면 그 계정의 주민번호도 이 크론의 대상이 되는데, 지금 조건은 펀딩 프로젝트만 보아 상점 아티스트의 번호를 1년 휴면으로 지울 수 있다. 조건을 한 헬퍼(`liveEngagementExists(creatorIdColumn)`)로 빼 두 파기가 함께 쓴다.

- [ ] **Step 1: 실패하는 테스트** — (A)·(B) 각각 지워짐 / 살아 있는 펀딩·승인 공연 등록·상점 아티스트가 있으면 남음 / 사업자등록증 키가 있으면 `deleteBlob`이 그 키로 불림 / 주민번호 파기가 상점 아티스트 계정을 (B)로 지우지 않음(새 조건 회귀) / 표가 없으면 파기 함수가 던지고 크론은 그 단계만 실패로 보고(다른 단계는 진행).
- [ ] **Step 2: 고아 청소 테스트** — `list({ prefix: 'tax-docs/' })` 결과 중 어떤 행의 `certificate_key`도 아니고 업로드 7일이 지난 것만 지운다(`mediaRetention.ts`의 유예와 같다). **접두사가 `tax-docs/`가 아닌 Blob은 어떤 경우에도 지우지 않는다**(계약서 PDF가 같은 저장소에 있다) — 가짜 `list`가 `contracts/x.pdf`를 섞어 돌려줘도 `del`이 불리지 않는지 본다.
- [ ] **Step 3: 구현·크론 연결** — 크론 본문의 단계 이름: "사업자 정산 기록 지급 후 5년 또는 1년 휴면이 지난 개설자 사업자 정보 파기", "아무 계정도 참조하지 않는 사업자등록증 파일 정리".
- [ ] **Step 4:** `npx jest` 전체 → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(funding): 사업자 정보·사업자등록증 자동 파기와 고아 파일 청소, 주민번호 파기도 공연·상점 계정을 살아 있는 것으로 본다"`

---

### Task 10: 처리방침 · 개설자 약관 · 주최자 약관 · 판본

**Files:**
- Modify: `lib/funding/policy.ts` (`FUNDING_TERMS_VERSION`, `FUNDING_CREATOR_TERMS_VERSION`)
- Modify: `lib/shows/organizer/policy.ts` (`SHOW_ORGANIZER_TERMS_VERSION`)
- Modify: `data/privacyPolicy.ts` (ko 13·14·15·18·19항)
- Modify: `pages/[locale]/funding/creator-terms.tsx` (정산 조항의 "정산을 받으려면" 문단)
- Modify: `pages/[locale]/shows/organizer-terms.tsx` (제6조 셋째 문단)
- Modify: 기준선 `content/funding-terms.baseline.json`(이름은 테스트가 쓰는 파일), `content/creator-terms.baseline.json`, `content/show-organizer-terms.baseline.json`

- [ ] **Step 1: 판본을 먼저 올린다** — 구현하는 날 날짜로. 2026-10-14라면 `funding-terms-2026-10-14-r2`, 개설자 약관 `funding-creator-terms-2026-10-14`, 주최자 약관 `show-organizer-terms-2026-10-14-r3`(이미 `-r2`). 날짜가 다르면 그 날짜의 첫 판.
- [ ] **Step 2: 처리방침 문구** (코드가 실제로 하는 것만 적는다)
  - **13항 수집 항목**에 한 줄: "승인된 프로젝트·공연·상점이 있는 개설자가 세금 처리 구분을 사업자로 등록하는 경우에만 — 사업자등록번호, 상호, 대표자명, 그 번호의 국세청 조회 결과(사업 상태·과세 유형·조회 시각), 개설자가 원하는 경우 사업자등록증 사본". 기존 정산 줄의 "프로젝트가 승인된 뒤"를 "프로젝트·공연·상점 중 하나가 승인된 뒤"로.
  - **14항 이용 목적·보유**: 사업자 정보는 세금계산서 수취와 대조, 정산에 쓴다. **국세청 조회**를 이렇게 적는다 — "사업자등록번호를 저장하거나 운영자가 다시 확인할 때, 그 번호 하나를 공공데이터포털(한국지능정보사회진흥원 운영)을 거쳐 국세청 사업자등록 상태조회 서비스에 보내 사업 상태(계속·휴업·폐업)와 과세 유형을 받아 옵니다. 상호·대표자명·계좌 등 다른 정보는 보내지 않습니다." 사업자등록증 사본은 비공개 저장소에 두고 운영자만 열람하며 열람 사실을 접속기록에 남긴다. 보유: 개인으로 바꿔 저장하면 함께 지운다(사업자 정산 기록이 있으면 보관), 자동 파기 요건(Task 9의 A·B와 살아 있는 일 조건).
  - **15항 보유 기간 문장**: "심사 중이거나 승인된 프로젝트 가운데 아직 정산이 끝나지 않은 것이 있으면"을 "…또는 승인된 공연 등록이나 상점 아티스트 등록이 있으면"까지 넓힌다(Task 9의 주민번호 조건 변경과 같은 커밋 묶음에서).
  - **18항 파기 절차·19항 접속기록**: 사업자등록증 파일 삭제와 열람 기록을 더한다(19항이 열거하는 기록 종류 목록에 "사업자등록증 열람").
  - `FUNDING_CREATOR_DATA_PROCESSORS`(위탁 표)에는 국세청·공공데이터포털을 **넣지 않는다**(결정 사항 절). Turso 행의 목적 문구에 "사업자 정보"를, Vercel Blob이 위탁 표에 없으면 Vercel 행의 목적에 "사업자등록증 사본 보관"을 더한다 — 구현 때 지금 표가 Blob 보관을 어디에 적는지 확인하고 같은 자리에 적는다.
- [ ] **Step 3: 개설자 약관** — "정산을 받으려면…" 문단에 한 문장: "세금계산서를 발행하는 사업자로 등록한 개설자는 사업자등록번호·상호·대표자명도 함께 등록해야 합니다. 스튜디오는 등록된 번호의 사업 상태를 국세청에 조회하며, 휴업·폐업 중이거나 세금계산서를 발행하기 어려운 과세 유형이면 정산 전에 개설자와 정산 방법을 협의합니다." 마지막 문장 "이 정보는 모두 프로젝트가 승인된 뒤에 등록할 수 있습니다"는 그대로(펀딩 약관이므로).
- [ ] **Step 4: 주최자 약관 제6조** — "계좌와 세금 처리 구분이 등록되어 있지 않으면"을 "계좌와 세금 처리 구분(사업자로 정산받는 주최자는 사업자등록번호·상호·대표자명까지)이 등록되어 있지 않으면"으로.
- [ ] **Step 5: 기준선 갱신**

```bash
UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts
UPDATE_CREATOR_TERMS_BASELINE=1 npx jest content/creatorTerms.baseline.test.ts
# 주최자 약관 갱신 변수는 content/showOrganizerTerms.baseline.test.ts 머리에서 확인
npx jest content/fundingTermsHash.test.ts content/
```

- [ ] **Step 6:** `npx jest` 전체 → PASS
- [ ] **Step 7: Commit** — 메시지에 바뀐 항·조항을 적는다(루트 CLAUDE.md 규칙 ③):

```bash
git commit -m "docs(policy): 개설자 사업자 정보·국세청 조회·사업자등록증 고지, 판본 올림

- 처리방침 13항: 사업자 정보·국세청 조회 결과·사업자등록증 사본 수집 항목, 수집 시점을 프로젝트·공연·상점 승인으로
- 처리방침 14항: 이용 목적, 국세청 조회(번호 하나만 공공데이터포털 경유 전송), 보유·파기
- 처리방침 15항: 주민번호 자동 파기 보류 조건에 승인된 공연·상점 등록 추가
- 처리방침 18·19항: 사업자등록증 파일 파기, 열람 접속기록
- 개설자 약관 정산 조항·주최자 약관 제6조: 사업자 정산의 등록 조건
"
```

---

### Task 11: 문서 · 배포 순서

**Files:**
- Modify: `lib/funding/CLAUDE.md` (새 절 "개설자 사업자 정보·국세청 조회")
- Modify: `lib/crypto/CLAUDE.md` (암호화 대상 목록 바로 아래 한 줄 — 사업자 정보는 일부러 평문, 이유는 schema 주석)
- Modify: 루트 `CLAUDE.md` (마이그레이션 0057 배포 전 적용 한 줄 + `NTS_BUSINESS_STATUS_API_KEY`)

- [ ] **Step 1: `lib/funding/CLAUDE.md`에 적을 것**
  - 저장 경로는 `savePayoutSection` 하나, 화면은 `/ko/funding/creator/payout` 하나다. 편집기 탭은 요약뿐이다.
  - 열리는 조건 `hasApprovedEngagement`(펀딩 승인·공연 승인·상점 아티스트).
  - 국세청 조회 실패는 저장을 막지 않는다 — `unverified` + 사유 코드. 휴업·폐업은 정산을 막지 않고 운영자가 판단한다. 막는 것은 사업자등록번호 부재(`no_business_number`)뿐이다.
  - 사업자등록증은 `tax-docs/`이고 `/api/funding/media/`가 내보낼 수 없다. `resolveFundingBlobPath`를 넓히지 말 것. 열람은 관리자 라우트 하나, 접속기록 `creator_business_certificate_view`.
  - 세금 구분 전환 시 파기 규칙과 `hasInvoicePayout`·`hasWithheldPayout`·`retention.ts`의 경계가 한 묶음이라는 것.
  - **알려진 한계:** 상점 정산은 기록 표가 없어 상점에서 원천징수로 지급한 사실을 코드가 모른다. 상점 아티스트가 원천징수로 정산받은 뒤 사업자로 바꾸면 `hasWithheldPayout`이 거짓이라 주민등록번호가 지워진다 — 상점 정산 기록 표를 만들 때 그 판정에 상점 갈래를 넣을 것.
- [ ] **Step 2: 루트 CLAUDE.md** — 마이그레이션 절 근처에 "0057(`creator_business_profiles`)도 배포 전에 — 안 하면 사업자 정보 저장과 사업자 개설자의 정산 기록만 실패한다(결제·로그인은 무관)" 한 줄. env 표나 운영 단계 목록에 `NTS_BUSINESS_STATUS_API_KEY`.
- [ ] **Step 3: 전체 검증** — `npm run type-check && npm run lint && npx jest && npm run build`
- [ ] **Step 4: Commit + PR** — 브랜치 `feat/creator-tax-profile`, `gh pr create`, 본문에 배포 순서:
  1. **운영자:** 공공데이터포털(data.go.kr)에서 "국세청_사업자등록정보 진위확인 및 상태조회 서비스" 활용 신청 → 일반 인증키(Decoding)를 Vercel env `NTS_BUSINESS_STATUS_API_KEY`(Production·Preview)에 넣는다. 머지 푸시가 싣고 가므로 따로 재배포하지 않는다. 키 없이 배포해도 저장은 되고 상태가 "미확인(API 키 없음)"으로 남는다.
  2. 운영 DB에 0057 적용(루트 CLAUDE.md 절차, main 병합본에서) → `pragma table_info(creator_business_profiles);`로 확인
  3. 머지
  4. 배포 뒤 확인(이 배포에만 있는 것으로):
     - `/ko/funding/creator/payout`이 로그인 개설자에게 200, 콘솔에 "정산 정보" 탭
     - 테스트 계정으로 사업자 저장 → 관리자 패널에 국세청 상태가 "정상"(키를 넣었다면) 또는 "미확인(API 키 없음)"
     - 사업자등록증 PDF 업로드 → 관리자 "보기" 200 → `/admin/privacy-logs`에 "사업자등록증 열람" 한 줄
     - 같은 파일 경로를 `/api/funding/media/…`로 요청하면 404
     - 확인 뒤 테스트 계정을 개인으로 바꿔 저장해 사업자 행·파일이 지워지는지 본다

---

## 다음 단계 메모 (이번 계획 밖, 결정 기록용)

- 상점 정산 기록 표가 생기면: `hasWithheldPayout`·`hasInvoicePayout`·두 파기 함수에 상점 갈래를 넣고, Task 8의 정산 게이트를 상점 기록 경로에도 건다.
- 공연 3단계 정산(`show_payouts`)도 같은 게이트(`no_tax_type`·`no_resident_number`·`no_business_number`)를 처음부터 쓴다.
- 국세청 "진위확인"(번호 + 개업일자 + 대표자명 대조) API는 개업일자를 더 받아야 해서 이번에 쓰지 않았다. 사칭 우려가 생기면 그때 붙인다.
