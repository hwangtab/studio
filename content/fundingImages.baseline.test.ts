/** @jest-environment node */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getAllFundingProjects } from '../lib/funding/projects';

/**
 * **그림을 바꿨으면 파일 이름도 바꿔야 한다.**
 *
 * `/images/**`는 `cache-control: public, max-age=31536000, immutable`로 나간다. `immutable`은
 * 브라우저에게 "1년간 다시 물어보지도 말라"는 뜻이라, 경로가 같으면 내용을 갈아 끼워도
 * **이미 한 번 본 사람에게는 영영 옛 그림이 보인다.** 배포로는 고칠 수 없다.
 *
 * 이 저장소에서 두 번 났다. 카카오 공유 썸네일이 그랬고(그래서 `og-20260915.webp`),
 * 펀딩 목록 썸네일이 그랬다 — 파일만 갈아 끼운 채 몇 주가 지나 "여전히 옛날 썸네일이
 * 보인다"는 지적을 받았다. CDN·서버는 새 그림을 주고 있었으므로 로그로는 보이지 않는다.
 *
 * 그래서 프로젝트의 얼굴 이미지(`cover`·`ogImage`)를 **이름과 내용 해시로** 함께 고정한다.
 * 내용이 바뀌었는데 이름이 그대로면 실패한다.
 */
const BASELINE = path.join(process.cwd(), 'content/funding-images.baseline.json');

type Entry = { file: string; sha256: string };
type Baseline = Record<string, Record<string, Entry>>;

const hashOf = (publicPath: string): Entry => {
  const abs = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  return { file: publicPath, sha256: crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex') };
};

const current = (): Baseline => {
  const out: Baseline = {};
  for (const project of getAllFundingProjects()) {
    const entry: Record<string, Entry> = { cover: hashOf(project.cover) };
    if (project.ogImage) entry.ogImage = hashOf(project.ogImage);
    if (project.heroImage) entry.heroImage = hashOf(project.heroImage);
    out[project.slug] = entry;
  }
  return out;
};

const readBaseline = (): Baseline =>
  fs.existsSync(BASELINE) ? (JSON.parse(fs.readFileSync(BASELINE, 'utf-8')) as Baseline) : {};

/**
 * 갱신 경로가 **규칙 위반을 통과시키면 안 된다.** 검사 모드만 막고 갱신 모드를 열어 두면
 * 자물쇠 옆에 열쇠를 걸어 두는 셈이다(약관 판본 게이트와 같은 판단).
 */
const assertUpdateAllowed = (prev: Baseline, next: Baseline): void => {
  const violations: string[] = [];
  for (const [slug, fields] of Object.entries(next)) {
    for (const [field, entry] of Object.entries(fields)) {
      const before = prev[slug]?.[field];
      if (!before) continue;
      if (before.file === entry.file && before.sha256 !== entry.sha256) {
        violations.push(`${slug}.${field}: ${entry.file}`);
      }
    }
  }
  if (violations.length > 0) {
    throw new Error(
      '그림이 바뀌었는데 파일 이름이 그대로다. 기준선을 갱신하기 전에 **이름을 먼저 바꿔라**\n' +
        `  ${violations.join('\n  ')}\n` +
        '이미지는 immutable로 1년간 캐시되므로, 경로가 같으면 이미 본 사람에게는 영영 옛 그림이 보인다.\n' +
        '날짜를 붙이는 관례를 쓴다(예: cover-20260916.webp).',
    );
  }
};

describe('펀딩 얼굴 이미지', () => {
  const now = current();
  const prev = readBaseline();

  if (process.env.UPDATE_FUNDING_IMAGE_BASELINE === '1') {
    it('기준선을 갱신한다', () => {
      assertUpdateAllowed(prev, now);
      fs.writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    });
  } else {
    it('그림이 바뀌었으면 파일 이름도 바뀌어 있다', () => {
      const broken: string[] = [];
      for (const [slug, fields] of Object.entries(now)) {
        for (const [field, entry] of Object.entries(fields)) {
          const before = prev[slug]?.[field];
          if (before && before.file === entry.file && before.sha256 !== entry.sha256) {
            broken.push(`${slug}.${field} — ${entry.file}`);
          }
        }
      }
      expect(broken).toEqual([]);
    });

    it('기준선과 현재가 일치한다', () => {
      expect(now).toEqual(prev);
    });
  }
});
