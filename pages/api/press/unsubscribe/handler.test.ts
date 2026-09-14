import { renderUnsubPage } from '../../../../lib/press/page';

/**
 * 확인 화면은 기자가 보는 유일한 우리 화면이다.
 *
 * 여기서 고정하는 것은 모양이 아니라 **약속** 세 가지다.
 *   1. GET 화면은 아직 거부를 반영하지 않았다고 말한다(버튼을 눌러야 한다).
 *   2. 되돌리기 버튼을 두지 않는다 — registry에 해제 경로가 의도적으로 없는데
 *      화면에만 만들면 그 원칙이 무너진다. 회신으로 안내한다.
 *   3. 토큰이 화면 밖으로 새지 않는다(폼 안에만 있고 링크에는 없다).
 */
describe('renderUnsubPage', () => {
  it('확인 화면은 버튼을 누르라고 말하고 토큰을 폼에 담는다', () => {
    const html = renderUnsubPage('confirm', 'ko', 'TOKEN123');
    expect(html).toContain('<form');
    expect(html).toContain('method="post"');
    expect(html).toContain('TOKEN123');
    expect(html).toContain('수신거부');
  });

  it('완료 화면은 되돌리기 버튼 대신 회신을 안내한다', () => {
    const html = renderUnsubPage('done', 'ko', 'TOKEN123');
    expect(html).not.toContain('<form');
    expect(html).toContain('회신');
  });

  it('잘못된 토큰에도 상세한 오류를 말하지 않는다', () => {
    const html = renderUnsubPage('invalid', 'ko', '');
    expect(html).not.toMatch(/서명|signature|HMAC|만료/);
  });

  it('알 수 없는 로케일은 영어로 떨어진다', () => {
    const html = renderUnsubPage('confirm', 'xx', 'T');
    expect(html).toContain('lang="en"');
  });

  it('토큰을 HTML에 그대로 끼워 넣지 않는다 (따옴표 이스케이프)', () => {
    const html = renderUnsubPage('confirm', 'ko', '"><script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
