import { useEffect, useId, useRef, useState } from 'react';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';

import { Button } from '../ui/Button';

interface Props {
  orderNo: string;
  amount: number;
  orderName: string; // 예: '보컬 녹음 1프로 (9/10 14:00)'
  customerName: string;
  customerEmail: string;
  /** 결제 실패 시 돌아갈 예약 페이지를 고르기 위해 failUrl에 싣는다. */
  service: string;
  /** 없으면 예약 퍼널 URL. 펀딩 등 다른 퍼널은 자기 경로를 넘긴다(origin 없이 경로만). */
  successUrl?: string;
  failUrl?: string;
}

export default function TossPaymentWidget({ orderNo, amount, orderName, customerName, customerEmail, service, successUrl, failUrl }: Props) {
  const widgetsRef = useRef<Awaited<ReturnType<Awaited<ReturnType<typeof loadTossPayments>>['widgets']>> | null>(null);
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
  // 위젯 로드 실패 시 "다시 시도"가 이 값을 증가시켜 아래 effect를 재실행한다
  // (amount는 안 바뀌므로 그것만으로는 재시도 트리거가 안 된다).
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
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
        await widgets.setAmount({ currency: 'KRW', value: amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: `#${methodsId}` }),
          widgets.renderAgreement({ selector: `#${agreementId}` }),
        ]);
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
      if (methodsEl) methodsEl.innerHTML = '';
      if (agreementEl) agreementEl.innerHTML = '';
    };
  }, [agreementId, amount, methodsId, retryKey]);

  const pay = async () => {
    const origin = window.location.origin;
    try {
      await widgetsRef.current?.requestPayment({
        orderId: orderNo,
        orderName,
        customerName,
        customerEmail,
        successUrl: `${origin}${successUrl ?? '/ko/booking/success'}`,
        // service를 싣지 않으면 실패 화면이 상품과 무관하게 녹음 예약으로 되돌린다
        // (축가 고객이 카드 한도로 실패하면 녹음 페이지로 갔다).
        failUrl: `${origin}${failUrl ?? `/ko/booking/fail?service=${encodeURIComponent(service)}`}`,
      });
    } catch {
      /* 사용자가 결제창을 닫은 경우 — 위젯이 자체 안내 */
    }
  };

  const retry = () => {
    setError(null);
    setReady(false);
    setRetryKey((k) => k + 1);
  };

  if (error) {
    return (
      <div>
        <p role="alert" className="text-red-600">{error}</p>
        <Button type="button" variant="outline" onClick={retry} className="mt-3">
          다시 시도
        </Button>
      </div>
    );
  }
  return (
    <div>
      <div id={methodsId} />
      <div id={agreementId} />
      <Button onClick={pay} disabled={!ready} fullWidth>결제하기</Button>
    </div>
  );
}
