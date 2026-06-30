import { autoLinkKeywords } from './autoLinks';

describe('autoLinkKeywords', () => {
  it('links the first eligible topic keyword with the configured anchor text', () => {
    expect(autoLinkKeywords('보컬 믹싱을 준비할 때 기준점이 필요합니다.')).toContain(
      '[보컬 믹싱 완전 가이드](/stories/vocal-mixing1)'
    );
  });

  it('skips matches inside existing markdown links, images, and code spans', () => {
    const input = [
      '[보컬 믹싱](https://example.com)',
      '![보컬 믹싱](/images/sample.webp)',
      '`보컬 믹싱`',
      '마지막 보컬 믹싱은 링크해야 합니다.',
    ].join('\n');

    const output = autoLinkKeywords(input);

    expect(output).toContain('[보컬 믹싱](https://example.com)');
    expect(output).toContain('![보컬 믹싱](/images/sample.webp)');
    expect(output).toContain('`보컬 믹싱`');
    expect(output).toContain('마지막 [보컬 믹싱 완전 가이드](/stories/vocal-mixing1)은 링크해야 합니다.');
  });

  it('does not link to the current story slug', () => {
    expect(autoLinkKeywords('보컬 믹싱을 설명합니다.', 'vocal-mixing1')).toBe('보컬 믹싱을 설명합니다.');
  });
});
