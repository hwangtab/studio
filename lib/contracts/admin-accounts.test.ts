/** @jest-environment node */

/**
 * 관리자 계정 — 비밀번호가 곧 신원이라는 전제를 고정한다.
 *
 * 이 전제가 깨지는 방식은 하나뿐이다: **두 사람이 같은 비밀번호를 쓰는 것.** 그러면
 * 접속기록이 엉뚱한 사람을 가리키는데, 화면에도 로그에도 이상이 안 보인다. 그래서
 * 기동을 세우고, 그 성질을 여기서 지킨다.
 */

import {
  ADMIN_FALLBACK_ID,
  ADMIN_FALLBACK_NAME,
  MIN_PASSWORD_LENGTH,
  parseAdminAccounts,
  resolveAdminAccounts,
} from './admin-accounts';
import { PRIVACY_ACTOR_ADMIN } from '../privacy/accessLog';

jest.mock('../../db/client', () => ({ getDb: jest.fn() }));

const PW_A = 'correct-horse-battery-1';
const PW_B = 'correct-horse-battery-2';

describe('parseAdminAccounts', () => {
  it('값이 없으면 null — 폴백 경로로 간다', () => {
    expect(parseAdminAccounts(undefined)).toBeNull();
    expect(parseAdminAccounts('')).toBeNull();
    expect(parseAdminAccounts('   ')).toBeNull();
  });

  it('계정을 읽는다', () => {
    const accounts = parseAdminAccounts(
      JSON.stringify([
        { id: 'kyungha', name: '황경하', password: PW_A },
        { id: 'jina', name: '지나', password: PW_B },
      ]),
    );
    expect(accounts).toEqual([
      { id: 'kyungha', name: '황경하', password: PW_A },
      { id: 'jina', name: '지나', password: PW_B },
    ]);
  });

  it('비밀번호가 겹치면 던진다 — 누구인지 가릴 수 없는 설정이다', () => {
    const raw = JSON.stringify([
      { id: 'kyungha', name: '황경하', password: PW_A },
      { id: 'jina', name: '지나', password: PW_A },
    ]);
    expect(() => parseAdminAccounts(raw)).toThrow(/kyungha.*jina|jina.*kyungha/);
  });

  it('겹침 오류 문구에 비밀번호를 담지 않는다', () => {
    const raw = JSON.stringify([
      { id: 'kyungha', name: '황경하', password: PW_A },
      { id: 'jina', name: '지나', password: PW_A },
    ]);
    let message = '';
    try {
      parseAdminAccounts(raw);
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(PW_A);
  });

  it.each([
    ['대문자', 'Kyungha'],
    ['공백', 'kyung ha'],
    ['한 글자', 'k'],
    ['33자', 'a'.repeat(33)],
    ['점', 'kyung.ha'],
  ])('id가 %s이면 던진다', (_label, id) => {
    expect(() => parseAdminAccounts(JSON.stringify([{ id, name: '아무개', password: PW_A }]))).toThrow(/id/);
  });

  it('id가 겹치면 던진다', () => {
    const raw = JSON.stringify([
      { id: 'kyungha', name: '황경하', password: PW_A },
      { id: 'kyungha', name: '다른 사람', password: PW_B },
    ]);
    expect(() => parseAdminAccounts(raw)).toThrow(/두 번/);
  });

  it(`비밀번호가 ${MIN_PASSWORD_LENGTH}자 미만이면 던진다`, () => {
    const raw = JSON.stringify([{ id: 'kyungha', name: '황경하', password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) }]);
    expect(() => parseAdminAccounts(raw)).toThrow(/password/);
  });

  it('name이 비어 있으면 던진다', () => {
    expect(() => parseAdminAccounts(JSON.stringify([{ id: 'kyungha', name: '  ', password: PW_A }]))).toThrow(/name/);
  });

  it.each([['JSON이 아니면', 'not-json'], ['배열이 아니면', '{"id":"a"}'], ['빈 배열이면', '[]']])(
    '%s 던진다',
    (_label, raw) => {
      expect(() => parseAdminAccounts(raw)).toThrow(/ADMIN_ACCOUNTS/);
    },
  );
});

describe('resolveAdminAccounts — ADMIN_PASSWORD 폴백', () => {
  it('ADMIN_ACCOUNTS가 없으면 ADMIN_PASSWORD 한 사람으로 떨어진다', () => {
    expect(resolveAdminAccounts({ ADMIN_PASSWORD: PW_A })).toEqual([
      { id: ADMIN_FALLBACK_ID, name: ADMIN_FALLBACK_NAME, password: PW_A },
    ]);
  });

  it('폴백 id는 예전 접속기록의 actor와 같은 문자열이다', () => {
    expect(ADMIN_FALLBACK_ID).toBe(PRIVACY_ACTOR_ADMIN);
  });

  it('ADMIN_ACCOUNTS가 있으면 ADMIN_PASSWORD는 무시된다', () => {
    const accounts = resolveAdminAccounts({
      ADMIN_ACCOUNTS: JSON.stringify([{ id: 'kyungha', name: '황경하', password: PW_A }]),
      ADMIN_PASSWORD: PW_B,
    });
    expect(accounts).toEqual([{ id: 'kyungha', name: '황경하', password: PW_A }]);
  });

  it('둘 다 없으면 빈 목록 — 로그인 자체가 불가능하다', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveAdminAccounts({})).toEqual([]);
    spy.mockRestore();
  });

  it(`ADMIN_PASSWORD가 ${MIN_PASSWORD_LENGTH}자 미만이면 빈 목록`, () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveAdminAccounts({ ADMIN_PASSWORD: 'short' })).toEqual([]);
    spy.mockRestore();
  });
});
