/** @jest-environment node */

import handler from '../../pages/api/og/story';

jest.mock('@vercel/og', () => ({
  ImageResponse: jest.fn(),
}));

describe('story OG image api', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects non-GET requests before generating an image', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const response = await handler({
      method: 'POST',
      url: 'https://studionol.co.kr/api/og/story?title=Test',
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
