#!/usr/bin/env -S npx tsx
/**
 * 펀딩 콘텐츠 불변식 기준선 게이트 — 프로젝트 slug와 리워드 id를 커밋해 두고, 바뀌면 세운다.
 *
 * 왜 필요한가:
 * 프로젝트·리워드의 정본은 `content/funding/<slug>.md`인데 후원 기록은 DB에 문자열
 * `project_slug`·`reward_id`로 남는다. 파일만 고치면 아무 에러 없이 다음이 벌어진다.
 *
 *   - 리워드 id를 바꾸면 한정 재고가 0으로 리셋된다. lib/funding/service.ts의 재고 조건은
 *     `fp.reward_id = <파일의 id>`로 기존 후원을 세므로, id가 바뀐 순간 그 후원들이 안
 *     세어져 100개짜리 리워드가 200개 팔린다.
 *   - slug를 바꾸면 진행 중 모금액이 공개적으로 0원이 되고, 기존 후원자는 manage 페이지에서
 *     프로젝트를 못 찾아 셀프 취소·후원 확인을 잃는다.
 *   - totalQuantity를 빼면 한정이 무제한이 되고, 없던 걸 넣으면 이미 팔린 수량을 모르는
 *     채로 상한이 생긴다.
 *
 * 스펙(docs/superpowers/specs/2026-09-08-funding-design.md §3.1)은 "오픈 뒤에는 리워드 id
 * 삭제와 금액 변경을 하지 않는다 … 이 규칙은 코드로 막을 수 없어 이 절이 정본이다"라고
 * 적어 뒀다. 이 기준선이 그 규칙을 코드로 가져온 것이다.
 *
 * 사용:
 *   npx tsx scripts/funding-baseline.ts             # 검사 (바뀌면 exit 1)
 *   npx tsx scripts/funding-baseline.ts --update    # 기준선 갱신
 *   npx tsx scripts/funding-baseline.ts --baseline <path>   # 다른 기준선과 대조(검증용)
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseFundingProject } from '../lib/funding/projects';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FUNDING = path.join(ROOT, 'content/funding');
const DEFAULT_BASELINE = path.join(ROOT, 'content/funding.baseline.json');

/** 리워드 id → 한정 여부(totalQuantity 유무). 수량 자체는 늘릴 수 있으므로 유무만 고정한다. */
export type ProjectEntry = { rewards: Record<string, { limited: boolean }> };
export type Baseline = { note: string; entries: Record<string, ProjectEntry> };

export const computeFundingBaseline = (dir: string = FUNDING): Record<string, ProjectEntry> => {
  const out: Record<string, ProjectEntry> = {};
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.md')) continue;
    const slug = file.slice(0, -3);
    const project = parseFundingProject(fs.readFileSync(path.join(dir, file), 'utf8'), slug);
    const rewards: ProjectEntry['rewards'] = {};
    for (const r of [...project.rewards].sort((a, b) => a.id.localeCompare(b.id))) {
      rewards[r.id] = { limited: r.totalQuantity !== null };
    }
    out[slug] = { rewards };
  }
  return out;
};

export type Violation = { kind: 'project-added' | 'project-removed' | 'reward-added' | 'reward-removed' | 'reward-limit-changed'; slug: string; rewardId?: string; detail: string };

const WHY: Record<Violation['kind'], string> = {
  'project-added': '새 프로젝트는 안전하다. 기준선만 갱신하면 된다.',
  'project-removed': 'slug가 사라지면(개명 포함) 진행 중 모금액이 0원으로 보이고, 기존 후원자는 manage 페이지에서 프로젝트를 못 찾아 셀프 취소·후원 확인을 잃는다.',
  'reward-added': '새 리워드는 안전하다. 기준선만 갱신하면 된다.',
  'reward-removed': '리워드 id가 사라지면(개명 포함) 그 id로 쌓인 기존 후원이 재고 집계에서 빠져 한정 수량이 0으로 리셋된다 — 100개짜리가 200개 팔린다.',
  'reward-limit-changed': '한정 여부가 바뀌면 이미 팔린 수량을 모르는 채로 상한이 생기거나, 한정이 조용히 무제한이 된다.',
};

export const diffFundingBaseline = (base: Record<string, ProjectEntry>, now: Record<string, ProjectEntry>): Violation[] => {
  const violations: Violation[] = [];
  for (const slug of [...new Set([...Object.keys(base), ...Object.keys(now)])].sort()) {
    const a = base[slug];
    const b = now[slug];
    if (!a) { violations.push({ kind: 'project-added', slug, detail: `프로젝트 추가: ${slug}` }); continue; }
    if (!b) { violations.push({ kind: 'project-removed', slug, detail: `프로젝트 사라짐: ${slug}` }); continue; }
    for (const id of [...new Set([...Object.keys(a.rewards), ...Object.keys(b.rewards)])].sort()) {
      const ra = a.rewards[id];
      const rb = b.rewards[id];
      if (!ra) violations.push({ kind: 'reward-added', slug, rewardId: id, detail: `${slug}: 리워드 추가 — ${id}` });
      else if (!rb) violations.push({ kind: 'reward-removed', slug, rewardId: id, detail: `${slug}: 리워드 id 사라짐 — ${id}` });
      else if (ra.limited !== rb.limited) violations.push({ kind: 'reward-limit-changed', slug, rewardId: id, detail: `${slug}.${id}: 한정 ${ra.limited ? '있음' : '없음'} → ${rb.limited ? '있음' : '없음'}` });
    }
  }
  return violations;
};

export const formatViolations = (violations: Violation[]): string => {
  const lines = [`펀딩 콘텐츠 불변식이 기준선과 다르다 (${violations.length}건):`];
  for (const v of violations) lines.push(`  - ${v.detail}\n      왜 위험한가: ${WHY[v.kind]}`);
  lines.push('');
  lines.push('의도한 변경이면: npm run check:funding-baseline -- --update  (같은 커밋에 "왜 이 slug·리워드 id가 바뀌는지"를 적을 것 — 이유 없는 갱신은 게이트를 무력화한다)');
  return lines.join('\n');
};

export const readBaseline = (baselinePath: string = DEFAULT_BASELINE): Record<string, ProjectEntry> =>
  (JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Baseline).entries;

const main = () => {
  const args = process.argv.slice(2);
  const bi = args.indexOf('--baseline');
  const baselinePath = bi >= 0 ? path.resolve(args[bi + 1]) : DEFAULT_BASELINE;
  const now = computeFundingBaseline();

  if (args.includes('--update')) {
    const payload: Baseline = {
      note: '펀딩 콘텐츠 불변식 기준선(프로젝트 slug × 리워드 id × 한정 여부). scripts/funding-baseline.ts --update 로 갱신하고, 같은 커밋에 이유를 남길 것.',
      entries: now,
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 1)}\n`);
    console.log(`기준선 갱신: 프로젝트 ${Object.keys(now).length}개 → ${path.relative(ROOT, baselinePath)}`);
    return;
  }
  if (!fs.existsSync(baselinePath)) {
    console.error(`기준선 파일이 없다: ${baselinePath}\n먼저 --update 로 생성할 것.`);
    process.exit(2);
  }
  const violations = diffFundingBaseline(readBaseline(baselinePath), now);
  if (violations.length === 0) {
    console.log(`✅ 펀딩 콘텐츠 불변식 변화 없음 (프로젝트 ${Object.keys(now).length}개)`);
    return;
  }
  console.error(`❌ ${formatViolations(violations)}`);
  process.exit(1);
};

if (process.argv[1] && /funding-baseline\.ts$/.test(process.argv[1])) main();
