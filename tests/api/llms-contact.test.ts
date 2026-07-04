/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';
import llmsHandler, { CURATED_GUIDES } from '../../pages/api/llms';
import llmsFullHandler from '../../pages/api/llms-full';
import rssHandler from '../../pages/api/rss';
import { getAllStories } from '../../lib/stories';

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

// public/llms.txt(정적) → /api/llms 동적 단일화 시 이식한 큐레이션 상록 가이드 13종.
// 날짜순 Recent Stories에서 밀려나도 항상 인용 가능해야 하는 핵심 자산이므로
// slug 실존과 출력 포함을 함께 고정한다.
describe('curated evergreen guides', () => {
  const curatedSlugs = CURATED_GUIDES.flatMap((group) => group.items.map((item) => item.slug));

  it('lists 13 curated slugs, all present in the ko story catalog', () => {
    expect(curatedSlugs).toHaveLength(13);

    const koSlugs = new Set(getAllStories('ko').map((story) => story.slug));
    const missing = curatedSlugs.filter((slug) => !koSlugs.has(slug));
    expect(missing).toEqual([]);
  });

  it('renders every curated guide link and the award credential in llms.txt', () => {
    const { res, getBody } = createResponse();

    llmsHandler(createRequest(), res);
    const body = getBody();

    for (const slug of curatedSlugs) {
      expect(body).toContain(`/ko/stories/${slug})`);
    }
    expect(body).toContain('한국대중음악상');
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
