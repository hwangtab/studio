/** @jest-environment node */

import { validateCreateContractPayload } from './validation';

const validPayload = () => ({
  title: '홍길동님 음악연습실 이용계약',
  customerName: '홍길동',
  customerEmail: 'test@example.com',
  customerPhone: '010-1234-5678',
  roomNumber: 'A',
  startDate: '2026-08-01',
  endDate: '2026-11-01',
  monthlyRent: 300000,
  depositAmount: 300000,
  paymentDay: 1,
});

const errorFields = (payload: Record<string, unknown>): string[] => {
  const result = validateCreateContractPayload(payload);
  return result.ok ? [] : result.errors.map((error) => error.field);
};

describe('계약 생성 페이로드 검증', () => {
  it('올바른 입력을 통과시키고 정규화한다', () => {
    const result = validateCreateContractPayload({
      ...validPayload(),
      customerName: '  홍길동  ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.customerName).toBe('홍길동');
      expect(result.data.monthlyRent).toBe(300000);
    }
  });

  it('필수 항목이 없으면 해당 필드를 보고한다', () => {
    const fields = errorFields({});
    expect(fields).toEqual(
      expect.arrayContaining([
        'title',
        'customerName',
        'customerEmail',
        'customerPhone',
        'roomNumber',
        'startDate',
        'endDate',
        'monthlyRent',
        'depositAmount',
      ]),
    );
  });

  it('공백만 있는 값은 미입력으로 본다', () => {
    expect(errorFields({ ...validPayload(), customerName: '   ' })).toContain('customerName');
  });

  it('이메일 형식을 검사한다', () => {
    expect(errorFields({ ...validPayload(), customerEmail: 'not-an-email' })).toContain(
      'customerEmail',
    );
  });

  it('한국 휴대폰 번호 형식을 검사한다', () => {
    expect(errorFields({ ...validPayload(), customerPhone: '02-123-4567' })).toContain(
      'customerPhone',
    );
    expect(errorFields({ ...validPayload(), customerPhone: '01012345678' })).toEqual([]);
  });

  describe('호실 표기 정규화', () => {
    // 표기가 흔들리면 기간 겹침 검사가 다른 방으로 보아 이중 배정을 못 막는다.
    it.each([
      ['소문자', 'a', 'A'],
      ['앞뒤 공백', ' A ', 'A'],
      ['중간 공백', 'A 1', 'A1'],
      ['소문자+공백', '  b2 ', 'B2'],
    ])('%s를 한 형태로 모은다', (_label, input, expected) => {
      const result = validateCreateContractPayload({ ...validPayload(), roomNumber: input });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.roomNumber).toBe(expected);
    });

    it('숫자·한글 호실은 그대로 둔다', () => {
      const result = validateCreateContractPayload({ ...validPayload(), roomNumber: '201' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.roomNumber).toBe('201');
    });
  });

  describe('시작일 범위', () => {
    // 연도 오타(2026→2020)가 통과하면 이미 끝난 계약이 만들어지고, 보관 기간 계산에도
    // 곧바로 걸린다. 실무에서 있을 법한 범위만 받는다.
    const shift = (months: number, extraDays = 0): string => {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      d.setDate(d.getDate() + extraDays);
      return d.toISOString().slice(0, 10);
    };

    it('몇 년 전 시작일은 거부한다', () => {
      expect(
        errorFields({ ...validPayload(), startDate: shift(-72), endDate: shift(-66) }),
      ).toContain('startDate');
    });

    it('먼 미래 시작일도 거부한다', () => {
      expect(
        errorFields({ ...validPayload(), startDate: shift(60), endDate: shift(66) }),
      ).toContain('startDate');
    });

    it('가까운 과거는 허용한다 (지난 계약의 뒤늦은 문서화)', () => {
      expect(errorFields({ ...validPayload(), startDate: shift(-2), endDate: shift(4) })).toEqual([]);
    });

    it('가까운 미래는 허용한다 (선계약)', () => {
      expect(errorFields({ ...validPayload(), startDate: shift(3), endDate: shift(9) })).toEqual([]);
    });
  });

  describe('최소 계약 기간', () => {
    it('1개월 미만은 거부한다', () => {
      expect(errorFields({ ...validPayload(), startDate: '2026-08-01', endDate: '2026-08-02' })).toContain('endDate');
      expect(errorFields({ ...validPayload(), startDate: '2026-08-01', endDate: '2026-08-31' })).toContain('endDate');
    });

    it('정확히 1개월은 통과한다', () => {
      expect(errorFields({ ...validPayload(), startDate: '2026-08-01', endDate: '2026-09-01' })).toEqual([]);
    });

    it('말일에서 시작해도 1개월을 정확히 판정한다', () => {
      // 1/31 + 1개월은 2/28로 본다. 3/3까지 요구하면 정당한 계약이 막힌다.
      expect(errorFields({ ...validPayload(), startDate: '2026-01-31', endDate: '2026-02-28' })).toEqual([]);
      expect(errorFields({ ...validPayload(), startDate: '2026-01-31', endDate: '2026-02-20' })).toContain('endDate');
    });

    it('6개월·12개월 계약도 통과한다', () => {
      expect(errorFields({ ...validPayload(), startDate: '2026-08-01', endDate: '2027-02-01' })).toEqual([]);
      expect(errorFields({ ...validPayload(), startDate: '2026-08-01', endDate: '2027-08-01' })).toEqual([]);
    });
  });

  it('종료일이 시작일보다 앞서면 거부한다', () => {
    expect(
      errorFields({ ...validPayload(), startDate: '2026-11-01', endDate: '2026-08-01' }),
    ).toContain('endDate');
  });

  it('종료일과 시작일이 같으면 거부한다', () => {
    expect(
      errorFields({ ...validPayload(), startDate: '2026-08-01', endDate: '2026-08-01' }),
    ).toContain('endDate');
  });

  it('날짜 형식이 잘못되면 거부한다', () => {
    expect(errorFields({ ...validPayload(), startDate: '언젠가' })).toContain('startDate');
  });

  it('월 이용료는 0보다 커야 한다', () => {
    expect(errorFields({ ...validPayload(), monthlyRent: 0 })).toContain('monthlyRent');
    expect(errorFields({ ...validPayload(), monthlyRent: -1000 })).toContain('monthlyRent');
  });

  it('보증금은 0을 허용한다', () => {
    expect(errorFields({ ...validPayload(), depositAmount: 0 })).toEqual([]);
  });

  it('금액 상한을 넘으면 거부한다 (0을 잘못 붙인 입력 방지)', () => {
    expect(errorFields({ ...validPayload(), monthlyRent: 30_000_000 })).toContain('monthlyRent');
  });

  it('금액은 정수만 받는다', () => {
    expect(errorFields({ ...validPayload(), monthlyRent: 300000.5 })).toContain('monthlyRent');
  });

  it('납부일은 1~31 사이여야 한다', () => {
    expect(errorFields({ ...validPayload(), paymentDay: 0 })).toContain('paymentDay');
    expect(errorFields({ ...validPayload(), paymentDay: 32 })).toContain('paymentDay');
    expect(errorFields({ ...validPayload(), paymentDay: 31 })).toEqual([]);
  });

  it('납부일을 생략하면 통과하고 값은 비어 있다', () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).paymentDay;

    const result = validateCreateContractPayload(payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.paymentDay).toBeUndefined();
  });

  it('생년월일은 YYYY-MM-DD 형식만 받는다', () => {
    expect(errorFields({ ...validPayload(), customerBirthdate: '90/01/01' })).toContain(
      'customerBirthdate',
    );
    expect(errorFields({ ...validPayload(), customerBirthdate: '1990-01-01' })).toEqual([]);
  });

  it('특약사항의 빈 항목은 걸러낸다', () => {
    const result = validateCreateContractPayload({
      ...validPayload(),
      specialTerms: ['첫 번째 특약', '   ', ''],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.specialTerms).toEqual(['첫 번째 특약']);
  });

  it('특약사항 개수 상한을 넘으면 거부한다', () => {
    expect(
      errorFields({ ...validPayload(), specialTerms: Array.from({ length: 11 }, (_, i) => `특약${i}`) }),
    ).toContain('specialTerms');
  });

  describe('한 줄 입력의 제어문자 차단', () => {
    // 파이프를 막아도 줄바꿈이 <br>로 살아남아 표 한 칸에 문구를 심을 수 있었다.
    it.each([
      ['줄바꿈', '홍길동\n보증금 면제 확정'],
      ['CRLF', '홍길동\r\n위약금 없음'],
      ['탭', '홍길동\t\t승인됨'],
      ['제로폭 문자', '홍길​동'],
      ['ANSI 제어문자', '홍길동[31m'],
      ['줄 구분자', '홍길동 승인'],
    ])('이름의 %s를 거부한다', (_label, name) => {
      expect(errorFields({ ...validPayload(), customerName: name })).toContain('customerName');
    });

    it('주소·호실 등 다른 한 줄 항목에도 같은 규칙이 적용된다', () => {
      expect(errorFields({ ...validPayload(), customerAddress: '서울시\n| 특약 | 없음 |' })).toContain(
        'customerAddress',
      );
      expect(errorFields({ ...validPayload(), roomNumber: 'A\n관리자동' })).toContain('roomNumber');
    });

    it('특약사항의 제어문자도 거부한다', () => {
      expect(
        errorFields({ ...validPayload(), specialTerms: ['정상 특약', '위약금\n면제'] }),
      ).toContain('specialTerms');
    });

    // 방향 제어는 embedding/override만 막으면 isolate로 우회된다. 화면·PDF에 보이는
    // 글자가 저장된 값과 달라지면 "보이는 대로 합의했다"는 전제가 무너진다.
    it.each([
      ['RLO override', '‮홍길동'],
      ['RLI isolate', '⁦홍길동⁩'],
      ['LRI isolate', '⁧보증금 면제⁩'],
      ['FSI isolate', '⁨홍길동⁩'],
      ['PDI 단독', '홍길동⁩'],
      ['word joiner', '홍⁠길동'],
      ['Arabic letter mark', '홍؜길동'],
      ['soft hyphen', '홍­길동'],
      ['interlinear annotation', '홍￹길동￻'],
    ])('이름의 %s를 거부한다', (_label, name) => {
      expect(errorFields({ ...validPayload(), customerName: name })).toContain('customerName');
    });

    it('정상적인 한글·공백·기호는 그대로 통과한다', () => {
      const result = validateCreateContractPayload({
        ...validPayload(),
        customerName: '홍 길동',
        customerAddress: '서울특별시 은평구 대조동 84-3, 3층',
      });
      expect(result.ok).toBe(true);
    });
  });

  it('지나치게 긴 이름은 거부한다', () => {
    expect(errorFields({ ...validPayload(), customerName: '가'.repeat(61) })).toContain(
      'customerName',
    );
  });
});
