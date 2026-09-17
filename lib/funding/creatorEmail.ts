import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO } from '../operatorContact';

export const buildCreatorLoginText = (loginUrl: string): string => [
  '펀딩 개설 페이지로 들어가는 링크입니다.',
  '',
  loginUrl,
  '',
  '· 이 링크는 15분 동안, 한 번만 쓸 수 있습니다.',
  '· 요청하지 않으셨다면 이 메일을 지우셔도 됩니다. 링크를 누르지 않으면 아무 일도 일어나지 않습니다.',
  '',
  `문의: ${CUSTOMER_REPLY_TO}`,
].join('\n');

export const sendCreatorLoginEmail = async (email: string, loginUrl: string): Promise<string | null> => {
  const result = await sendEmail({
    to: email,
    replyTo: CUSTOMER_REPLY_TO,
    subject: '[스튜디오 놀] 펀딩 개설 로그인 링크',
    text: buildCreatorLoginText(loginUrl),
  });
  // SendEmailResult는 { ok, status?, errorCode?, errorDetail? }다(lib/email/resend.ts:27).
  return result.ok ? null : (result.errorDetail ?? result.errorCode ?? '메일 발송 실패');
};
