/** @jest-environment node */

import fs from 'fs';
import path from 'path';

const CTR_TITLE_TARGETS: Record<string, string[]> = {
  'practice-room-vocal-diction1.md': ['딕션 뜻', '보컬 딕션'],
  'epk1.md': ['EPK 뜻', 'EPK 만드는 법'],
  'songstructure1.md': ['프리코러스', '송폼'],
  'audioformat1.md': ['WAV MP3 차이', 'MP3 WAV 차이'],
  'headvoice1.md': ['두성 뜻', '두성 내는 법'],
  'falsetto1.md': ['팔세토 뜻', '가성 내는 법'],
  'session-musician1.md': ['세션 뜻', '세션 뮤지션'],
  'noise-reduction1.md': ['홈레코딩', '녹음 잡음 제거'],
  'mastering1.md': ['마스터링이란', '믹싱과 마스터링 차이'],
};

const getFrontmatterTitle = (file: string) => {
  const content = fs.readFileSync(path.join(process.cwd(), 'content/stories', file), 'utf8');
  const match = content.match(/^---\n[\s\S]*?^title:\s*"?(.+?)"?\n/m);
  return match?.[1] || '';
};

describe('CTR target story titles', () => {
  it('keeps high-impression low-CTR query terms in story titles', () => {
    const missing = Object.entries(CTR_TITLE_TARGETS)
      .flatMap(([file, terms]) => {
        const title = getFrontmatterTitle(file);
        return terms
          .filter((term) => !title.includes(term))
          .map((term) => `${file}:${term}`);
      });

    expect(missing).toEqual([]);
  });
});
