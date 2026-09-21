/** @jest-environment node */
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));
jest.mock('../../../../lib/funding/creatorEmail', () => ({ sendCreatorLoginEmail: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../../lib/funding/creatorToken', () => ({
  issueCreatorLoginToken: jest.fn(),
  normalizeCreatorEmail: jest.requireActual('../../../../lib/funding/creatorToken').normalizeCreatorEmail,
}));
jest.mock('../../../../lib/funding/email', () => ({ sendCreatorLoginCapAlert: jest.fn().mockResolvedValue(null) }));
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/funding/creator/login';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { sendCreatorLoginEmail } from '../../../../lib/funding/creatorEmail';
import { issueCreatorLoginToken } from '../../../../lib/funding/creatorToken';
import { sendCreatorLoginCapAlert } from '../../../../lib/funding/email';

const call = async (body: unknown, method = 'POST') => {
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0], setHeader };
};

beforeEach(() => {
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(true);
  (sendCreatorLoginEmail as jest.Mock).mockResolvedValue(null);
  (issueCreatorLoginToken as jest.Mock).mockResolvedValue({ creatorId: 'c1', rawToken: 'raw-token-abc' });
  (sendCreatorLoginCapAlert as jest.Mock).mockResolvedValue(null);
});

it('POST가 아니면 405', async () => {
  const r = await call(undefined, 'GET');
  expect(r.status).toBe(405);
});

it('허용되지 않은 Origin이면 403', async () => {
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
  const r = await call({ email: 'a@b.com' });
  expect(r.status).toBe(403);
  expect(issueCreatorLoginToken).not.toHaveBeenCalled();
});

it('이메일 형식이 잘못되면 400', async () => {
  const r = await call({ email: 'not-an-email' });
  expect(r.status).toBe(400);
});

it('정상 요청 → 200, sendCreatorLoginEmail이 로그인 링크를 담아 호출됨', async () => {
  const r = await call({ email: 'Creator@Example.com' });
  expect(r.status).toBe(200);
  expect(issueCreatorLoginToken).toHaveBeenCalledWith('creator@example.com');
  expect(sendCreatorLoginEmail).toHaveBeenCalledWith(
    'creator@example.com',
    expect.stringContaining('token=raw-token-abc'),
  );
});

it('메일 발송이 실패해도 200이고 같은 문구다', async () => {
  const ok = await call({ email: 'a@b.com' });

  (sendCreatorLoginEmail as jest.Mock).mockResolvedValue('API_ERROR');
  const failed = await call({ email: 'a@b.com' });

  expect(failed.status).toBe(200);
  expect(failed.body).toEqual(ok.body);
});

it('등록 여부와 무관하게 같은 응답 — 토큰 발급 실패(issueCreatorLoginToken이 null)여도 200 + 같은 문구', async () => {
  const ok = await call({ email: 'a@b.com' });

  (sendCreatorLoginEmail as jest.Mock).mockClear();
  (issueCreatorLoginToken as jest.Mock).mockResolvedValue(null);
  const notIssued = await call({ email: 'a@b.com' });

  expect(notIssued.status).toBe(200);
  expect(notIssued.body).toEqual(ok.body);
  expect(sendCreatorLoginEmail).not.toHaveBeenCalled();
});

it('IP 한도 초과 → 429', async () => {
  (consumeRateLimit as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(!key.startsWith('creator_login:ip:')));
  const r = await call({ email: 'a@b.com' });
  expect(r.status).toBe(429);
});

it('이메일 한도 초과 → 429가 아니라 200 + 같은 문구(존재 여부를 흘리지 않음)', async () => {
  const ok = await call({ email: 'a@b.com' });

  (issueCreatorLoginToken as jest.Mock).mockClear();
  (consumeRateLimit as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(!key.startsWith('creator_login:email:')));
  const limited = await call({ email: 'a@b.com' });

  expect(limited.status).toBe(200);
  expect(limited.body).toEqual(ok.body);
  expect(issueCreatorLoginToken).not.toHaveBeenCalled();
});

it('이메일 요청 제한 키는 접두사만이 아니라 평문 이메일 자체도 담지 않는다(해시 처리 고정)', async () => {
  const seenKeys: string[] = [];
  (consumeRateLimit as jest.Mock).mockImplementation((key: string) => {
    seenKeys.push(key);
    return Promise.resolve(true);
  });
  await call({ email: 'a@b.com' });

  const emailKey = seenKeys.find((key) => key.startsWith('creator_login:email:'));
  expect(emailKey).toBeDefined();
  expect(emailKey).not.toContain('a@b.com');
});

it('Cache-Control: no-store가 실린다', async () => {
  const r = await call({ email: 'a@b.com' });
  expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

describe('전역 일일 캡', () => {
  it('전역 캡은 주소별 제한을 통과한 뒤에만 소비된다', async () => {
    // 한 주소를 두드리는 것만으로 전체를 잠글 수 있으면 안 된다 — 주소별 제한에 걸린
    // 요청은 메일을 보내지 않으므로 전역 예산도 쓰면 안 된다.
    (consumeRateLimit as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(!key.startsWith('creator_login:email')));
    await call({ email: 'a@b.com' });

    const keys = (consumeRateLimit as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(keys).not.toContain('creator_login:global');
  });

  it('전역 캡에 걸리면 메일을 보내지 않고 운영자에게 알린다', async () => {
    (consumeRateLimit as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key !== 'creator_login:global'));
    const r = await call({ email: 'a@b.com' });

    expect(sendCreatorLoginEmail).not.toHaveBeenCalled();
    expect(sendCreatorLoginCapAlert).toHaveBeenCalledTimes(1);
    // 화면은 성공이라고 답한다 — 주소 존재 여부를 숨기려면 그래야 한다.
    expect(r.status).toBe(200);
  });

  it('캡에 걸린 상태가 이어져도 알림은 창당 한 번만 나간다', async () => {
    (consumeRateLimit as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key !== 'creator_login:global' && key !== 'creator_login:global_alert'));
    await call({ email: 'a@b.com' });

    expect(sendCreatorLoginCapAlert).not.toHaveBeenCalled();
  });
});
