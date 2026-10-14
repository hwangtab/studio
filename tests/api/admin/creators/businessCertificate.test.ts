/** @jest-environment node */
jest.mock('@vercel/blob', () => ({ get: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/privacy/accessLog', () => ({ recordAdminPrivacyAccess: jest.fn() }));
jest.mock('../../../../lib/funding/businessProfile', () => ({
  ...jest.requireActual('../../../../lib/funding/businessProfile'),
  loadBusinessCertificateKey: jest.fn(),
}));

import { get } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadBusinessCertificateKey } from '../../../../lib/funding/businessProfile';
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import handler from '../../../../pages/api/admin/creators/[creatorId]/business-certificate';

const CID = 'c0ffee';
const ACTION = 'creator_business_certificate_view';

const call = async (method = 'GET', creatorId: unknown = CID) => {
  const out: { status: number; headers: Record<string, string>; body: unknown } = { status: 0, headers: {}, body: null };
  const res = {
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; return this; },
    status(code: number) { out.status = code; return this; },
    json(v: unknown) { out.body = v; return this; },
    send(v: unknown) { out.body = v; return this; },
    end() { return this; },
  } as unknown as NextApiResponse;
  await handler({ method, query: { creatorId }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return out;
};

const stream = (text: string) => new Response(text).body;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha' });
  (recordAdminPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
  (loadBusinessCertificateKey as jest.Mock).mockResolvedValue(`tax-docs/${CID}/u1.pdf`);
  (get as jest.Mock).mockResolvedValue({ statusCode: 200, stream: stream('%PDF-1.4'), blob: { contentType: 'text/html' } });
});

afterEach(() => jest.restoreAllMocks());

const logged = () => (recordAdminPrivacyAccess as jest.Mock).mock.calls.map((c) => c.slice(2));

test('무인증 401이고 기록하지 않는다', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  expect((await call()).status).toBe(401);
  expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test('GET이 아니면 405', async () => {
  expect((await call('POST')).status).toBe(405);
});

test('행·키가 없으면 404 + not_found 기록', async () => {
  (loadBusinessCertificateKey as jest.Mock).mockResolvedValue(null);
  expect((await call()).status).toBe(404);
  expect(logged()).toEqual([[ACTION, CID, 'not_found']]);
});

test.each([
  ['다른 개설자 경로', 'tax-docs/other/u1.pdf'],
  ['접두사 밖', `funding/${CID}/u1.pdf`],
  ['상위 경로', `tax-docs/${CID}/../other/u1.pdf`],
  ['모르는 확장자', `tax-docs/${CID}/u1.html`],
])('%s면 404 + error 기록, Blob을 읽지 않는다', async (_label, key) => {
  (loadBusinessCertificateKey as jest.Mock).mockResolvedValue(key);
  expect((await call()).status).toBe(404);
  expect(logged()).toEqual([[ACTION, CID, 'error']]);
  expect(get).not.toHaveBeenCalled();
});

test('PDF — 확장자로 정한 형식, 내려받기, nosniff, no-store + success 기록', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(get).toHaveBeenCalledWith(`tax-docs/${CID}/u1.pdf`, { access: 'private' });
  expect(r.headers['content-type']).toBe('application/pdf');
  expect(r.headers['content-disposition']).toBe('attachment; filename="business-certificate.pdf"');
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  expect(r.headers['cache-control']).toBe('no-store, private');
  expect(r.headers['content-security-policy']).toBeUndefined();
  expect(Buffer.isBuffer(r.body) && (r.body as Buffer).toString()).toBe('%PDF-1.4');
  expect(logged()).toEqual([[ACTION, CID, 'success']]);
});

test('WebP — 바로 보기, 좁은 CSP', async () => {
  (loadBusinessCertificateKey as jest.Mock).mockResolvedValue(`tax-docs/${CID}/u2.webp`);
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.headers['content-type']).toBe('image/webp');
  expect(r.headers['content-disposition']).toBe('inline; filename="business-certificate.webp"');
  expect(r.headers['content-security-policy']).toBe("default-src 'none'; img-src 'self'");
  expect(r.headers['x-content-type-options']).toBe('nosniff');
});

test('기록에는 키·파일명이 남지 않는다', async () => {
  await call();
  expect(JSON.stringify((recordAdminPrivacyAccess as jest.Mock).mock.calls)).not.toMatch(/tax-docs|u1\.pdf|business-certificate/);
});

test('Blob get 실패는 500 + error 기록', async () => {
  (get as jest.Mock).mockRejectedValue(new Error('blob down'));
  expect((await call()).status).toBe(500);
  expect(logged()).toEqual([[ACTION, CID, 'error']]);
});

test('Blob이 비어 있으면 404 + not_found 기록', async () => {
  (get as jest.Mock).mockResolvedValue(null);
  expect((await call()).status).toBe(404);
  expect(logged()).toEqual([[ACTION, CID, 'not_found']]);
});

test('기록 실패가 열람을 끊지 않는다', async () => {
  (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('log down'));
  expect((await call()).status).toBe(200);
});
