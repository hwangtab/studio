import { getPageLastmod, getRouteLastmod, formatLastmodDate } from './pageLastmod';
import pageLastmodJson from './sitemap/pageLastmod.json';

const TABLE = pageLastmodJson as Record<string, string>;

describe('getPageLastmod', () => {
  it('returns the ISO timestamp recorded for a known page file', () => {
    expect(getPageLastmod('pages/[locale]/recording.tsx')).toBe(
      TABLE['pages/[locale]/recording.tsx']
    );
  });

  it('returns null for a page file with no entry', () => {
    expect(getPageLastmod('pages/[locale]/does-not-exist.tsx')).toBeNull();
  });
});

describe('getRouteLastmod', () => {
  it('resolves a route to its pages/[locale]/<route>.tsx lastmod', () => {
    expect(getRouteLastmod('/recording')).toBe(TABLE['pages/[locale]/recording.tsx']);
  });

  it('maps the root route "/" to index.tsx', () => {
    expect(getRouteLastmod('/')).toBe(TABLE['pages/[locale]/index.tsx']);
  });

  it('returns null for a route with no lastmod entry', () => {
    expect(getRouteLastmod('/this-route-does-not-exist')).toBeNull();
  });

  it('trims leading/trailing slashes before resolving', () => {
    expect(getRouteLastmod('recording/')).toBe(getRouteLastmod('/recording'));
  });
});

describe('formatLastmodDate', () => {
  it('formats an ISO timestamp down to YYYY-MM-DD', () => {
    expect(formatLastmodDate('2026-09-01T23:52:58.000Z')).toBe('2026-09-01');
  });

  it('returns null when given null', () => {
    expect(formatLastmodDate(null)).toBeNull();
  });

  it('returns null for an unparseable date string', () => {
    expect(formatLastmodDate('not-a-date')).toBeNull();
  });
});
