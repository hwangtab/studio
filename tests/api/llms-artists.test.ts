/** @jest-environment node */

import { artistsLine } from '../../pages/api/llms';

jest.mock('../../data/artists', () => {
  const actual = jest.requireActual('../../data/artists');
  return { ...actual, getSupportedArtists: jest.fn() };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getSupportedArtists } = require('../../data/artists') as {
  getSupportedArtists: jest.Mock;
};

/**
 * llms.txt는 AI가 그대로 인용하는 문서다. 후원 가능한 아티스트가 0명인데도
 * "monthly patronage" 링크를 조건 없이 안내하면, AI 답변을 보고 들어온 사람이
 * 빈 목록(그리고 noindex 페이지)을 만난다 — fundingStatusLine과 같은 원칙.
 */

const SITE = 'https://studionol.co.kr';

describe('llms.txt 아티스트 후원 안내', () => {
  afterEach(() => getSupportedArtists.mockReset());

  it('아티스트가 0명이면 ko에서도 후원 링크를 싣지 않는다', () => {
    getSupportedArtists.mockReturnValue([]);
    expect(artistsLine(SITE, 'ko')).toBe('');
  });

  it('아티스트가 있으면 ko에서 후원 링크를 싣는다', () => {
    getSupportedArtists.mockReturnValue([{ slug: 'demo' }]);
    const line = artistsLine(SITE, 'ko');
    expect(line).toContain(`${SITE}/ko/artists`);
    expect(line).toContain('Support Artists');
  });

  it('아티스트가 있어도 ko가 아니면 링크를 싣지 않는다(결제 퍼널은 ko 전용)', () => {
    getSupportedArtists.mockReturnValue([{ slug: 'demo' }]);
    expect(artistsLine(SITE, 'en')).toBe('');
  });
});
