import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReleaseDiscographySection from './ReleaseDiscographySection';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt || ''} {...props} />
  ),
}));

const items = [
  {
    id: 'song-one',
    title: 'Song One',
    description: 'Produced at Studio NOL',
    image: '/images/song-one.webp',
    artist: 'Artist One',
    featured: true,
  },
];

describe('ReleaseDiscographySection', () => {
  it('renders discography proof cards and opens the selected item through the modal handler', () => {
    const onSelectItem = jest.fn();

    render(
      <ReleaseDiscographySection
        locale="ko"
        title="발매 디스코그래피"
        subtitle="실제 작업물"
        viewAllLabel="전체 보기"
        items={items}
        onSelectItem={onSelectItem}
      />
    );

    expect(screen.getByRole('heading', { name: '발매 디스코그래피' })).toBeInTheDocument();
    expect(screen.getByText('Artist One')).toBeInTheDocument();
    expect(screen.getByText('Song One')).toBeInTheDocument();
    expect(screen.getByAltText('Song One')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Song One/ }));

    expect(onSelectItem).toHaveBeenCalledWith('song-one');
  });

  it('renders nothing when there are no portfolio items', () => {
    const { container } = render(
      <ReleaseDiscographySection
        locale="ko"
        title="발매 디스코그래피"
        subtitle="실제 작업물"
        viewAllLabel="전체 보기"
        items={[]}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
