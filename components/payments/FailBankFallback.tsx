/* eslint-disable @next/next/no-html-link-for-pages --
 * 결제 실패 화면(URL에 토스 orderId가 실린다)의 이탈 링크는 next/link가 아니라 문서 이동이어야 한다.
 * 근거: lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts
 */
import { bankFallbackHref } from '../../lib/payments/bankFallback';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

/**
 * 결제 실패 화면의 "계좌번호로 직접 보내기" 안내 — 예약·믹싱(booking/fail)·펀딩(funding/fail)·예약금 링크(pay/fail) 공용.
 *
 * 결제가 어려운 분(주로 고령층)이 막혔을 때 바로 계좌번호 안내로 가는 입구다(운영자 결정 2026-10-14 — 목록에도 같은
 * 줄이 있지만 실패 직후에는 눈에 띄게 한 번 더 권한다). 폼 주소에 `?bank=1`을 붙여 돌려보내면 폼이 "계좌로 직접 입금"을
 * 고른 채 열린다(lib/payments/bankFallback.ts) — 실패한 주문은 이미 풀려 있어 폼에서 새로 만든다.
 *
 * 글자는 본문 크기 이상이다 — 이 안내를 찾는 분이 바로 작은 글씨를 읽기 어려운 분이다.
 */
export default function FailBankFallback({ formPath, note }: { formPath: string; /** 폴백이 막힐 수 있는 경우의 보조 안내(펀딩 한정 수량 리워드 등). */ note?: string }) {
  return (
    <Notice tone="info" className="mx-auto max-w-md text-center">
      <p className="text-lg font-semibold">결제가 어려우신가요?</p>
      <p className="mt-1 text-base leading-relaxed">
        카드나 은행 앱 결제가 잘 안 되시면 계좌번호를 알려 드릴게요. 은행 앱이나 ATM에서 직접 보내시면 됩니다.
      </p>
      <div className="mt-3">
        <Button asChild size="lg" fullWidth>
          <a href={bankFallbackHref(formPath)} rel="noreferrer">계좌번호로 직접 보내기</a>
        </Button>
      </div>
      {note && <p className="mt-3 text-base leading-relaxed">{note}</p>}
    </Notice>
  );
}
