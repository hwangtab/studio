import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingRefundAccounts } from '../../db/schema';
import { decryptField, encryptField } from '../crypto/fieldCrypto';
import { REFUND_ACCOUNT_LIMITS } from './bankAccount';

/**
 * 계좌 입금 후원의 **환불 계좌**(funding_refund_accounts, 마이그레이션 0048).
 *
 * 후원자가 펀딩 확인 페이지에서 취소를 요청할 때 적고(lib/funding/cancel.ts), 운영자가 송금하려고
 * "계좌 보기"를 누를 때만 복호화한다(pages/api/admin/funding/pledges/[id]/refund-account.ts).
 * 계좌번호만 암호화하고 은행명·예금주는 평문이다 — 이유는 db/schema.ts의 표 주석.
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

/** 접수 여부만(복호화 없이) — 관리자 상세 SSR이 "계좌 접수됨"을 그릴 때 쓴다. 표가 없으면 null. */
export const loadRefundAccountSummary = async (
  orderId: string,
): Promise<{ status: 'present'; bankName: string; accountHolder: string; updatedAt: Date } | { status: 'none' } | { status: 'unavailable' }> => {
  try {
    const row = await getDb()
      .select({ bankName: fundingRefundAccounts.bankName, accountHolder: fundingRefundAccounts.accountHolder, updatedAt: fundingRefundAccounts.updatedAt })
      .from(fundingRefundAccounts)
      .where(eq(fundingRefundAccounts.orderId, orderId))
      .get();
    return row ? { status: 'present', ...row } : { status: 'none' };
  } catch (error) {
    // 0048 미적용 등 — 화면은 열리고 이 칸만 "불러오지 못함"이다.
    console.error('[funding-refund-account] 환불 계좌 요약 조회 실패', { orderId, error });
    return { status: 'unavailable' };
  }
};

/** 운영자 "계좌 보기" — 복호화한 값. 없으면 null. 복호화 실패는 FieldCryptoError로 던진다. */
export const loadRefundAccount = async (orderId: string): Promise<RefundAccountInput | null> => {
  const row = await getDb()
    .select()
    .from(fundingRefundAccounts)
    .where(eq(fundingRefundAccounts.orderId, orderId))
    .get();
  if (!row) return null;
  return { bankName: row.bankName, accountNumber: decryptField(row.accountNumberEnc), accountHolder: row.accountHolder };
};

/** 더 쓸 데가 없어진 계좌를 지운다(운영자가 환불 요청을 철회 처리한 때). 실패는 삼키고 로그만. */
export const deleteRefundAccount = async (orderId: string): Promise<void> => {
  try {
    await getDb().run(sql`DELETE FROM funding_refund_accounts WHERE order_id = ${orderId}`);
  } catch (error) {
    console.error('[funding-refund-account] 환불 계좌 삭제 실패 — 5년 파기 때 함께 지워진다', { orderId, error });
  }
};
