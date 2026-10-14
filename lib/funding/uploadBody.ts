import type { NextApiRequest } from 'next';

/**
 * 바디를 모으면서 상한을 확인한다.
 *
 * 끝까지 받은 뒤 크기를 재면 상한이 상한이 아니다 — 8MB 제한을 두고 500MB를 다 받아
 * 버리는 요청을 서버가 그대로 삼키게 된다. 누적이 넘는 순간 즉시 중단한다.
 */
export const readBodyWithLimit = async (req: NextApiRequest, maxBytes: number): Promise<Buffer | null> => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > maxBytes) return null;
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
};
