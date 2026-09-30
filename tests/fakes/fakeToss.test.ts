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

test('cancelPayment는 같은 idempotencyKey로 다시 오면 cancels를 늘리지 않고 최초 응답을 재생한다', async () => {
  // finding #2/#4 회귀 — 실제 토스는 같은 Idempotency-Key로 다시 온 요청에 최초 응답을
  // 그대로 재생한다(두 번째 취소가 실제로 나가지 않는다). 이 fake가 그 동작을 흉내 내지
  // 못하면, 서로 다른 두 환불 호출이 같은 키를 잘못 만드는 버그(finding #2)가 fake 위에서는
  // "매번 성공해서 cancels가 계속 늘어나는" 것으로만 보여 실제 과소 환불을 테스트가 잡을
  // 수 없다.
  const toss = createFakeToss();
  await toss.confirmPayment({ paymentKey: 'pk4', orderId: 'TKT-4', amount: 10000 });
  const r1 = await toss.cancelPayment({
    paymentKey: 'pk4', cancelAmount: 10000, cancelReason: '첫 번째', idempotencyKey: 'same-key',
  });
  const r2 = await toss.cancelPayment({
    paymentKey: 'pk4', cancelAmount: 10000, cancelReason: '두 번째(재생돼야 함)', idempotencyKey: 'same-key',
  });
  expect(r1.ok).toBe(true);
  expect(r2).toEqual(r1); // 최초 응답 그대로
  if (r1.ok) expect(r1.payment.cancels?.length).toBe(1); // 두 번째 호출로 cancels가 늘지 않는다
});

test('fetchPayment는 paymentKey로만 조회한다 — orderId로는 찾지 못한다(실제 토스와 동일)', async () => {
  // finding #3 회귀 — 예전엔 이 fake가 orderId로도 찾아 줘서, 프로덕션에서는 항상
  // NOT_FOUND인 `toss.fetchPayment(orderNo)` 호출이 테스트에서만 성공하는 착시가 있었다.
  const toss = createFakeToss();
  await toss.confirmPayment({ paymentKey: 'pk5', orderId: 'TKT-5', amount: 10000 });
  const byKey = await toss.fetchPayment('pk5');
  expect(byKey.ok).toBe(true);
  const byOrderId = await toss.fetchPayment('TKT-5');
  expect(byOrderId.ok).toBe(false);
  if (!byOrderId.ok) expect(byOrderId.code).toBe('NOT_FOUND_PAYMENT');
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
