/** @jest-environment node */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { LINEUP_PEOPLE } from './FundingLineupPerson';

/**
 * 펀딩 본문의 `%%funding-lineup:<id>%%`가 전부 실제 데이터를 가리키는지. 모르는 id는 카드가
 * **아무 말 없이 사라진다**(컴포넌트가 null) — 오타 하나로 출연진 한 명이 페이지에서 빠져도
 * 아무도 모른다. 사진 파일도 함께 본다.
 */
const FUNDING_DIR = path.join(process.cwd(), 'content/funding');
const used = readdirSync(FUNDING_DIR)
  .filter((f) => f.endsWith('.md'))
  .flatMap((f) => [...readFileSync(path.join(FUNDING_DIR, f), 'utf-8').matchAll(/%%funding-lineup:([\w-]+)%%/g)].map((m) => ({ file: f, id: m[1] })));

it('본문이 부르는 출연진 id는 전부 데이터에 있다', () => {
  expect(used.length).toBeGreaterThan(0);
  expect(used.filter((u) => !LINEUP_PEOPLE[u.id])).toEqual([]);
});

it('출연진 사진 파일이 실제로 있다', () => {
  const photos = Object.values(LINEUP_PEOPLE).flatMap((p) => [p.photo, p.photoSecondary].filter((x): x is string => !!x));
  expect(photos.filter((src) => !existsSync(path.join(process.cwd(), 'public', src)))).toEqual([]);
});
