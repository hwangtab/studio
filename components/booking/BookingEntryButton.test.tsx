import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import BookingEntryButton from './BookingEntryButton';

describe('BookingEntryButton', () => {
  it('renders a link to the booking flow when locale is ko', () => {
    render(<BookingEntryButton service="recording" locale="ko" />);

    const link = screen.getByRole('link', { name: '온라인 예약' });
    expect(link).toHaveAttribute('href', '/ko/booking/recording');
  });

  it('renders nothing for non-ko locales', () => {
    const { container } = render(<BookingEntryButton service="recording" locale="en" />);

    expect(container).toBeEmptyDOMElement();
  });
});
