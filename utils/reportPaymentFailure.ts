import { useEffect, useRef } from 'react';

/**
 * 결제창이 열리기 전에 SDK가 던진 실패를 서버에 알린다(fire-and-forget).
 *
 * 세 위자드(예약·믹싱·후원)의 catch가 화면에 문구만 띄우고 사유를 버렸다. 2026-09-19에
 * 한 후원자가 3분 동안 세 번 실패하고 떠났는데 이유를 알 수 없었던 것이 그 때문이다.
 *
 * 사용자 흐름을 절대 막지 않는다 — await하지 않고, 실패해도 조용히 지나간다.
 */
export const reportPaymentFailure = (
  orderNo: string | null | undefined,
  err: unknown,
): void => {
  if (!orderNo) return;
  const { code, message } = (err ?? {}) as { code?: unknown; message?: unknown };
  if (typeof code !== 'string' || !code) return;
  try {
    void fetch('/api/payments/failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNo,
        code,
        message: typeof message === 'string' ? message : null,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 기록은 부가 기능이다 — 여기서 나는 오류가 결제 화면을 흔들면 안 된다. */
  }
};

/**
 * 실패 화면이 **마운트된 뒤** 사유를 비콘으로 남긴다.
 *
 * 예전에는 실패 화면의 getServerSideProps가 직접 DB에 썼다. 그 주소는 인증도 Origin
 * 검사도 없는 GET이라, 남의 주문번호를 넣은 링크 한 번(링크 프리뷰 봇 포함)으로 그 주문의
 * 실패 사유·updated_at이 덮였다 — 문의 대응의 유일한 우리 쪽 근거를 위조할 수 있었다.
 * 비콘(`/api/payments/failed`)에는 Origin 검사와 IP 레이트리밋이 걸려 있다. 봇·프리뷰는
 * 자바스크립트를 돌리지 않아 기록하지 못하고, 실제 결제자의 브라우저는 기록한다.
 *
 * 원문 message는 props로 내리지 않고 **주소에서 직접 읽는다** — 화면에 쓰지 않는 미검증
 * 문자열을 `__NEXT_DATA__`에 실을 이유가 없다.
 *
 * 펀딩·예약 실패 화면이 같은 것을 하므로 훅 하나로 둔다 — 복제하면 한쪽만 고쳐진다.
 */
export const useReportPaymentFailureOnMount = (
  orderNo: string | null | undefined,
  code: string | null | undefined,
): void => {
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || !orderNo || !code) return;
    reported.current = true;
    const raw = new URLSearchParams(window.location.search).get('message');
    reportPaymentFailure(orderNo, { code, message: raw });
  }, [orderNo, code]);
};
