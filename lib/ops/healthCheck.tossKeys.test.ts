import { checkTossApiKeyPair } from './healthCheck';

describe('checkTossApiKeyPair — 토스 API 개별 연동 키 쌍', () => {
  const saved = { c: process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY, s: process.env.TOSS_API_SECRET_KEY };
  afterEach(() => {
    if (saved.c === undefined) delete process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY; else process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY = saved.c;
    if (saved.s === undefined) delete process.env.TOSS_API_SECRET_KEY; else process.env.TOSS_API_SECRET_KEY = saved.s;
  });

  it('클라이언트 키만 있고 시크릿이 없으면 high — 값은 싣지 않는다', () => {
    process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY = 'live_ck_SECRETVALUE';
    delete process.env.TOSS_API_SECRET_KEY;
    const issue = checkTossApiKeyPair()!;
    expect(issue.severity).toBe('high');
    expect(issue.title).toContain('TOSS_API_SECRET_KEY');
    expect(`${issue.title}${issue.detail}`).not.toContain('SECRETVALUE');
  });

  it('둘 다 있거나 둘 다 없으면 보고하지 않는다', () => {
    process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY = 'live_ck_x';
    process.env.TOSS_API_SECRET_KEY = 'live_sk_x';
    expect(checkTossApiKeyPair()).toBeNull();
    delete process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY;
    delete process.env.TOSS_API_SECRET_KEY;
    expect(checkTossApiKeyPair()).toBeNull();
  });
});
