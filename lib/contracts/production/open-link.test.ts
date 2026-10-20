import { maskEmail, normalizeMobile, validateOpenLinkClient } from './open-link';
import { isLinkPreviewBot } from './view-log';

describe('링크 계약 — 서명 화면 입력', () => {
  it('휴대폰 번호는 하이픈 꼴로 정리해 계약서에 같은 모양으로 인쇄된다', () => {
    expect(normalizeMobile('01012345678')).toBe('010-1234-5678');
    expect(normalizeMobile('010 1234 5678')).toBe('010-1234-5678');
    expect(normalizeMobile('0111234567')).toBe('011-123-4567');
    expect(normalizeMobile('+82 10')).toBe('+82 10');
  });

  it('이메일은 소문자로, 번호는 정리해서 돌려준다', () => {
    const result = validateOpenLinkClient({ clientName: ' 김의뢰 ', clientEmail: 'A@B.COM', clientPhone: '01098765432' });
    expect(result.ok && result.data).toEqual({ clientName: '김의뢰', clientStageName: null, clientEmail: 'a@b.com', clientPhone: '010-9876-5432' });
  });

  it('완료 화면은 서명본을 보낸 주소를 가려서 보인다', () => {
    expect(maskEmail('abcdef@gmail.com')).toBe('ab***@gmail.com');
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
    expect(maskEmail('')).toBe('');
  });

  it('카카오톡 링크 미리보기 수집기는 열람으로 세지 않는다', () => {
    expect(isLinkPreviewBot('facebookexternalhit/1.1;kakaotalk-scrap/1.0;')).toBe(true);
    expect(isLinkPreviewBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.4.0')).toBe(false);
    expect(isLinkPreviewBot(null)).toBe(false);
  });
});
