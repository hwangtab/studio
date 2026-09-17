import { CREATOR_LIMITS, validateBasicSection, validateRewardInput, validateStorySection } from './creatorValidation';

const NOW = new Date('2026-10-01T00:00:00+09:00');
const basic = () => ({
  title: '2집 제작 펀딩',
  summary: '두 번째 앨범을 만듭니다',
  slug: 'my-second-album',
  goalAmount: 3000000,
  startAt: '2026-10-10T00:00:00+09:00',
  endAt: '2026-11-10T23:59:59+09:00',
  coverUrl: 'https://x.public.blob.vercel-storage.com/a.webp',
});

describe('validateBasicSection', () => {
  it('정상 입력을 통과시킨다', () => {
    const r = validateBasicSection(basic(), NOW);
    expect(r.ok).toBe(true);
  });

  it('시작일이 오늘부터 3일 안이면 거부한다 — 심사 시간이 필요하다', () => {
    const r = validateBasicSection({ ...basic(), startAt: '2026-10-02T00:00:00+09:00' }, NOW);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/3일/);
  });

  it('기간이 60일을 넘으면 거부한다', () => {
    const r = validateBasicSection({ ...basic(), endAt: '2026-12-20T00:00:00+09:00' }, NOW);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/60일/);
  });

  it('종료가 시작보다 앞이면 거부한다', () => {
    const r = validateBasicSection({ ...basic(), endAt: '2026-10-09T00:00:00+09:00' }, NOW);
    expect(r).toMatchObject({ ok: false });
  });

  it('목표 금액의 범위와 단위를 본다', () => {
    expect(validateBasicSection({ ...basic(), goalAmount: 5000 }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), goalAmount: 1234567 }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), goalAmount: 1230000 }, NOW).ok).toBe(true);
  });

  it('예약 slug를 거부한다', () => {
    const r = validateBasicSection({ ...basic(), slug: 'apply' }, NOW);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/사용할 수 없/);
  });

  it('제목·요약 길이 상한을 본다', () => {
    expect(validateBasicSection({ ...basic(), title: 'a'.repeat(CREATOR_LIMITS.titleMax + 1) }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), summary: 'a'.repeat(CREATOR_LIMITS.summaryMax + 1) }, NOW).ok).toBe(false);
  });
});

describe('validateStorySection', () => {
  it('본문 길이 상한을 본다', () => {
    expect(validateStorySection({ content: 'a'.repeat(CREATOR_LIMITS.contentMax + 1) }).ok).toBe(false);
    expect(validateStorySection({ content: '짧은 본문' }).ok).toBe(true);
  });
  it('빈 본문도 저장은 허용한다 — 심사 신청에서 막는다', () => {
    expect(validateStorySection({ content: '' }).ok).toBe(true);
  });
});

describe('validateRewardInput', () => {
  const reward = () => ({
    rewardId: 'cd',
    title: 'CD',
    description: '앨범 CD 한 장',
    amount: 30000,
    totalQuantity: 100,
    requiresShipping: true,
    estimatedDelivery: '2026-12',
    imageUrl: null,
  });

  it('정상 입력을 통과시킨다', () => {
    expect(validateRewardInput(reward()).ok).toBe(true);
  });
  it('금액 단위와 범위를 본다', () => {
    expect(validateRewardInput({ ...reward(), amount: 1234 }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), amount: 0 }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), amount: 20000001 }).ok).toBe(false);
  });
  it('rewardId 형식을 본다', () => {
    expect(validateRewardInput({ ...reward(), rewardId: 'CD 한장' }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), rewardId: 'cd-1' }).ok).toBe(true);
  });
  it('수량이 있으면 양의 정수여야 한다', () => {
    expect(validateRewardInput({ ...reward(), totalQuantity: 0 }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), totalQuantity: null }).ok).toBe(true);
  });
});
