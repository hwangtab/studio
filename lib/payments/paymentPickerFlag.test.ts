import { resolvePaymentPicker } from './paymentPickerFlag';

describe('resolvePaymentPicker — 새 결제 화면 스위치', () => {
  const r = (envValue: string | undefined, search = '', cookie = '') => resolvePaymentPicker({ envValue, search, cookie });

  it('기본값은 위젯(꺼짐)', () => {
    expect(r(undefined)).toEqual({ on: false, remember: null });
    expect(r('off')).toEqual({ on: false, remember: null });
  });

  it('?pay=v2는 켜고 쿠키에 기억한다, ?pay=widget은 끄고 기억한다', () => {
    expect(r(undefined, '?pay=v2')).toEqual({ on: true, remember: 'v2' });
    expect(r(undefined, '?a=1&pay=V2')).toEqual({ on: true, remember: 'v2' });
    expect(r('on', '?pay=widget')).toEqual({ on: false, remember: 'widget' });
  });

  it('쿠키가 쿼리 다음, env보다 먼저다', () => {
    expect(r(undefined, '', 'x=1; studio_pay=v2')).toEqual({ on: true, remember: null });
    expect(r('on', '', 'studio_pay=widget')).toEqual({ on: false, remember: null });
    expect(r(undefined, '?pay=widget', 'studio_pay=v2')).toEqual({ on: false, remember: 'widget' });
  });

  it('env NEXT_PUBLIC_PAYMENT_PICKER=on이면 전체 기본값이 새 화면', () => {
    expect(r('on')).toEqual({ on: true, remember: null });
    expect(r(' ON ')).toEqual({ on: true, remember: null });
  });

  it('모르는 값은 무시한다', () => {
    expect(r(undefined, '?pay=1', 'studio_pay=yes')).toEqual({ on: false, remember: null });
  });
});
