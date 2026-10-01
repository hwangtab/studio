import { stripMarkdown } from './textUtils';

describe('stripMarkdown', () => {
  it('이스케이프한 밑줄은 이탤릭 제거에 먹히지 않고 `_`로 남는다', () => {
    expect(stripMarkdown('파일명은 [아티스트명]\\_[곡명]\\_vocal.wav 형식')).toBe('파일명은 [아티스트명]_[곡명]_vocal.wav 형식');
  });

  it('이탤릭 표시는 여전히 벗긴다', () => {
    expect(stripMarkdown('이건 _강조_ 입니다')).toBe('이건 강조 입니다');
  });
});
