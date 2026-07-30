/** @jest-environment node */

import {
  IDENTITY_DIGITS,
  getIdentityDigits,
  maskIdentityDigitsInContent,
  verifyIdentityDigits,
} from './identity';

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

describe('서명 화면의 확인 값 가리기', () => {
  const contentWith = (phone: string) => `| 연락처 | ${phone} |\n\n문의: ${phone}`;

  it('계약서에 적힌 연락처의 뒷자리를 가린다', () => {
    const masked = maskIdentityDigitsInContent(contentWith('010-1234-5678'), '010-1234-5678');

    expect(masked).not.toContain('5678');
    expect(masked).toContain('010-1234-****');
  });

  it('같은 번호가 여러 번 나와도 모두 가린다', () => {
    const masked = maskIdentityDigitsInContent(contentWith('010-1234-5678'), '010-1234-5678');
    expect(masked.match(/\*\*\*\*/g)?.length).toBe(2);
  });

  it('하이픈이 없는 표기도 가린다', () => {
    const masked = maskIdentityDigitsInContent(contentWith('01012345678'), '01012345678');
    expect(masked).not.toContain('5678');
    expect(masked).toContain('0101234****');
  });

  it('앞자리는 그대로 남겨 본인이 자기 번호를 알아볼 수 있게 한다', () => {
    const masked = maskIdentityDigitsInContent(contentWith('010-1234-5678'), '010-1234-5678');
    expect(masked).toContain('010-1234');
  });

  it('가릴 수 없는 번호는 본문을 그대로 둔다', () => {
    const content = contentWith('123');
    expect(maskIdentityDigitsInContent(content, '123')).toBe(content);
    expect(maskIdentityDigitsInContent(content, '')).toBe(content);
  });

  it('본문에 번호가 없으면 아무것도 바꾸지 않는다', () => {
    const content = '# 계약서\n\n연락처 없음';
    expect(maskIdentityDigitsInContent(content, '010-1234-5678')).toBe(content);
  });
});
