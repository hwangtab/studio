const sendEmail = jest.fn();
jest.mock('../email/resend', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

// eslint-disable-next-line import/first
import {
  buildCreatorEmailChangedText,
  buildCreatorLoginText,
  buildCreatorNameChangedText,
  sendCreatorEmailChangedEmails,
} from './creatorEmail';

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


describe('계정 변경 알림', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ ok: true });
  });

  it('이름 변경 본문에 이전 이름·새 이름·사유를 싣는다', () => {
    const text = buildCreatorNameChangedText('옛이름', '새이름', '개설자 요청');
    expect(text).toContain('옛이름');
    expect(text).toContain('새이름');
    expect(text).toContain('개설자 요청');
  });

  it('이메일 변경 본문에 두 주소와 사유, 기존 링크 무효 사실을 싣는다', () => {
    const text = buildCreatorEmailChangedText('old@example.com', 'new@example.com', '메일함 접근 상실');
    expect(text).toContain('old@example.com');
    expect(text).toContain('new@example.com');
    expect(text).toContain('메일함 접근 상실');
    expect(text).toContain('무효');
  });

  it('이메일 변경은 옛 주소와 새 주소 양쪽에 보낸다', async () => {
    const error = await sendCreatorEmailChangedEmails('old@example.com', 'new@example.com', '사유');
    expect(error).toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map((c) => (c[0] as { to: string }).to)).toEqual([
      'old@example.com',
      'new@example.com',
    ]);
  });

  it('한쪽이 실패해도 다른 쪽은 보내고, 실패 사실을 돌려준다', async () => {
    sendEmail
      .mockResolvedValueOnce({ ok: false, errorCode: 'bounced' })
      .mockResolvedValueOnce({ ok: true });
    const error = await sendCreatorEmailChangedEmails('old@example.com', 'new@example.com', '사유');
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(error).toContain('previous');
  });
});
