import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Info } from '@/lib/lucide-icons';
import HubLocaleContentSection from './HubLocaleContentSection';

describe('HubLocaleContentSection', () => {
  it('renders localized hub cards when content is available', () => {
    render(
      <HubLocaleContentSection
        icon={Info}
        content={{
          title: 'Localized guide',
          items: [
            { heading: 'First heading', body: 'First body' },
            { heading: 'Second heading', body: 'Second body' },
          ],
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Localized guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First heading' })).toBeInTheDocument();
    expect(screen.getByText('Second body')).toBeInTheDocument();
  });

  it('renders nothing when content is missing', () => {
    const { container } = render(
      <HubLocaleContentSection icon={Info} content={null} />
    );

    expect(container.firstChild).toBeNull();
  });
});
