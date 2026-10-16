/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/r2', () => ({
  fundingDownloadObjectExists: jest.fn().mockResolvedValue(true),
  presignFundingDownload: jest.fn().mockResolvedValue('https://r2.example/signed'),
}));
jest.mock('../../../data/software/catalog', () => ({
  ...jest.requireActual('../../../data/software/catalog'),
  SOFTWARE_PRODUCTS: [{
    ...jest.requireActual('../../helpers/softwareFixtures').SOFTWARE_FIXTURE_PRODUCTS[0],
    releases: [{ version: '1.1.0', date: '2026-11-01', notes: [], notesEn: [], downloads: [{ platform: 'macos', objectKey: 'software/test-plugin/1.1.0/T.dmg', sha256: 'a'.repeat(64), sizeBytes: 1 }] }],
  }],
}));

/* eslint-disable import/first */
import handler from '../../../pages/api/software/download/[...path]';
import { fundingDownloadObjectExists, presignFundingDownload } from '../../../lib/funding/r2';
/* eslint-enable import/first */

const call = async (path: string[]) => {
  const result: { status?: number; location?: string } = {};
  const res = {
    setHeader: () => res,
    status: (code: number) => { result.status = code; return res; },
    send: () => res,
    end: () => res,
    redirect: (code: number, url: string) => { result.status = code; result.location = url; return res; },
  } as unknown as NextApiResponse;
  await handler({ method: 'GET', query: { path }, headers: {}, socket: { remoteAddress: '1.2.3.4' } } as unknown as NextApiRequest, res);
  return result;
};

describe('GET /api/software/download/<slug>/<version>/<platform>', () => {
  it('카탈로그의 키로 서명 주소에 302 — 요청 경로를 키로 쓰지 않는다', async () => {
    expect(await call(['test-plugin', '1.1.0', 'macos'])).toEqual({ status: 302, location: 'https://r2.example/signed' });
    expect(presignFundingDownload).toHaveBeenCalledWith('software/test-plugin/1.1.0/T.dmg');
  });

  it('없는 상품·버전·OS는 404', async () => {
    expect((await call(['test-plugin', '1.1.0', 'windows'])).status).toBe(404);
    expect((await call(['test-plugin', '9.9.9', 'macos'])).status).toBe(404);
    expect((await call(['nope', '1.1.0', 'macos'])).status).toBe(404);
    expect((await call(['test-plugin', '1.1.0'])).status).toBe(404);
  });

  it('R2에 객체가 없으면 서명 주소로 보내지 않고 503', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (fundingDownloadObjectExists as jest.Mock).mockResolvedValueOnce(false);
    expect((await call(['test-plugin', '1.1.0', 'macos'])).status).toBe(503);
  });
});
