import { linkPhoneNumbers } from './phoneLinks';
import { CANONICAL_FACTS } from '../../lib/factTokens';

const PHONE = CANONICAL_FACTS.phone;
const HREF = `tel:${PHONE.replace(/[^0-9+]/g, '')}`;

describe('linkPhoneNumbers', () => {
  it('평문 전화번호를 tel 링크로 바꾸되 표시 문자열은 유지한다', () => {
    expect(linkPhoneNumbers(`문의는 ${PHONE}로 주세요.`)).toBe(
      `문의는 [${PHONE}](${HREF})로 주세요.`
    );
  });

  it('tel href에서 하이픈을 제거한다 (일부 다이얼러가 실패)', () => {
    expect(HREF).not.toContain('-');
    expect(linkPhoneNumbers(PHONE)).toContain(HREF);
  });

  it('한 문서에 여러 번 나와도 전부 바꾼다', () => {
    const out = linkPhoneNumbers(`${PHONE} 또는 ${PHONE}`);
    expect(out.match(/\]\(tel:/g)).toHaveLength(2);
  });

  it('이미 링크인 번호를 이중으로 감싸지 않는다', () => {
    const already = `[${PHONE}](${HREF})`;
    expect(linkPhoneNumbers(already)).toBe(already);
  });

  it('링크의 표시 텍스트로 쓰인 번호도 건드리지 않는다', () => {
    const src = `[전화 ${PHONE}](/contact)`;
    expect(linkPhoneNumbers(src)).toBe(src);
  });

  it('코드 펜스·인라인 코드 안은 건너뛴다', () => {
    const fence = '```\n' + PHONE + '\n```';
    expect(linkPhoneNumbers(fence)).toBe(fence);
    expect(linkPhoneNumbers(`\`${PHONE}\``)).toBe(`\`${PHONE}\``);
  });

  it('헤딩 줄은 건너뛴다 (헤딩 id·목차 앵커가 어긋난다)', () => {
    const heading = `## 전화 ${PHONE} 안내`;
    expect(linkPhoneNumbers(heading)).toBe(heading);
  });

  it('전화번호가 없으면 원문 그대로 반환한다', () => {
    const src = '전화번호가 없는 본문입니다.';
    expect(linkPhoneNumbers(src)).toBe(src);
  });
});
