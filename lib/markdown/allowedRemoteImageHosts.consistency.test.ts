import fs from 'node:fs';
import path from 'node:path';

import { ALLOWED_REMOTE_IMAGE_HOSTS } from './allowedRemoteImageHosts';

/**
 * `next.config.mjs`는 ESM 빌드 설정이라 이 상수 파일이 거기서 직접 값을 끌어올 수 없다
 * (컴포넌트 쪽에서 import하기도 애매하다). 그래서 두 목록을 손으로 맞춰 두는데, 그러면
 * 한쪽만 고치고 잊는 사고가 난다 — 이 테스트가 `next.config.mjs` 소스 텍스트에서
 * `hostname: '...'` 값을 정규식으로 뽑아 이 배열과 정확히 같은 집합인지 본다.
 */
describe('ALLOWED_REMOTE_IMAGE_HOSTS ↔ next.config.mjs remotePatterns', () => {
  it('두 목록의 호스트 집합이 정확히 같다', () => {
    const configSource = fs.readFileSync(path.join(process.cwd(), 'next.config.mjs'), 'utf8');
    const matches = [...configSource.matchAll(/hostname:\s*'([^']+)'/g)].map((m) => m[1]);

    expect(matches.length).toBeGreaterThan(0);
    expect([...matches].sort()).toEqual([...ALLOWED_REMOTE_IMAGE_HOSTS].sort());
  });
});
