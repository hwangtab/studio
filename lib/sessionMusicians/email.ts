import { instrumentLabel } from '../../data/sessionMusicians';
import { adminUrl, buildEmailLayout, escapeHtml, SITE_URL } from '../email/layout';
import { buildOperatorAlertHtml } from '../email/operatorAlert';
import { sendEmail } from '../email/resend';
import { consumeRateLimit } from '../booking/rate-limit';
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL } from '../operatorContact';

/**
 * 세션 연주자 등록의 메일 셋 — 접수 확인(관리 링크), 이미 등록돼 있다는 안내(관리 링크 재발송), 보유 기간 재확인.
 * 운영자 알림은 별도(`sendOperatorNewRegistrationEmail`).
 *
 * **남의 주소로도 갈 수 있다.** 누구나 아무 이메일이나 적을 수 있으므로 고객 메일에는 사용자가 적은 자유 서술을
 * 싣지 않는다(활동명만). 그 활동명도 `escapeHtml`로 감싼다. 본인이 아니면 관리 링크로 지워 달라는 안내를 둔다.
 * 광고성 문구·혜택은 넣지 않는다 — 등록 사실에 대한 거래·관리 안내다.
 */

export const manageLinkUrl = (token: string): string => `${SITE_URL}/ko/session-musicians/manage/${encodeURIComponent(token)}`;

const NOT_YOU_NOTICE = '본인이 등록하신 게 아니라면 위 링크에서 <strong>삭제</strong>해 주세요. 삭제하면 등록 정보가 바로 지워져요.';
const LINK_NOTICE =
  '이 링크를 아는 사람은 누구나 등록 정보를 고치거나 지울 수 있어요. 다른 사람에게 전달하지 마세요. 링크를 다시 받으면 이전 링크는 쓸 수 없어요.';

export type RegistrationMailKind = 'received' | 'already';

export const buildRegistrationMail = (kind: RegistrationMailKind, stageName: string, manageUrl: string) => {
  const received = kind === 'received';
  const subject = received ? '[스튜디오 놀] 세션 연주자 등록을 받았어요' : '[스튜디오 놀] 이미 등록돼 있어요 — 관리 링크를 보내드려요';
  const lead = received
    ? `세션 연주자 등록을 받았어요. 등록명은 “${stageName}”이에요.`
    : `이 이메일 주소로 이미 세션 연주자 등록이 돼 있어요. 등록명은 “${stageName}”이에요. 등록 정보를 고치거나 지우는 관리 링크를 새로 보내드려요.`;
  const extra = received
    ? '등록이 섭외를 약속하는 건 아니에요. 맞는 프로젝트가 생기면 스튜디오 놀이 먼저 연락드려요.'
    : '새로 등록하신 게 아니니 같은 내용이 중복으로 쌓이지 않아요.';
  const text = [
    lead,
    extra,
    '',
    `등록 정보를 고치거나 지우는 링크: ${manageUrl}`,
    '',
    '· 이 링크를 아는 사람은 누구나 등록 정보를 고치거나 지울 수 있어요. 다른 사람에게 전달하지 마세요. 링크를 다시 받으면 이전 링크는 쓸 수 없어요.',
    '· 본인이 등록하신 게 아니라면 위 링크에서 삭제해 주세요. 삭제하면 등록 정보가 바로 지워져요.',
    '',
    `문의: ${CUSTOMER_REPLY_TO}`,
  ].join('\n');
  const html = buildEmailLayout({
    preheader: received ? '세션 연주자 등록을 받았어요.' : '이미 등록돼 있어요. 관리 링크를 새로 보내드려요.',
    heading: received ? '세션 연주자 등록을 받았어요' : '이미 등록돼 있어요',
    paragraphs: [escapeHtml(lead), escapeHtml(extra)],
    cta: { label: '등록 정보 보기·고치기·삭제', url: manageUrl },
    notices: [escapeHtml(LINK_NOTICE), NOT_YOU_NOTICE, `문의: ${escapeHtml(CUSTOMER_REPLY_TO)}`],
  });
  return { subject, text, html };
};

export const buildReconfirmMail = (stageName: string, manageUrl: string) => {
  const subject = '[스튜디오 놀] 아직 세션 연주 하세요?';
  const lead = `“${stageName}”으로 등록하신 세션 연주자 정보를 보관한 지 거의 2년이 돼 가요. 아직 세션 연주를 하고 계신지 알려 주세요.`;
  const extra =
    '아래 링크에서 “계속 활동 중이에요” 버튼을 한 번 누르시면 보관 기간이 그날부터 다시 2년으로 이어져요. 확인하지 않으시면 보관 기간 2년이 지난 뒤 등록 정보를 지워요. 지금 바로 지우고 싶으시면 같은 링크에서 삭제하실 수 있어요.';
  const text = [lead, extra, '', `확인·수정·삭제 링크: ${manageUrl}`, '', `· ${LINK_NOTICE}`, '', `문의: ${CUSTOMER_REPLY_TO}`].join('\n');
  const html = buildEmailLayout({
    preheader: '보관 기간이 곧 끝나요. 계속 활동 중인지 알려 주세요.',
    heading: '아직 세션 연주 하세요?',
    paragraphs: [escapeHtml(lead), escapeHtml(extra)],
    cta: { label: '확인하러 가기', url: manageUrl },
    notices: [escapeHtml(LINK_NOTICE), `문의: ${escapeHtml(CUSTOMER_REPLY_TO)}`],
  });
  return { subject, text, html };
};

const resultError = (result: Awaited<ReturnType<typeof sendEmail>>): string | null =>
  result.ok ? null : (result.errorDetail ?? result.errorCode ?? '메일 발송 실패');

/**
 * 응답이 늦어 끊긴 발송(`TIMEOUT`)은 실패가 아니라 "갔을 수도 있음"이다 — Resend가 받아 놓고 늦게 답했을 수 있다.
 * 관리 링크를 바꾼 뒤 이 경우에 옛 링크로 되돌리면 도착한 메일의 새 링크가 죽는다. 되돌리기는 확실히 안 간 실패에만 한다.
 */
export const mailMayHaveBeenSent = (error: string | null): boolean => error === 'TIMEOUT';

/** 보내지 못하면 오류 문구를, 보냈으면 null을 돌려준다(접수를 되돌리지 않으려고 던지지 않는다). */
export const sendRegistrationMail = async (
  kind: RegistrationMailKind,
  to: string,
  stageName: string,
  manageUrl: string,
): Promise<string | null> => {
  const mail = buildRegistrationMail(kind, stageName, manageUrl);
  return resultError(await sendEmail({ to, replyTo: CUSTOMER_REPLY_TO, ...mail }));
};

export const sendReconfirmMail = async (to: string, stageName: string, manageUrl: string): Promise<string | null> => {
  const mail = buildReconfirmMail(stageName, manageUrl);
  return resultError(await sendEmail({ to, replyTo: CUSTOMER_REPLY_TO, ...mail }));
};

export interface OperatorNoticeInput {
  id: string;
  stageName: string;
  primaryInstrument: string;
  region: string | null;
  sampleLinkCount: number;
}

/** 운영자 알림 — **연락처는 싣지 않는다**(메일함은 접속기록이 없다). 관리자 상세로 가는 버튼만. */
export const buildOperatorNewRegistrationMail = (input: OperatorNoticeInput) => {
  const subject = `[Studio NOL] 새 세션 연주자 등록 — ${input.stageName}`;
  const detailUrl = adminUrl(`/admin/session-musicians/${input.id}`);
  const text = [
    `새 세션 연주자 등록이 들어왔습니다.`,
    `활동명: ${input.stageName}`,
    `주 악기: ${instrumentLabel(input.primaryInstrument)}`,
    `지역: ${input.region ?? '미입력'}`,
    `샘플 링크: ${input.sampleLinkCount}개`,
    '',
    `관리자에서 보기: ${detailUrl}`,
  ].join('\n');
  const html = buildEmailLayout({
    audience: 'operator',
    preheader: `${input.stageName} · ${instrumentLabel(input.primaryInstrument)}`,
    heading: '새 세션 연주자 등록',
    rows: [
      { label: '활동명', value: input.stageName },
      { label: '주 악기', value: instrumentLabel(input.primaryInstrument) },
      { label: '지역', value: input.region ?? '미입력' },
      { label: '샘플 링크', value: `${input.sampleLinkCount}개` },
    ],
    cta: { label: '관리자에서 보기', url: detailUrl },
  });
  return { subject, text, html };
};

const ALERT_DAY_SECONDS = 86_400;

/**
 * 운영자 알림 발송. 실패하면 서버 로그를 남기고, 하루 한 번만 "알림 메일이 안 나간다"는 경보를 따로 보낸다
 * (발송사 장애면 경보도 실패하겠지만 로그는 남는다). 접수는 되돌리지 않는다.
 */
export const sendOperatorNewRegistrationEmail = async (input: OperatorNoticeInput): Promise<void> => {
  const mail = buildOperatorNewRegistrationMail(input);
  const error = resultError(await sendEmail({ to: OPERATOR_EMAIL, ...mail }));
  if (!error) return;
  console.error(`[session-musicians] 운영자 알림 메일 실패 (id=${input.id}):`, error);
  if (!(await consumeRateLimit('session_musician:operator_mail_failure_alert', 1, ALERT_DAY_SECONDS))) return;
  await sendEmail({
    to: OPERATOR_EMAIL,
    subject: '[Studio NOL] 세션 연주자 등록 알림 메일 실패',
    text: `새 세션 연주자 등록(id=${input.id})의 알림 메일을 보내지 못했습니다.\n\n사유: ${error}\n\n관리자 명단에서 직접 확인해 주세요: ${adminUrl('/admin/session-musicians')}`,
    html: buildOperatorAlertHtml({
      title: '세션 연주자 등록 알림 메일이 나가지 않았습니다',
      cron: 'api/session-musicians',
      reason: error,
      hints: ['등록 자체는 저장되었습니다. 관리자 명단에서 확인해 주세요.'],
      ctaLabel: '관리자 명단 열기',
      ctaUrl: adminUrl('/admin/session-musicians'),
    }),
  }).catch(() => undefined);
};
