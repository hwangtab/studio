import { render, screen } from '@testing-library/react';
import PhoneAwareText from './PhoneAwareText';
import { CANONICAL_FACTS } from '../../lib/factTokens';

jest.mock('../../utils/analytics', () => ({ trackLeadEvent: jest.fn() }));

const PHONE = CANONICAL_FACTS.phone;
const INTL = CANONICAL_FACTS.phoneIntl;

describe('PhoneAwareText', () => {
  it('번호를 tel 링크로, 나머지는 평문으로 렌더한다', () => {
    render(<PhoneAwareText text={`문의는 ${PHONE}로 주세요.`} source="faq" />);
    const link = screen.getByRole('link', { name: PHONE });
    expect(link).toHaveAttribute('href', `tel:${PHONE.replace(/-/g, '')}`);
    expect(screen.getByText(/문의는/)).toBeInTheDocument();
  });

  it('한 문자열에 번호가 여러 번 나와도 전부 링크가 된다', () => {
    // 전역 정규식에 test()를 반복 호출하면 lastIndex 때문에 두 번째가 누락된다 —
    // 그 회귀를 막는 케이스다.
    render(<PhoneAwareText text={`${PHONE} 또는 ${PHONE}`} source="faq" />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('국제표기도 인식하고 국내표기로 잘리지 않는다', () => {
    render(<PhoneAwareText text={`해외에서는 ${INTL}`} source="faq" />);
    const link = screen.getByRole('link', { name: INTL });
    expect(link).toHaveAttribute('href', `tel:${INTL.replace(/[^0-9+]/g, '')}`);
  });

  it('번호가 없으면 원문을 그대로 렌더한다', () => {
    render(<PhoneAwareText text="번호 없는 답변입니다." source="faq" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('번호 없는 답변입니다.')).toBeInTheDocument();
  });
});
