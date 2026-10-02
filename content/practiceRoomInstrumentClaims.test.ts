import fs from 'node:fs';
import path from 'node:path';

import { isUnsupportedPracticeInstrumentSlug } from '../lib/practiceRoomInstrumentScope';

/**
 * 연습실은 드럼·관악기를 받지 않는다. 그 주제의 practice-room-* 글이 스튜디오 놀 연습실에서
 * 연습할 수 있다고 읽히면 없는 서비스를 약속하는 것이라, 우리 공간을 가리키는 표현이
 * 글(메타 포함)에 들어오지 못하게 막는다. 관악기 글이 "받지 않는다"고 답하는 문장만 허용한다.
 * 하단 "관련 가이드" 링크 줄은 다른 글 제목이라 제외한다.
 */
const STORIES_DIR = path.join(__dirname, 'stories');
const FORBIDDEN = /스튜디오 놀|Studio NOL|24시간|36만원|은평|연신내|음악 ?연습실|방음 개인실|개인 방음실/;
const ALLOWED = /스튜디오 놀 연습실은[^.]*받지 않습니다/;

describe('드럼·관악기 연습실 글은 우리 연습실을 약속하지 않는다', () => {
  const slugs = fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    // drum1은 /practice-room으로 308 되는 슬러그라 렌더되지 않는다.
    .filter((s) => s.startsWith('practice-room-') && s !== 'practice-room-drum1' && isUnsupportedPracticeInstrumentSlug(s));

  it('대상 글이 있다', () => {
    expect(slugs.length).toBeGreaterThan(80);
  });

  it('금지 표현이 없다', () => {
    const hits: string[] = [];
    for (const slug of slugs) {
      const lines = fs.readFileSync(path.join(STORIES_DIR, `${slug}.md`), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.startsWith('author:')) return;
        if (/^\s*[-]?\s*\[.*\]\(\/stories\//.test(line) || /^\[.*\]\(\/stories\/.*\) \|/.test(line)) return;
        if (FORBIDDEN.test(line) && !ALLOWED.test(line)) hits.push(`${slug}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
