import { cleanSupporterMessage } from './messageText';

describe('cleanSupporterMessage', () => {
  it('아래아 점(U+11A2)을 말줄임표로 바꾼다', () => {
    expect(cleanSupporterMessage('일인지ᆢ!')).toBe('일인지…!');
  });
  it('평범한 문장은 그대로 둔다', () => {
    expect(cleanSupporterMessage('힘내세요, 응원합니다.')).toBe('힘내세요, 응원합니다.');
  });
});
