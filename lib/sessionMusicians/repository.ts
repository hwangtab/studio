import { and, desc, eq, like, or, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { sessionMusicians, type SessionMusician } from '../../db/schema';
import { isMissingTableError } from '../dbErrors';
import type { SessionInstrumentEntry, SessionRegistrationInput, SessionSampleLink } from './validate';

/**
 * 세션 연주자 표 읽기·쓰기. 표가 없으면(마이그레이션 0077 전 배포) `isSessionMusicianTableMissing`이 참이다 —
 * 공개 API는 503 `migration_needed`, 관리자 화면은 적용 안내로 돌린다(0067 `partner_payouts`와 같은 방식).
 * **개인정보 평문은 이 파일을 지나지 않는다** — 암호문(`private_enc`)을 그대로 넘긴다.
 */

export const isSessionMusicianTableMissing = (error: unknown): boolean => isMissingTableError(error, 'session_musicians');

/** UNIQUE 위반(이메일 해시·토큰 해시). drizzle이 감싸면 원문이 cause에 있다. */
export const isUniqueViolation = (error: unknown): boolean => {
  const seen = new Set<unknown>();
  let cur: unknown = error;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const msg = cur instanceof Error ? cur.message : '';
    if (/UNIQUE constraint failed/i.test(msg)) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
};

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/** 개인정보를 뺀 프로필 — 목록·상세·본인 화면이 같은 모양을 쓴다. */
export interface SessionMusicianProfile {
  id: string;
  stageName: string;
  primaryInstrument: string;
  instruments: SessionInstrumentEntry[];
  genres: string[];
  yearsExperience: number | null;
  reading: 'chart' | 'staff' | 'none' | null;
  remoteRecording: boolean;
  region: string | null;
  bio: string | null;
  sampleLinks: SessionSampleLink[];
  rateNote: string | null;
  status: SessionMusician['status'];
  operatorMemo: string | null;
  /** 직렬화를 위해 epoch ms로 둔다(Date는 getServerSideProps props에 못 싣는다). */
  createdAt: number;
  updatedAt: number;
  lastConfirmedAt: number;
}

export const toProfile = (row: SessionMusician): SessionMusicianProfile => ({
  id: row.id,
  stageName: row.stageName,
  primaryInstrument: row.primaryInstrument,
  instruments: parseJson<SessionInstrumentEntry[]>(row.instrumentsJson, []),
  genres: parseJson<string[]>(row.genresJson, []),
  yearsExperience: row.yearsExperience ?? null,
  reading: row.reading ?? null,
  remoteRecording: row.remoteRecording === true,
  region: row.region ?? null,
  bio: row.bio ?? null,
  sampleLinks: parseJson<SessionSampleLink[]>(row.sampleLinksJson, []),
  rateNote: row.rateNote ?? null,
  status: row.status,
  operatorMemo: row.operatorMemo ?? null,
  createdAt: row.createdAt.getTime(),
  updatedAt: row.updatedAt.getTime(),
  lastConfirmedAt: row.lastConfirmedAt.getTime(),
});

/** 공개 입력에서 평문 칸만 뽑는다(실명·연락처는 `privateEnc`로). */
const plainColumns = (input: SessionRegistrationInput) => ({
  stageName: input.stageName,
  primaryInstrument: input.primaryInstrument,
  instrumentsJson: JSON.stringify(input.instruments),
  genresJson: JSON.stringify(input.genres),
  yearsExperience: input.yearsExperience,
  reading: input.reading,
  remoteRecording: input.remoteRecording,
  region: input.region,
  bio: input.bio,
  sampleLinksJson: JSON.stringify(input.sampleLinks),
  rateNote: input.rateNote,
});

export interface NewSessionMusicianRow {
  input: SessionRegistrationInput;
  privateEnc: string;
  emailHash: string;
  manageTokenHash: string;
  consentVersion: string;
}

export const insertSessionMusician = async (row: NewSessionMusicianRow): Promise<string> => {
  const [created] = await getDb()
    .insert(sessionMusicians)
    .values({
      ...plainColumns(row.input),
      adultConfirmed: true,
      privateEnc: row.privateEnc,
      emailHash: row.emailHash,
      manageTokenHash: row.manageTokenHash,
      consentVersion: row.consentVersion,
    })
    .returning({ id: sessionMusicians.id });
  return created.id;
};

export const findIdByEmailHash = async (emailHash: string): Promise<{ id: string; stageName: string } | null> => {
  const [row] = await getDb()
    .select({ id: sessionMusicians.id, stageName: sessionMusicians.stageName })
    .from(sessionMusicians)
    .where(eq(sessionMusicians.emailHash, emailHash))
    .limit(1);
  return row ?? null;
};

/** 관리 링크를 다시 보낼 때 새 토큰으로 바꾼다 — 원문을 저장하지 않으니 옛 링크를 다시 만들 수 없다. */
export const replaceManageTokenHash = async (id: string, manageTokenHash: string): Promise<void> => {
  await getDb().update(sessionMusicians).set({ manageTokenHash }).where(eq(sessionMusicians.id, id));
};

export const findByManageTokenHash = async (tokenHash: string): Promise<SessionMusician | null> => {
  const [row] = await getDb().select().from(sessionMusicians).where(eq(sessionMusicians.manageTokenHash, tokenHash)).limit(1);
  return row ?? null;
};

/** 본인 수정 — 보유 기간 기산점을 갱신하고 재확인 표시를 지운다. 바뀐 행이 있으면 true. */
export const updateByManageTokenHash = async (
  tokenHash: string,
  input: SessionRegistrationInput,
  privateEnc: string,
  now: Date = new Date(),
): Promise<boolean> => {
  const result = await getDb()
    .update(sessionMusicians)
    .set({ ...plainColumns(input), privateEnc, updatedAt: now, lastConfirmedAt: now, reconfirmSentAt: null })
    .where(eq(sessionMusicians.manageTokenHash, tokenHash));
  return result.rowsAffected > 0;
};

/** "계속 활동 중" 확인 — 보유 기간 기산점만 갱신한다. */
export const confirmByManageTokenHash = async (tokenHash: string, now: Date = new Date()): Promise<boolean> => {
  const result = await getDb()
    .update(sessionMusicians)
    .set({ lastConfirmedAt: now, reconfirmSentAt: null })
    .where(eq(sessionMusicians.manageTokenHash, tokenHash));
  return result.rowsAffected > 0;
};

/** 본인 삭제 — 소프트 삭제가 아니라 행 삭제다(열람·정정·삭제 요구). */
export const deleteByManageTokenHash = async (tokenHash: string): Promise<boolean> => {
  const result = await getDb().delete(sessionMusicians).where(eq(sessionMusicians.manageTokenHash, tokenHash));
  return result.rowsAffected > 0;
};

// ---- 관리자 ----

export interface SessionMusicianFilters {
  status?: SessionMusician['status'];
  /** 주 악기이거나 다룰 수 있는 악기에 들어 있는 것. */
  instrument?: string;
  genre?: string;
  remoteOnly?: boolean;
}

export const LIST_LIMIT = 300;

export const listSessionMusicians = async (filters: SessionMusicianFilters = {}): Promise<SessionMusicianProfile[]> => {
  const conditions = [];
  if (filters.status) conditions.push(eq(sessionMusicians.status, filters.status));
  if (filters.instrument) {
    conditions.push(
      or(eq(sessionMusicians.primaryInstrument, filters.instrument), like(sessionMusicians.instrumentsJson, `%"${filters.instrument}"%`)),
    );
  }
  if (filters.genre) conditions.push(like(sessionMusicians.genresJson, `%"${filters.genre}"%`));
  if (filters.remoteOnly) conditions.push(eq(sessionMusicians.remoteRecording, true));
  const rows = await getDb()
    .select()
    .from(sessionMusicians)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sessionMusicians.createdAt))
    .limit(LIST_LIMIT);
  return rows.map(toProfile);
};

export const getSessionMusician = async (id: string): Promise<SessionMusician | null> => {
  const [row] = await getDb().select().from(sessionMusicians).where(eq(sessionMusicians.id, id)).limit(1);
  return row ?? null;
};

export const updateOperatorFields = async (
  id: string,
  fields: { status?: SessionMusician['status']; operatorMemo?: string | null },
): Promise<boolean> => {
  const set: Partial<typeof sessionMusicians.$inferInsert> = { updatedAt: new Date() };
  if (fields.status !== undefined) set.status = fields.status;
  if (fields.operatorMemo !== undefined) set.operatorMemo = fields.operatorMemo;
  const result = await getDb().update(sessionMusicians).set(set).where(eq(sessionMusicians.id, id));
  return result.rowsAffected > 0;
};

/** 대시보드 "처리할 일" — 아직 열어 보지 않은 새 등록 수. */
export const countNewSessionMusicians = async (): Promise<number> => {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(sessionMusicians)
    .where(eq(sessionMusicians.status, 'new'));
  return Number(row?.n ?? 0);
};

