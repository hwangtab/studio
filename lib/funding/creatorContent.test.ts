import { INLINE_DIRECTIVE_NAMES } from '../inlineDirectives';
import { stripTrustedDirectives, TRUSTED_SHORTCODE_NAMES } from './creatorContent';

describe('stripTrustedDirectives', () => {
  it('블록 숏코드를 지운다', () => {
    const out = stripTrustedDirectives('앞\n\n%%studio-services%%\n\n뒤');
    expect(out).not.toContain('studio-services');
    expect(out).toContain('앞');
    expect(out).toContain('뒤');
  });

  it('인자가 붙은 인라인 디렉티브를 지운다', () => {
    expect(stripTrustedDirectives('%%price:mixing-level1%%')).not.toContain('price');
    expect(stripTrustedDirectives('%%booking:지금 예약%%')).not.toContain('booking');
  });

  it('본문 첫 줄에 있어도 지운다', () => {
    expect(stripTrustedDirectives('%%studio-more%%\n본문')).toBe('본문');
  });

  it('화이트리스트 밖 이름은 건드리지 않는다', () => {
    // 렌더러가 어차피 지우지만, 우리가 지우면 개설자가 쓴 글자가 말없이 사라진 것이 된다.
    // 남겨 두면 렌더러 단계에서 사라지므로 화면 결과는 같다.
    const src = '%%내맘대로%%';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('문장 가운데의 %%는 건드리지 않는다', () => {
    const src = '이 곡은 %%price%% 같은 농담을 담았습니다';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('코드 펜스 안도 지운다 — 렌더러가 펜스를 보지 않으므로 그것이 곧 우회다', () => {
    const out = stripTrustedDirectives('```\n%%studio-services%%\n```');
    expect(out).not.toContain('studio-services');
  });

  it('줄 앞뒤에 공백이 있으면 건드리지 않는다 — 렌더러도 그것은 안 그린다', () => {
    const src = ' %%price:mixing-level1%%';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('빈 줄을 정리하지 않는다 — 코드 블록 안의 의도한 빈 줄이 뭉개진다', () => {
    const src = '앞\n\n\n\n뒤';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('목록이 렌더러의 화이트리스트와 같다', () => {
    for (const name of INLINE_DIRECTIVE_NAMES) {
      expect(TRUSTED_SHORTCODE_NAMES).toContain(name);
    }
    expect(TRUSTED_SHORTCODE_NAMES).toContain('studio-services');
  });
});
