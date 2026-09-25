/**
 * 디지털 리워드 파일이 저장소에 없을 때 운영자에게 알린다.
 *
 * 후원자가 버튼을 눌렀는데 객체가 없으면 그 사람은 아무것도 할 수 없다 — 키 오타든
 * 파일 교체 중이든 고칠 수 있는 사람은 운영자뿐이고, 알리지 않으면 "내려받기가 안 된다"는
 * 문의가 올 때까지 아무도 모른다. 같은 형태의 사고 기록이 있다(#153).
 *
 * **내려받기를 막지 않는다** — 이 함수는 어떤 경우에도 throw하지 않는다. 호출부는 이미
 * 503으로 답할 참이고, 알림이 실패한다고 그 응답이 달라질 이유가 없다
 * (lib/payments/methodAlert.ts와 같은 판단).
 */
import { consumeRateLimit } from '../booking/rate-limit';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';

/**
 * 같은 키 하나에 하루 한 통. 파일이 없는 동안은 누르는 사람마다 이 경로를 지나므로,
 * 창이 없으면 메일이 쏟아지고 그러면 운영자가 다음 경보를 읽지 않게 된다
 * (methodAlert.ts의 ALERT_WINDOW_SECONDS와 같은 이유).
 */
const ALERT_WINDOW_SECONDS = 24 * 60 * 60;
const ALERT_LIMIT = 1;

export const alertMissingDownloadObject = async (input: { key: string; orderNo: string }): Promise<void> => {
  try {
    // 로그는 창과 무관하게 매번 남긴다 — "언제부터 몇 건이었나"를 되짚을 근거는 건별로 있어야 한다.
    console.error('[funding-download] 저장소에 객체가 없다', { key: input.key, orderNo: input.orderNo });
    if (!(await consumeRateLimit(`funding_download_missing:${input.key}`, ALERT_LIMIT, ALERT_WINDOW_SECONDS))) return;
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[Studio NOL] 펀딩 내려받기 파일 없음 — ${input.key}`,
      text: [
        `후원자가 내려받기를 눌렀는데 저장소에 객체가 없습니다.`,
        '',
        `키: ${input.key}`,
        `주문: ${input.orderNo}`,
        '',
        '무엇을 해야 하나:',
        '  1. R2 버킷에 그 키로 파일이 올라가 있는지 확인한다.',
        '  2. 없으면 올리고, 키가 바뀐 것이라면 content/funding/<slug>.md의 downloads를 고친다.',
        '',
        '후원자에게는 503과 안내 문구가 나갔고, downloaded_at은 남기지 않았습니다',
        '(파일을 못 받은 사람이 청약철회권까지 잃지 않게 합니다).',
        '',
        '이 메일은 같은 키에 대해 하루 한 번만 옵니다.',
      ].join('\n'),
    });
  } catch (error: unknown) {
    console.error('[funding-download] 파일 부재 알림 실패:', error);
  }
};
