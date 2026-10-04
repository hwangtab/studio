import { createHash } from 'node:crypto';

import { consumeRateLimit } from '../booking/rate-limit';

/**
 * 계좌 입금 **안내 메일** 발송 상한 — 신청은 막지 않고 메일만 줄인다.
 *
 * 계좌 입금 신청은 입력한 주소로 곧바로 안내 메일을 보낸다. 신청 수에는 상한을 두지 않기로 했으므로
 * (운영자 결정 2026-10-04 — 좌석·시간대 점유를 막지 않는다), 남의 주소를 적어 신청을 되풀이하면 그
 * 사람에게 메일을 퍼부을 수 있다. 그래서 같은 주소로 가는 안내 메일만 시간당 몇 통으로 자른다.
 * 계좌는 신청 직후 화면에도 나오므로 정상 신청자는 메일이 빠져도 입금할 수 있다.
 *
 * 관리자 "입금 안내 재발송"은 이 상한을 타지 않는다(운영자가 판단해 보내는 것이다).
 * 키는 정규화한 주소의 해시다 — 대소문자·`+태그`·gmail 점 별칭은 같은 받은편지함으로 간다.
 */
export const DEPOSIT_GUIDE_MAILS_PER_ADDRESS_PER_HOUR = 3;

export const normalizeMailbox = (email: string): string => {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 0) return lower;
  let local = lower.slice(0, at).split('+')[0];
  const domain = lower.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.replace(/\./g, '');
  return `${local}@${domain === 'googlemail.com' ? 'gmail.com' : domain}`;
};

export const allowCustomerDepositGuideMail = (email: string): Promise<boolean> =>
  consumeRateLimit(
    `deposit_guide_mail:${createHash('sha256').update(normalizeMailbox(email)).digest('hex').slice(0, 24)}`,
    DEPOSIT_GUIDE_MAILS_PER_ADDRESS_PER_HOUR,
    3600,
  );
