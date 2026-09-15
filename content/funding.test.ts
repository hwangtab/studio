/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { FUNDING_DIR, getAllFundingProjects, parseFundingProject } from '../lib/funding/projects';

describe('content/funding', () => {
  const files = fs.existsSync(FUNDING_DIR) ? fs.readdirSync(FUNDING_DIR).filter((f) => f.endsWith('.md')) : [];

  it.each(files)('%s — frontmatter가 유효하다', (file) => {
    expect(() =>
      parseFundingProject(fs.readFileSync(path.join(FUNDING_DIR, file), 'utf-8'), file.replace(/\.md$/, '')),
    ).not.toThrow();
  });

  it('cover·리워드 이미지 파일이 존재한다', () => {
    for (const p of getAllFundingProjects()) {
      for (const img of [p.cover, p.ogImage, ...p.rewards.map((r) => r.image)]) {
        if (img) expect(fs.existsSync(path.join(process.cwd(), 'public', img))).toBe(true);
      }
    }
  });

  it('slug는 [a-z0-9-]만 쓴다', () => {
    for (const p of getAllFundingProjects()) expect(p.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('slug는 트랜잭셔널 라우트 예약어(success·fail·terms·deposit·manage·pledge)를 쓰지 않는다', () => {
    for (const p of getAllFundingProjects()) expect(p.slug).not.toMatch(/^(success|fail|terms|deposit|manage|pledge)$/);
  });
});

/**
 * 금액이 큰 티어는 작은 티어가 주는 파일을 **전부 포함해야 한다.**
 *
 * 이 규칙이 없던 동안 실제로 이렇게 나가 있었다: 3만원 티어는 설명이 "MP3에 더해 WAV"라고
 * 약속해 놓고 WAV 하나만 줬고, 5만·10만원 티어는 1.8GB짜리 24bit 원본 하나만 받아 휴대폰
 * 에서는 들을 방법이 없었다. 값을 더 낸 사람이 덜 받는 구성이었고, 설명과 실제가 달랐다.
 */
describe('디지털 리워드는 금액이 오를수록 누적된다', () => {
  for (const project of getAllFundingProjects()) {
    const digital = project.rewards.filter((r) => r.downloads.length > 0);
    if (digital.length < 2) continue;

    it(`${project.slug}: 상위 티어가 하위 티어의 파일을 모두 포함한다`, () => {
      const sorted = [...digital].sort((a, b) => a.amount - b.amount);
      sorted.forEach((reward, i) => {
        for (const lower of sorted.slice(0, i)) {
          const missing = lower.downloads
            .map((d) => d.url)
            .filter((url) => !reward.downloads.some((d) => d.url === url));
          expect(
            `${reward.id}(${reward.amount}원)에 없는 ${lower.id}(${lower.amount}원)의 파일: ${missing.join(', ')}`
          ).toBe(`${reward.id}(${reward.amount}원)에 없는 ${lower.id}(${lower.amount}원)의 파일: `);
        }
      });
    });

    it(`${project.slug}: 같은 파일을 두 번 싣지 않는다`, () => {
      for (const reward of digital) {
        const urls = reward.downloads.map((d) => d.url);
        expect(new Set(urls).size).toBe(urls.length);
      }
    });

    it(`${project.slug}: 내려받기 항목에 빈 레이블·주소가 없다`, () => {
      for (const reward of digital) {
        for (const d of reward.downloads) {
          expect(d.label.trim()).not.toBe('');
          expect(d.url).toMatch(/^https:\/\//);
        }
      }
    });
  }
});
