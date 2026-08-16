/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';
import llmsHandler, { CURATED_GUIDES } from '../../pages/api/llms';
import llmsFullHandler from '../../pages/api/llms-full';
import rssHandler from '../../pages/api/rss';
import { getAllStories } from '../../lib/stories';

const createRequest = (query: Record<string, string> = {}, method = 'GET'): NextApiRequest =>
  ({
    method,
    query,
  } as NextApiRequest);

const createResponse = () => {
  let body = '';
  let statusCode = 200;
  const headers: Record<string, string> = {};

  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = String(value);
    },
    status(code: number) {
      statusCode = code;
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
    getStatus: () => statusCode,
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

// public/llms.txt(정적) → /api/llms 동적 단일화 시 이식한 큐레이션 상록 가이드.
// 날짜순 Recent Stories에서 밀려나도 항상 인용 가능해야 하는 핵심 자산이므로
// slug 실존과 출력 포함을 함께 고정한다.
describe('curated evergreen guides', () => {
  const curatedSlugs = CURATED_GUIDES.flatMap((group) => group.items.map((item) => item.slug));

  it('lists 16 curated slugs, all present in the ko story catalog', () => {
    expect(curatedSlugs).toHaveLength(16);
    // 같은 슬러그가 두 섹션에 들어가면 llms.txt에 중복 링크가 나간다.
    expect(new Set(curatedSlugs).size).toBe(curatedSlugs.length);

    const koSlugs = new Set(getAllStories('ko').map((story) => story.slug));
    const missing = curatedSlugs.filter((slug) => !koSlugs.has(slug));
    expect(missing).toEqual([]);
  });

  // GA4(docs/ga4-raw/llm_referrers.csv)가 AI 유입 실적을 확인해 준 글은 큐레이션에서
  // 빠지면 안 된다 — Recent Stories는 발행일 역순 50편이라 2026-04 백필분인 이 글들을
  // 담지 못하고, 결과적으로 ChatGPT가 이미 인용 중인 문서가 llms.txt 어디에도 없게 된다.
  it('includes the guides that AI assistants actually cite', () => {
    for (const slug of ['distribution1', 'mr-guide1', 'recording-price1', 'voiceactor1']) {
      expect(curatedSlugs).toContain(slug);
    }
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

// PageSpeed Insights의 'Agentic Browsing > llms.txt' 감사가 실패로 잡아낸 두 결함의
// 회귀 방지. (1) H1 부재 — llmstxt.org 스펙의 유일한 필수 요소, (2) HEAD 405 —
// 크롤러가 존재 확인용 HEAD를 먼저 보내면 "가져올 수 없음"으로 판정된다.
describe('llms.txt spec compliance (llmstxt.org)', () => {
  it.each([
    ['llms.txt', llmsHandler],
    ['llms-full.txt', llmsFullHandler],
  ])('starts %s with an H1 heading', (_name, handler) => {
    const { res, getBody } = createResponse();

    handler(createRequest(), res);

    const firstLine = getBody().split('\n')[0];
    expect(firstLine).toMatch(/^# \S/);
  });

  it.each([
    ['llms.txt', llmsHandler],
    ['llms-full.txt', llmsFullHandler],
  ])('answers HEAD %s with 200 so crawlers can probe it', (_name, handler) => {
    const { res, getStatus, getHeader } = createResponse();

    handler(createRequest({}, 'HEAD'), res);

    expect(getStatus()).toBe(200);
    expect(getHeader('content-type')).toBe('text/plain; charset=utf-8');
  });

  it.each([
    ['llms.txt', llmsHandler],
    ['llms-full.txt', llmsFullHandler],
  ])('still rejects unsafe methods on %s with 405', (_name, handler) => {
    const { res, getStatus, getHeader } = createResponse();

    handler(createRequest({}, 'POST'), res);

    expect(getStatus()).toBe(405);
    expect(getHeader('allow')).toBe('GET, HEAD');
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
