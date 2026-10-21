import { birthdateErrorMessage, formatBirthdateInput, isUnder19, parseBirthdate } from './birthdate';

describe('formatBirthdateInput', () => {
  it('숫자만 남기고 하이픈을 넣는다', () => {
    expect(formatBirthdateInput('1')).toBe('1');
    expect(formatBirthdateInput('1990')).toBe('1990');
    expect(formatBirthdateInput('19901')).toBe('1990-1');
    expect(formatBirthdateInput('199001')).toBe('1990-01');
    expect(formatBirthdateInput('1990011')).toBe('1990-01-1');
    expect(formatBirthdateInput('19900115')).toBe('1990-01-15');
  });

  it('8자리를 넘는 숫자와 숫자가 아닌 글자는 버린다', () => {
    expect(formatBirthdateInput('1990-01-15 99')).toBe('1990-01-15');
    expect(formatBirthdateInput('1990.01.15')).toBe('1990-01-15');
    expect(formatBirthdateInput('abc')).toBe('');
  });

  it('하이픈을 지우면 뒤따르는 하이픈도 함께 정리된다', () => {
    expect(formatBirthdateInput('1990-')).toBe('1990');
  });

  it('이미 정리된 값은 그대로다(옛 임시 저장본도 같다)', () => {
    expect(formatBirthdateInput('1990-01-15')).toBe('1990-01-15');
  });
});

describe('parseBirthdate', () => {
  const now = new Date('2026-10-21T03:00:00.000Z');

  it('실제 있는 날짜는 서버가 받는 YYYY-MM-DD 그대로 돌려준다', () => {
    expect(parseBirthdate('1990-01-15', now)).toEqual({ ok: true, value: '1990-01-15' });
    expect(parseBirthdate('2000-02-29', now)).toEqual({ ok: true, value: '2000-02-29' });
  });

  it('덜 쳤거나 비었으면 오류가 아니라 미완성이다', () => {
    expect(parseBirthdate('', now)).toEqual({ ok: false, reason: 'empty' });
    expect(parseBirthdate('1990-01', now)).toEqual({ ok: false, reason: 'incomplete' });
  });

  it('없는 날짜를 거른다', () => {
    expect(parseBirthdate('1990-02-30', now)).toEqual({ ok: false, reason: 'invalid' });
    expect(parseBirthdate('1990-13-01', now)).toEqual({ ok: false, reason: 'invalid' });
    expect(parseBirthdate('2001-02-29', now)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('미래·120세 초과는 서버와 같이 거른다', () => {
    expect(parseBirthdate('2030-01-01', now)).toEqual({ ok: false, reason: 'future' });
    expect(parseBirthdate('1890-01-01', now)).toEqual({ ok: false, reason: 'too-old' });
  });
});

describe('birthdateErrorMessage', () => {
  it('덜 친 동안은 조용하다가 eager일 때만 안내한다', () => {
    expect(birthdateErrorMessage({ ok: false, reason: 'incomplete' }, false)).toBeUndefined();
    expect(birthdateErrorMessage({ ok: false, reason: 'incomplete' }, true)).toContain('19900115');
    expect(birthdateErrorMessage({ ok: false, reason: 'invalid' }, false)).toContain('없는 날짜');
    expect(birthdateErrorMessage({ ok: true, value: '1990-01-15' }, true)).toBeUndefined();
  });
});

describe('isUnder19', () => {
  const now = new Date('2026-10-21T03:00:00.000Z');

  it('서버(validateSignerDetails)와 같은 기준으로 만 19세 미만을 가른다', () => {
    expect(isUnder19('2010-01-01', now)).toBe(true);
    expect(isUnder19('2000-01-01', now)).toBe(false);
    expect(isUnder19('2007-10-01', now)).toBe(false);
  });

  it('날짜가 아니면 미성년으로 보지 않는다', () => {
    expect(isUnder19('2010-0', now)).toBe(false);
  });
});
