import { useEffect, useRef, useState } from 'react';
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 위젯 로드 실패 시 "다시 시도"가 이 값을 증가시켜 아래 effect를 재실행한다
  // (amount는 안 바뀌므로 그것만으로는 재시도 트리거가 안 된다).
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
        if (!clientKey) throw new Error('결제 설정이 없습니다.');
        const toss = await loadTossPayments(clientKey);
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: 'KRW', value: amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#toss-payment-methods' }),
          widgets.renderAgreement({ selector: '#toss-agreement' }),
        ]);
        if (!cancelled) { widgetsRef.current = widgets; setReady(true); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '결제 모듈을 불러오지 못했습니다.');
      }
    })();
    return () => { cancelled = true; };
  }, [amount, retryKey]);

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
      <div id="toss-payment-methods" />
      <div id="toss-agreement" />
      <Button onClick={pay} disabled={!ready} fullWidth>결제하기</Button>
    </div>
  );
}
