/** @jest-environment node */
import { parseSampleUrl, validateSessionRegistration, normalizeSessionEmail } from './validate';

const RLO = String.fromCharCode(0x202e);
const ZWSP = String.fromCharCode(0x200b);
const BEL = String.fromCharCode(0x07);

const valid = (over: Record<string, unknown> = {}) => ({
  stageName: '김베이스',
  realName: '김하늘',
  adultConfirmed: true,
  consent: true,
  primaryInstrument: 'bass',
  instruments: ['bass', 'upright-bass', { other: '우쿨렐레' }],
  genres: ['jazz', 'pop'],
  yearsExperience: 12,
  reading: 'chart',
  remoteRecording: true,
  region: '서울',
  bio: '재즈 클럽과 스튜디오 세션을 해 왔습니다.',
  sampleLinks: [{ url: 'https://www.youtube.com/watch?v=abc', label: '라이브 영상' }],
  ratePerSong: 150000,
  rateNote: '편곡 포함 시 별도',
  phone: '010-1234-5678',
  email: ' Player@Example.COM ',
  kakaoId: 'player1',
  ...over,
});

describe('validateSessionRegistration', () => {
  it('정상 입력을 정규화한다 — 이메일은 소문자·공백만 정리한다', () => {
    const result = validateSessionRegistration(valid());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe('player@example.com');
    expect(result.value.instruments).toEqual(['bass', 'upright-bass', { other: '우쿨렐레' }]);
    expect(result.value.reading).toBe('chart');
    expect(result.value.sampleLinks[0].url).toBe('https://www.youtube.com/watch?v=abc');
  });

  describe('곡당 희망 연주비', () => {
    const rate = (value: unknown) => validateSessionRegistration(valid({ ratePerSong: value }));
    const rateOf = (value: unknown) => {
      const result = rate(value);
      return result.ok ? result.value.ratePerSong : result;
    };

    it('정수와 숫자 문자열(쉼표·공백 허용)을 받는다', () => {
      expect(rateOf(150000)).toBe(150000);
      expect(rateOf('150000')).toBe(150000);
      expect(rateOf('150,000')).toBe(150000);
      expect(rateOf(' 1 50,000 ')).toBe(150000);
      expect(rateOf(10000)).toBe(10000);
      expect(rateOf(10000000)).toBe(10000000);
    });

    it('비어 있으면 null — 빠뜨려도 등록된다', () => {
      expect(rateOf(undefined)).toBeNull();
      expect(rateOf(null)).toBeNull();
      expect(rateOf('')).toBeNull();
    });

    it('범위(1만~1천만원)를 벗어나거나 숫자가 아니면 rate_per_song_invalid', () => {
      for (const bad of [9999, 10000001, 0, -5, 1.5, '9,999', '10,000,001', '15만원', '150000원', 'abc', ',', true, {}, []]) {
        expect(rate(bad)).toMatchObject({ ok: false, field: 'ratePerSong', code: 'rate_per_song_invalid' });
      }
    });

    it('오류 메시지는 시간당을 말하지 않는다', () => {
      const result = rate(5);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).not.toMatch(/시간/);
    });
  });

  it('gmail 점·+태그는 지우지 않는다(서로 다른 사람을 한 주소로 합치지 않는다)', () => {
    expect(normalizeSessionEmail('A.B+tag@Gmail.com')).toBe('a.b+tag@gmail.com');
  });

  it('만 19세 확인과 동의가 없으면 거절한다', () => {
    expect(validateSessionRegistration(valid({ adultConfirmed: false }))).toMatchObject({ ok: false, code: 'adult_required' });
    expect(validateSessionRegistration(valid({ adultConfirmed: 'true' }))).toMatchObject({ ok: false, code: 'adult_required' });
    expect(validateSessionRegistration(valid({ consent: false }))).toMatchObject({ ok: false, code: 'consent_required' });
  });

  it('본인 수정(existingEmail)에서는 확인·동의를 다시 받지 않고 이메일을 바꾸지 않는다', () => {
    const result = validateSessionRegistration(valid({ adultConfirmed: undefined, consent: undefined, email: 'other@example.com' }), {
      existingEmail: 'player@example.com',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe('player@example.com');
  });

  it('필수 칸이 비면 거절한다', () => {
    expect(validateSessionRegistration(valid({ stageName: '  ' }))).toMatchObject({ ok: false, code: 'stage_name_required' });
    expect(validateSessionRegistration(valid({ realName: 'a' }))).toMatchObject({ ok: false, code: 'real_name_length' });
    expect(validateSessionRegistration(valid({ phone: '' }))).toMatchObject({ ok: false, code: 'phone_required' });
    expect(validateSessionRegistration(valid({ email: '' }))).toMatchObject({ ok: false, code: 'email_required' });
    expect(validateSessionRegistration(valid({ email: 'nope' }))).toMatchObject({ ok: false, code: 'email_invalid' });
    expect(validateSessionRegistration(valid({ primaryInstrument: 'kazoo' }))).toMatchObject({ ok: false, code: 'primary_instrument_invalid' });
    expect(validateSessionRegistration(valid({ sampleLinks: [] }))).toMatchObject({ ok: false, code: 'sample_links_required' });
    expect(validateSessionRegistration(valid({ sampleLinks: [{ url: '', label: '' }] }))).toMatchObject({ ok: false, code: 'sample_links_required' });
  });

  it('전화번호는 숫자·기호만, 9~15자리', () => {
    expect(validateSessionRegistration(valid({ phone: 'abc-defg-hijk' }))).toMatchObject({ ok: false, code: 'phone_invalid' });
    expect(validateSessionRegistration(valid({ phone: '123' }))).toMatchObject({ ok: false, code: 'phone_invalid' });
    expect(validateSessionRegistration(valid({ phone: '+82 10 1234 5678' })).ok).toBe(true);
  });

  it('길이 한도를 지킨다', () => {
    expect(validateSessionRegistration(valid({ stageName: 'a'.repeat(41) }))).toMatchObject({ ok: false, code: 'stage_name_length' });
    expect(validateSessionRegistration(valid({ bio: 'a'.repeat(1001) }))).toMatchObject({ ok: false, code: 'bio_length' });
    expect(validateSessionRegistration(valid({ rateNote: 'a'.repeat(201) }))).toMatchObject({ ok: false, code: 'rate_note_length' });
    expect(validateSessionRegistration(valid({ kakaoId: 'a'.repeat(51) }))).toMatchObject({ ok: false, code: 'kakao_id_length' });
    expect(validateSessionRegistration(valid({ bio: 'a'.repeat(1000) })).ok).toBe(true);
  });

  it('샘플 링크는 1~5개, 6개는 거절하고 중복 주소는 합친다', () => {
    const link = (n: number) => ({ url: `https://example.org/${n}`, label: '' });
    expect(validateSessionRegistration(valid({ sampleLinks: [1, 2, 3, 4, 5, 6].map(link) }))).toMatchObject({ ok: false, code: 'sample_links_too_many' });
    const dup = validateSessionRegistration(valid({ sampleLinks: [link(1), link(1), link(2)] }));
    expect(dup.ok && dup.value.sampleLinks).toHaveLength(2);
  });

  it('경력·악보 리딩·지역·장르 값을 목록으로 검사한다', () => {
    expect(validateSessionRegistration(valid({ yearsExperience: -1 }))).toMatchObject({ ok: false, code: 'years_invalid' });
    expect(validateSessionRegistration(valid({ yearsExperience: 1.5 }))).toMatchObject({ ok: false, code: 'years_invalid' });
    expect(validateSessionRegistration(valid({ yearsExperience: '8' })).ok).toBe(true);
    expect(validateSessionRegistration(valid({ reading: 'braille' }))).toMatchObject({ ok: false, code: 'reading_invalid' });
    expect(validateSessionRegistration(valid({ region: '평양' }))).toMatchObject({ ok: false, code: 'region_invalid' });
    expect(validateSessionRegistration(valid({ genres: ['polka'] }))).toMatchObject({ ok: false, code: 'genres_invalid' });
  });

  it('직접 입력 악기는 5개까지', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ other: `악기${i}` }));
    expect(validateSessionRegistration(valid({ instruments: many }))).toMatchObject({ ok: false, code: 'instruments_invalid' });
  });

  it('제어·양방향 문자를 걷어 낸다', () => {
    const result = validateSessionRegistration(valid({ stageName: `김${RLO}베이스${ZWSP}`, bio: `안녕${BEL}하세요\r\n\r\n\r\n\r\n끝` }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stageName).toBe('김베이스');
    expect(result.value.bio).toBe('안녕하세요\n\n끝');
  });

  it('객체가 아닌 본문은 거절한다', () => {
    expect(validateSessionRegistration(null)).toMatchObject({ ok: false, code: 'invalid_body' });
    expect(validateSessionRegistration([])).toMatchObject({ ok: false, code: 'invalid_body' });
  });
});

describe('parseSampleUrl', () => {
  it('https만 받는다', () => {
    expect(parseSampleUrl('https://soundcloud.com/a/b')).toBe('https://soundcloud.com/a/b');
    expect(parseSampleUrl('http://soundcloud.com/a')).toBeNull();
    expect(parseSampleUrl('javascript:alert(1)')).toBeNull();
    expect(parseSampleUrl('data:text/html,hi')).toBeNull();
    expect(parseSampleUrl('//example.com/a')).toBeNull();
  });

  it('호스트에 점이 없거나 계정이 있거나 공백·양방향 문자가 있으면 거절한다', () => {
    expect(parseSampleUrl('https://localhost/a')).toBeNull();
    expect(parseSampleUrl('https://user:pw@example.com/a')).toBeNull();
    expect(parseSampleUrl('https://example.com/a b')).toBeNull();
    expect(parseSampleUrl(`https://example.com/${RLO}a`)).toBeNull();
  });

  it('2,048자를 넘으면 거절한다', () => {
    expect(parseSampleUrl(`https://example.com/${'a'.repeat(2040)}`)).toBeNull();
  });
});
