/** @jest-environment node */
const put = jest.fn();
const list = jest.fn();
const del = jest.fn().mockResolvedValue(undefined);
jest.mock('@vercel/blob', () => ({
  put: (...a: unknown[]) => put(...a),
  list: (...a: unknown[]) => list(...a),
  del: (...a: unknown[]) => del(...a),
}));

let mockContracts: Array<{ id: string; pdfUrl: string | null; signToken: string }> = [];
jest.mock('../../db/client', () => ({
  getDb: () => ({ query: { contracts: { findMany: async () => mockContracts } } }),
}));

// eslint-disable-next-line import/first
import { backupContracts } from './backup';

const NOW = new Date('2026-10-20T00:00:00Z');
const OLD = new Date('2026-09-01T00:00:00Z');
const blob = (host: string, pathname: string, uploadedAt = OLD) => ({
  url: `https://${host}.private.blob.vercel-storage.com/${pathname}`,
  pathname,
  uploadedAt,
});

beforeEach(() => {
  jest.clearAllMocks();
  put.mockResolvedValue({ pathname: 'contracts/backup/x.json' });
});

describe('고아 PDF 정리', () => {
  // 저장소를 옮기면 DB에는 옛 저장소 주소가, 저장소에는 새 주소가 있다. 주소로 비교하던 시절에는
  // 여기서 계약서 PDF 전부가 고아로 잡혀 지워졌다.
  it('DB 주소의 저장소가 달라도 같은 경로의 PDF는 지우지 않는다', async () => {
    mockContracts = [{ id: 'a', pdfUrl: blob('oldstore', 'contracts/a.pdf').url, signToken: 't' }];
    list.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      blobs: prefix === 'contracts/' ? [blob('newstore', 'contracts/a.pdf')] : [],
    }));

    const result = await backupContracts(NOW);

    expect(result.removedOrphanPdfs).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });

  it('어느 계약도 가리키지 않는 PDF는 지운다', async () => {
    mockContracts = [{ id: 'a', pdfUrl: blob('oldstore', 'contracts/a.pdf').url, signToken: 't' }];
    const orphan = blob('newstore', 'contracts/gone.pdf');
    list.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      blobs: prefix === 'contracts/' ? [blob('newstore', 'contracts/a.pdf'), orphan] : [],
    }));

    const result = await backupContracts(NOW);

    expect(result.removedOrphanPdfs).toBe(1);
    expect(del).toHaveBeenCalledWith(orphan.url);
  });

  it('갓 올라온 PDF는 DB에 없어도 유예 동안 남긴다', async () => {
    mockContracts = [];
    list.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      blobs: prefix === 'contracts/' ? [blob('newstore', 'contracts/new.pdf', new Date(NOW.getTime() - 60 * 60 * 1000))] : [],
    }));

    expect((await backupContracts(NOW)).removedOrphanPdfs).toBe(0);
  });
});
