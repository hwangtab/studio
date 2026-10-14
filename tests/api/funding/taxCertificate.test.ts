/** @jest-environment node */
import { Readable } from 'node:stream';

import sharp from 'sharp';

jest.mock('@vercel/blob', () => ({ put: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn() }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/creatorAuth', () => ({ authenticateCreatorApi: jest.fn() }));
jest.mock('../../../lib/funding/creatorEligibility', () => ({ hasApprovedEngagement: jest.fn() }));
jest.mock('../../../lib/funding/businessProfile', () => ({
  ...jest.requireActual('../../../lib/funding/businessProfile'),
  loadBusinessProfile: jest.fn(),
  isInvoiceTaxType: jest.fn(),
  setBusinessCertificate: jest.fn(),
  clearBusinessCertificate: jest.fn(),
  deleteTaxDocumentBlob: jest.fn().mockResolvedValue(undefined),
}));

import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { isAllowedContactRequestOrigin } from '../../../lib/contact/origin';
import {
  clearBusinessCertificate,
  deleteTaxDocumentBlob,
  isInvoiceTaxType,
  loadBusinessProfile,
  setBusinessCertificate,
} from '../../../lib/funding/businessProfile';
import { authenticateCreatorApi } from '../../../lib/funding/creatorAuth';
import { hasApprovedEngagement } from '../../../lib/funding/creatorEligibility';
import handler from '../../../pages/api/funding/creator/payout/certificate';

const CID = 'c0ffee';
const pdf = Buffer.from('%PDF-1.4\n%%EOF');

const call = async (method: string, body: Buffer = Buffer.alloc(0)) => {
  const req = Object.assign(Readable.from(body.length ? [body] : []), { method, headers: {}, query: {}, socket: { remoteAddress: '1.2.3.4' } }) as unknown as NextApiRequest;
  const out: { status: number; json: unknown } = { status: 0, json: null };
  const res = {
    setHeader: jest.fn(),
    status(code: number) { out.status = code; return this; },
    json(v: unknown) { out.json = v; return this; },
  } as unknown as NextApiResponse;
  await handler(req, res);
  return out;
};

beforeEach(() => {
  jest.clearAllMocks();
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(true);
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: CID });
  (hasApprovedEngagement as jest.Mock).mockResolvedValue(true);
  (isInvoiceTaxType as jest.Mock).mockResolvedValue(true);
  (loadBusinessProfile as jest.Mock).mockResolvedValue({ businessNumber: '1234567890' });
  (setBusinessCertificate as jest.Mock).mockResolvedValue({ previousKey: null });
  (clearBusinessCertificate as jest.Mock).mockResolvedValue({ previousKey: `tax-docs/${CID}/old.pdf` });
});

test('무인증 401', async () => {
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
  expect((await call('POST', pdf)).status).toBe(401);
});

test('다른 Origin 403', async () => {
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
  expect((await call('POST', pdf)).status).toBe(403);
});

test('승인 전 계정은 403', async () => {
  (hasApprovedEngagement as jest.Mock).mockResolvedValue(false);
  expect((await call('POST', pdf)).status).toBe(403);
  expect(put).not.toHaveBeenCalled();
});

test('사업자 행이 없으면 409', async () => {
  (loadBusinessProfile as jest.Mock).mockResolvedValue(null);
  const r = await call('POST', pdf);
  expect(r.status).toBe(409);
  expect(r.json).toEqual({ ok: false, message: '사업자 정보를 먼저 저장해 주세요.' });
});

test('HTML 본문 400, 올리지 않는다', async () => {
  expect((await call('POST', Buffer.from('<html><script>'))).status).toBe(400);
  expect(put).not.toHaveBeenCalled();
});

test('4MB 초과 413', async () => {
  expect((await call('POST', Buffer.alloc(4 * 1024 * 1024 + 1, 1))).status).toBe(413);
});

test('정상 PDF 200 — private tax-docs 키, 옛 키 삭제, 키는 응답에 없다', async () => {
  (setBusinessCertificate as jest.Mock).mockResolvedValue({ previousKey: `tax-docs/${CID}/old.pdf` });
  const r = await call('POST', pdf);
  expect(r.status).toBe(200);
  expect(Object.keys(r.json as object).sort()).toEqual(['ok', 'uploadedAt']);
  const [key, , opts] = (put as jest.Mock).mock.calls[0];
  expect(key).toMatch(new RegExp(`^tax-docs/${CID}/[0-9a-f-]{36}\\.pdf$`));
  expect(opts).toEqual({ access: 'private', contentType: 'application/pdf' });
  expect(deleteTaxDocumentBlob).toHaveBeenCalledWith(`tax-docs/${CID}/old.pdf`, CID);
});

test('행 갱신이 실패하면 방금 올린 Blob을 지운다', async () => {
  (setBusinessCertificate as jest.Mock).mockRejectedValue(new Error('db'));
  const r = await call('POST', pdf);
  expect(r.status).toBe(500);
  expect(deleteTaxDocumentBlob).toHaveBeenCalledWith((put as jest.Mock).mock.calls[0][0], CID);
});

test('DELETE는 행을 비우고 Blob을 지운다', async () => {
  const r = await call('DELETE');
  expect(r).toEqual({ status: 200, json: { ok: true } });
  expect(deleteTaxDocumentBlob).toHaveBeenCalledWith(`tax-docs/${CID}/old.pdf`, CID);
});

test('개인(원천징수)으로 바꾼 뒤 남은 행 — POST 409, 올리지 않는다', async () => {
  (isInvoiceTaxType as jest.Mock).mockResolvedValue(false);
  const r = await call('POST', pdf);
  expect(r.status).toBe(409);
  expect(r.json).toEqual({ ok: false, message: '세금 구분이 사업자일 때만 올릴 수 있어요.' });
  expect(put).not.toHaveBeenCalled();
});

test('개인(원천징수)으로 바꾼 뒤 남은 행 — DELETE 409, Blob을 지우지 않는다', async () => {
  (isInvoiceTaxType as jest.Mock).mockResolvedValue(false);
  expect((await call('DELETE')).status).toBe(409);
  expect(clearBusinessCertificate).not.toHaveBeenCalled();
  expect(deleteTaxDocumentBlob).not.toHaveBeenCalled();
});

test('사업자 표가 없으면 503', async () => {
  (loadBusinessProfile as jest.Mock).mockResolvedValue('unavailable');
  expect((await call('POST', pdf)).status).toBe(503);
});

test('저장 시점에 행이 사라졌으면 409, 올린 Blob을 지운다', async () => {
  (setBusinessCertificate as jest.Mock).mockResolvedValue(null);
  const r = await call('POST', pdf);
  expect(r.status).toBe(409);
  expect(deleteTaxDocumentBlob).toHaveBeenCalledWith((put as jest.Mock).mock.calls[0][0], CID);
});

test('이미지는 webp 키와 image/webp로 올라간다', async () => {
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer();
  expect((await call('POST', png)).status).toBe(200);
  const [key, , opts] = (put as jest.Mock).mock.calls[0];
  expect(key).toMatch(/\.webp$/);
  expect(opts.contentType).toBe('image/webp');
});
