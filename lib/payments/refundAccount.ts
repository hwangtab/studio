import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refundAccounts, type RefundAccountOrderKind } from '../../db/schema';
import { decryptField, encryptField } from '../crypto/fieldCrypto';
import { REFUND_ACCOUNT_LIMITS } from './bankAccount';

export type { RefundAccountOrderKind };

/**
 * 계좌 입금 주문의 **환불 계좌** — 결제 공용(`refund_accounts`, 마이그레이션 0048).
 *
 * 주문은 (`order_kind`, `order_no`)로 가리킨다 — 펀딩·예약·믹싱은 `orders`, 공연은 `show_orders`에
 * 있어 FK 하나로 묶을 수 없다. 지금 쓰는 곳은 펀딩뿐이다: 후원자가 펀딩 확인 페이지에서 취소를 요청할
 * 때 적고(lib/funding/cancel.ts), 운영자가 송금하려고 "계좌 보기"를 누를 때만 복호화한다
 * (pages/api/admin/funding/pledges/[id]/refund-account.ts). 계좌번호만 암호화하고 은행명·예금주는
 * 평문이다 — 이유는 db/schema.ts의 표 주석.
 *
 * **평문 계좌번호를 로그·화면 props·메일에 넣지 않는다**(lib/crypto/CLAUDE.md). 이 모듈의 어떤
 * 오류 메시지에도 계좌번호가 들어갈 자리가 없다.
 */

export interface RefundAccountInput {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}


/**
 * 입력 검사. 형식만 본다 — 실제로 있는 계좌인지는 송금해 봐야 안다(계좌 실명 조회 API가 없다).
 * 계좌번호는 숫자·하이픈·공백만, 숫자가 8~20자리. 은행마다 자릿수와 하이픈 위치가 달라 그보다
 * 좁히면 정상 계좌를 거절한다. 저장할 때는 사람이 적은 모양(하이픈 포함)을 그대로 둔다 —
 * 송금 화면에 옮겨 적을 때 원래 모양이 읽기 쉽다.
 */
export const validateRefundAccount = (raw: unknown): { ok: true; value: RefundAccountInput } | { ok: false; message: string } => {
  const r = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const trim = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
  const bankName = trim(r.bankName);
  const accountNumber = trim(r.accountNumber);
  const accountHolder = trim(r.accountHolder);
  if (!bankName || !accountNumber || !accountHolder) {
    return { ok: false, message: '환불받을 은행·계좌번호·예금주를 모두 적어 주세요.' };
  }
  if (bankName.length > REFUND_ACCOUNT_LIMITS.bankName || accountHolder.length > REFUND_ACCOUNT_LIMITS.accountHolder) {
    return { ok: false, message: `은행과 예금주는 ${REFUND_ACCOUNT_LIMITS.bankName}자까지 적을 수 있습니다.` };
  }
  const digits = accountNumber.replace(/[^0-9]/g, '');
  if (accountNumber.length > REFUND_ACCOUNT_LIMITS.accountNumber || !/^[0-9\- ]+$/.test(accountNumber) || digits.length < 8 || digits.length > 20) {
    return { ok: false, message: '계좌번호는 숫자와 하이픈(-)으로 적어 주세요.' };
  }
  return { ok: true, value: { bankName, accountNumber, accountHolder } };
};

/** 계좌번호 → 암호문. 키가 없으면 던진다(fieldCrypto 규약) — 평문 저장 경로는 없다. */
export const encryptRefundAccountNumber = (accountNumber: string): string => encryptField(accountNumber);

/**
 * 예금주가 후원자 이름과 같은가 — **경고용이지 막지 않는다.** 가족 계좌로 받는 경우가 흔하다.
 * 공백만 무시하고 비교한다.
 */
export const holderMatchesCustomer = (holder: string, customerName: string): boolean =>
  holder.replace(/\s+/g, '') === customerName.replace(/\s+/g, '');

/**
 * DB 오류를 로그에 남길 **요지만** — 이름과 코드. 오류 객체를 통째로 찍지 않는다: drizzle의
 * `Failed query: … params: …` 메시지와 `cause`에 바인딩 값이 실려, 환불 계좌 INSERT가 실패하면
 * 계좌번호 암호문·예금주가 그대로 서버 로그에 남는다(lib/crypto/CLAUDE.md "평문·암호문을 로그에
 * 넣지 않는다"). 메시지 본문은 버리고 SQLite 코드(예: SQLITE_ERROR)만 남긴다.
 */
export const safeDbErrorSummary = (error: unknown): { name: string; code?: string } => {
  if (!(error instanceof Error)) return { name: 'unknown' };
  const pick = (e: unknown): string | undefined => {
    const c = (e as { code?: unknown } | null)?.code;
    return typeof c === 'string' ? c : undefined;
  };
  const code = pick(error) ?? pick((error as { cause?: unknown }).cause);
  return code ? { name: error.name, code } : { name: error.name };
};

/** 주문 하나를 가리키는 키. */
export interface RefundAccountKey {
  kind: RefundAccountOrderKind;
  orderNo: string;
}

const whereKey = (key: RefundAccountKey) =>
  and(eq(refundAccounts.orderKind, key.kind), eq(refundAccounts.orderNo, key.orderNo));

/**
 * 계좌를 저장한다(이미 있으면 덮어쓴다 — 마지막에 적은 계좌가 보낼 계좌다). `accountNumberEnc`는
 * 호출부가 미리 암호화해 넘긴다 — 키가 없으면 암호화 단계에서 던져 아무것도 쓰지 않게 하려는 순서다.
 * DB 오류는 던진다(호출부가 접수를 되돌린다).
 */
export const saveRefundAccount = async (
  key: RefundAccountKey,
  value: { bankName: string; accountNumberEnc: string; accountHolder: string; requestedAt: Date },
): Promise<void> => {
  const requestedAt = Math.floor(value.requestedAt.getTime() / 1000);
  await getDb().run(sql`
    INSERT INTO refund_accounts (id, order_kind, order_no, bank_name, account_number_enc, account_holder, requested_at)
    VALUES (lower(hex(randomblob(16))), ${key.kind}, ${key.orderNo}, ${value.bankName}, ${value.accountNumberEnc}, ${value.accountHolder}, ${requestedAt})
    ON CONFLICT (order_kind, order_no) DO UPDATE SET
      bank_name = excluded.bank_name, account_number_enc = excluded.account_number_enc,
      account_holder = excluded.account_holder, requested_at = excluded.requested_at,
      refunded_at = NULL, updated_at = unixepoch()`);
};

/** 운영자가 송금을 마치고 기록한 시각을 남긴다. 계좌가 없으면 아무 일도 없다. 실패는 삼키고 로그만. */
export const markRefundAccountRefunded = async (key: RefundAccountKey, at: Date): Promise<void> => {
  try {
    await getDb().update(refundAccounts).set({ refundedAt: at, updatedAt: at }).where(whereKey(key));
  } catch (error) {
    console.error('[refund-account] 송금 완료 시각 기록 실패', { kind: key.kind, orderNo: key.orderNo, error: safeDbErrorSummary(error) });
  }
};

/** 접수 여부만(복호화 없이) — 관리자 상세 SSR이 "계좌 접수됨"을 그릴 때 쓴다. 표가 없으면 unavailable. */
export const loadRefundAccountSummary = async (
  key: RefundAccountKey,
): Promise<{ status: 'present'; bankName: string; accountHolder: string; updatedAt: Date; refundedAt: Date | null } | { status: 'none' } | { status: 'unavailable' }> => {
  try {
    const row = await getDb()
      .select({
        bankName: refundAccounts.bankName, accountHolder: refundAccounts.accountHolder,
        updatedAt: refundAccounts.updatedAt, refundedAt: refundAccounts.refundedAt,
      })
      .from(refundAccounts)
      .where(whereKey(key))
      .get();
    return row ? { status: 'present', ...row } : { status: 'none' };
  } catch (error) {
    // 0048 미적용 등 — 화면은 열리고 이 칸만 "불러오지 못함"이다.
    console.error('[refund-account] 환불 계좌 요약 조회 실패', { kind: key.kind, orderNo: key.orderNo, error: safeDbErrorSummary(error) });
    return { status: 'unavailable' };
  }
};

/** 운영자 "계좌 보기" — 복호화한 값. 없으면 null. 복호화 실패는 FieldCryptoError로 던진다. */
export const loadRefundAccount = async (key: RefundAccountKey): Promise<RefundAccountInput | null> => {
  const row = await getDb().select().from(refundAccounts).where(whereKey(key)).get();
  if (!row) return null;
  return { bankName: row.bankName, accountNumber: decryptField(row.accountNumberEnc), accountHolder: row.accountHolder };
};

/** 더 쓸 데가 없어진 계좌를 지운다(운영자가 환불 요청을 철회 처리한 때). 실패는 삼키고 로그만. */
export const deleteRefundAccount = async (key: RefundAccountKey): Promise<void> => {
  try {
    await getDb().delete(refundAccounts).where(whereKey(key));
  } catch (error) {
    console.error('[refund-account] 환불 계좌 삭제 실패 — 5년 파기 때 함께 지워진다', { kind: key.kind, orderNo: key.orderNo, error: safeDbErrorSummary(error) });
  }
};
