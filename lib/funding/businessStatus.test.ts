/** @jest-environment node */
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
