import { revalidateFundingPaths } from './revalidate';

describe('revalidateFundingPaths', () => {
  it('목록과 상세 둘 다 재검증한다', async () => {
    const revalidate = jest.fn().mockResolvedValue(undefined);
    await revalidateFundingPaths({ revalidate }, 'my-album');
    expect(revalidate).toHaveBeenCalledWith('/ko/funding');
    expect(revalidate).toHaveBeenCalledWith('/ko/funding/my-album');
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it('하나가 실패해도 나머지를 시도하고 사유를 돌려준다', async () => {
    const revalidate = jest.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const reason = await revalidateFundingPaths({ revalidate }, 'my-album');
    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(reason).toMatch(/\/ko\/funding/);
  });

  it('전부 성공하면 null', async () => {
    const revalidate = jest.fn().mockResolvedValue(undefined);
    expect(await revalidateFundingPaths({ revalidate }, 'my-album')).toBeNull();
  });
});
