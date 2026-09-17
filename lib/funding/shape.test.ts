import { validateFundingProjectShape } from './shape';

const base = () => ({
  title: '제목',
  summary: '요약',
  cover: '/c.webp',
  goalAmount: 1000000,
  startAt: '2026-10-01T10:00:00+09:00',
  endAt: '2026-10-31T23:59:59+09:00',
  rewards: [
    { id: 'cd', title: 'CD', description: '설명', amount: 30000, estimatedDelivery: '2026-12' },
  ],
});

describe('validateFundingProjectShape', () => {
  it('일반 객체(파일이 아닌 입력)를 FundingProject로 만든다', () => {
    const p = validateFundingProjectShape({ ...base(), slug: 'demo' }, 'demo', '본문');
    expect(p.slug).toBe('demo');
    expect(p.content).toBe('본문');
    expect(p.status).toBe('auto');
    expect(p.hidden).toBe(false);
    expect(p.rewards[0]).toMatchObject({ id: 'cd', amount: 30000, requiresShipping: false, downloads: [] });
    // lastmod 기본값은 startAt의 앞 10자다.
    expect(p.lastmod).toBe('2026-10-01');
  });

  it('slug가 인자와 다르면 던진다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'other' }, 'demo', '')).toThrow(/slug/);
  });

  it('endAt이 startAt보다 앞이면 던진다', () => {
    const d = { ...base(), slug: 'demo', endAt: '2026-09-01T00:00:00+09:00' };
    expect(() => validateFundingProjectShape(d, 'demo', '')).toThrow(/endAt/);
  });

  it('리워드 id가 중복이면 던진다', () => {
    const r = base().rewards[0];
    const d = { ...base(), slug: 'demo', rewards: [r, { ...r }] };
    expect(() => validateFundingProjectShape(d, 'demo', '')).toThrow(/중복/);
  });

  it('리워드가 0개면 던진다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'demo', rewards: [] }, 'demo', '')).toThrow(/1개 이상/);
  });

  it('status 오타를 조용히 통과시키지 않는다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'demo', status: 'Draft' }, 'demo', '')).toThrow(/status/);
  });

  it('따옴표 붙은 hidden을 거부한다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'demo', hidden: 'true' }, 'demo', '')).toThrow(/boolean/);
  });

  it('downloads의 key가 객체 키 형식이 아니면 던진다', () => {
    const d = {
      ...base(),
      slug: 'demo',
      rewards: [{ ...base().rewards[0], downloads: [{ label: 'MP3', key: 'https://example.com/a.zip' }] }],
    };
    expect(() => validateFundingProjectShape(d, 'demo', '')).toThrow(/객체 키/);
  });
});
