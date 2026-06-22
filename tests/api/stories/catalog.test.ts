/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/stories/catalog';

const createRequest = (overrides: Partial<NextApiRequest> = {}): NextApiRequest =>
  ({
    method: 'GET',
    query: { locale: 'ko' },
    ...overrides,
  } as unknown as NextApiRequest);

const createResponse = () => {
  let statusCode = 200;
  let jsonBody: unknown;
  const headers: Record<string, string> = {};

  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = String(value);
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonBody = payload;
      return this;
    },
  } as unknown as NextApiResponse;

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => jsonBody as Record<string, unknown>,
    getHeader: (name: string) => headers[name.toLowerCase()],
  };
};

describe('stories catalog api', () => {
  it('rejects non-GET requests', () => {
    const req = createRequest({ method: 'POST' });
    const { res, getStatus, getBody, getHeader } = createResponse();

    handler(req, res);

    expect(getStatus()).toBe(405);
    expect(getHeader('allow')).toBe('GET');
    expect(getBody()).toEqual({ error: 'Method Not Allowed' });
  });
});
