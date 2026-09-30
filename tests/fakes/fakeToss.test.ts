import { createFakeToss } from './fakeToss';

test('confirmPayment는 성공 응답을 멱등키로 재생한다', async () => {
  const toss = createFakeToss();
  const r1 = await toss.confirmPayment({ paymentKey: 'pk1', orderId: 'TKT-20260930-AAAAAAAA', amount: 10000 });
  const r2 = await toss.confirmPayment({ paymentKey: 'pk1', orderId: 'TKT-20260930-AAAAAAAA', amount: 10000 });
  expect(r1.ok).toBe(true);
  expect(r2).toEqual(r1);
});

test('injectFault로 NETWORK_ERROR를 강제할 수 있다', async () => {
  const toss = createFakeToss();
  toss.injectFault('cancel:pk1', { code: 'NETWORK_ERROR' });
  const r = await toss.cancelPayment({ paymentKey: 'pk1', cancelAmount: 1000, cancelReason: '테스트' });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe('NETWORK_ERROR');
});

test('cancelPayment 성공 시 cancels 배열에 cancelReason이 기록된다', async () => {
  const toss = createFakeToss();
  await toss.confirmPayment({ paymentKey: 'pk2', orderId: 'TKT-2', amount: 5000 });
  const r = await toss.cancelPayment({
    paymentKey: 'pk2',
    cancelAmount: 5000,
    cancelReason: '[#tkt-refund:TKT-2:1] 환불',
    idempotencyKey: 'tkt-refund:TKT-2:1',
  });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.payment.cancels?.[0]?.cancelReason).toBe('[#tkt-refund:TKT-2:1] 환불');
});

test('interceptHook으로 응답 직전 개입해 경쟁을 재현한다', async () => {
  const toss = createFakeToss();
  const order: string[] = [];
  toss.setInterceptHook(async () => {
    order.push('toss-about-to-return');
  });
  order.push('before-call');
  await toss.confirmPayment({ paymentKey: 'pk3', orderId: 'TKT-3', amount: 1000 });
  order.push('after-call');
  expect(order).toEqual(['before-call', 'toss-about-to-return', 'after-call']);
});
