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

  /**
   * 이 함수가 유일한 방어선이라 테스트가 곧 규칙 문서다. 리뷰가 실제로 추적해 본
   * 입력을 그대로 넣는다 — 통과하는 것도 있지만, 전부 접두사(`funding/`) 안에 머무르므로
   * 계약서(`contracts/…`)에는 어떤 경우에도 닿지 않는다.
   */
  it('빈 문자열은 거부한다', () => {
    expect(resolveFundingBlobPath([''])).toBeNull();
  });

  it('대문자 확장자는 통과한다 — 접두사 안이라 안전하다', () => {
    // FILENAME 정규식은 대소문자를 가리지 않고, endsWith 비교만 소문자로 정규화한다.
    // 결과는 여전히 `funding/A.WEBP`로, 계약서가 있는 `contracts/`에는 닿지 않는다.
    expect(resolveFundingBlobPath(['A.WEBP'])).toBe(`${FUNDING_MEDIA_PREFIX}A.WEBP`);
  });

  it('확장자 앞에 다른 점이 더 있어도 통과한다 — 접두사 안이라 안전하다', () => {
    // "a.pdf.webp"는 파일명 문자(점 포함)만 쓰고 .webp로 끝나므로 정당한 webp 파일명이다.
    // 계약서 확장자(.pdf)를 흉내 낸 것처럼 보여도 실제로 저장되는 곳은 여전히 funding/
    // 접두사 안이라 계약서 자체를 가리키지 않는다.
    expect(resolveFundingBlobPath(['a.pdf.webp'])).toBe(`${FUNDING_MEDIA_PREFIX}a.pdf.webp`);
  });

  it('.webp로 끝나지 않으면(뒤에 다른 확장자가 더 붙어도) 거부한다', () => {
    expect(resolveFundingBlobPath(['a.webp.pdf'])).toBeNull();
  });

  it('공백이 섞인 파일명은 거부한다', () => {
    expect(resolveFundingBlobPath(['a .webp'])).toBeNull();
  });

  it('퍼센트 인코딩된 경로 탈출 시도를 거부한다', () => {
    // FILENAME 정규식이 '%'를 허용하지 않으므로 URL 디코딩 여부와 무관하게 걸린다.
    expect(resolveFundingBlobPath(['..%2Fcontracts%2Fx.pdf'])).toBeNull();
  });

  it('세그먼트 안에 슬래시를 심은 경로 탈출 시도를 거부한다', () => {
    expect(resolveFundingBlobPath(['a/../../contracts/abc.pdf'])).toBeNull();
  });
});
