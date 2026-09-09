import { assessSelfCancel } from './policy';
describe('assessSelfCancel', () => {
  it('paid + live + 발송 전이면 가능', () => {
    expect(assessSelfCancel({ orderStatus: 'paid', projectState: 'live', fulfillmentStatus: 'none' })).toEqual({ ok: true });
  });
  it.each([
    ['pending', 'live', 'none', 'not_paid'],
    ['paid', 'closed', 'none', 'project_not_live'],
    ['paid', 'live', 'preparing', 'fulfilling'],
  ])('%s/%s/%s → %s', (orderStatus, projectState, fulfillmentStatus, code) => {
    expect(assessSelfCancel({ orderStatus, projectState: projectState as never, fulfillmentStatus })).toEqual({ ok: false, code });
  });
});
