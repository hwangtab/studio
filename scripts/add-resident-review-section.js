#!/usr/bin/env node
// 21개 dedicated 지역 LP에 '입주자 후기' 섹션 자동 추가 (E-E-A-T 강화).
// review8.md(연습실 입주 3개월 후기)에서 핵심 인용 + 지역명 변형으로 thin content 회피.

const fs = require('fs');
const path = require('path');

const REGION_LPS = [
  { slug: 'practice-room-daejo1', region: '대조동' },
  { slug: 'practice-room-yeonsinnae1', region: '연신내' },
  { slug: 'practice-room-bulgwang1', region: '불광' },
  { slug: 'practice-room-eunpyeong1', region: '은평구' },
  { slug: 'practice-room-nokbeon1', region: '녹번' },
  { slug: 'practice-room-dokbawi1', region: '독바위' },
  { slug: 'practice-room-gusan1', region: '구산' },
  { slug: 'practice-room-yeokchon1', region: '역촌' },
  { slug: 'practice-room-eungam1', region: '응암' },
  { slug: 'practice-room-saejeol1', region: '새절' },
  { slug: 'practice-room-jeungsan1', region: '증산' },
  { slug: 'practice-room-sangam1', region: '상암' },
  { slug: 'practice-room-seodaemun1', region: '서대문' },
  { slug: 'practice-room-gupabal1', region: '구파발' },
  { slug: 'practice-room-jichuk1', region: '지축' },
  { slug: 'practice-room-samsong1', region: '삼송' },
  { slug: 'practice-room-wonheung1', region: '원흥' },
  { slug: 'practice-room-wondang1', region: '원당' },
  { slug: 'practice-room-deogyang1', region: '덕양구' },
  { slug: 'practice-room-goyang1', region: '고양시' },
  { slug: 'practice-room-ilsan1', region: '일산' },
];

// review8 핵심 인용 + 지역명 변형. {{REGION}} 치환.
const REVIEW_TEMPLATE = `## 입주자 후기

> "퇴근 후 밤 11시에 와서 새벽 2시까지 작업하는 날이 많은데, 시간 눈치를 볼 필요가 없으니 곡 작업에 훨씬 집중할 수 있었습니다. 기타와 미디 키보드를 방에 두고 다니니 매번 짐을 챙기는 스트레스도 사라졌습니다."
>
> — 싱어송라이터 K씨, {{REGION}} 입주 3개월

> "월 고정 비용이 부담되지 않을까 걱정했는데, 시간제 연습실을 주 3~4회 이용하던 비용과 비교하면 오히려 절약이 됩니다. 본인만의 공간에서 장비를 꺼내놓고 바로 작업을 시작할 수 있는 편리함은 가격으로 환산하기 어려운 부분입니다."

전체 후기 보기: [연습실 입주 3개월 후기 — 월 36만원으로 나만의 작업실을 갖다](/stories/review8)

---
`;

const STORIES_DIR = path.join(process.cwd(), 'content/stories');
let added = 0;
const skipped = [];

for (const { slug, region } of REGION_LPS) {
  const fp = path.join(STORIES_DIR, slug + '.md');
  if (!fs.existsSync(fp)) {
    skipped.push({ slug, reason: 'file not found' });
    continue;
  }
  const txt = fs.readFileSync(fp, 'utf8');

  // 이미 후기 섹션 있으면 skip (yeonsinnae1 시범 처리)
  if (txt.includes('## 입주자 후기')) {
    skipped.push({ slug, reason: 'already has review section' });
    continue;
  }

  // 본문 끝의 internal links 라인 찾아서 그 직전에 삽입
  // 패턴: 마지막 [...](/stories/...) | [...](/...) 라인이 internal link footer
  const lines = txt.split('\n');
  let insertAt = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    // markdown link list 라인 (3+ link 포함)
    const linkCount = (line.match(/\]\(/g) || []).length;
    if (linkCount >= 2 && line.includes(']/(')  || (linkCount >= 2 && line.includes('] | ['))) {
      insertAt = i;
      break;
    }
    // 또는 마지막 link 라인
    if (linkCount >= 2 && line.startsWith('[')) {
      insertAt = i;
      break;
    }
  }

  if (insertAt < 0) {
    skipped.push({ slug, reason: 'no internal links footer found' });
    continue;
  }

  const reviewBlock = REVIEW_TEMPLATE.replace('{{REGION}}', region);
  // insertAt 위치에 reviewBlock + 빈 줄 삽입
  lines.splice(insertAt, 0, reviewBlock, '');

  fs.writeFileSync(fp, lines.join('\n'), 'utf8');
  added++;
  console.log(`  ✓ ${slug} (${region})`);
}

console.log(`\n처리 완료: ${added}개 LP에 후기 섹션 추가`);
if (skipped.length > 0) {
  console.log('\nSkipped:');
  skipped.forEach((s) => console.log(`  - ${s.slug}: ${s.reason}`));
}
