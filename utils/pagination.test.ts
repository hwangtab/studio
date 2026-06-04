/** @jest-environment node */

import { normalizePageNumber } from './pagination';

describe('normalizePageNumber', () => {
  it('falls back to the first page for invalid values', () => {
    expect(normalizePageNumber(undefined, 10)).toBe(1);
    expect(normalizePageNumber('abc', 10)).toBe(1);
    expect(normalizePageNumber('-2', 10)).toBe(1);
    expect(normalizePageNumber('0', 10)).toBe(1);
  });

  it('clamps values above the total page count', () => {
    expect(normalizePageNumber('999', 7)).toBe(7);
  });

  it('accepts the first page when there are no pages', () => {
    expect(normalizePageNumber('3', 0)).toBe(1);
  });
});
