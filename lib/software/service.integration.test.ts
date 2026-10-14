import { generateKeyPairSync } from 'crypto';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/software/catalog', () => ({
  ...jest.requireActual('../../data/software/catalog'),
  SOFTWARE_PRODUCTS: jest.requireActual('../../tests/helpers/softwareFixtures').SOFTWARE_FIXTURE_PRODUCTS,
}));

/* eslint-disable import/first */
import { rawPublicKeyOf, verifyLicenseFile } from './licenseFile';
import { activateLicense, adminDeactivate, deactivateMachine, issueLicense, listAdminLicenses, revokeLicense } from './service';
/* eslint-enable import/first */

const { privateKey } = generateKeyPairSync('ed25519');
const signer = { kid: 'k-test', key: privateKey };
const publicKeys = { 'k-test': rawPublicKeyOf(privateKey) };
const machine = (n: number) => `machine-${String(n).padStart(4, '0')}`;

beforeEach(async () => {
  testDb = (await createTestDb()).db;
});

const issue = (overrides: Partial<Parameters<typeof issueLicense>[0]> = {}) =>
  issueLicense({ productSlug: 'test-plugin', email: 'Buyer@Example.com', source: 'manual', ...overrides });

describe('issueLicense', () => {
  it('상품 기본 기기 수로 발급하고 이메일은 소문자로 저장한다', async () => {
    const lic = await issue();
    expect(lic).toMatchObject({ productSlug: 'test-plugin', email: 'buyer@example.com', maxActivations: 2, status: 'active', firstActivatedAt: null });
    expect(lic.licenseKey).toMatch(/^NOL(-[0-9A-Z]{5}){4}$/);
  });

  it('비공개 상품에도 발급된다(출시 전 시험 키), 없는 상품은 던진다', async () => {
    await expect(issue({ productSlug: 'test-app' })).resolves.toMatchObject({ maxActivations: 3 });
    await expect(issue({ productSlug: 'nope' })).rejects.toThrow();
  });
});

describe('activateLicense', () => {
  it('활성화하면 그 기기·상품에 묶인 서명 파일을 주고 첫 활성화 시각을 남긴다', async () => {
    const lic = await issue();
    const now = new Date('2026-10-20T01:00:00Z');
    const r = await activateLicense({ key: lic.licenseKey.toLowerCase(), product: 'test-plugin', machineId: machine(1), label: 'Studio iMac', appVersion: '1.0.0' }, signer, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reused).toBe(false);
    expect(verifyLicenseFile(r.licenseFile, publicKeys)).toMatchObject({ lic: lic.id, product: 'test-plugin', machine: machine(1), keyHint: lic.licenseKey.slice(-5) });
    const row = await testDb.query.softwareLicenses.findFirst();
    expect(row!.firstActivatedAt!.toISOString()).toBe(now.toISOString());
  });

  it('같은 기기는 자리를 더 쓰지 않고 새 파일만 준다(재설치)', async () => {
    const lic = await issue();
    await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(1) }, signer);
    const again = await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(1) }, signer);
    expect(again).toMatchObject({ ok: true, reused: true });
    expect(await testDb.query.softwareActivations.findMany()).toHaveLength(1);
  });

  it('기기 수를 넘으면 activation_limit, 하나 해제하면 다시 된다', async () => {
    const lic = await issue();
    for (const n of [1, 2]) expect((await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(n) }, signer)).ok).toBe(true);
    expect(await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(3) }, signer)).toEqual({ ok: false, code: 'activation_limit' });

    expect(await deactivateMachine({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(1) })).toEqual({ ok: true, deactivated: true });
    expect(await deactivateMachine({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(1) })).toEqual({ ok: true, deactivated: false });
    expect((await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(3) }, signer)).ok).toBe(true);
  });

  it('동시에 몰려도 기기 수를 넘지 않는다', async () => {
    const lic = await issue();
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(n) }, signer)));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    const active = (await testDb.query.softwareActivations.findMany()).filter((a) => a.deactivatedAt === null);
    expect(active).toHaveLength(2);
  });

  it('없는 키와 다른 상품의 키는 같은 invalid_key, 형식 오류는 bad_request', async () => {
    const lic = await issue();
    expect(await activateLicense({ key: 'NOL-00000-00000-00000-00000', product: 'test-plugin', machineId: machine(1) }, signer)).toEqual({ ok: false, code: 'invalid_key' });
    expect(await activateLicense({ key: lic.licenseKey, product: 'test-app', machineId: machine(1) }, signer)).toEqual({ ok: false, code: 'invalid_key' });
    expect(await activateLicense({ key: 'garbage', product: 'test-plugin', machineId: machine(1) }, signer)).toEqual({ ok: false, code: 'bad_request' });
    expect(await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: 'short' }, signer)).toEqual({ ok: false, code: 'bad_request' });
    expect(await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: 'has space here' }, signer)).toEqual({ ok: false, code: 'bad_request' });
  });

  it('취소된 라이선스는 revoked — 새 기기를 받지 않는다', async () => {
    const lic = await issue();
    expect(await revokeLicense(lic.id)).toBe(true);
    expect(await revokeLicense(lic.id)).toBe(false);
    expect(await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(1) }, signer)).toEqual({ ok: false, code: 'revoked' });
  });
});

describe('관리자', () => {
  it('목록은 활성 기기만 붙이고, 이메일·키로 찾는다', async () => {
    const a = await issue({ email: 'a@example.com' });
    await issue({ email: 'b@example.com' });
    await activateLicense({ key: a.licenseKey, product: 'test-plugin', machineId: machine(1), label: 'iMac' }, signer);
    await activateLicense({ key: a.licenseKey, product: 'test-plugin', machineId: machine(2) }, signer);
    await deactivateMachine({ key: a.licenseKey, product: 'test-plugin', machineId: machine(2) });

    const all = await listAdminLicenses();
    expect(all).toHaveLength(2);
    const byEmail = await listAdminLicenses('A@EXAMPLE');
    expect(byEmail.map((r) => r.email)).toEqual(['a@example.com']);
    expect(byEmail[0].activations.map((x) => x.label)).toEqual(['iMac']);
    expect((await listAdminLicenses(a.licenseKey.slice(-5).toLowerCase())).map((r) => r.id)).toEqual([a.id]);
  });

  it('기기 해제 — 하나 또는 전부', async () => {
    const lic = await issue();
    for (const n of [1, 2]) await activateLicense({ key: lic.licenseKey, product: 'test-plugin', machineId: machine(n) }, signer);
    const [row] = await listAdminLicenses();
    expect(await adminDeactivate(lic.id, row.activations[0].id)).toBe(1);
    expect(await adminDeactivate(lic.id)).toBe(1);
    expect((await listAdminLicenses())[0].activations).toHaveLength(0);
  });
});
