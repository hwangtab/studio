import { buildCreatorLoginText } from './creatorEmail';

describe('buildCreatorLoginText', () => {
  const text = buildCreatorLoginText('https://studionol.co.kr/ko/funding/creator/auth?token=abc');

  it('링크를 그대로 싣는다', () => {
    expect(text).toContain('https://studionol.co.kr/ko/funding/creator/auth?token=abc');
  });

  it('수명과 1회용이라는 사실을 알린다', () => {
    expect(text).toContain('15분');
  });

  it('요청하지 않았을 때 무엇을 하면 되는지 적는다', () => {
    expect(text).toContain('요청하지 않으셨다면');
  });
});
