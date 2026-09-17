import { normalizeFundingSlug, RESERVED_FUNDING_SLUGS, slugRejectionReason } from './reservedSlugs';

describe('normalizeFundingSlug', () => {
  it('앞뒤 공백을 떼고 소문자로 만든다', () => {
    expect(normalizeFundingSlug('  My-Album  ')).toBe('my-album');
  });
  it('허용 문자가 아니면 null', () => {
    expect(normalizeFundingSlug('내 앨범')).toBeNull();
    expect(normalizeFundingSlug('my_album')).toBeNull();
    expect(normalizeFundingSlug('my album')).toBeNull();
  });
  it('하이픈으로 시작하거나 끝나면 null', () => {
    expect(normalizeFundingSlug('-a')).toBeNull();
    expect(normalizeFundingSlug('a-')).toBeNull();
  });
  it('길이 범위를 벗어나면 null', () => {
    expect(normalizeFundingSlug('ab')).toBeNull();
    expect(normalizeFundingSlug('a'.repeat(81))).toBeNull();
    expect(normalizeFundingSlug('abc')).toBe('abc');
  });
});

describe('slugRejectionReason', () => {
  it('리터럴 라우트와 겹치면 사유를 돌려준다', () => {
    for (const reserved of ['apply', 'creator', 'terms', 'success', 'fail', 'manage', 'pledge']) {
      expect(RESERVED_FUNDING_SLUGS.has(reserved)).toBe(true);
      expect(slugRejectionReason(reserved)).toMatch(/사용할 수 없/);
    }
  });
  it('형식이 틀리면 사유를 돌려준다', () => {
    expect(slugRejectionReason('내 앨범')).toMatch(/영문 소문자/);
  });
  it('통과하면 null', () => {
    expect(slugRejectionReason('my-second-album')).toBeNull();
  });
});
