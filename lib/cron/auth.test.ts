/** @jest-environment node */

/**
 * 크론 엔드포인트 인증 검사.
 *
 * 세 크론(gsc-audit·purge-contracts·backup-contracts)이 이 함수 하나를 공유한다.
 * 그중 purge-contracts는 계약 개인정보를 삭제하고 backup-contracts는 전 계약을
 * Blob에 떠내므로, 여기가 열리면 파기와 유출이 동시에 가능해진다.
 */

import type { NextApiRequest } from 'next';

import { isCronAuthorized } from './auth';

const SECRET = 'cron-secret-value-0123456789';

const req = (authorization?: string): NextApiRequest =>
  ({ headers: authorization === undefined ? {} : { authorization } }) as NextApiRequest;

const original = process.env.CRON_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
  jest.restoreAllMocks();
});

describe('isCronAuthorized', () => {
  describe('CRON_SECRET이 설정된 경우', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = SECRET;
    });

    it('정확한 Bearer 토큰을 통과시킨다', () => {
      expect(isCronAuthorized(req(`Bearer ${SECRET}`), 'test')).toBe(true);
    });

    it('값이 틀리면 거부한다', () => {
      expect(isCronAuthorized(req('Bearer wrong-value'), 'test')).toBe(false);
    });

    it('앞자리만 맞는 값을 거부한다 (타이밍 대입 시나리오)', () => {
      expect(isCronAuthorized(req(`Bearer ${SECRET.slice(0, -1)}`), 'test')).toBe(false);
      expect(isCronAuthorized(req('Bearer c'), 'test')).toBe(false);
    });

    it('Bearer 접두사가 없으면 거부한다', () => {
      expect(isCronAuthorized(req(SECRET), 'test')).toBe(false);
    });

    it('헤더가 아예 없으면 거부한다', () => {
      expect(isCronAuthorized(req(), 'test')).toBe(false);
    });

    it('빈 문자열 헤더를 거부한다', () => {
      expect(isCronAuthorized(req(''), 'test')).toBe(false);
    });

    it('대소문자가 다른 접두사를 거부한다', () => {
      expect(isCronAuthorized(req(`bearer ${SECRET}`), 'test')).toBe(false);
    });
  });

  /**
   * fail-closed. 시크릿이 없을 때 열리면 누구나 개인정보 파기와 전체 백업을 트리거할 수 있다.
   * 크론이 조용히 멈추는 편이 조용히 열리는 것보다 낫고, 멈춘 사실은 로그로 남긴다.
   */
  describe('CRON_SECRET이 없는 경우', () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET;
    });

    it('어떤 헤더가 와도 거부한다', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(isCronAuthorized(req(`Bearer ${SECRET}`), 'test')).toBe(false);
      expect(isCronAuthorized(req('Bearer undefined'), 'test')).toBe(false);
      expect(isCronAuthorized(req(), 'test')).toBe(false);
    });

    it('멈춘 이유를 로그로 남긴다', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      isCronAuthorized(req('Bearer anything'), 'cron/purge-contracts');

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('cron/purge-contracts'));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('CRON_SECRET'));
    });
  });
});
