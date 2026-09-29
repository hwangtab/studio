import { generateOrderNo, generateManageToken, isTokenMatch, readPreviousOrderNo } from './token';

describe('generateOrderNo', () => {
  it('토스 orderId 규격(영숫자·_·- , 6~64자)을 만족한다', () => {
    const orderNo = generateOrderNo(new Date('2026-09-04T03:00:00Z'));
    expect(orderNo).toMatch(/^[A-Za-z0-9_-]{6,64}$/);
  });

  it('UTC 자정 직후(=KST 오전)에도 KST 날짜를 쓴다 — UTC였다면 하루 전으로 밀린다', () => {
    // 2026-09-04 00:30 UTC = 2026-09-04 09:30 KST. UTC 기준이면 같은 날이라 이 케이스만으론
    // 회귀를 못 잡는다 — 아래 경계 케이스가 실제 버그(UTC 전날) 재현 지점이다.
    const orderNo = generateOrderNo(new Date('2026-09-04T00:30:00Z'));
    expect(orderNo).toContain('SNB-20260904-');
  });

  it('KST 00:00~09:00 경계 — UTC로는 전날인데 KST로는 그날이어야 한다', () => {
    // 2026-09-04 08:30 KST == 2026-09-03 23:30 UTC. UTC.slice(0,10)을 쓰면 SNB-20260903-…이
    // 되어 "9월 3일 주문"으로 오독된다(정산·CS는 전부 KST를 본다) — 이 커밋 이전 버그.
    const kst0830 = new Date('2026-09-03T23:30:00Z');
    const orderNo = generateOrderNo(kst0830);
    expect(orderNo).toContain('SNB-20260904-');
    expect(orderNo).not.toContain('SNB-20260903-');
  });

  it('KST 23:59에도 같은 KST 날짜를 쓴다', () => {
    // 2026-09-04 23:59 KST == 2026-09-04 14:59 UTC.
    const orderNo = generateOrderNo(new Date('2026-09-04T14:59:00Z'));
    expect(orderNo).toContain('SNB-20260904-');
  });

  it('뒤 8자는 매번 랜덤이라 같은 시각이어도 값이 다르다', () => {
    const now = new Date('2026-09-04T03:00:00Z');
    const a = generateOrderNo(now);
    const b = generateOrderNo(now);
    expect(a).not.toBe(b);
  });
});

describe('generateManageToken', () => {
  it('URL-safe base64 문자열을 만든다', () => {
    const token = generateManageToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('isTokenMatch', () => {
  it('같은 토큰이면 true', () => {
    expect(isTokenMatch('abc', 'abc')).toBe(true);
  });

  it('다른 토큰이면 false', () => {
    expect(isTokenMatch('abc', 'abd')).toBe(false);
  });

  it('길이가 달라도 false(내부적으로 고정 길이 해시 후 비교)', () => {
    expect(isTokenMatch('abc', 'abcdef')).toBe(false);
  });
});

describe('readPreviousOrderNo — 자기 홀드 해제의 소유 증명', () => {
  it('생성 형태의 주문번호를 대문자로 돌려준다(소문자로 와도 된다)', () => {
    expect(readPreviousOrderNo({ previousOrderNo: 'SNB-20260910-0A1B2C3D' })).toBe('SNB-20260910-0A1B2C3D');
    expect(readPreviousOrderNo({ previousOrderNo: 'snb-20260910-0a1b2c3d' })).toBe('SNB-20260910-0A1B2C3D');
  });

  it.each([
    [undefined],
    [null],
    [{}],
    [{ previousOrderNo: 123 }],
    [{ previousOrderNo: 'FND-20260910-0A1B2C3D' }],
    [{ previousOrderNo: 'SNB-20260910-0A1B2C3D OR 1=1' }],
    [{ previousOrderNo: '' }],
  ])('형태가 아니면 증명이 없는 것으로 본다: %p', (body) => {
    expect(readPreviousOrderNo(body)).toBeNull();
  });
});
