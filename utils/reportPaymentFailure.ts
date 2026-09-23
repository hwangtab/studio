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
