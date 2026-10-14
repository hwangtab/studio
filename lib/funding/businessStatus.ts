/**
 * 사업자등록번호 검사와 국세청 상태조회(공공데이터포털 "국세청_사업자등록정보 진위확인 및 상태조회 서비스").
 *
 * 이 파일은 클라이언트 폼도 쓴다 — db/schema를 값으로 import하지 않는다(lib/funding/CLAUDE.md 클라이언트 번들 절).
 * **조회 실패는 저장 실패가 아니다**(운영자 결정 2026-10-14). 그래서 lookupBusinessStatus는 던지지 않고 사유 코드를 돌려준다.
 * 요청 주소에 서비스 키가 들어가므로 이 파일은 주소·키를 로그에 남기지 않는다.
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
 * 그 밖(02 간이과세자·03 과세특례자·04 면세사업자·05 수익사업을 하지 않는 비영리법인·국가기관 등·
 * 06 고유번호를 받은 단체)은 경고만 한다.
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
  const row = body.data[0] as Record<string, unknown> | null;
  if (!row || typeof row !== 'object') return bad;
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

const isAbortError = (error: unknown): boolean =>
  // DOMException은 런타임에 따라 Error의 인스턴스가 아닐 수 있어 이름으로 본다.
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';

/**
 * `businessNumber`는 normalizeBusinessNumber를 통과한 10자리 숫자여야 한다 — 이 함수는 다시 검사하지 않는다.
 */
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
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    if (!res.ok) return { ok: false, error: 'http_error' };
    let json: unknown;
    try {
      json = await res.json();
    } catch (error: unknown) {
      return { ok: false, error: isAbortError(error) ? 'timeout' : 'bad_response' };
    }
    return parseNtsStatusResponse(json);
  } catch (error: unknown) {
    if (isAbortError(error)) return { ok: false, error: 'timeout' };
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
        if (!input.taxTypeLabel) {
          return ['국세청 조회 결과 과세 유형으로 보면 세금계산서 발행이 어려울 수 있어요. 정산 전에 스튜디오 놀이 확인해 연락드려요.'];
        }
        return [`국세청 조회 결과 과세 유형이 「${input.taxTypeLabel}」로 나와요. 이 유형은 세금계산서 발행이 어려울 수 있어, 정산 전에 스튜디오 놀이 확인해 연락드려요.`];
      }
      return [];
    default:
      return [];
  }
};
