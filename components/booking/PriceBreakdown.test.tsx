import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import PriceBreakdown from './PriceBreakdown';

describe('PriceBreakdown', () => {
  it('shows the item amount, VAT, and total broken out with thousands separators', () => {
    render(<PriceBreakdown amounts={{ itemAmount: 250000, vatAmount: 25000, totalAmount: 275000 }} />);

    expect(
      screen.getByText(
        (_, node) => node?.tagName.toLowerCase() === 'p' && node.textContent === '상품가 250,000원 + VAT 25,000원 = 합계 275,000원'
      )
    ).toBeInTheDocument();
  });

  it('never collapses the breakdown into a single total-only figure', () => {
    render(<PriceBreakdown amounts={{ itemAmount: 100000, vatAmount: 10000, totalAmount: 110000 }} />);

    expect(screen.getByText(/상품가/)).toBeInTheDocument();
    expect(screen.getByText(/VAT/)).toBeInTheDocument();
    expect(screen.getByText(/합계 110,000원/)).toBeInTheDocument();
  });
});
