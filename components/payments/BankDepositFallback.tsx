import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

/**
 * "계좌번호로 직접 보내기" 폴백 — 결제 공용(펀딩·예약·믹싱·예약금 결제 링크).
 *
 * 기본 결제수단은 전부 토스(카드·간편결제·계좌이체)다. 결제가 어려운 분(주로 고령층)이 막혔을 때만 계좌번호를
 * 안내한다(운영자 결정 2026-10-14) — 그래서 결제수단 목록의 한 줄이 아니라 **목록 아래의 작은 링크**다.
 * 누르면 호출부가 `payMethod`를 `bank_transfer`로 바꾸고, 제출하면 지금까지의 계좌 입금 흐름
 * (`awaiting_deposit` → 계좌 안내 → 운영자 입금 확인)이 그대로 돈다. 실패 화면에서 돌아온 사람은
 * `?bank=1`(lib/payments/bankFallback.ts)로 이미 이 상태로 열린다.
 *
 * - 비활성: 링크 한 줄. 이용할 수 없으면(`blockedMessage` — 시작 임박·한정 리워드) 링크 대신 이유 한 줄.
 * - 활성: 무엇이 일어나는지와 토스로 돌아가는 버튼. 이때 호출부는 결제수단 목록을 숨긴다.
 *
 * 글자는 본문 크기 이상이다 — 이 입구를 찾는 분이 바로 작은 글씨를 읽기 어려운 분이다.
 */
export default function BankDepositFallback({ active, blockedMessage, onEnter, onLeave, confirmLabel = '확정' }: {
  active: boolean;
  /** 있으면 폴백을 막고 이유만 보인다(lib/payments/bankDeposit.ts·lib/funding/bankAccount.ts). */
  blockedMessage?: string | null;
  onEnter: () => void;
  onLeave: () => void;
  /** 입금 확인 뒤 일어나는 일 — "예약이 확정", "주문이 접수", "후원이 확정". */
  confirmLabel?: string;
}) {
  if (active) {
    return (
      <Notice tone="info" className="mt-3">
        <p className="text-base font-semibold">계좌번호로 직접 보내기를 선택하셨어요.</p>
        <p className="mt-1 text-base leading-relaxed">
          아래 버튼을 누르면 입금하실 계좌를 바로 알려 드려요. 은행 앱이나 ATM에서 보내시고, 입금을 확인하면 {confirmLabel}되고 메일로 알려 드려요.
        </p>
        <div className="mt-3">
          <Button type="button" variant="weak" size="sm" onClick={onLeave}>카드·간편결제·계좌이체로 돌아가기</Button>
        </div>
      </Notice>
    );
  }
  if (blockedMessage) {
    return <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">계좌번호로 직접 보내기: {blockedMessage}</p>;
  }
  return (
    <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-gray-300">
      결제가 어려우신가요?{' '}
      <button
        type="button"
        onClick={onEnter}
        className="font-semibold text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:text-primary-lighter"
      >
        계좌번호로 직접 보내기
      </button>
    </p>
  );
}
