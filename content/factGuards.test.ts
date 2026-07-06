/** @jest-environment node */

/**
 * 정본 사실 CI 게이트 — 프로덕션 콘텐츠 표면 전수 스캔.
 *
 * lib/factGuards.ts의 룰(정본: docs/wiki/entities/services.md 서비스 범위 가드)을
 * content/stories 전체 + 7로케일 common.json + data/ + pages/ + components/에
 * 적용한다. 이 테스트가 실패하면 폐기된 사실(구 전화번호·잘못된 출구 번호)이나
 * 미제공 서비스(보컬·악기 레슨, 영어 전담 엔지니어) 주장이 커밋에 포함된 것이다.
 * 오탐이라고 판단되면 룰을 완화하기 전에 반드시 위키 정본과 대조할 것.
 */

import fs from 'fs';
import path from 'path';

import { findFactViolations, FactViolation } from '../lib/factGuards';

const ROOT = process.cwd();

const listFilesRecursive = (dir: string, extensions: string[]): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
};

const formatViolations = (violations: FactViolation[]): string =>
  violations.map((v) => `  ${v.file}:${v.line} [${v.ruleId}] ${v.excerpt}`).join('\n');

const expectNoViolations = (files: string[], markdown: boolean, label: string): void => {
  const violations = files.flatMap((file) =>
    findFactViolations(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file), { markdown }),
  );
  expect(
    violations.length === 0
      ? ''
      : `${label} 정본 사실 위반 ${violations.length}건 — 위키(entities/services.md)와 대조 후 수정하세요:\n${formatViolations(violations)}`,
  ).toBe('');
};

describe('canonical fact guards', () => {
  it('keeps content/stories free of forbidden fact claims', () => {
    const files = listFilesRecursive(path.join(ROOT, 'content/stories'), ['.md']);
    expect(files.length).toBeGreaterThan(1000);
    expectNoViolations(files, true, 'content/stories');
  });

  it('keeps locale resources free of forbidden fact claims', () => {
    const files = listFilesRecursive(path.join(ROOT, 'public/locales'), ['.json']);
    expect(files.length).toBeGreaterThanOrEqual(7);
    expectNoViolations(files, false, 'public/locales');
  });

  it('keeps data/, pages/, components/ code surfaces free of forbidden fact claims', () => {
    const codeFiles = [
      ...listFilesRecursive(path.join(ROOT, 'data'), ['.ts']),
      ...listFilesRecursive(path.join(ROOT, 'pages'), ['.ts', '.tsx']),
      ...listFilesRecursive(path.join(ROOT, 'components'), ['.ts', '.tsx']),
    ].filter((f) => !/\.test\.[jt]sx?$|__snapshots__/.test(f));

    expect(codeFiles.length).toBeGreaterThan(50);
    expectNoViolations(codeFiles, false, 'code surfaces');
  });
});

describe('fact guard rules self-check', () => {
  it('flags known past incidents and reviewed bypasses (regression fixtures)', () => {
    const fixtures: Array<[string, string]> = [
      ['전화 0507-1384-3144 또는 카카오톡', 'legacy-phone-0507'],
      ['국제전화는 +82-507-1384-3144로 연락주세요', 'legacy-phone-0507'],
      ['연신내역 3번 출구에서 도보 5분', 'yeonsinnae-exit-number'],
      ['스튜디오 놀에서 보컬 레슨을 신청하세요', 'vocal-instrument-lesson-firstparty'],
      // 2026-07 리뷰에서 확인된 우회 경로: '선택'이 allow였다면 통과했을 판매 문구
      ['스튜디오 놀 보컬 레슨을 선택하세요. 지금 예약!', 'vocal-instrument-lesson-firstparty'],
      // 마커와 주장이 줄로 갈라진 문단 수준 날조
      [
        '저희 스튜디오는 다양한 프로그램을 운영합니다.\n보컬 레슨도 그중 하나입니다.',
        'vocal-instrument-lesson-firstparty',
      ],
      ['기타 악기 레슨은 별도 문의', 'instrument-lesson-offer-verb'],
      ['영어 가능 엔지니어가 상주합니다', 'english-engineer-claim'],
      ['We offer English-speaking music lessons in Seoul', 'english-chinese-lesson-fabrication'],
      // 스튜디오명 없는 1인칭 영어 날조
      ['We offer vocal lessons and singing lessons for beginners.', 'vocal-lesson-claim-en'],
      ['Parent organization: kosmart.org', 'kosmart-parent-claim'],
      // 어순 역전형 parent 주장
      ['한국스마트협동조합은 Studio NOL의 모기업입니다', 'kosmart-parent-claim'],
      // '불가능'이 allow '가능'에 자기 면제되던 우회 경로 (1인칭 배제 단정)
      ['스튜디오 놀에서 드럼 녹음은 불가능합니다.', 'drum-exclusion-claim'],
    ];

    for (const [text, expectedRule] of fixtures) {
      const violations = findFactViolations(text, 'fixture');
      expect(
        violations.some((v) => v.ruleId === expectedRule)
          ? expectedRule
          : `MISSED(${expectedRule}): ${text} → [${violations.map((v) => v.ruleId).join(',')}]`,
      ).toBe(expectedRule);
    }
  });

  it('passes known legal contexts (no false positives)', () => {
    const fixtures = [
      '스튜디오 놀은 보컬 레슨을 운영하지 않습니다. 외부 보컬 코치를 이용하세요.',
      '연신내역 4번 출구에서 도보 5분',
      '6호선 불광역 7번 출구 도보 5분, 연신내역 도보 5분',
      '스튜디오 놀은 연신내역 4번 출구에서 도보 5분, 불광역 7번 출구에서 도보 7분 거리입니다.',
      '지하철 6호선 불광역 7번 출구·3호선 연신내역 4번 출구에서 각각 도보 5분',
      '불광역/연신내역 4번 출구 도보 5분, 24시간 보안 시스템',
      '강남·서초에는 K-pop 보컬 레슨 학원과 오디션 준비 스터디가 밀집해 있습니다.',
      '목동 학원가 인근 보컬 레슨 수강생들의 첫 스튜디오 녹음 의뢰가 꾸준합니다. 연신내까지 환승 한 번.',
      // 외부 레슨 고르기 가이드 관용구 (레슨 선택/비교)
      '![보컬 레슨 선택 가이드 — 스튜디오 놀](/images/recording6.webp)',
      '![온라인 보컬 레슨 vs 오프라인 레슨 비교 — 스튜디오 놀](/images/hardware8.webp)',
      // 부정어가 앞 줄에 오는 합법 문맥
      '스튜디오 놀은 보컬 레슨을 운영하지 않으므로, 외부 코치와 병행하세요.\n보컬 레슨 후 녹음 세션으로 성과를 확인할 수 있습니다.',
      '드럼 녹음은 의뢰 시 가능하니 문의해 주세요.',
      // 아파트 방음 셀링 포인트 문맥 (스튜디오 배제 단정 아님)
      '일산 신도시 아파트 단지에서 보컬·드럼·악기 연습은 사실상 불가능. STC 60+ 방음 개인실이 대안입니다.',
      '전화 010-4255-7893 또는 카카오톡으로 문의',
      '한국스마트협동조합이 제작을 지원한 아티스트의 발매작이다.',
      'Studio NOL does not offer vocal lessons; use an external vocal coach.',
    ];

    for (const text of fixtures) {
      const violations = findFactViolations(text, 'fixture');
      expect(
        violations.length === 0
          ? ''
          : `FALSE POSITIVE: ${text} → ${formatViolations(violations)}`,
      ).toBe('');
    }
  });
});
