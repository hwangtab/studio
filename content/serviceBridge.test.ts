/** @jest-environment node */

import fs from 'fs';
import path from 'path';

const EXPECTED_SERVICE_BRIDGES: Record<string, string> = {
  'daw-choice1.md': '%%service:lesson%%',
  'practice-room-startup1.md': '%%service:practice%%',
  'copyright-cover1.md': '%%service:recording%%',
  // 유통(발매) 의도 글 → 발매 프로젝트 브릿지로 재타깃(2026-07-25 레버 4).
  'distribution1.md': '%%service:release%%',
  'plugins1.md': '%%service:lesson%%',
  // 2026-07-07 GSC audit 고임프레션 저CTR 페이지 중 전환 브릿지가 비어 있던 6건.
  // vocal/business/production 카테고리라 SERVICE_BY_CATEGORY 자동 fallback 대상이
  // 아니었음 → 정보성 트래픽을 녹음 의뢰(/pricing)로 잇는 명시 브릿지 추가.
  'falsetto1.md': '%%service:recording%%',
  'headvoice1.md': '%%service:recording%%',
  'practice-room-vocal-diction1.md': '%%service:recording%%',
  'royalty1.md': '%%service:recording%%',
  'session-musician1.md': '%%service:recording%%',
  'songstructure1.md': '%%service:recording%%',
  // 녹음/발성 주제라 연습실(practice)보다 녹음 의뢰(recording) 전환 적합도가 높아 재타깃.
  'highnote1.md': '%%service:recording%%',
  'vocalrange1.md': '%%service:recording%%',
  // 2026-07-26 레슨 매출 강화: 고트래픽 믹싱 튜토리얼(학습 의도)을 '녹음'에서 '믹싱 레슨'으로
  // 재타깃 — 정원 유한한 연습실·의도 미스매치 녹음 대신 확장 가능한 레슨(월정액) 라인으로.
  'eq1.md': '%%service:lesson%%',
  'loudness1.md': '%%service:lesson%%',
  'drum-mixing1.md': '%%service:lesson%%',
  // song-key1(자기 키 찾기)은 정원 유한 연습실 → 녹음(보컬 녹음 의뢰)으로 재타깃.
  'song-key1.md': '%%service:recording%%',
};

describe('high-traffic story service bridges', () => {
  it('keeps inline service callouts on high-traffic low-lead stories', () => {
    const missing = Object.entries(EXPECTED_SERVICE_BRIDGES)
      .filter(([file, shortcode]) => {
        const content = fs.readFileSync(path.join(process.cwd(), 'content/stories', file), 'utf8');
        return !content.includes(shortcode);
      })
      .map(([file, shortcode]) => `${file}:${shortcode}`);

    expect(missing).toEqual([]);
  });
});
