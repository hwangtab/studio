#!/usr/bin/env node
/**
 * 라이선스 서명키(Ed25519) 한 쌍을 만들어 **화면에만** 찍는다 — 파일로 쓰지 않는다.
 *
 *   node scripts/software/generate-license-key.mjs k1
 *
 * 1. 비밀키(base64 DER)를 Vercel env `SOFTWARE_LICENSE_SIGNING_KEY`(Sensitive)에, kid를 `SOFTWARE_LICENSE_KEY_ID`에 넣는다.
 * 2. **같은 비밀키를 오프라인에 백업한다**(비밀번호 관리자 등). 잃으면 새 키로 바꿔야 하고, 그러면 플러그인을 다시 배포해야 한다.
 * 3. 공개키를 `data/software/publicKeys.ts`에 `{ kid: '<공개키>' }`로 더하고 커밋한다 — 플러그인 바이너리에도 같은 값을 박는다.
 *
 * kid는 한 번 쓰면 다시 쓰지 않는다(k1, k2, …). 옛 kid는 이미 배포된 플러그인이 쓰므로 지우지 않는다.
 */
import { generateKeyPairSync } from 'node:crypto';

const kid = process.argv[2];
if (!kid || !/^[a-z0-9-]{1,16}$/.test(kid)) {
  console.error('사용법: node scripts/software/generate-license-key.mjs <kid>   (예: k1)');
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateDer = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const publicRaw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');

console.log(`kid:                           ${kid}`);
console.log(`SOFTWARE_LICENSE_KEY_ID        ${kid}`);
console.log(`SOFTWARE_LICENSE_SIGNING_KEY   ${privateDer}`);
console.log(`공개키(publicKeys.ts·플러그인)  ${publicRaw}`);
