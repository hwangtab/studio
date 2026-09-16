import { Button } from '../ui/Button';
import { useTossPaymentWidgets } from './useTossPaymentWidgets';

interface Props {
  orderNo: string;
  amount: number;
  orderName: string; // 예: '보컬 녹음 1프로 (9/10 14:00)'
  customerName: string;
  customerEmail: string;
  /** 결제 실패 시 돌아갈 예약 페이지를 고르기 위해 failUrl에 싣는다. */
  service: string;
  /** 없으면 예약 퍼널 URL. 다른 퍼널은 자기 경로를 넘긴다(origin 없이 경로만). */
  successUrl?: string;
  failUrl?: string;
}

/**
 * 결제 **전용 화면**에 쓰는 위젯 — 주문이 이미 만들어진 뒤 금액이 고정된 자리다.
 *
 * 폼 안에 위젯을 두고 제출 버튼 하나로 끝내는 화면(펀딩)은 이 컴포넌트가 아니라
 * `useTossPaymentWidgets`를 직접 쓴다. 버튼을 폼이 들고 있어야 하기 때문이다.
 */
export default function TossPaymentWidget({ orderNo, amount, orderName, customerName, customerEmail, service, successUrl, failUrl }: Props) {
  const { methodsId, agreementId, ready, error, retry, requestPayment } = useTossPaymentWidgets(amount);

  const pay = async () => {
    const origin = window.location.origin;
    try {
      await requestPayment({
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
