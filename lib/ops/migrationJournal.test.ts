/**
 * 마이그레이션 저널 무결성 — drizzle 마이그레이터가 **조용히** 건너뛰는 경우를 CI에서 잡는다.
 *
 * libsql 마이그레이터는 적용된 것 중 `created_at` 최댓값 하나만 읽고, 저널의 `when`이 그 값보다
 * 큰 엔트리만 실행한다(node_modules/drizzle-orm/libsql/migrator.js). 그래서 이미 적용된 최대
 * `when`보다 작은 마이그레이션은 영원히 실행되지 않고 `db:migrate`는 오류 없이 초록으로 끝난다
 * (CLAUDE.md "작은 `when`은 조용히 건너뛴다"). 브랜치 병합으로 저널이 부딪힐 때 이 모양이 생긴다.
 *
 * 검사: (i) `when` 엄격 증가 (ii) idx 중복 없음 (iii) 엔트리마다 SQL 파일 존재
 * (iv) 스냅샷 `prevId` 사슬이 앞 스냅샷의 `id`로 이어짐 — 끊기면 다음 `drizzle-kit generate`가
 * 이미 적용된 DDL을 다시 발행해 운영 DB에서 `duplicate column name`으로 터진다.
 */
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle/migrations');
const META_DIR = path.join(MIGRATIONS_DIR, 'meta');

interface JournalEntry { idx: number; when: number; tag: string }
interface Snapshot { id: string; prevId: string }

const entries: JournalEntry[] = JSON.parse(fs.readFileSync(path.join(META_DIR, '_journal.json'), 'utf-8')).entries;

const HINT = ' — drizzle은 적용된 최대 when보다 작은 when의 마이그레이션을 오류 없이 건너뛴다. '
  + '병합 시 엔트리를 when 오름차순으로 합쳐 idx를 다시 매기고, when을 현재 최댓값보다 크게 재발행할 것(CLAUDE.md "마이그레이션은 배열 순서가 아니라 when으로 걸러진다").';

const snapshotPath = (idx: number) => path.join(META_DIR, `${String(idx).padStart(4, '0')}_snapshot.json`);

describe('drizzle 마이그레이션 저널', () => {
  it('when이 엄격히 증가한다', () => {
    const bad = entries.flatMap((e, i) => (i > 0 && e.when <= entries[i - 1].when
      ? [`${entries[i - 1].tag}(${entries[i - 1].when}) → ${e.tag}(${e.when})`] : []));
    expect(bad.length === 0 ? '' : `when이 앞 엔트리보다 크지 않다: ${bad.join(', ')}${HINT}`).toBe('');
  });

  it('idx가 중복되지 않는다', () => {
    const seen = new Map<number, string>();
    const dup: string[] = [];
    for (const e of entries) {
      if (seen.has(e.idx)) dup.push(`idx ${e.idx}: ${seen.get(e.idx)} / ${e.tag}`);
      else seen.set(e.idx, e.tag);
    }
    expect(dup.length === 0 ? '' : `idx 중복: ${dup.join(', ')}${HINT}`).toBe('');
  });

  it('엔트리마다 SQL 파일이 있다', () => {
    const missing = entries.filter((e) => !fs.existsSync(path.join(MIGRATIONS_DIR, `${e.tag}.sql`))).map((e) => e.tag);
    expect(missing).toEqual([]);
  });

  it('스냅샷 prevId 사슬이 끊기지 않는다', () => {
    const problems: string[] = [];
    let prevId: string | null = null;
    for (const e of entries) {
      const file = snapshotPath(e.idx);
      if (!fs.existsSync(file)) {
        problems.push(`${e.tag}: 스냅샷 ${path.basename(file)} 없음`);
        prevId = null;
        continue;
      }
      const snap: Snapshot = JSON.parse(fs.readFileSync(file, 'utf-8'));
      // 첫 스냅샷의 prevId는 0으로 채운 자리표시자다.
      if (prevId !== null && snap.prevId !== prevId) {
        problems.push(`${e.tag}: prevId(${snap.prevId})가 앞 스냅샷 id(${prevId})와 다르다`);
      }
      prevId = snap.id;
    }
    expect(problems.length === 0 ? '' : `${problems.join('; ')} — 마지막 스냅샷이 양쪽 변경을 모두 담은 전체 스키마가 되도록 재발행하고 prevId 사슬을 이을 것.`).toBe('');
  });
});
