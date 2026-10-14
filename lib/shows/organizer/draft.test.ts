// lib/shows/organizer/draft.test.ts
import { buildShowDefinition, emptyDraft, findSubmitProblems, mergeApprovedEdit, normalizeDraftInput, parseDraft, type ShowSubmissionDraft } from './draft';
import { validateShowDefinition } from '../seed';

const CREATOR = 'a'.repeat(32);
const NOW = new Date('2026-10-14T03:00:00Z');
const ownPhoto = `/api/funding/media/${CREATOR}-11111111-1111-1111-1111-111111111111.webp?w=800&h=1100`;

const complete = (): ShowSubmissionDraft => ({
  ...emptyDraft(),
  title: '가을 밤 단독 공연',
  presenterName: '밴드 놀',
  description: '첫 문단 소개입니다.\n\n둘째 문단.',
  posterUrl: ownPhoto,
  ageRating: '전체 관람가',
  runningMinutes: 90,
  venueName: '스튜디오 놀',
  venueAddress: '서울 마포구 어딘가 1',
  showtimes: ['2026-11-01T19:00'],
  capacity: 60,
  ticketTypes: [{ name: '일반', price: 20000 }],
  performers: [{ name: '밴드 놀', bio: '', photoUrl: null }],
});

test('완성된 초안은 문제 없음', () => {
  expect(findSubmitProblems(complete(), NOW)).toEqual([]);
});

test('첫 회차가 7일 안이면 거부', () => {
  const d = { ...complete(), showtimes: ['2026-10-18T19:00'] };
  expect(findSubmitProblems(d, NOW).join()).toContain('7일');
});

test('1,000원 미만 가격 거부', () => {
  const d = { ...complete(), ticketTypes: [{ name: '일반', price: 500 }] };
  expect(findSubmitProblems(d, NOW).join()).toContain('1,000원');
});

test('남의 업로드 이미지는 저장 단계에서 거부', () => {
  const other = `/api/funding/media/${'b'.repeat(32)}-x.webp?w=1&h=1`;
  const r = normalizeDraftInput({ ...complete(), posterUrl: other }, CREATOR);
  expect(r.ok).toBe(false);
});

test('외부 이미지 주소도 거부', () => {
  const r = normalizeDraftInput({ ...complete(), posterUrl: 'https://evil.example/a.png' }, CREATOR);
  expect(r.ok).toBe(false);
});

test('ShowDefinition으로 바꾸면 기존 검증을 통과(이미지 존재 검사는 업로드 주소를 건너뜀)', () => {
  const def = buildShowDefinition(complete(), 'autumn-night');
  expect(def.zones).toEqual([{ code: 'GA', label: '전석', capacity: 60 }]);
  expect(def.ticketTypes).toEqual([{ zoneCode: 'GA', name: '일반', price: 20000, quota: null, compQuota: 0 }]);
  expect(def.showtimes[0].startsAt.toISOString()).toBe('2026-11-01T10:00:00.000Z'); // KST 19:00
  expect(def.coverImage).toBe(ownPhoto);
  expect(validateShowDefinition(def)).toEqual([]);
});

test('승인 뒤 저장은 잠긴 칸을 승인본에서 가져온다', () => {
  const approved = complete();
  const incoming = { ...complete(), description: '바뀐 소개.', ticketTypes: [{ name: '일반', price: 1000 }], showtimes: ['2026-12-01T19:00'], capacity: 999 };
  const merged = mergeApprovedEdit(approved, incoming);
  expect(merged.description).toBe('바뀐 소개.');
  expect(merged.ticketTypes).toEqual(approved.ticketTypes);
  expect(merged.showtimes).toEqual(approved.showtimes);
  expect(merged.capacity).toBe(60);
});

test('깨진 JSON은 빈 초안', () => {
  expect(parseDraft('{oops')).toEqual(emptyDraft());
});

describe('이미지 주소 경로 탈출 차단', () => {
  const OTHER = 'b'.repeat(32);
  const bad = [
    `/api/funding/media/${CREATOR}-x/../${OTHER}-uuid.webp`,
    `/api/funding/media/${CREATOR}-x\\..\\${OTHER}-uuid.webp`,
    `/api/funding/media/${CREATOR}-%2e%2e/${OTHER}-uuid.webp`,
    `/api/funding/media/${CREATOR}-%2e%2e%2f${OTHER}-uuid.webp`,
    `${ownPhoto}#frag`,
    `/api/funding/media/${CREATOR}-x.webp/extra.webp`,
    `/api/funding/media/${CREATOR}-11111111.webp?w=800&h=1100&evil=1`,
    `/api/funding/media/${CREATOR}-11111111.webp?x=1`,
    `/api/funding/media/${CREATOR}-${'a'.repeat(300)}.webp`,
  ];
  test.each(bad)('거부: %s', (url) => {
    expect(normalizeDraftInput({ ...complete(), posterUrl: url }, CREATOR).ok).toBe(false);
    expect(normalizeDraftInput({ ...complete(), performers: [{ name: 'a', bio: '', photoUrl: url }] }, CREATOR).ok).toBe(false);
  });
  test('쿼리 없는 본인 주소는 통과', () => {
    const url = `/api/funding/media/${CREATOR}-11111111.webp`;
    expect(normalizeDraftInput({ ...complete(), posterUrl: url }, CREATOR).ok).toBe(true);
  });
});

test('정상 입력은 다듬어서 ok', () => {
  const r = normalizeDraftInput({ ...complete(), title: '  가을 밤  ', notices: [' 안내 ', ''] }, CREATOR);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.draft.title).toBe('가을 밤');
    expect(r.draft.notices).toEqual(['안내']);
    expect(r.draft.posterUrl).toBe(ownPhoto);
  }
});

test('문자열이 아닌 필수 칸은 형식 오류, 너무 길면 글자 수 오류', () => {
  const a = normalizeDraftInput({ ...complete(), title: 5 }, CREATOR);
  expect(a.ok === false && a.message).toBe('요청 형식이 올바르지 않아요.');
  const b = normalizeDraftInput({ ...complete(), venueName: undefined }, CREATOR);
  expect(b.ok === false && b.message).toBe('요청 형식이 올바르지 않아요.');
  const c = normalizeDraftInput({ ...complete(), title: 'x'.repeat(61) }, CREATOR);
  expect(c.ok === false && c.message).toBe('글자 수가 너무 많은 칸이 있어요.');
});

test('parseDraft는 칸마다 타입을 보정한다', () => {
  const d = parseDraft(JSON.stringify({ title: 'T', showtimes: 'x', ticketTypes: 7, performers: [1, { name: 3 }], capacity: '9', notices: [1, 'a'] }));
  expect(d.title).toBe('T');
  expect(d.showtimes).toEqual([]);
  expect(d.ticketTypes).toEqual(emptyDraft().ticketTypes);
  expect(d.performers).toEqual([{ name: '', bio: '', photoUrl: null }]);
  expect(d.capacity).toBeNull();
  expect(d.notices).toEqual(['a']);
  expect(() => findSubmitProblems(d, NOW)).not.toThrow();
});

describe('한 줄 칸의 제어 문자', () => {
  const normalized = (over: Partial<ShowSubmissionDraft>): ShowSubmissionDraft => {
    const r = normalizeDraftInput({ ...complete(), ...over }, CREATOR);
    if (!r.ok) throw new Error(r.message);
    return r.draft;
  };

  test('줄바꿈·탭·제어 문자는 공백 하나로 접는다', () => {
    const d = normalized({
      title: '가을\n밤\r\n단독\t공연',
      subtitle: '부제\u0000끝',
      presenterName: '밴드 \n 놀',
      ageRating: '전체 관람가',
      venueName: '스튜디오\u007f놀',
      venueAddress: '서울\n마포구',
      scheduleNote: '매주\r금요일',
      notices: ['주차\n불가', '\n'],
      ticketTypes: [{ name: '일반\t석', price: 20000 }],
      performers: [{ name: '보컬\n김', bio: '첫 줄\n둘째 줄', photoUrl: null }],
    });
    expect(d.title).toBe('가을 밤 단독 공연');
    expect(d.subtitle).toBe('부제 끝');
    expect(d.presenterName).toBe('밴드 놀');
    expect(d.ageRating).toBe('전체 관람가');
    expect(d.venueName).toBe('스튜디오 놀');
    expect(d.venueAddress).toBe('서울 마포구');
    expect(d.scheduleNote).toBe('매주 금요일');
    expect(d.notices).toEqual(['주차 불가']);
    expect(d.ticketTypes[0].name).toBe('일반 석');
    expect(d.performers[0].name).toBe('보컬 김');
  });

  test('소개·출연진 소개는 줄바꿈을 지키고 그 밖의 제어 문자만 뺀다', () => {
    const d = normalized({
      description: '첫 문단\r\n\r\n둘째\u0000 문단',
      performers: [{ name: '김', bio: '첫 줄\n둘째\u0007 줄', photoUrl: null }],
    });
    expect(d.description).toBe('첫 문단\n\n둘째 문단');
    expect(d.performers[0].bio).toBe('첫 줄\n둘째 줄');
  });
});
