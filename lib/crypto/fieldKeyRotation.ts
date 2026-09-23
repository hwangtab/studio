import { and, eq, isNotNull } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { getDb } from '../../db/client';
import { fundingCreators } from '../../db/schema';
import {
  FieldCryptoError,
  decryptFieldWithKey,
  deriveKeyId,
  encryptFieldWithKey,
  readFieldKeyId,
} from './fieldCrypto';

/**
 * 필드 암호화 키 회전 엔진. CLI는 `scripts/rotate-field-key.mjs`가 얇게 감싼다 —
 * 판정과 쓰기는 전부 여기 있고, 그래서 테스트가 인메모리 libsql로 전부 돌 수 있다.
 *
 * 성질 넷이 이 파일의 이유다.
 * 1. **기본이 dry-run이다.** 쓰려면 호출부가 `apply: true`를 명시해야 한다 — 이 저장소는
 *    "프로덕션 DB는 운영자가 직접"이 규칙이다.
 * 2. **재실행이 안전하다.** 이미 새 키(keyId)로 바뀐 행은 복호화조차 하지 않고 건너뛴다.
 *    그게 저장 형식 v2에 keyId를 넣은 이유다.
 * 3. **한 행이 실패해도 멈추지 않는다.** 끝까지 돌고 요약을 낸다. 중간에 멈추면 "어디까지
 *    갔는지"를 사람이 추적해야 하는데, 그 추적이야말로 이 스크립트가 없애려는 일이다.
 * 4. **낙관적 잠금으로만 쓴다.** UPDATE의 WHERE에 "읽은 그 암호문 그대로일 때"를 건다.
 *    회전이 도는 중에 개설자가 값을 다시 저장하면 그 새 값(이미 새 키다)을 덮어쓰면 안 된다
 *    — 덮어쓰면 방금 입력한 번호가 옛 번호로 되돌아간다. `publicStatusDecision.ts`와 같은 축.
 *
 * **평문·키·암호문은 어떤 반환값에도 담지 않는다.** 실패는 행 id와 오류 코드만 남긴다.
 */

export interface EncryptedFieldTarget {
  /** 로그에 찍히는 이름. 실제 DB 컬럼 이름과 같게 둔다. */
  readonly label: string;
  readonly table: SQLiteTable;
  readonly idColumn: SQLiteColumn;
  readonly valueColumn: SQLiteColumn;
  /** drizzle 스키마에서의 속성 이름 — UPDATE ... SET의 키로 쓴다. */
  readonly valueField: string;
}

/**
 * **회전 대상 컬럼은 여기 하나에만 적는다.** 암호화 필드가 늘면 이 배열에 한 줄을 더하는
 * 것으로 끝나야 한다 — 스크립트도 테스트도 이 목록을 읽는다. 목록에 없는 컬럼은 회전되지
 * 않고, 그 사실은 키를 지운 뒤에야 드러난다.
 */
export const ENCRYPTED_FIELD_TARGETS: readonly EncryptedFieldTarget[] = [
  {
    label: 'funding_creators.resident_number_enc',
    table: fundingCreators,
    idColumn: fundingCreators.id,
    valueColumn: fundingCreators.residentNumberEnc,
    valueField: 'residentNumberEnc',
  },
];

/** 회전하지 못한 행. **id와 코드만** 담는다. */
export interface FieldRotationFailure {
  readonly target: string;
  readonly id: string;
  /**
   * `FieldCryptoError.code` 또는:
   * - `changed` — 읽은 뒤 값이 바뀌었다(낙관적 잠금이 막았다). 다시 돌리면 대개 건너뛴다.
   * - `unknown` — 암호화와 무관한 실패(DB 오류 등).
   */
  readonly code: string;
}

export interface FieldRotationTargetSummary {
  readonly target: string;
  readonly scanned: number;
  readonly rotated: number;
  readonly skipped: number;
  readonly failed: number;
}

export interface FieldRotationSummary {
  /** false면 아무것도 쓰지 않았다. `rotated`는 "썼을 행 수"라는 뜻이 된다. */
  readonly apply: boolean;
  readonly rotated: number;
  readonly skipped: number;
  readonly failed: number;
  readonly failures: readonly FieldRotationFailure[];
  readonly byTarget: readonly FieldRotationTargetSummary[];
}

type Database = ReturnType<typeof getDb>;

export interface RotateFieldKeyOptions {
  readonly oldKey: Buffer;
  readonly newKey: Buffer;
  /** 기본 false = dry-run. */
  readonly apply?: boolean;
  readonly targets?: readonly EncryptedFieldTarget[];
  readonly db?: Database;
}

export const rotateFieldKey = async (options: RotateFieldKeyOptions): Promise<FieldRotationSummary> => {
  const { oldKey, newKey } = options;
  const apply = options.apply === true;
  const targets = options.targets ?? ENCRYPTED_FIELD_TARGETS;
  const db = options.db ?? getDb();
  const newKeyId = deriveKeyId(newKey);

  const failures: FieldRotationFailure[] = [];
  const byTarget: FieldRotationTargetSummary[] = [];

  for (const target of targets) {
    let scanned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    const rows = (await db
      .select({ id: target.idColumn, value: target.valueColumn })
      .from(target.table)
      .where(isNotNull(target.valueColumn))) as Array<{ id: unknown; value: unknown }>;

    for (const row of rows) {
      scanned += 1;
      const id = String(row.id);
      const stored = typeof row.value === 'string' ? row.value : '';

      const fail = (code: string) => {
        failed += 1;
        failures.push({ target: target.label, id, code });
      };

      try {
        // 이미 새 키면 복호화도 하지 않는다 — 재실행이 싸고 안전해야 한다.
        if (readFieldKeyId(stored) === newKeyId) {
          skipped += 1;
          continue;
        }

        // 옛 키로 열어 새 키로 다시 잠근다. 평문은 이 블록 밖으로 나가지 않는다.
        const next = encryptFieldWithKey(decryptFieldWithKey(stored, oldKey), newKey);

        if (!apply) {
          rotated += 1;
          continue;
        }

        const result = await db
          .update(target.table)
          .set({ [target.valueField]: next })
          // 낙관적 잠금 — 읽은 그 암호문일 때만 쓴다.
          .where(and(eq(target.idColumn, row.id), eq(target.valueColumn, stored)));

        if (Number(result.rowsAffected) === 0) fail('changed');
        else rotated += 1;
      } catch (error: unknown) {
        fail(error instanceof FieldCryptoError ? error.code : 'unknown');
      }
    }

    byTarget.push({ target: target.label, scanned, rotated, skipped, failed });
  }

  return {
    apply,
    rotated: byTarget.reduce((sum, t) => sum + t.rotated, 0),
    skipped: byTarget.reduce((sum, t) => sum + t.skipped, 0),
    failed: byTarget.reduce((sum, t) => sum + t.failed, 0),
    failures,
    byTarget,
  };
};
