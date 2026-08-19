/** @jest-environment node */

/**
 * 생년월일·주소는 운영자가 알 수 없어 당사자가 직접 채운다. 그 값이 계약서에 그대로
 * 인쇄되고 계약 당사자를 특정하므로, 서버가 다시 확인한다.
 */

import { validateSignerDetails } from './validation';

const valid = () => ({
  customerBirthdate: '1990-01-02',
  customerAddress: '서울시 은평구 대조동 84-3',
});

const errorFields = (payload: Record<string, unknown>): string[] => {
  const result = validateSignerDetails(payload);
  return result.ok ? [] : result.errors.map((e) => e.field);
};

describe('서명자가 채우는 정보', () => {
  it('정상 입력을 통과시키고 앞뒤 공백을 정리한다', () => {
    const result = validateSignerDetails({
      customerBirthdate: '1990-01-02',
      customerAddress: '  서울시 은평구  ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.customerAddress).toBe('서울시 은평구');
  });

  it('둘 다 필수다', () => {
    expect(errorFields({})).toEqual(
      expect.arrayContaining(['customerBirthdate', 'customerAddress']),
    );
    expect(errorFields({ ...valid(), customerAddress: '   ' })).toContain('customerAddress');
  });

  it('생년월일 형식을 검사한다', () => {
    expect(errorFields({ ...valid(), customerBirthdate: '1990/01/02' })).toContain(
      'customerBirthdate',
    );
    expect(errorFields({ ...valid(), customerBirthdate: '90-01-02' })).toContain(
      'customerBirthdate',
    );
  });

  it('미래 날짜를 거부한다', () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expect(
      errorFields({ ...valid(), customerBirthdate: nextYear.toISOString().slice(0, 10) }),
    ).toContain('customerBirthdate');
  });

  /** 미성년자 계약은 법정대리인 동의 없이는 취소될 수 있다 — 온라인에서 받지 않는다. */
  it('만 19세 미만을 거부한다', () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    const fields = errorFields({
      ...valid(),
      customerBirthdate: tenYearsAgo.toISOString().slice(0, 10),
    });
    expect(fields).toContain('customerBirthdate');
  });

  it('만 19세는 통과한다 (경계)', () => {
    const justOver = new Date();
    justOver.setFullYear(justOver.getFullYear() - 20);
    expect(errorFields({ ...valid(), customerBirthdate: justOver.toISOString().slice(0, 10) })).toEqual(
      [],
    );
  });

  it('있을 수 없는 나이를 거부한다', () => {
    expect(errorFields({ ...valid(), customerBirthdate: '1850-01-01' })).toContain(
      'customerBirthdate',
    );
  });

  /**
   * 이 값들은 계약서 표의 셀로 들어간다. 줄바꿈·제로폭 문자가 섞이면 한 칸에 다른 문구를
   * 심거나 보이는 글자와 저장된 값을 다르게 만들 수 있다.
   */
  it.each([
    ['줄바꿈', '서울시\n| 특약 | 없음 |'],
    ['제로폭 문자', '서울시​은평구'],
    ['방향 뒤집기', '서울시‮은평구'],
  ])('주소의 %s를 거부한다', (_label, address) => {
    expect(errorFields({ ...valid(), customerAddress: address })).toContain('customerAddress');
  });

  it('지나치게 긴 주소를 거부한다', () => {
    expect(errorFields({ ...valid(), customerAddress: '가'.repeat(300) })).toContain(
      'customerAddress',
    );
  });
});
