#!/usr/bin/env node
/**
 * 감상실 비밀번호의 scrypt 해시를 만든다 — lib/press/listeningRoom.ts의 passwordSalt·passwordHash에 넣는다.
 *
 *   node scripts/press/hash-password.mjs '<새 비밀번호>'
 *
 * 저장소가 공개라 원문은 어디에도 커밋하지 않는다. 파라미터는 listeningRoom.ts의 SCRYPT_PARAMS와 같아야 한다.
 */
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error("사용법: node scripts/press/hash-password.mjs '<새 비밀번호>'");
  process.exit(1);
}
const salt = randomBytes(16).toString('base64url');
const hash = scryptSync(password.trim().normalize('NFC'), salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64url');
console.log(`passwordSalt: '${salt}',\npasswordHash: '${hash}',`);
