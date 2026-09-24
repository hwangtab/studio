import { FieldCryptoError, decryptField, encryptField } from '../crypto/fieldCrypto';

/**
 * 정산 계좌 한 벌(은행명·계좌번호·예금주)을 **하나의 암호문**으로 싸고 푼다.
 *
 * 저장 자리는 `funding_creators.payout_account_enc` 하나이고, 형식은
 * `lib/crypto/fieldCrypto.ts`의 `v2:<keyId>:<iv>:<tag>:<ct>` 그대로다. 이 모듈이 더하는
 * 것은 **평문 쪽의 봉투**뿐이다 — 세 값을 고정된 순서의 JSON으로 만들어 넘기고, 풀어서
 * 같은 모양으로 돌려준다.
 *
 * 세 값을 나눠 세 컬럼에 담지 않은 이유는 `db/schema.ts`의 `payoutAccountEnc` 주석에 있다.
 * 요지는 "셋은 언제나 함께 저장되고 함께 쓰이므로, 열린 것과 안 열린 것이 섞인 상태를
 * 애초에 만들지 않는다"이다.
 *
 * **실패는 전부 `FieldCryptoError`다.** 봉투가 깨진 경우(JSON이 아니거나 모양이 다른 경우)도
 * `malformed`로 맞춘다 — 호출부(관리자 조회 라우트·정산 게이트)는 이미 그 코드 집합으로
 * 분기하고 있고, 여기만 다른 예외를 던지면 그 분기가 통째로 빠진다.
 *
 * **평문을 메시지에 넣지 않는다.** 이 모듈이 만드는 어떤 오류 문자열에도 계좌번호·예금주가
 * 들어갈 자리가 없다.
 */

export interface FundingPayoutAccountFields {
  bankName: string;
  account: string;
  holder: string;
}

/**
 * 계좌번호에서 숫자만 남겨 뒤 4자리. 하이픈 위치가 은행마다 달라 자릿수부터 맞춘다.
 * 4자리를 못 채우면 null이다(그 경우 화면은 "등록됨"만 말한다).
 *
 * 이 값은 **저장 시점에 한 번 계산해** `payout_account_last4` 컬럼에 평문으로 넣는다.
 * 읽는 쪽(개설자 편집 화면·관리자 미리보기)은 키 없이 그 컬럼만 본다.
 */
export const payoutAccountLast4 = (account: string): string | null => {
  const digits = account.replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

/** 봉투의 키 순서를 한 자리에 고정한다 — 같은 입력이 늘 같은 평문이 되게. */
const envelope = (fields: FundingPayoutAccountFields): string =>
  JSON.stringify({ bankName: fields.bankName, account: fields.account, holder: fields.holder });

/**
 * 세 값을 암호문 한 문자열로. 키가 없거나 형식이 틀리면 `FieldCryptoError`를 던진다 —
 * 호출부가 그 예외를 삼켜 평문을 저장하는 경로는 없어야 한다.
 */
export const encryptPayoutAccount = (fields: FundingPayoutAccountFields): string =>
  encryptField(envelope(fields));

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** 암호문을 세 값으로. 복호화 실패·봉투 파손 모두 `FieldCryptoError`다. */
export const decryptPayoutAccount = (stored: string): FundingPayoutAccountFields => {
  const plaintext = decryptField(stored);

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    // 원본 예외는 삼킨다 — JSON 파서의 메시지는 평문 조각을 그대로 인용한다.
    throw new FieldCryptoError('malformed', '정산 계좌 암호문의 내용이 형식과 다르다.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new FieldCryptoError('malformed', '정산 계좌 암호문의 내용이 형식과 다르다.');
  }
  const { bankName, account, holder } = parsed as Record<string, unknown>;
  if (!isNonEmptyString(bankName) || !isNonEmptyString(account) || !isNonEmptyString(holder)) {
    throw new FieldCryptoError('malformed', '정산 계좌 암호문에 은행명·계좌번호·예금주가 모두 들어 있지 않다.');
  }
  return { bankName, account, holder };
};
