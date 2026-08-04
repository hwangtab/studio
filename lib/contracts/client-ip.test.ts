/** @jest-environment node */

import type { NextApiRequest } from 'next';

import { getClientIp } from './client-ip';

const request = (
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string,
): NextApiRequest =>
  ({ headers, socket: { remoteAddress } }) as unknown as NextApiRequest;

describe('접속 IP 판정', () => {
  it('Vercel이 넣은 헤더를 쓴다', () => {
    expect(getClientIp(request({ 'x-vercel-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('체인이 오면 맨 앞(실제 접속자)을 쓴다', () => {
    expect(
      getClientIp(request({ 'x-vercel-forwarded-for': '203.0.113.9, 70.41.3.18' })),
    ).toBe('203.0.113.9');
  });

  it('헤더가 없으면 소켓 주소로 내려간다 (로컬 개발)', () => {
    expect(getClientIp(request({}, '127.0.0.1'))).toBe('127.0.0.1');
  });

  it('어느 쪽으로도 못 얻으면 null이다', () => {
    expect(getClientIp(request({}))).toBeNull();
    expect(getClientIp(request({}, ''))).toBeNull();
  });

  /**
   * 이 파일이 존재하는 이유. x-forwarded-for는 누구나 요청에 직접 넣을 수 있어서,
   * 그 값을 그대로 쓰면 서명자가 계약서에 남의 IP를 적어 넣거나 대입을 시도하는 쪽이
   * 헤더만 바꿔 요청 제한을 피할 수 있다.
   */
  describe('위조 시도', () => {
    it('클라이언트가 보낸 x-forwarded-for를 믿지 않는다', () => {
      const forged = request({ 'x-forwarded-for': '1.2.3.4' }, '203.0.113.9');
      expect(getClientIp(forged)).toBe('203.0.113.9');
    });

    it('Vercel 헤더가 있으면 x-forwarded-for는 무시된다', () => {
      const forged = request({
        'x-forwarded-for': '1.2.3.4',
        'x-vercel-forwarded-for': '203.0.113.9',
      });
      expect(getClientIp(forged)).toBe('203.0.113.9');
    });

    it('x-forwarded-for만 있으면 아무것도 얻지 못한 것으로 본다', () => {
      expect(getClientIp(request({ 'x-forwarded-for': '1.2.3.4' }))).toBeNull();
    });
  });
});
