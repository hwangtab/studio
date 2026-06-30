import React from 'react';
import { toHeadingId } from './headings';

describe('toHeadingId', () => {
  it('normalizes whitespace and punctuation while keeping Korean text', () => {
    expect(toHeadingId('보컬 믹싱: 준비 체크리스트!')).toBe('보컬-믹싱-준비-체크리스트');
  });

  it('extracts text from nested React children', () => {
    expect(
      toHeadingId(
        <>
          Studio <strong>NOL</strong> Guide
        </>
      )
    ).toBe('studio-nol-guide');
  });

  it('falls back to section when no text remains', () => {
    expect(toHeadingId('!!!')).toBe('section');
  });
});
