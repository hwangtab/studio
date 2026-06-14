/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';
import llmsHandler from '../../pages/api/llms';
import llmsFullHandler from '../../pages/api/llms-full';
import rssHandler from '../../pages/api/rss';

const createRequest = (query: Record<string, string> = {}): NextApiRequest =>
  ({
    method: 'GET',
    query,
  } as NextApiRequest);

const createResponse = () => {
  let body = '';
  const headers: Record<string, string> = {};

  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = String(value);
    },
    status() {
      return this;
    },
    send(payload: unknown) {
      body = String(payload);
      return this;
    },
    end(payload?: unknown) {
      body = payload === undefined ? '' : String(payload);
      return this;
    },
  } as unknown as NextApiResponse;

  return {
    res,
    getBody: () => body,
    getHeader: (name: string) => headers[name.toLowerCase()],
  };
};

describe('LLM contact metadata', () => {
  it('uses the current mobile number in llms.txt', () => {
    const { res, getBody } = createResponse();

    llmsHandler(createRequest(), res);

    expect(getBody()).toContain('+82-10-4255-7893');
    expect(getBody()).not.toContain('+82-507-1384-3144');
  });

  it('uses the current mobile number in llms-full.txt', () => {
    const { res, getBody, getHeader } = createResponse();

    llmsFullHandler(createRequest(), res);

    expect(getHeader('content-type')).toBe('text/plain; charset=utf-8');
    expect(getBody()).toContain('+82-10-4255-7893');
    expect(getBody()).not.toContain('+82-507-1384-3144');
  });
});

describe('external content index policy', () => {
  it('omits Korean stories with explicit noindex from llms-full.txt', () => {
    const { res, getBody } = createResponse();

    llmsFullHandler(createRequest({ locale: 'ko' }), res);

    expect(getBody()).not.toContain('/ko/stories/bulgwang-mixing-club-3rd)');
    expect(getBody()).not.toContain('/ko/stories/bulgwang-mixing-club)');
  });

  it('omits Korean stories with explicit noindex from RSS', () => {
    const { res, getBody } = createResponse();

    rssHandler(createRequest({ locale: 'ko' }), res);

    expect(getBody()).not.toContain('/ko/stories/bulgwang-mixing-club-3rd</link>');
    expect(getBody()).not.toContain('/ko/stories/bulgwang-mixing-club</link>');
  });
});
