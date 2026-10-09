import { PLEDGE_TEXT_LIMITS } from './policy';

/**
 * 택배사·운송장 입력 검증 — setFulfillment 한 곳이 호출하므로 관리자·개설자 경로가 같은 규칙을 지난다.
 *
 * 해외 운송장 형태를 알 수 없어 문자 종류는 제한하지 않는다. **제어문자 거부 + 길이 상한**만 둔다
 * (CSV·메일·화면에 그대로 실리는 값이라 개행·제어문자가 들어오면 칸이 깨진다). 앞뒤 공백은
 * 길이를 세기 전에 걷는다. 상한을 넘으면 자르지 않고 거부한다(validation.ts overLimitMessage와 같은 판단).
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

const FIELDS = [
  { key: 'trackingCompany', max: PLEDGE_TEXT_LIMITS.trackingCompany, label: '택배사는' },
  { key: 'trackingNumber', max: PLEDGE_TEXT_LIMITS.trackingNumber, label: '운송장 번호는' },
] as const;

export const validateTrackingInput = (input: {
  trackingCompany?: string | null;
  trackingNumber?: string | null;
}): { ok: true } | { ok: false; message: string } => {
  for (const { key, max, label } of FIELDS) {
    const v = input[key];
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (CONTROL_CHARS.test(t)) return { ok: false, message: `${label} 줄바꿈·제어 문자를 넣을 수 없어요.` };
    if (t.length > max) return { ok: false, message: `${label} ${max}자까지 입력할 수 있어요.` };
  }
  return { ok: true };
};
