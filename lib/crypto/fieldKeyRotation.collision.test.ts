/** @jest-environment node */
/**
 * keyId 충돌 게이트 회귀 — **엔진이 한 행도 읽기 전에 던져야 한다.**
 *
 * 복호화 경로에서 keyId 충돌은 안전한 방향이다(GCM 태그가 잡는다). 회전 엔진에서는 반대다:
 * keyId만 보고 복호화 없이 건너뛰므로, 옛 키와 새 키의 keyId가 충돌하면 옛 키로 잠긴 행이
 * 전부 "이미 회전됨"으로 집계되고 실패 0으로 끝난다 → 운영자가 옛 키를 지운다 → 영구 손실.
 *
 * 실제 충돌(2^-32)을 테스트에서 만들 수는 없으므로 `deriveKeyId`를 고정값으로 바꿔 끼운다.
 */
import { randomBytes } from 'node:crypto';

jest.mock('./fieldCrypto', () => ({
  ...jest.requireActual('./fieldCrypto'),
  deriveKeyId: () => 'deadbeef',
}));

// eslint-disable-next-line import/first
import { FieldCryptoError } from './fieldCrypto';
// eslint-disable-next-line import/first
import { rotateFieldKey } from './fieldKeyRotation';

/** 한 번이라도 쓰이면 테스트가 실패한다 — 게이트는 DB를 건드리기 전에 서야 한다. */
const forbiddenDb = new Proxy({}, {
  get() {
    throw new Error('게이트가 통과시켰다 — DB에 손을 댔다.');
  },
}) as unknown as Parameters<typeof rotateFieldKey>[0]['db'];

it('옛 키와 새 키의 keyId가 충돌하면 DB를 건드리기 전에 던진다', async () => {
  const oldKey = randomBytes(32);
  const newKey = randomBytes(32);
  expect(oldKey.equals(newKey)).toBe(false);

  await expect(
    rotateFieldKey({ oldKey, newKey, apply: true, db: forbiddenDb }),
  ).rejects.toMatchObject({ code: 'invalid_key' });

  await expect(
    rotateFieldKey({ oldKey, newKey, db: forbiddenDb }),
  ).rejects.toBeInstanceOf(FieldCryptoError);
});

it('같은 키는 이 게이트가 막지 않는다 — CLI의 --same-key가 받는 정당한 용법이다', async () => {
  const key = randomBytes(32);
  // 게이트를 지나면 DB를 만지므로 forbiddenDb가 다른 오류를 던진다. code=invalid_key가
  // 아니라는 것이 "이 게이트는 통과했다"는 증거다.
  await expect(rotateFieldKey({ oldKey: key, newKey: key, db: forbiddenDb })).rejects.not.toMatchObject({
    code: 'invalid_key',
  });
});
