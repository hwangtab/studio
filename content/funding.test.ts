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
});
