/**
 * "기록 삭제"를 받는 주문의 조건 — 서버(deleteUnpaid.ts)와 관리자 화면이 같이 쓴다. 이 모듈은 아무것도 import하지 않는다
 * (화면 번들에 DB 클라이언트가 끌려가지 않게).
 */
/** 지울 수 있는 주문 상태. */
export const DELETABLE_UNPAID_STATUSES = ['deposit_cancelled', 'expired', 'failed'] as const;
/** 만료·실패 주문은 이만큼 지난 뒤에만 — 늦게 도착하는 결제 승인(웹훅)을 기다린다. */
export const EXPIRED_DELETE_AFTER_MS = 24 * 60 * 60 * 1000;

/** 화면이 "기록 삭제"를 보일지 — 서버 판정의 앞부분(상태·나이·결제 행)과 같다. 캘린더·환불 계좌 검사는 서버만 한다. */
export const canOfferUnpaidDelete = (o: { orderType: string; orderStatus: string; createdAt: string; paymentCount: number }, now: Date = new Date()): boolean => {
  if (o.orderType !== 'session' && o.orderType !== 'mixing') return false;
  if (!(DELETABLE_UNPAID_STATUSES as readonly string[]).includes(o.orderStatus)) return false;
  if (o.paymentCount > 0) return false;
  if (o.orderStatus === 'deposit_cancelled') return true;
  return now.getTime() - new Date(o.createdAt).getTime() >= EXPIRED_DELETE_AFTER_MS;
};

