import validator from 'validator';

import {
  SESSION_LIMITS,
  SESSION_READING_OPTIONS,
  SESSION_REGIONS,
  isGenreId,
  isInstrumentId,
} from '../../data/sessionMusicians';

/**
 * 세션 연주자 등록 입력의 순수 검증·정규화 — DB·메일·암호화를 모른다.
 * `lib/contact/payload.ts`처럼 손으로 검사한다(zod 없음). 설계: docs/session-musician-registration-design-2026-10.md 3장.
 *
 * 규칙 몇 가지가 에러 없이 어겨지기 쉬워 적어 둔다.
 * - 제어 문자·양방향 제어 문자(RLO 등)는 **걷어 낸다** — 관리자 화면·메일에서 글자 순서를 뒤집어 보이는 데 쓰인다.
 * - 샘플 링크는 https만, 호스트에 점이 있어야 하고, 주소에 계정(user:pass@)이 있으면 거절한다. 사이트는 이 링크를 열기만 하고 가져오지 않는다.
 * - 이메일은 소문자·공백 정규화만 한다. `validator.normalizeEmail`은 gmail 점·`+태그`를 지워 서로 다른 사람을 한 주소로 합친다.
 */

export type SessionInstrumentEntry = string | { other: string };

export interface SessionSampleLink {
  url: string;
  label: string;
}

export interface SessionRegistrationInput {
  stageName: string;
  realName: string;
  primaryInstrument: string;
  /** 다룰 수 있는 악기 — 목록 id 또는 직접 입력({other}). 주 악기와 겹쳐도 그대로 둔다. */
  instruments: SessionInstrumentEntry[];
  genres: string[];
  yearsExperience: number | null;
  reading: 'chart' | 'staff' | 'none' | null;
  remoteRecording: boolean;
  region: string | null;
  bio: string | null;
  sampleLinks: SessionSampleLink[];
  /** 곡당 희망 연주비(원, 참고용). 연주비는 곡당 기준 하나뿐이다. */
  ratePerSong: number | null;
  rateNote: string | null;
  phone: string;
  email: string;
  kakaoId: string | null;
}

export type SessionValidationCode =
  | 'invalid_body'
  | 'stage_name_required'
  | 'stage_name_length'
  | 'real_name_required'
  | 'real_name_length'
  | 'adult_required'
  | 'consent_required'
  | 'primary_instrument_invalid'
  | 'instruments_invalid'
  | 'genres_invalid'
  | 'years_invalid'
  | 'reading_invalid'
  | 'region_invalid'
  | 'bio_length'
  | 'sample_links_required'
  | 'sample_links_too_many'
  | 'sample_link_invalid'
  | 'rate_per_song_invalid'
  | 'rate_note_length'
  | 'phone_required'
  | 'phone_invalid'
  | 'email_required'
  | 'email_invalid'
  | 'kakao_id_length';

export type SessionValidationResult =
  | { ok: true; value: SessionRegistrationInput }
  | { ok: false; field: string; code: SessionValidationCode; message: string };

// 제어 문자(탭·줄바꿈 제외는 아래에서 따로)·너비 없는 문자·양방향 제어 문자.
const UNSAFE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x7f],
  [0x200b, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2060, 0x2069],
  [0xfeff, 0xfeff],
];
const isUnsafeChar = (ch: string): boolean => {
  const code = ch.codePointAt(0) ?? 0;
  return UNSAFE_RANGES.some(([from, to]) => code >= from && code <= to);
};
const stripUnsafe = (value: string): string => Array.from(value).filter((ch) => !isUnsafeChar(ch)).join('');
const hasUnsafeChars = (value: string): boolean => Array.from(value).some(isUnsafeChar);

/** 한 줄 글: 제어 문자를 걷고 연속 공백을 하나로, 앞뒤를 자른다. */
export const cleanLine = (value: unknown): string =>
  typeof value === 'string' ? stripUnsafe(value).replace(/\s+/g, ' ').trim() : '';

/** 여러 줄 글: 제어 문자를 걷고 줄바꿈은 살린다(연속 빈 줄은 하나로). */
export const cleanMultiline = (value: unknown): string =>
  typeof value === 'string'
    ? stripUnsafe(value.replace(/\r\n?/g, '\n'))
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : '';

/** 소문자·공백 정규화한 이메일 — 중복 판정(HMAC)과 발송 주소가 같은 값을 쓴다. */
export const normalizeSessionEmail = (value: unknown): string =>
  typeof value === 'string' ? stripUnsafe(value).trim().toLowerCase() : '';

const fail = (field: string, code: SessionValidationCode, message: string): SessionValidationResult => ({
  ok: false,
  field,
  code,
  message,
});

const PHONE_PATTERN = /^[\d\s+\-().]+$/;

/** https 주소만. 통과하면 정규화된 주소를, 아니면 null. */
export const parseSampleUrl = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > SESSION_LIMITS.sampleUrl.max) return null;
  // 공백·제어·양방향 문자가 섞인 주소는 고쳐 쓰지 않고 거절한다 — 붙여 넣기 실수이거나 속임수다.
  if (/\s/.test(trimmed) || hasUnsafeChars(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;
  if (url.username || url.password) return null;
  return url.href;
};

export interface ValidateOptions {
  /**
   * 본인 수정(PATCH)일 때 준다. 이미 등록된 행의 수정이므로
   * - 이메일은 바꾸지 않는다 — 이메일이 곧 본인 확인(관리 링크 수신처)이자 중복 판정 키라서, 바꾸려면 삭제하고 다시 등록한다.
   *   입력의 email은 무시하고 이 값을 쓴다.
   * - 만 19세 확인·동의는 등록 때 받은 것이 그대로 유효하다(다시 받지 않는다).
   */
  existingEmail?: string;
}

/**
 * 곡당 희망 연주비 — 비면 null. 정수 또는 숫자 문자열(쉼표·공백 허용). 소수·단위 글자·음수·범위 밖은 거절한다.
 * 등록 폼·관리 링크와 관리자 수정(가격이 바뀌면 운영자가 고친다)이 같은 규칙을 쓴다.
 */
export const parseRatePerSong = (raw: unknown): { ok: true; value: number | null } | { ok: false; message: string } => {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  const { min, max } = SESSION_LIMITS.ratePerSong;
  const invalid = { ok: false as const, message: `곡당 연주비는 ${min.toLocaleString('ko-KR')}원~${max.toLocaleString('ko-KR')}원 사이의 숫자로 적어 주세요.` };
  let rate: number;
  if (typeof raw === 'number') rate = raw;
  else if (typeof raw === 'string') {
    const digits = raw.replace(/[,\s]/g, '');
    if (!/^\d+$/.test(digits)) return invalid;
    rate = Number(digits);
  } else return invalid;
  if (!Number.isSafeInteger(rate) || rate < min || rate > max) return invalid;
  return { ok: true, value: rate };
};

export const validateSessionRegistration = (
  body: unknown,
  options: ValidateOptions = {},
): SessionValidationResult => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return fail('body', 'invalid_body', '요청 형식이 올바르지 않아요.');
  }
  const b = body as Record<string, unknown>;

  if (options.existingEmail === undefined) {
    if (b.adultConfirmed !== true) return fail('adultConfirmed', 'adult_required', '만 19세 이상만 등록할 수 있어요.');
    if (b.consent !== true) return fail('consent', 'consent_required', '개인정보 수집·이용에 동의해 주세요.');
  }

  const stageName = cleanLine(b.stageName);
  if (!stageName) return fail('stageName', 'stage_name_required', '활동명을 적어 주세요.');
  if (stageName.length < SESSION_LIMITS.stageName.min || stageName.length > SESSION_LIMITS.stageName.max) {
    return fail('stageName', 'stage_name_length', `활동명은 ${SESSION_LIMITS.stageName.max}자 이하로 적어 주세요.`);
  }

  const realName = cleanLine(b.realName);
  if (!realName) return fail('realName', 'real_name_required', '실명을 적어 주세요.');
  if (realName.length < SESSION_LIMITS.realName.min || realName.length > SESSION_LIMITS.realName.max) {
    return fail('realName', 'real_name_length', `실명은 ${SESSION_LIMITS.realName.min}~${SESSION_LIMITS.realName.max}자로 적어 주세요.`);
  }

  if (!isInstrumentId(b.primaryInstrument)) {
    return fail('primaryInstrument', 'primary_instrument_invalid', '주 악기를 골라 주세요.');
  }
  const primaryInstrument = b.primaryInstrument;

  // 다룰 수 있는 악기: 목록 id(중복 제거) + 직접 입력 최대 5개.
  const instruments: SessionInstrumentEntry[] = [];
  if (b.instruments !== undefined && b.instruments !== null) {
    if (!Array.isArray(b.instruments) || b.instruments.length > 40) {
      return fail('instruments', 'instruments_invalid', '악기 목록을 확인해 주세요.');
    }
    const seen = new Set<string>();
    let others = 0;
    for (const entry of b.instruments) {
      if (typeof entry === 'string') {
        if (!isInstrumentId(entry)) return fail('instruments', 'instruments_invalid', '악기 목록을 확인해 주세요.');
        if (!seen.has(entry)) {
          seen.add(entry);
          instruments.push(entry);
        }
      } else if (entry && typeof entry === 'object' && typeof (entry as { other?: unknown }).other === 'string') {
        const other = cleanLine((entry as { other: string }).other);
        if (!other) continue;
        if (other.length > SESSION_LIMITS.otherInstrument.max) {
          return fail('instruments', 'instruments_invalid', `직접 입력한 악기 이름은 ${SESSION_LIMITS.otherInstrument.max}자 이하로 적어 주세요.`);
        }
        if (seen.has(`other:${other}`)) continue;
        seen.add(`other:${other}`);
        others += 1;
        if (others > SESSION_LIMITS.otherInstrument.count) {
          return fail('instruments', 'instruments_invalid', `직접 입력한 악기는 ${SESSION_LIMITS.otherInstrument.count}개까지예요.`);
        }
        instruments.push({ other });
      } else {
        return fail('instruments', 'instruments_invalid', '악기 목록을 확인해 주세요.');
      }
    }
  }

  const genres: string[] = [];
  if (b.genres !== undefined && b.genres !== null) {
    if (!Array.isArray(b.genres) || b.genres.length > 30) return fail('genres', 'genres_invalid', '장르 목록을 확인해 주세요.');
    for (const genre of b.genres) {
      if (!isGenreId(genre)) return fail('genres', 'genres_invalid', '장르 목록을 확인해 주세요.');
      if (!genres.includes(genre)) genres.push(genre);
    }
  }

  let yearsExperience: number | null = null;
  if (b.yearsExperience !== undefined && b.yearsExperience !== null && b.yearsExperience !== '') {
    const years = typeof b.yearsExperience === 'string' ? Number(b.yearsExperience) : b.yearsExperience;
    if (
      typeof years !== 'number' ||
      !Number.isInteger(years) ||
      years < SESSION_LIMITS.yearsExperience.min ||
      years > SESSION_LIMITS.yearsExperience.max
    ) {
      return fail('yearsExperience', 'years_invalid', '경력(년)은 0~70 사이의 정수로 적어 주세요.');
    }
    yearsExperience = years;
  }

  let reading: SessionRegistrationInput['reading'] = null;
  if (b.reading !== undefined && b.reading !== null && b.reading !== '') {
    const match = SESSION_READING_OPTIONS.find((option) => option.id === b.reading);
    if (!match) return fail('reading', 'reading_invalid', '악보 리딩을 다시 골라 주세요.');
    reading = match.id as 'chart' | 'staff' | 'none';
  }

  let region: string | null = null;
  if (b.region !== undefined && b.region !== null && b.region !== '') {
    if (typeof b.region !== 'string' || !SESSION_REGIONS.includes(b.region)) {
      return fail('region', 'region_invalid', '지역을 다시 골라 주세요.');
    }
    region = b.region;
  }

  const bio = cleanMultiline(b.bio);
  if (bio.length > SESSION_LIMITS.bio.max) {
    return fail('bio', 'bio_length', `소개는 ${SESSION_LIMITS.bio.max}자 이하로 적어 주세요.`);
  }

  if (!Array.isArray(b.sampleLinks) || b.sampleLinks.length === 0) {
    return fail('sampleLinks', 'sample_links_required', '연주 샘플 링크를 1개 이상 넣어 주세요.');
  }
  // 비어 있는 칸은 버린다(폼은 5칸을 그려 두고 채운 것만 보낸다).
  const rawLinks = (b.sampleLinks as unknown[]).filter(
    (link) => !(link && typeof link === 'object' && !cleanLine((link as { url?: unknown }).url)),
  );
  if (rawLinks.length === 0) return fail('sampleLinks', 'sample_links_required', '연주 샘플 링크를 1개 이상 넣어 주세요.');
  if (rawLinks.length > SESSION_LIMITS.sampleLinks.max) {
    return fail('sampleLinks', 'sample_links_too_many', `샘플 링크는 ${SESSION_LIMITS.sampleLinks.max}개까지예요.`);
  }
  const sampleLinks: SessionSampleLink[] = [];
  for (const link of rawLinks) {
    if (!link || typeof link !== 'object') return fail('sampleLinks', 'sample_link_invalid', '샘플 링크를 확인해 주세요.');
    const url = parseSampleUrl((link as { url?: unknown }).url);
    if (!url) return fail('sampleLinks', 'sample_link_invalid', '샘플 링크는 https:// 로 시작하는 주소만 넣을 수 있어요.');
    const label = cleanLine((link as { label?: unknown }).label);
    if (label.length > SESSION_LIMITS.sampleLabel.max) {
      return fail('sampleLinks', 'sample_link_invalid', `링크 설명은 ${SESSION_LIMITS.sampleLabel.max}자 이하로 적어 주세요.`);
    }
    if (!sampleLinks.some((existing) => existing.url === url)) sampleLinks.push({ url, label });
  }

  const rate = parseRatePerSong(b.ratePerSong);
  if (!rate.ok) return fail('ratePerSong', 'rate_per_song_invalid', rate.message);
  const ratePerSong = rate.value;

  const rateNote = cleanLine(b.rateNote);
  if (rateNote.length > SESSION_LIMITS.rateNote.max) {
    return fail('rateNote', 'rate_note_length', `연주비 메모는 ${SESSION_LIMITS.rateNote.max}자 이하로 적어 주세요.`);
  }

  const phone = cleanLine(b.phone);
  if (!phone) return fail('phone', 'phone_required', '휴대전화 번호를 적어 주세요.');
  const phoneDigits = phone.replace(/\D/g, '');
  if (!PHONE_PATTERN.test(phone) || phoneDigits.length < 9 || phoneDigits.length > 15) {
    return fail('phone', 'phone_invalid', '휴대전화 번호를 다시 확인해 주세요.');
  }

  const email = options.existingEmail ?? normalizeSessionEmail(b.email);
  if (!email) return fail('email', 'email_required', '이메일 주소를 적어 주세요.');
  if (email.length > SESSION_LIMITS.email.max || !validator.isEmail(email)) {
    return fail('email', 'email_invalid', '이메일 주소를 다시 확인해 주세요.');
  }

  const kakaoId = cleanLine(b.kakaoId);
  if (kakaoId.length > SESSION_LIMITS.kakaoId.max) {
    return fail('kakaoId', 'kakao_id_length', `카카오톡 ID는 ${SESSION_LIMITS.kakaoId.max}자 이하로 적어 주세요.`);
  }

  return {
    ok: true,
    value: {
      stageName,
      realName,
      primaryInstrument,
      instruments,
      genres,
      yearsExperience,
      reading,
      remoteRecording: b.remoteRecording === true,
      region,
      bio: bio || null,
      sampleLinks,
      ratePerSong,
      rateNote: rateNote || null,
      phone,
      email,
      kakaoId: kakaoId || null,
    },
  };
};
