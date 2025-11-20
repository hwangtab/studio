import handler, { __contactTestUtils } from '../pages/api/contact';

const createRequestResponse = ({
  method = 'POST',
  body = {},
  headers = {},
} = {}) => {
  const req = {
    method,
    body,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };

  return { req, res };
};

describe('/api/contact', () => {
  beforeEach(() => {
    __contactTestUtils.resetRateLimitStore();
    process.env.EMAILJS_SERVICE_ID = 'svc';
    process.env.EMAILJS_TEMPLATE_ID = 'tmpl';
    process.env.EMAILJS_PUBLIC_KEY = 'pub';
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      })
    );
  });

  it('차단용 허니팟 필드가 채워지면 요청을 거절한다', async () => {
    const { req, res } = createRequestResponse({
      body: { name: 'test', phone: '010', message: 'hi', company: 'bot' },
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: '잘못된 요청입니다.' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('단시간 내 과도한 요청을 rate limit 한다', async () => {
    const forwardedHeaders = { 'x-forwarded-for': '203.0.113.1' };

    for (let i = 0; i < 5; i += 1) {
      const { req, res } = createRequestResponse({
        headers: forwardedHeaders,
        body: { name: 'user', phone: '010', message: 'hello' },
      });
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const { req, res } = createRequestResponse({
      headers: forwardedHeaders,
      body: { name: 'user', phone: '010', message: 'blocked' },
    });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });
});
