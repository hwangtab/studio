import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';

type Widgets = Awaited<ReturnType<Awaited<ReturnType<typeof loadTossPayments>>['widgets']>>;

/**
 * 위젯이 그리는 필수 결제 약관을 빼먹었을 때의 문구.
 *
 * 화면에 약관 동의가 두 벌이라 "약관에 동의해 주세요"로는 어느 쪽인지 알 수 없다 —
 * 우리 것은 이미 체크한 사람이 이 문구를 본다. 위젯 약관의 실제 라벨을 그대로 인용해
 * 찾아갈 수 있게 한다.
 */
export const TOSS_TERMS_REQUIRED_MESSAGE = '결제수단 아래 [필수] 결제 서비스 이용 약관에도 동의해 주세요.';

export interface TossRequestPaymentParams {
  orderId: string;
  orderName: string;
  customerName: string;
  customerEmail?: string;
  /** origin을 포함한 전체 주소. */
  successUrl: string;
  failUrl: string;
  /**
   * 청구할 금액. 넘기면 결제창을 열기 **직전에** 위젯 금액을 이 값으로 맞춘다.
   *
   * 폼 안에 위젯을 띄우는 화면에서는 후원자가 수량을 고치는 동안 금액이 계속 움직인다.
   * 서버가 확정한 금액으로 한 번 더 맞춰 두지 않으면 화면의 추정치로 결제창이 열린다.
   */
  amount?: number;
}

/**
 * 토스 **결제위젯**(수단 목록 + 약관 동의)을 붙이고 결제창을 여는 훅.
 *
 * 왜 컴포넌트가 아니라 훅인가: 위젯을 결제 전용 화면이 아니라 **신청 폼 안에** 두는
 * 화면이 생겼다(펀딩). 그 화면의 제출 버튼은 폼이 들고 있어야 하므로, 마운트 지점과
 * `requestPayment`만 넘겨주고 버튼은 쓰는 쪽이 그린다.
 *
 * **마운트와 금액 갱신을 갈라 놓은 것이 이 훅의 핵심이다.** 예전에는 `amount`가 effect의
 * 의존성이라 금액이 바뀔 때마다 위젯을 통째로 다시 그렸다. 결제 전용 화면에서는 금액이
 * 고정이라 드러나지 않았지만, 폼 안에 두면 수량을 한 번 고칠 때마다 iframe이 사라졌다
 * 다시 붙는다. 지금은 한 번만 붙이고 금액은 `setAmount`로만 갱신한다.
 */
/**
 * @param enabled 마운트 지점(`methodsId`·`agreementId` div)이 **화면에 있을 때만** true.
 *
 * 위저드가 단계별로 화면을 갈아 끼우는 경우, 훅은 컴포넌트가 붙는 순간 한 번 돌지만 붙일
 * div는 마지막 단계에만 있다. 그대로 두면 `renderPaymentMethods`가 없는 선택자를 받아
 * 실패하고, 고객이 결제 단계에 닿았을 때 "결제 모듈을 불러오지 못했습니다"만 본다.
 */
export const useTossPaymentWidgets = (amount: number, enabled = true) => {
  const widgetsRef = useRef<Widgets | null>(null);
  /**
   * 마운트 지점은 **인스턴스마다 유일한 id**여야 한다. 예전엔 `#toss-payment-methods`라는
   * 전역 고정 id였는데, 그건 "한 페이지에 위젯이 평생 하나"라는 전제에 기대고 있었다.
   * 펀딩 리워드 모달처럼 열고 닫으며 위젯을 여러 번 만드는 화면에서는 이전 인스턴스가
   * 남긴 노드와 새 렌더가 같은 셀렉터를 두고 부딪힌다. useId는 SSR과 클라이언트가 같은
   * 값을 내므로 하이드레이션도 어긋나지 않는다.
   */
  // useId는 React 판본에 따라 `:r0:`·`«r0»` 등 CSS 선택자에 못 쓰는 문자를 포함한다.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const methodsId = `toss-payment-methods-${uid}`;
  const agreementId = `toss-agreement-${uid}`;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * 위젯이 그리는 **필수 결제 약관**에 동의했는가. `null`은 아직 모른다는 뜻이다.
   *
   * 이걸 추적하지 않으면 미동의 상태로 제출을 막을 방법이 없다. 예전에는 그냥 제출시켜
   * `requestPayment`가 실패하게 두고 `code === 'NEED_AGREEMENT'`로 사유를 가리려 했는데,
   * **그 코드는 SDK에 없다**(types/index.d.ts의 requestPayment throws 목록에 약관 관련
   * 항목이 없다). 그래서 약관만 빼먹은 사람도 "결제를 시작하지 못했습니다. 잠시 후 다시
   * 시도해 주세요"를 봤다 — 다시 시도해도 같고, 무엇을 고쳐야 하는지도 알 수 없다.
   * 게다가 그 시점엔 주문이 이미 만들어져 있어(펀딩은 한정 재고 홀드까지) 실패가 흔적을
   * 남긴다. 제출 전에 막는 것이 맞다.
   *
   * `null`을 false로 취급하지 않는 이유: 위젯이 렌더 직후 초기 상태를 이벤트로 주는지가
   * 판본에 따라 다르다. 못 받은 상태에서 막으면 동의를 했는데도 결제가 안 된다 —
   * 모를 때는 종전대로 보내고, 실패 문구만 정확하게 바꾼다.
   */
  const [agreedRequiredTerms, setAgreedRequiredTerms] = useState<boolean | null>(null);
  // 위젯 로드 실패 시 "다시 시도"가 이 값을 증가시켜 아래 effect를 재실행한다.
  const [retryKey, setRetryKey] = useState(0);

  // 첫 렌더 금액은 ref로 읽는다 — 의존성에 넣으면 금액이 바뀔 때마다 재마운트된다.
  const amountRef = useRef(amount);
  amountRef.current = amount;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // 노드는 **effect 본문에서** 붙잡는다. React는 언마운트 때 passive effect cleanup보다
    // 먼저 ref를 떼므로, cleanup에서 ref.current를 읽으면 이미 null이라 아무것도 못 지운다.
    const methodsEl = document.getElementById(methodsId);
    const agreementEl = document.getElementById(agreementId);
    (async () => {
      try {
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
        if (!clientKey) throw new Error('결제 설정이 없습니다.');
        const toss = await loadTossPayments(clientKey);
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: 'KRW', value: amountRef.current });
        const [, agreementWidget] = await Promise.all([
          widgets.renderPaymentMethods({ selector: `#${methodsId}` }),
          widgets.renderAgreement({ selector: `#${agreementId}` }),
        ]);
        // 동의 상태를 구독한다. 위젯 안의 체크는 iframe 안에서 일어나므로 이 이벤트가
        // 아니면 밖에서 알 방법이 없다.
        //
        // 옵셔널 호출인 이유: 구독이 안 되면 상태는 `null`로 남고, 호출부는 `null`을
        // "모름"으로 보고 종전대로 제출시킨다. 즉 구독 실패가 결제를 막지 않는다 —
        // SDK 판본이 반환 형태를 바꿔도 결제 경로는 그대로 산다.
        agreementWidget?.on?.('agreementStatusChange', (status) => {
          if (!cancelled) setAgreedRequiredTerms(status.agreedRequiredTerms);
        });
        if (!cancelled) { widgetsRef.current = widgets; setReady(true); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '결제 모듈을 불러오지 못했습니다.');
      }
    })();
    return () => {
      cancelled = true;
      // 위젯이 심어 둔 iframe을 직접 걷어낸다. SDK에 파기 API가 없어서, 컨테이너를 비우지
      // 않으면 재마운트 때 옛 iframe이 남은 채 새 iframe이 덧붙는다.
      widgetsRef.current = null;
      setReady(false);
      // 새로 그린 위젯의 체크는 풀린 상태로 시작한다 — 옛 동의를 물려주면 안 된다.
      setAgreedRequiredTerms(null);
      if (methodsEl) methodsEl.innerHTML = '';
      if (agreementEl) agreementEl.innerHTML = '';
    };
  }, [agreementId, enabled, methodsId, retryKey]);

  // 금액이 움직이면 위젯에만 알린다 — 다시 그리지 않는다.
  useEffect(() => {
    const widgets = widgetsRef.current;
    if (!ready || !widgets) return;
    // Promise.resolve로 감싼다 — 실패해도 화면을 흔들지 않는다(결제 직전에 다시 맞춘다).
    void Promise.resolve(widgets.setAmount({ currency: 'KRW', value: amount })).catch(() => {});
  }, [amount, ready]);

  const requestPayment = useCallback(async ({ amount: finalAmount, ...params }: TossRequestPaymentParams) => {
    const widgets = widgetsRef.current;
    if (!widgets) throw new Error('결제 모듈이 준비되지 않았습니다.');
    // 서버가 확정한 금액으로 맞춘 뒤 연다. 화면의 추정치로 열면 청구액이 어긋난다.
    if (finalAmount !== undefined) await widgets.setAmount({ currency: 'KRW', value: finalAmount });
    await widgets.requestPayment(params);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setReady(false);
    setRetryKey((k) => k + 1);
  }, []);

  return { methodsId, agreementId, ready, error, retry, requestPayment, agreedRequiredTerms };
};
