import { FUNDING_MEDIA_PREFIX, resolveFundingBlobPath } from './mediaPath';

describe('resolveFundingBlobPath', () => {
  it('정상 파일명을 접두사와 함께 돌려준다', () => {
    expect(resolveFundingBlobPath(['abc123.webp'])).toBe(`${FUNDING_MEDIA_PREFIX}abc123.webp`);
  });
  it('세그먼트가 하나가 아니면 거부한다', () => {
    expect(resolveFundingBlobPath(['a', 'b.webp'])).toBeNull();
    expect(resolveFundingBlobPath([])).toBeNull();
    expect(resolveFundingBlobPath(undefined)).toBeNull();
  });
  it('상위 경로 탈출을 거부한다', () => {
    expect(resolveFundingBlobPath(['../contracts/secret.pdf'])).toBeNull();
    expect(resolveFundingBlobPath(['..'])).toBeNull();
    expect(resolveFundingBlobPath(['.hidden.webp'])).toBeNull();
  });
  it('webp가 아니면 거부한다', () => {
    expect(resolveFundingBlobPath(['a.pdf'])).toBeNull();
    expect(resolveFundingBlobPath(['a.jpg'])).toBeNull();
    expect(resolveFundingBlobPath(['a'])).toBeNull();
  });
  it('이름이 길면 거부한다', () => {
    expect(resolveFundingBlobPath([`${'a'.repeat(200)}.webp`])).toBeNull();
  });
});
