/** @jest-environment node */
const list = jest.fn();
const del = jest.fn();
jest.mock('@vercel/blob', () => ({
  list: (...args: unknown[]) => list(...args),
  del: (...args: unknown[]) => del(...args),
}));

const all = jest.fn();
jest.mock('../../db/client', () => ({ getDb: () => ({ all }) }));

// eslint-disable-next-line import/first
import { purgeOrphanFundingMedia } from './mediaRetention';

const NOW = new Date('2026-09-26T00:00:00Z');
const OLD = '2026-09-01T00:00:00Z';
const RECENT = '2026-09-25T00:00:00Z';

const blob = (pathname: string, uploadedAt: string) => ({
  pathname,
  uploadedAt,
  url: `https://blob.example/${pathname}`,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  all.mockResolvedValue([]);
  del.mockResolvedValue(undefined);
  list.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined });
});

afterEach(() => jest.restoreAllMocks());

it('참조가 없고 7일이 지난 파일을 지운다', async () => {
  list.mockResolvedValue({ blobs: [blob('funding/a.webp', OLD)], hasMore: false });
  const result = await purgeOrphanFundingMedia(NOW);
  expect(del).toHaveBeenCalledWith('https://blob.example/funding/a.webp');
  expect(result).toEqual({ scanned: 1, deleted: 1, skippedRecent: 0, failed: 0 });
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'funding/' }));
});

it('반려 프로젝트가 참조하는 파일도 남긴다 — 표지·본문·리워드 어디든', async () => {
  all.mockResolvedValue([
    { text: '/api/funding/media/cover.webp?w=1200&h=675' },
    { text: '본문 <img src="/api/funding/media/body.webp?w=800&h=600" />' },
    { text: '/api/funding/media/reward.webp' },
    { text: null },
  ]);
  list.mockResolvedValue({
    blobs: ['cover', 'body', 'reward', 'orphan'].map((n) => blob(`funding/${n}.webp`, OLD)),
    hasMore: false,
  });
  const result = await purgeOrphanFundingMedia(NOW);
  expect(del).toHaveBeenCalledTimes(1);
  expect(del).toHaveBeenCalledWith('https://blob.example/funding/orphan.webp');
  expect(result).toEqual({ scanned: 4, deleted: 1, skippedRecent: 0, failed: 0 });
});

it('참조가 대문자로 적혀 있어도 같은 파일로 본다', async () => {
  all.mockResolvedValue([{ text: '/api/funding/media/A.WEBP' }]);
  list.mockResolvedValue({ blobs: [blob('funding/a.webp', OLD)], hasMore: false });
  const result = await purgeOrphanFundingMedia(NOW);
  expect(del).not.toHaveBeenCalled();
  expect(result.deleted).toBe(0);
});

it('7일이 지나지 않은 파일은 건너뛴다', async () => {
  list.mockResolvedValue({ blobs: [blob('funding/new.webp', RECENT)], hasMore: false });
  const result = await purgeOrphanFundingMedia(NOW);
  expect(del).not.toHaveBeenCalled();
  expect(result).toEqual({ scanned: 1, deleted: 0, skippedRecent: 1, failed: 0 });
});

it('접두사 밖 파일이 섞여 와도 지우지 않는다 — 같은 저장소에 계약서 PDF가 있다', async () => {
  list.mockResolvedValue({
    blobs: [blob('contracts/2026-secret.pdf', OLD), blob('funding/a.webp', OLD)],
    hasMore: false,
  });
  const result = await purgeOrphanFundingMedia(NOW);
  expect(del).toHaveBeenCalledTimes(1);
  expect(del).toHaveBeenCalledWith('https://blob.example/funding/a.webp');
  expect(result.scanned).toBe(1);
});

it('삭제가 실패해도 다음 파일로 넘어간다', async () => {
  list.mockResolvedValue({
    blobs: [blob('funding/a.webp', OLD), blob('funding/b.webp', OLD)],
    hasMore: false,
  });
  del.mockRejectedValueOnce(new Error('blob down'));
  const result = await purgeOrphanFundingMedia(NOW);
  expect(del).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ scanned: 2, deleted: 1, skippedRecent: 0, failed: 1 });
});

it('페이지네이션을 끝까지 따라간다', async () => {
  list
    .mockResolvedValueOnce({ blobs: [blob('funding/a.webp', OLD)], hasMore: true, cursor: 'c1' })
    .mockResolvedValueOnce({ blobs: [blob('funding/b.webp', OLD)], hasMore: false, cursor: undefined });
  const result = await purgeOrphanFundingMedia(NOW);
  expect(list).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'c1' }));
  expect(result.deleted).toBe(2);
});
