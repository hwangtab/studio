import type { NextApiRequest } from 'next';

const PRODUCTION_ORIGIN = 'https://studionol.co.kr';
const PRODUCTION_WWW_ORIGIN = 'https://www.studionol.co.kr';

const normalizeOrigin = (value: string): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getAllowedOrigins = (): string[] => {
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));

  const defaults = [
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL || ''),
    PRODUCTION_ORIGIN,
    PRODUCTION_WWW_ORIGIN,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3001' : null,
  ]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  return [...new Set([...defaults, ...envOrigins])];
};

export const isAllowedContactRequestOrigin = (req: NextApiRequest): boolean => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = normalizeOrigin(String(req.headers.origin || req.headers.referer || ''));
  return Boolean(requestOrigin && allowedOrigins.includes(requestOrigin));
};
