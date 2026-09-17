/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import { RESERVED_FUNDING_SLUGS } from './reservedSlugs';

/**
 * 예약 목록은 손으로 적은 것이라 라우트가 늘면 조용히 낡는다. 디렉터리를 직접 읽어
 * 대조한다 — 새 리터럴 라우트를 만들고 목록에 넣지 않으면 여기서 멈춘다.
 */
it('funding 아래 리터럴 라우트가 전부 예약 목록에 있다', () => {
  const dir = path.join(process.cwd(), 'pages/[locale]/funding');
  const literals = fs.readdirSync(dir, { withFileTypes: true })
    .map((e) => (e.isDirectory() ? e.name : e.name.replace(/\.tsx?$/, '')))
    .filter((name) => !name.startsWith('[') && name !== 'index');

  for (const name of literals) {
    expect([name, [...RESERVED_FUNDING_SLUGS]]).toEqual([name, expect.arrayContaining([name])]);
  }
});
