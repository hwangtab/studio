/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { FUNDING_DIR, getAllFundingProjects, parseFundingProject } from '../lib/funding/projects';
import { isSafeObjectKey } from '../lib/funding/objectKey';
import { imageAspectRatio } from '../lib/funding/imageAspect';

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
    // 앨범이 둘 이상이면 앨범마다 따로 누적한다 — 다른 앨범의 파일은 서로 포함할 이유가 없다.
    // id 접두사가 앨범 계열이다(`fish-`는 〈물고기는 물이 없으면 죽어요〉, 나머지는 첫 앨범).
    const digitalAll = project.rewards.filter((r) => r.downloads.length > 0);
    for (const series of [digitalAll.filter((r) => r.id.startsWith('fish-')), digitalAll.filter((r) => !r.id.startsWith('fish-'))]) {
    const digital = series;
    if (digital.length < 2) continue;

    it(`${project.slug}: 상위 티어가 하위 티어의 파일을 모두 포함한다 (${digital[0].id}…)`, () => {
      const sorted = [...digital].sort((a, b) => a.amount - b.amount);
      sorted.forEach((reward, i) => {
        for (const lower of sorted.slice(0, i)) {
          const missing = lower.downloads
            .map((d) => d.key)
            .filter((key) => !reward.downloads.some((d) => d.key === key));
          expect(
            `${reward.id}(${reward.amount}원)에 없는 ${lower.id}(${lower.amount}원)의 파일: ${missing.join(', ')}`
          ).toBe(`${reward.id}(${reward.amount}원)에 없는 ${lower.id}(${lower.amount}원)의 파일: `);
        }
      });
    });

    it(`${project.slug}: 같은 파일을 두 번 싣지 않는다`, () => {
      for (const reward of digital) {
        const keys = reward.downloads.map((d) => d.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });

    it(`${project.slug}: 내려받기 항목이 주소가 아니라 저장소 키다`, () => {
      for (const reward of digital) {
        for (const d of reward.downloads) {
          expect(d.label.trim()).not.toBe('');
          // 주소를 적어 두면 그 값이 메일·화면으로 그대로 나가 게이트를 우회할 수 있다.
          expect(d.key).not.toMatch(/^https?:\/\//);
          expect(d.key).not.toContain('r2.dev');
          expect(isSafeObjectKey(d.key)).toBe(true);
        }
      }
    });
    }
  }
});


/**
 * 리워드 썸네일이 **있어야 할 곳에 있는지**.
 *
 * 카드·모달에 썸네일 자리를 만들어 두고 정작 어느 리워드에도 `image`를 넣지 않은 채로
 * 배포된 적이 있다. 자리는 코드에, 그림은 콘텐츠에 있어서 둘이 갈라져도 아무 검사에
 * 걸리지 않았다.
 */
describe('리워드 이미지', () => {
  const live = getAllFundingProjects().filter((p) => !p.hidden && p.status !== 'draft');

  it.each(live.map((p) => [p.slug, p] as const))('%s: 모든 리워드에 썸네일이 있다', (_slug, project) => {
    const missing = project.rewards.filter((r) => !r.image).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it.each(live.map((p) => [p.slug, p] as const))('%s: 썸네일 비율을 알 수 있다 — 모르면 16:9로 잘린다', (_slug, project) => {
    for (const reward of project.rewards) {
      if (!reward.image) continue;
      // imageMetadata.json에 없으면 카드가 16:9로 떨어져 정사각 그림이 잘린다.
      expect([reward.id, imageAspectRatio(reward.image)]).not.toEqual([reward.id, null]);
    }
  });
});

/**
 * 강정 펀딩의 리워드 배열 기준(마크다운 frontmatter 위 주석과 같은 표).
 * 가격 전체 정렬은 서로 다른 상품이 섞여 정신없어서, 종류로 묶고 묶음 안에서만 가격순으로 한다.
 *   음원(첫 앨범 → 물고기 앨범, 앨범 안 금액 오름차순) → 시/노래집(출간순) → 티셔츠(최신 회차 먼저)
 * 책이 티셔츠보다 앞이어야 결제 화면 "함께 받기"(addOn 중 앞의 두 개)가 책 두 권이 된다.
 */
describe('keep-singing-for-palestine 리워드 배열 기준', () => {
  const project = getAllFundingProjects().find((p) => p.slug === 'keep-singing-for-palestine');
  const rank = (id: string): [number, number] => {
    if (id.startsWith('fish-')) return [0, 1];
    if (id.startsWith('book-')) return [1, id === 'book-baljak' ? 0 : 1];
    if (id.startsWith('tshirt-')) return [2, id.startsWith('tshirt-3rd') ? 0 : 1];
    return [0, 0];
  };

  it('종류 묶음 → 앨범 → 금액 오름차순 순서를 지킨다', () => {
    if (!project) return;
    const rewards = project.rewards;
    for (let i = 1; i < rewards.length; i++) {
      const [a, b] = [rewards[i - 1], rewards[i]];
      const [ra, rb] = [rank(a.id), rank(b.id)];
      const msg = `${a.id} → ${b.id}`;
      if (ra[0] !== rb[0]) expect([msg, ra[0] < rb[0]]).toEqual([msg, true]);
      else if (ra[1] !== rb[1]) expect([msg, ra[1] < rb[1]]).toEqual([msg, true]);
      else if (ra[0] === 0) expect([msg, a.amount <= b.amount]).toEqual([msg, true]); // 음원만 앨범 안에서 금액순
    }
  });

  it('함께 받기 제안(addOn 앞 두 개)은 시/노래집이다', () => {
    if (!project) return;
    expect(project.rewards.filter((r) => r.addOn).slice(0, 2).map((r) => r.id)).toEqual(['book-baljak', 'book-gangdo']);
  });
});
