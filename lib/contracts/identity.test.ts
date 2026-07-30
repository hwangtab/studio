/** @jest-environment node */

import { IDENTITY_DIGITS, getIdentityDigits, verifyIdentityDigits } from './identity';

describe('서명자 본인 확인', () => {
  it('계약서 번호의 표기가 달라도 같은 뒷자리를 뽑는다', () => {
    for (const phone of ['010-1234-5678', '01012345678', '010 1234 5678', '+82 10-1234-5678']) {
      expect(getIdentityDigits(phone)).toBe('5678');
    }
  });

  it('맞는 뒷자리를 통과시킨다', () => {
    expect(verifyIdentityDigits('5678', '010-1234-5678')).toEqual({ ok: true });
  });

  it('입력에 하이픈·공백이 섞여도 숫자만 보고 판정한다', () => {
    expect(verifyIdentityDigits('56 78', '010-1234-5678')).toEqual({ ok: true });
  });

  it('틀린 뒷자리는 mismatch로 거부한다', () => {
    expect(verifyIdentityDigits('1234', '010-1234-5678')).toEqual({
      ok: false,
      reason: 'mismatch',
    });
  });

  it('자릿수가 맞지 않으면 malformed로 거부한다', () => {
    expect(verifyIdentityDigits('567', '010-1234-5678').ok).toBe(false);
    expect(verifyIdentityDigits('56789', '010-1234-5678').ok).toBe(false);
    expect(verifyIdentityDigits('', '010-1234-5678').ok).toBe(false);
  });

  it('문자열이 아닌 입력을 거부한다', () => {
    for (const value of [undefined, null, 5678, {}, []]) {
      expect(verifyIdentityDigits(value, '010-1234-5678').ok).toBe(false);
    }
  });

  // 계약서의 번호가 이상해 확인이 불가능한 경우와 입력이 틀린 경우는 대처가 다르다.
  it('계약서 번호가 짧으면 unverifiable로 구분한다', () => {
    expect(verifyIdentityDigits('5678', '123')).toEqual({ ok: false, reason: 'unverifiable' });
    expect(getIdentityDigits('12')).toBeNull();
  });

  it('확인에 쓰는 자릿수는 4자리다', () => {
    expect(IDENTITY_DIGITS).toBe(4);
  });
});
