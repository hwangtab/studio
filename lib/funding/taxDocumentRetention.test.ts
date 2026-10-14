/** @jest-environment node */
const all = jest.fn();
jest.mock('../../db/client', () => ({ getDb: () => ({ all }) }));

// eslint-disable-next-line import/first
import { purgeOrphanTaxDocuments } from './taxDocumentRetention';

const NOW = new Date('2026-09-26T00:00:00Z');
const OLD = '2026-09-01T00:00:00Z';
const RECENT = '2026-09-25T00:00:00Z';
const UUID_A = '0f8fad5b-d9cb-469f-a165-70867728950e';
const UUID_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const blob = (pathname: string, uploadedAt: string = OLD) => ({
  pathname,
  uploadedAt,
  url: `https://store.private.blob.example/${pathname}`,
});

const list = jest.fn();
const del = jest.fn();
const run = () => purgeOrphanTaxDocuments({ list, del, now: NOW });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  all.mockResolvedValue([]);
  del.mockResolvedValue(undefined);
  list.mockResolvedValue({ blobs: [], hasMore: false });
});

afterEach(() => jest.restoreAllMocks());

it('tax-docs/ 접두사만 나열하고, 참조가 없고 7일이 지난 파일을 지운다', async () => {
  list.mockResolvedValue({ blobs: [blob(`tax-docs/c1/${UUID_A}.pdf`)], hasMore: false });
  const result = await run();
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'tax-docs/' }));
  expect(del).toHaveBeenCalledWith(`https://store.private.blob.example/tax-docs/c1/${UUID_A}.pdf`);
  expect(result).toMatchObject({ deleted: 1 });
});

it('어떤 행이 참조하는 사업자등록증은 남긴다', async () => {
  all.mockResolvedValue([{ key: `tax-docs/c1/${UUID_A}.webp` }, { key: null }]);
  list.mockResolvedValue({
    blobs: [blob(`tax-docs/c1/${UUID_A}.webp`), blob(`tax-docs/c2/${UUID_B}.webp`)],
    hasMore: false,
  });
  const result = await run();
  expect(del).toHaveBeenCalledTimes(1);
  expect(del).toHaveBeenCalledWith(`https://store.private.blob.example/tax-docs/c2/${UUID_B}.webp`);
  expect(result).toMatchObject({ deleted: 1 });
});

it('7일 유예 안의 파일은 지우지 않는다 — 업로드와 행 갱신 사이', async () => {
  list.mockResolvedValue({ blobs: [blob(`tax-docs/c1/${UUID_A}.pdf`, RECENT)], hasMore: false });
  const result = await run();
  expect(del).not.toHaveBeenCalled();
  expect(result).toMatchObject({ deleted: 0, skippedRecent: 1 });
});

it('접두사가 tax-docs/가 아닌 Blob은 어떤 경우에도 지우지 않는다(계약서 PDF가 같은 저장소에 있다)', async () => {
  list.mockResolvedValue({
    blobs: [
      blob('contracts/x.pdf'),
      blob(`contracts/tax-docs/c1/${UUID_A}.pdf`),
      blob(`funding/${UUID_A}.webp`),
      blob('backups/db.json'),
    ],
    hasMore: false,
  });
  const result = await run();
  expect(del).not.toHaveBeenCalled();
  expect(result).toMatchObject({ deleted: 0 });
});

it('tax-docs/<creatorId>/<uuid>.(pdf|webp) 모양이 아닌 키는 지우지 않는다', async () => {
  list.mockResolvedValue({
    blobs: [
      blob('tax-docs/c1/not-a-uuid.pdf'),
      blob(`tax-docs/c1/${UUID_A}.png`),
      blob(`tax-docs/${UUID_A}.pdf`),
      blob(`tax-docs/c1/sub/${UUID_A}.pdf`),
      blob(`tax-docs/../contracts/${UUID_A}.pdf`),
    ],
    hasMore: false,
  });
  await run();
  expect(del).not.toHaveBeenCalled();
});

it('참조 조회가 실패하면 나열도 삭제도 하지 않고 던진다', async () => {
  all.mockRejectedValue(new Error('no such table: creator_business_profiles'));
  list.mockResolvedValue({ blobs: [blob(`tax-docs/c1/${UUID_A}.pdf`)], hasMore: false });
  await expect(run()).rejects.toThrow(/no such table/);
  expect(del).not.toHaveBeenCalled();
});

it('여러 쪽을 넘겨 가며 나열한다', async () => {
  list
    .mockResolvedValueOnce({ blobs: [blob(`tax-docs/c1/${UUID_A}.pdf`)], hasMore: true, cursor: 'next' })
    .mockResolvedValueOnce({ blobs: [blob(`tax-docs/c2/${UUID_B}.pdf`)], hasMore: false });
  const result = await run();
  expect(list).toHaveBeenNthCalledWith(2, expect.objectContaining({ prefix: 'tax-docs/', cursor: 'next' }));
  expect(result).toMatchObject({ deleted: 2 });
});

it('한 파일 삭제 실패는 세고 계속한다', async () => {
  del.mockRejectedValueOnce(new Error('blob 장애'));
  list.mockResolvedValue({
    blobs: [blob(`tax-docs/c1/${UUID_A}.pdf`), blob(`tax-docs/c2/${UUID_B}.pdf`)],
    hasMore: false,
  });
  const result = await run();
  expect(result).toMatchObject({ deleted: 1, failed: 1 });
});
