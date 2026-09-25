import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

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

/**
 * 운영자가 개설자 계정(이름·이메일)을 고쳤을 때의 알림 — `creatorAccountDecision.ts`.
 *
 * 로그인 메일과 같은 파일에 두는 이유: 둘 다 **프로젝트가 아니라 계정**에 대한 메일이라
 * 수신자가 `fundingCreators.email`이고, 프로젝트 정보(`AdminProjectDetail`)를 전혀 쓰지
 * 않는다. 심사·공개 상태 메일(`reviewEmail.ts`)은 그 반대다.
 *
 * 본문에 **사유를 반드시 싣는다.** 사유는 어느 컬럼에도 저장하지 않으므로(계정 변경
 * 기록용 컬럼이 없다) 개설자가 "왜 바뀌었는지"를 아는 경로가 이 메일과 서버 로그뿐이다.
 */
const accountNoticeText = (lines: string[]): string =>
  [...lines, '', `이 변경을 요청하지 않으셨다면 바로 알려 주세요: ${CUSTOMER_REPLY_TO}`].join('\n');

export const buildCreatorNameChangedText = (
  previousName: string,
  nextName: string,
  reason: string,
): string =>
  accountNoticeText([
    '운영자가 개설자 이름을 고쳤습니다.',
    '',
    `이전 이름: ${previousName}`,
    `새 이름: ${nextName}`,
    `사유: ${reason}`,
    '',
    '이 이름은 승인된 프로젝트 페이지에 개설자 이름으로 표시됩니다.',
  ]);

export const sendCreatorNameChangedEmail = async (
  email: string,
  previousName: string,
  nextName: string,
  reason: string,
): Promise<string | null> => {
  const result = await sendEmail({
    to: email,
    replyTo: CUSTOMER_REPLY_TO,
    subject: '[스튜디오 놀] 개설자 이름이 변경되었습니다',
    text: buildCreatorNameChangedText(previousName, nextName, reason),
  });
  return result.ok ? null : `creator:${result.errorCode}`;
};

/**
 * 이메일 변경 알림. **옛 주소 쪽이 더 중요하다** — 이 변경이 계정 탈취라면 그 사실을 알 수
 * 있는 사람은 옛 주소의 주인뿐이다. 그래서 새 주소와 옛 주소 양쪽에 보내고, 둘 중 하나라도
 * 실패하면 그 사실을 호출부에 돌려준다(호출부가 운영자에게 폴백 알림을 보낸다).
 */
export const buildCreatorEmailChangedText = (
  previousEmail: string,
  nextEmail: string,
  reason: string,
): string =>
  accountNoticeText([
    '운영자가 개설자 계정의 로그인 이메일을 바꿨습니다.',
    '',
    `이전 주소: ${previousEmail}`,
    `새 주소: ${nextEmail}`,
    `사유: ${reason}`,
    '',
    '이제부터 로그인 링크는 새 주소로만 발송됩니다. 이전 주소로 보내 둔 로그인 링크와 기존 로그인 상태가 모두 무효가 됐습니다.',
  ]);

export const sendCreatorEmailChangedEmails = async (
  previousEmail: string,
  nextEmail: string,
  reason: string,
): Promise<string | null> => {
  const text = buildCreatorEmailChangedText(previousEmail, nextEmail, reason);
  const subject = '[스튜디오 놀] 개설자 로그인 이메일이 변경되었습니다';
  const failures: string[] = [];
  for (const [key, to] of [
    ['previous', previousEmail],
    ['next', nextEmail],
  ] as const) {
    const result = await sendEmail({ to, replyTo: CUSTOMER_REPLY_TO, subject, text });
    if (!result.ok) failures.push(`creator:${key}:${result.errorCode}`);
  }
  return failures.length > 0 ? failures.join(', ') : null;
};

/**
 * 개설자 알림이 실패했을 때의 운영자 폴백 — `reviewEmail.ts`의 두 폴백과 같은 이유다:
 * 실패 사실이 이번 HTTP 응답의 warnings에만 남으면 운영자가 새로고침하는 순간 사라진다.
 * 이메일 변경에서는 특히 옛 주소 쪽 알림이 실패한 것을 운영자가 알아야 한다 — 탈취라면
 * 그 사람만 이상을 감지할 수 있다.
 */
export const sendCreatorAccountOperatorFallback = async (
  what: '이름' | '로그인 이메일',
  creatorEmail: string,
  previousValue: string,
  nextValue: string,
  reason: string,
  failureReason: string,
): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[펀딩] 개설자 계정 변경 알림 메일 실패 — ${what}`,
    text: [
      `개설자에게 계정 ${what} 변경 메일을 보내지 못했습니다. 직접 연락해 주세요.`,
      '',
      // 수신 주소를 따로 받는다 — 이름 변경이면 이전 값·새 값이 둘 다 이름이라
      // 본문 어디에도 연락할 주소가 안 나온다. "직접 연락해 주세요"라고 쓰면서
      // 주소를 빠뜨리면 이 메일이 할 일을 못 한다.
      `대상 개설자: ${creatorEmail}`,
      `이전 값: ${previousValue}`,
      `새 값: ${nextValue}`,
      `사유: ${reason}`,
      `실패 사유: ${failureReason}`,
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};
