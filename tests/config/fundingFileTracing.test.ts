/** @jest-environment node */
import { execFileSync } from 'node:child_process';

/**
 * 펀딩 md는 런타임에 fs로 읽는다 — outputFileTracingIncludes에 없으면 서버리스 번들에서
 * 빠져 로컬에서는 멀쩡하고 배포판에서만 프로젝트가 통째로 사라진다(계약서 md와 같은 함정).
 *
 * jest는 .mjs를 CJS로 변환하는데 next.config.mjs가 스스로 __dirname을 선언해 충돌하고,
 * 네이티브 동적 import는 --experimental-vm-modules 없이는 막힌다 — 자식 node로 진짜
 * import해 설정값만 JSON으로 받아온다.
 */
const loadTracingIncludes = (): Record<string, string[]> =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', "import c from './next.config.mjs'; process.stdout.write(JSON.stringify(c.outputFileTracingIncludes));"],
      { cwd: process.cwd(), encoding: 'utf-8' },
    ),
  );

describe('next.config outputFileTracingIncludes — 펀딩 md', () => {
  it('펀딩 md를 읽는 네 라우트 그룹이 모두 등록되어 있다', () => {
    const includes = loadTracingIncludes();
    for (const key of ['/api/funding/**', '/[locale]/funding/**', '/admin/funding/**', '/api/admin/funding/**']) {
      expect(includes[key]).toBeDefined();
      expect(includes[key].some((p) => p.includes('content/funding'))).toBe(true);
    }
  });
});
