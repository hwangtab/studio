import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import PriceBreakdown from './PriceBreakdown';

describe('PriceBreakdown', () => {
  it('공급가액·VAT·합계를 항목별 줄로, 천 단위 구분으로 보여준다 (합계가 화면 가격이다)', () => {
    render(<PriceBreakdown amounts={{ itemAmount: 227273, vatAmount: 22727, totalAmount: 250000 }} />);
    const dl = screen.getByLabelText('금액 요약').querySelector('dl')!;
    expect(dl).toHaveTextContent('공급가액');
    expect(dl).toHaveTextContent('227,273원');
    expect(dl).toHaveTextContent('VAT');
    expect(dl).toHaveTextContent('22,727원');
    expect(dl).toHaveTextContent('합계 (VAT 포함)');
    expect(dl).toHaveTextContent('250,000원');
  });

  it('합계 한 줄로 뭉개지 않는다', () => {
    render(<PriceBreakdown amounts={{ itemAmount: 90909, vatAmount: 9091, totalAmount: 100000 }} label="믹싱" />);
    expect(screen.getByText('믹싱 (공급가액)')).toBeInTheDocument();
    expect(screen.getByText('VAT')).toBeInTheDocument();
    expect(screen.getByText('100,000원')).toBeInTheDocument();
  });
});
