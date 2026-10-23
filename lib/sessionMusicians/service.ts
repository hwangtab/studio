import { FUNDING_TERMS_VERSION } from '../funding/policy';
import { mailMayHaveBeenSent, manageLinkUrl, sendOperatorNewRegistrationEmail, sendRegistrationMail } from './email';
import { openSessionPrivate, sealSessionPrivate, type SessionMusicianPrivate } from './privateData';
import {
  confirmByManageTokenHash,
  deleteByManageTokenHash,
  findByManageTokenHash,
  findIdByEmailHash,
  insertSessionMusician,
  getManageTokenHash,
  swapManageTokenHash,
  toProfile,
  updateByManageTokenHash,
  type SessionMusicianProfile,
} from './repository';
import { generateManageToken, hashManageToken, hashSessionEmail, isWellFormedManageToken } from './tokens';
import { validateSessionRegistration, type SessionRegistrationInput, type SessionValidationResult } from './validate';
import { isUniqueConstraintError } from '../dbErrors';

/**
 * 세션 연주자 등록의 흐름 — 공개 API(`/api/session-musicians`, `/manage`)가 얇게 부른다.
 * 검증은 `validate.ts`(순수), 저장은 `repository.ts`, 메일은 `email.ts`.
 */

export type SubmitOutcome = { kind: 'created' | 'duplicate'; id: string };
type ResendOutcome = SubmitOutcome | { kind: 'vanished'; id: string };

/**
 * 등록을 받는다.
 *
 * **같은 이메일(`email_hash`)이 이미 있으면 새 행을 만들지 않는다.** 대신 관리 링크를 새로 만들어(원문을 저장하지 않으므로
 * 옛 링크를 다시 보낼 수 없다) 그 주소로 "이미 등록돼 있어요" 메일을 보낸다. 호출부는 새 등록과 **같은 응답**을 준다 —
 * 이메일 존재 여부를 화면으로 알려 주지 않는다. 남이 내 주소를 적어 링크를 갈아 끼우는 장난은 이메일 하루 2건 제한이 좁히고,
 * 내 메일함에 새 링크가 오므로 잃는 건 없다.
 *
 * 동시에 같은 주소가 두 번 들어오면 UNIQUE 인덱스가 뒤의 INSERT를 막고, 그 요청은 중복 경로로 돌아간다.
 */
export const submitRegistration = async (input: SessionRegistrationInput): Promise<SubmitOutcome> => {
  const emailHash = hashSessionEmail(input.email);

  const existing = await findIdByEmailHash(emailHash);
  if (existing) {
    const resent = await resendManageLink(existing, input.email);
    // 읽은 뒤 그 등록이 지워졌으면(본인 삭제·운영자 삭제와 겹침) 새 등록으로 받는다 — "받았어요"라고 답하고 아무것도
    // 남기지 않으면 안 된다(2026-10-23 리뷰).
    if (resent.kind !== 'vanished') return resent;
  }

  const token = generateManageToken();
  let id: string;
  try {
    id = await insertSessionMusician({
      input,
      privateEnc: sealSessionPrivate({
        realName: input.realName,
        phone: input.phone,
        email: input.email,
        ...(input.kakaoId ? { kakaoId: input.kakaoId } : {}),
      }),
      emailHash,
      manageTokenHash: hashManageToken(token),
      consentVersion: FUNDING_TERMS_VERSION,
    });
  } catch (error: unknown) {
    if (!isUniqueConstraintError(error, 'session_musicians.email_hash')) throw error;
    const raced = await findIdByEmailHash(emailHash);
    if (!raced) throw error;
    const resent = await resendManageLink(raced, input.email);
    if (resent.kind === 'vanished') throw error;
    return resent;
  }

  // 메일 실패는 접수를 되돌리지 않는다 — 로그만 남긴다(운영자 알림 실패는 email.ts가 경보한다).
  const mailError = await sendRegistrationMail('received', input.email, input.stageName, manageLinkUrl(token));
  if (mailError) console.error(`[session-musicians] 접수 확인 메일 실패 (id=${id}):`, mailError);
  await sendOperatorNewRegistrationEmail({
    id,
    stageName: input.stageName,
    primaryInstrument: input.primaryInstrument,
    region: input.region,
    sampleLinkCount: input.sampleLinks.length,
  }).catch((error: unknown) => console.error('[session-musicians] 운영자 알림 처리 실패', error));
  return { kind: 'created', id };
};

/**
 * 새 관리 링크를 만들어 보낸다. **메일이 실패하면 옛 토큰으로 되돌린다** — 안 그러면 본인이 가진 링크는 끊기고 새 링크는
 * 도착하지 않아 수정·삭제할 길이 사라진다(재확인 메일 `retention.ts`와 같은 처리).
 */
const resendManageLink = async (
  existing: { id: string; stageName: string; manageTokenHash: string },
  email: string,
): Promise<ResendOutcome> => {
  const { id } = existing;
  const token = generateManageToken();
  const newHash = hashManageToken(token);
  // 지금 값을 읽고 그 값일 때만 바꾼다 — 동시 재발송·재확인 메일과 겹치면 다시 읽어 시도한다.
  let previous = existing.manageTokenHash;
  let swapped = false;
  for (let attempt = 0; attempt < 3 && !swapped; attempt += 1) {
    if (attempt > 0) {
      const current = await getManageTokenHash(id);
      if (current === null) return { kind: 'vanished', id }; // 그 사이 본인·운영자가 지웠다 — 호출부가 새로 등록한다
      previous = current;
    }
    swapped = await swapManageTokenHash(id, previous, newHash);
  }
  if (!swapped) {
    console.error(`[session-musicians] 관리 링크 재발송 — 토큰을 바꾸지 못해 건너뜀 (id=${id})`);
    return { kind: 'duplicate', id };
  }
  const mailError = await sendRegistrationMail('already', email, existing.stageName, manageLinkUrl(token));
  if (mailError && mailMayHaveBeenSent(mailError)) {
    console.error(`[session-musicians] 관리 링크 재발송 메일 응답 지연 (id=${id}) — 도착했을 수 있어 새 링크를 그대로 둡니다`);
  } else if (mailError) {
    console.error(`[session-musicians] 관리 링크 재발송 메일 실패 (id=${id}) — 바로 전 링크로 되돌립니다:`, mailError);
    await swapManageTokenHash(id, newHash, previous);
  }
  return { kind: 'duplicate', id };
};

// ---- 본인 관리 (관리 링크) ----

export interface ManageView extends Omit<SessionMusicianProfile, 'status' | 'operatorMemo' | 'id'> {
  /** 본인 정보라 복호화해 돌려준다 — 관리 링크를 가진 사람(=본인)에게만. */
  private: SessionMusicianPrivate;
}

export type ManageLookup =
  | { ok: true; view: ManageView; tokenHash: string }
  | { ok: false; reason: 'bad_token' | 'not_found' };

export const lookupByToken = async (token: unknown): Promise<ManageLookup> => {
  if (!isWellFormedManageToken(token)) return { ok: false, reason: 'bad_token' };
  const tokenHash = hashManageToken(token);
  const row = await findByManageTokenHash(tokenHash);
  if (!row) return { ok: false, reason: 'not_found' };
  const { status: _status, operatorMemo: _memo, id: _id, ...profile } = toProfile(row);
  return { ok: true, tokenHash, view: { ...profile, private: openSessionPrivate(row.privateEnc) } };
};

export type UpdateOutcome =
  | { ok: true }
  | { ok: false; reason: 'bad_token' | 'not_found' }
  | { ok: false; reason: 'invalid'; validation: Extract<SessionValidationResult, { ok: false }> };

export const updateByToken = async (token: unknown, body: unknown): Promise<UpdateOutcome> => {
  const found = await lookupByToken(token);
  if (!found.ok) return found;
  const validation = validateSessionRegistration(body, { existingEmail: found.view.private.email });
  if (!validation.ok) return { ok: false, reason: 'invalid', validation };
  const input = validation.value;
  const updated = await updateByManageTokenHash(
    found.tokenHash,
    input,
    sealSessionPrivate({
      realName: input.realName,
      phone: input.phone,
      email: found.view.private.email,
      ...(input.kakaoId ? { kakaoId: input.kakaoId } : {}),
    }),
  );
  return updated ? { ok: true } : { ok: false, reason: 'not_found' };
};

export const confirmByToken = async (token: unknown): Promise<{ ok: boolean }> => {
  if (!isWellFormedManageToken(token)) return { ok: false };
  return { ok: await confirmByManageTokenHash(hashManageToken(token)) };
};

export const deleteByToken = async (token: unknown): Promise<{ ok: boolean }> => {
  if (!isWellFormedManageToken(token)) return { ok: false };
  return { ok: await deleteByManageTokenHash(hashManageToken(token)) };
};
