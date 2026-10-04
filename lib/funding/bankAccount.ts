/**
 * 펀딩 **계좌 입금**의 고유 규칙 — 한정 리워드 불가, 온라인 계좌 입금 판정.
 *
 * 계좌·기한·안내 표기·입력 상한처럼 결제 종류와 무관한 것은 lib/payments/bankAccount.ts(결제 공용)에 있다.
 *
 * **이 모듈은 아무것도 import하지 않는다.** 후원 폼(클라이언트 번들)과 서버 검증이 같은 판정
 * 함수를 써야 하는데, `lib/funding/projects.ts`는 `node:fs`를 물고 있어 클라이언트가 값을
 * 가져가면 빌드가 깨진다(lib/funding/CLAUDE.md). 리워드는 모양(`totalQuantity`)만 받는다.
 *
 * 2026-09-11에 한 번 걷어냈다가(PR #77, 입금 대조 수작업 부담) 2026-10-04 운영자 결정으로
 * 되살렸다 — 은행·ATM에서 직접 보내는 노년층 후원자를 위해서다. 그때와 다른 점은 둘이다:
 * **자동 취소가 없다**(lib/payments/bankAccount.ts `BANK_DEPOSIT_GUIDE_DAYS`), **환불 계좌를 화면에서
 * 받는다**(결제 공용 `refund_accounts`, 마이그레이션 0048).
 */

export type BankTransferBlockCode = 'limited_reward';

/**
 * 이 리워드들로 계좌 입금을 받을 수 있는가 — 막히면 그 이유, 되면 null.
 *
 * **한정 수량 리워드는 계좌 입금을 받지 않는다.** 계좌 입금은 확인까지 며칠이 걸리는데
 * 그동안 재고를 붙들면 다른 후원자가 품절을 보고, 붙들지 않으면 입금을 확인하는 순간 이미
 * 다 팔렸을 수 있다. 무제한 리워드만 받으면 둘 다 생기지 않는다(입금 확인에 재고 재검증이
 * 필요 없다).
 *
 * 후원 폼(`components/funding/PledgeWizard.tsx`)과 서버 검증(`lib/funding/validation.ts`)이
 * **이 함수 하나를 같은 인자로** 부른다. 인자는 필수다 — 한쪽이 빼먹고 컴파일되면 화면은
 * 계좌를 고르게 두는데 서버가 거절하는 죽은 선택지가 생긴다(PR #77의 교훈).
 */
export const bankTransferBlockReason = (
  rewards: ReadonlyArray<{ totalQuantity: number | null }>,
): BankTransferBlockCode | null => (rewards.some((r) => r.totalQuantity !== null) ? 'limited_reward' : null);

export const BANK_TRANSFER_BLOCK_MESSAGES: Record<BankTransferBlockCode, string> = {
  limited_reward: '수량이 정해진 리워드는 카드·간편결제로만 받습니다. 입금을 확인하는 사이 다 팔릴 수 있어서입니다.',
};

/**
 * 온라인 **계좌 입금** 후원인가 — 후원자가 폼에서 "계좌로 직접 입금"을 고른 건.
 *
 * 관리자 수기 등록도 `payment_method = 'bank_transfer'`다(운영자가 현장·계좌로 받은 돈을 적는
 * 기능). 그 둘은 결제수단이 같아도 다루는 법이 다르다 — 수기 건은 등록 순간 이미 `paid`이고
 * 후원자가 화면에서 취소를 요청하는 경로가 없다. 그래서 결제수단만 보지 말고 **등록 경로까지**
 * 본다. 인자는 둘 다 필수다.
 */
export const isOnlineBankTransfer = (pledge: { paymentMethod: string; entrySource: string }): boolean =>
  pledge.paymentMethod === 'bank_transfer' && pledge.entrySource === 'online';
