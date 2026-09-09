/** @jest-environment node */
import { resolveSocialBlobPath } from './mediaPath';

/**
 * 이 판정이 느슨해지면 인증 없는 라우트가 같은 Blob 저장소의 계약서 PDF를 내보낼 수 있다.
 * 그래서 "무엇을 막는가"를 통과 사례보다 많이 적는다.
 */
describe('resolveSocialBlobPath', () => {
  it('accepts a single jpg filename and prefixes it itself', () => {
    expect(resolveSocialBlobPath(['adhoc-1a2b-XyZ.jpg'])).toBe('social/adhoc-1a2b-XyZ.jpg');
    expect(resolveSocialBlobPath('ableton1-Qq9.jpg')).toBe('social/ableton1-Qq9.jpg');
  });

  it('refuses anything that could leave the social/ prefix', () => {
    expect(resolveSocialBlobPath(['..', 'contracts', 'x.pdf'])).toBeNull();
    expect(resolveSocialBlobPath(['../contracts/x.jpg'])).toBeNull();
    expect(resolveSocialBlobPath(['contracts/x.jpg'])).toBeNull();
    expect(resolveSocialBlobPath(['a', 'b.jpg'])).toBeNull();
    expect(resolveSocialBlobPath('%2e%2e%2fcontracts%2fx.jpg')).toBeNull();
  });

  it('refuses non-jpg and empty input', () => {
    expect(resolveSocialBlobPath(['x.pdf'])).toBeNull();
    expect(resolveSocialBlobPath(['x'])).toBeNull();
    expect(resolveSocialBlobPath([])).toBeNull();
    expect(resolveSocialBlobPath(undefined)).toBeNull();
    expect(resolveSocialBlobPath([''])).toBeNull();
  });

  it('refuses dotfiles and absurdly long names', () => {
    expect(resolveSocialBlobPath(['.env.jpg'])).toBeNull();
    expect(resolveSocialBlobPath([`${'a'.repeat(200)}.jpg`])).toBeNull();
  });
});
