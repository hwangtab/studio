import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import PriceBreakdown from './PriceBreakdown';

describe('PriceBreakdown', () => {
  it('상품가·VAT·합계를 항목별 줄로, 천 단위 구분으로 보여준다', () => {
    render(<PriceBreakdown amounts={{ itemAmount: 250000, vatAmount: 25000, totalAmount: 275000 }} />);
    const dl = screen.getByLabelText('금액 요약').querySelector('dl')!;
    expect(dl).toHaveTextContent('상품가');
    expect(dl).toHaveTextContent('250,000원');
    expect(dl).toHaveTextContent('VAT');
    expect(dl).toHaveTextContent('25,000원');
    expect(dl).toHaveTextContent('합계');
    expect(dl).toHaveTextContent('275,000원');
  });

  it('합계 한 줄로 뭉개지 않는다', () => {
    render(<PriceBreakdown amounts={{ itemAmount: 100000, vatAmount: 10000, totalAmount: 110000 }} />);
    expect(screen.getByText(/상품가/)).toBeInTheDocument();
    expect(screen.getByText(/VAT/)).toBeInTheDocument();
    expect(screen.getByText('110,000원')).toBeInTheDocument();
  });
});
