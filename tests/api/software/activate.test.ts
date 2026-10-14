/** @jest-environment node */
import { generateKeyPairSync } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';

let testDb: ShowsTestDb;
const { privateKey } = generateKeyPairSync('ed25519');
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../data/software/catalog', () => ({
  ...jest.requireActual('../../../data/software/catalog'),
  SOFTWARE_PRODUCTS: jest.requireActual('../../helpers/softwareFixtures').SOFTWARE_FIXTURE_PRODUCTS,
}));
const mockPublicKeys: Record<string, string> = {};
jest.mock('../../../data/software/publicKeys', () => ({ get SOFTWARE_LICENSE_PUBLIC_KEYS() { return mockPublicKeys; } }));

/* eslint-disable import/first */
import activate from '../../../pages/api/software/activate';
import deactivate from '../../../pages/api/software/deactivate';
import latest from '../../../pages/api/software/latest';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { rawPublicKeyOf, verifyLicenseFile } from '../../../lib/software/licenseFile';
import { issueLicense } from '../../../lib/software/service';
/* eslint-enable import/first */

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;
const call = async (handler: Handler, init: { method?: string; body?: unknown; query?: Record<string, string> }) => {
  const result: { status?: number; json?: Record<string, unknown>; headers: Record<string, string> } = { headers: {} };
  const res = {
    setHeader: (k: string, v: string) => { result.headers[k] = v; return res; },
    status: (code: number) => { result.status = code; return res; },
    json: (j: Record<string, unknown>) => { result.json = j; return res; },
  } as unknown as NextApiResponse;
  await handler({ method: init.method ?? 'POST', body: init.body ?? {}, query: init.query ?? {}, headers: {}, socket: { remoteAddress: '1.2.3.4' } } as unknown as NextApiRequest, res);
  return result;
};

const ENV = { ...process.env };
const machineId = 'a'.repeat(64);

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  process.env.SOFTWARE_LICENSE_SIGNING_KEY = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  process.env.SOFTWARE_LICENSE_KEY_ID = 'k1';
  mockPublicKeys.k1 = rawPublicKeyOf(privateKey);
  jest.mocked(consumeRateLimit).mockResolvedValue(true);
});
afterAll(() => { process.env = ENV; });

describe('POST /api/software/activate', () => {
  it('200 — 서명 파일을 돌려주고 no-store', async () => {
    const lic = await issueLicense({ productSlug: 'test-plugin', email: 'a@b.com', source: 'manual' });
    const r = await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } });
    expect(r.status).toBe(200);
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(verifyLicenseFile(r.json?.licenseFile, mockPublicKeys)).toMatchObject({ product: 'test-plugin', machine: machineId });
  });

  it('응답 코드는 연동 안내서(docs/software/license-integration.md §3)와 같다', async () => {
    const lic = await issueLicense({ productSlug: 'test-plugin', email: 'a@b.com', source: 'manual', maxActivations: 1 });
    expect((await call(activate, { body: { key: 'x', product: 'test-plugin', machineId } }))).toMatchObject({ status: 400, json: { error: 'bad_request' } });
    expect((await call(activate, { body: { key: 'NOL-00000-00000-00000-00000', product: 'test-plugin', machineId } }))).toMatchObject({ status: 404, json: { error: 'invalid_key' } });
    await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } });
    expect((await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId: 'b'.repeat(64) } }))).toMatchObject({ status: 409, json: { error: 'activation_limit' } });
    expect((await call(activate, { method: 'GET' }))).toMatchObject({ status: 405 });
    jest.mocked(consumeRateLimit).mockResolvedValueOnce(false);
    expect((await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } }))).toMatchObject({ status: 429, json: { error: 'rate_limited' } });
  });

  it('서명키가 없거나, 그 kid가 공개키 목록에 없으면 503으로 닫는다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const lic = await issueLicense({ productSlug: 'test-plugin', email: 'a@b.com', source: 'manual' });
    delete mockPublicKeys.k1;
    expect((await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } }))).toMatchObject({ status: 503, json: { error: 'unavailable' } });
    mockPublicKeys.k1 = rawPublicKeyOf(privateKey);
    delete process.env.SOFTWARE_LICENSE_SIGNING_KEY;
    expect((await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } }))).toMatchObject({ status: 503 });
  });
});

describe('플러그인 본문·서명키 짝', () => {
  it('Content-Type 없이 보낸 JSON(JUCE 기본 — 폼 인코딩으로 파싱됨)도 읽는다', async () => {
    const lic = await issueLicense({ productSlug: 'test-plugin', email: 'a@b.com', source: 'manual' });
    const json = JSON.stringify({ key: lic.licenseKey, product: 'test-plugin', machineId });
    expect(await call(activate, { body: { [json]: '' } })).toMatchObject({ status: 200 });
    expect(await call(activate, { body: json })).toMatchObject({ status: 200 });
  });

  it('env 비밀키가 그 kid의 공개키와 짝이 아니면 503 — 검증 못 할 파일을 내주지 않는다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const lic = await issueLicense({ productSlug: 'test-plugin', email: 'a@b.com', source: 'manual' });
    mockPublicKeys.k1 = rawPublicKeyOf(generateKeyPairSync('ed25519').privateKey);
    expect(await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } })).toMatchObject({ status: 503 });
  });
});

describe('POST /api/software/deactivate', () => {
  it('해제는 멱등 — 두 번째도 200', async () => {
    const lic = await issueLicense({ productSlug: 'test-plugin', email: 'a@b.com', source: 'manual' });
    await call(activate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } });
    expect(await call(deactivate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } })).toMatchObject({ status: 200, json: { deactivated: true } });
    expect(await call(deactivate, { body: { key: lic.licenseKey, product: 'test-plugin', machineId } })).toMatchObject({ status: 200, json: { deactivated: false } });
    expect(await call(deactivate, { body: { key: 'NOL-00000-00000-00000-00000', product: 'test-plugin', machineId } })).toMatchObject({ status: 404 });
  });
});

describe('GET /api/software/latest', () => {
  it('공개 상품의 첫 릴리스를 최신으로, 비공개·없는 상품은 404', async () => {
    expect(await call(latest, { method: 'GET', query: { product: 'test-plugin' } })).toMatchObject({ status: 200, json: { version: '1.1.0', date: '2026-11-01' } });
    expect(await call(latest, { method: 'GET', query: { product: 'test-app' } })).toMatchObject({ status: 404 });
    expect(await call(latest, { method: 'GET', query: { product: 'nope' } })).toMatchObject({ status: 404 });
  });
});
