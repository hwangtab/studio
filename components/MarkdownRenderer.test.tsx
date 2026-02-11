import React from 'react';
import { render, screen } from '@testing-library/react';
import MarkdownRenderer from './MarkdownRenderer';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt || ''} {...props} />,
}));

describe('MarkdownRenderer link protocol filtering', () => {
  it('renders allowed protocols and relative links', () => {
    render(<MarkdownRenderer locale="ko" content={'[Safe](https://example.com) [Local](/stories/story-1) [Mail](mailto:test@example.com)'} />);

    expect(screen.getByRole('link', { name: 'Safe' }).getAttribute('href')).toBe('https://example.com');
    expect(screen.getByRole('link', { name: 'Mail' }).getAttribute('href')).toBe('mailto:test@example.com');
    expect(screen.getByRole('link', { name: 'Local' }).getAttribute('href')).toBe('/ko/stories/story-1');
  });

  it('blocks dangerous protocols and keeps plain text', () => {
    render(<MarkdownRenderer locale="ko" content={'[JS](javascript:alert(1)) [Data](data:text/html;base64,abc) [VB](vbscript:msgbox(1))'} />);

    expect(screen.queryByRole('link', { name: 'JS' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Data' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'VB' })).toBeNull();
    expect(screen.getByText('JS')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.getByText('VB')).toBeTruthy();
  });

});
