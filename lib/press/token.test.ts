import fs from 'fs';
import path from 'path';
import { verifyPressToken } from './token';

/**
 * music-promo가 만든 토큰을 이쪽이 읽을 수 있어야 한다.
 *
 * 두 저장소가 각자 구현하므로, 벡터가 어긋나면 "발송은 되는데 수신거부 링크가
 * 전부 죽은" 상태가 된다. 그 상태는 배포 후 기자가 눌러 봐야 드러나므로 여기서 막는다.
 * 벡터 파일은 music-promo/tests/press-token-vectors.json과 내용이 같아야 한다.
 */
const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'tests', 'press', 'press-token-vectors.json'), 'utf8'),
) as {
  secret: string;
  cases: { payload: Record<string, unknown>; token: string }[];
};

describe('verifyPressToken', () => {
  it('music-promo가 서명한 토큰을 payload로 되돌린다', () => {
    for (const c of vectors.cases) {
      expect(verifyPressToken(c.token, vectors.secret)).toEqual(c.payload);
    }
  });

  it('키가 다르면 거부한다', () => {
    expect(verifyPressToken(vectors.cases[0].token, 'wrong-secret')).toBeNull();
  });

  it('payload를 고치면 거부한다', () => {
    const mac = vectors.cases[0].token.split('.')[1];
    const tampered = Buffer.from(
      JSON.stringify({ ...vectors.cases[0].payload, h: '0'.repeat(32) }),
      'utf8',
    ).toString('base64url');
    expect(verifyPressToken(`${tampered}.${mac}`, 'wrong-secret')).toBeNull();
    expect(verifyPressToken(`${tampered}.${mac}`, vectors.secret)).toBeNull();
  });

  it('모양이 아닌 입력에 던지지 않는다', () => {
    for (const bad of ['', '.', 'abc', 'a.b.c', '....', 'x'.repeat(500)]) {
      expect(verifyPressToken(bad, vectors.secret)).toBeNull();
    }
  });
});
