import {
  CREATOR_LIMITS, findMissingRequiredSections, isDefaultCreatorName, validateBasicSection, validatePayoutSection,
  validateRewardInput, validateStorySection,
} from './creatorValidation';

const NOW = new Date('2026-10-01T00:00:00+09:00');
const basic = () => ({
  title: '2집 제작 펀딩',
  summary: '두 번째 앨범을 만듭니다',
  slug: 'my-second-album',
  goalAmount: 3000000,
  startAt: '2026-10-10T00:00:00+09:00',
  endAt: '2026-11-10T23:59:59+09:00',
  coverUrl: '/api/funding/media/a.webp?w=1200&h=675',
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

  // 우리 업로드 경로에서 온 것만 받는다 — 외부 호스트를 넣으면 next/image가 렌더 중
  // throw하고, 승인 뒤에는 상세 페이지와 /ko/funding 목록 전체가 함께 죽는다.
  it('대표 이미지는 우리 업로드 경로(/api/funding/media/)에서 온 것만 받는다', () => {
    expect(validateBasicSection({ ...basic(), coverUrl: 'https://evil.example/a.webp' }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), coverUrl: '/images/a.webp' }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), coverUrl: '' }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), coverUrl: '/api/funding/media/a.webp?w=1200&h=675' }, NOW).ok).toBe(true);
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

  it('imageUrl은 값이 있을 때만 우리 업로드 경로인지 본다', () => {
    expect(validateRewardInput({ ...reward(), imageUrl: null }).ok).toBe(true);
    expect(validateRewardInput({ ...reward(), imageUrl: 'https://evil.example/a.webp' }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), imageUrl: '/images/a.webp' }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), imageUrl: '' }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), imageUrl: '/api/funding/media/r.webp?w=800&h=600' }).ok).toBe(true);
  });
});

describe('isDefaultCreatorName', () => {
  it('가입 시 채워 넣는 이메일 로컬파트는 개설자가 고른 이름이 아니다', () => {
    expect(isDefaultCreatorName('hwangtab', 'hwangtab@gmail.com')).toBe(true);
  });

  it('앞뒤 공백은 이름으로 치지 않는다', () => {
    expect(isDefaultCreatorName('  hwangtab  ', 'hwangtab@gmail.com')).toBe(true);
  });

  it('개설자가 실제로 고른 이름은 기본값이 아니다', () => {
    expect(isDefaultCreatorName('황경하', 'hwangtab@gmail.com')).toBe(false);
  });

  it('로컬파트와 같은 글자를 일부러 이름으로 골라도 기본값으로 본다 — 구분할 방법이 없다', () => {
    // 이 경우 개설자는 이름을 다시 저장해야 하고, 잠금도 걸리지 않는다. 안전한 방향이다.
    expect(isDefaultCreatorName('studio', 'studio@example.com')).toBe(true);
  });
});

describe('findMissingRequiredSections — 개설자 이름', () => {
  const filled = {
    title: '제목',
    summary: '요약',
    coverUrl: 'https://example.com/a.webp',
    content: 'x'.repeat(400),
    rewardsCount: 1,
  };

  it('이름이 이메일 로컬파트뿐이면 미비로 잡는다', () => {
    expect(
      findMissingRequiredSections({ ...filled, creatorName: 'hwangtab', creatorEmail: 'hwangtab@gmail.com' }),
    ).toContain('개설자 정보(이름)');
  });

  it('이름을 실제로 골랐으면 미비가 아니다', () => {
    expect(
      findMissingRequiredSections({ ...filled, creatorName: '황경하', creatorEmail: 'hwangtab@gmail.com' }),
    ).not.toContain('개설자 정보(이름)');
  });

  it('creatorEmail을 안 넘기면 기본값 판정을 건너뛴다 — 빈 이름만 본다', () => {
    expect(findMissingRequiredSections({ ...filled, creatorName: 'hwangtab' })).not.toContain('개설자 정보(이름)');
    expect(findMissingRequiredSections({ ...filled, creatorName: '' })).toContain('개설자 정보(이름)');
  });
});

describe('validatePayoutSection', () => {
  const payout = () => ({ taxType: 'withholding', bankName: '국민은행', account: '123-456-789012', holder: '황경하' });

  it('정상 입력은 통과하고 앞뒤 공백을 다듬는다', () => {
    const r = validatePayoutSection({ ...payout(), bankName: '  국민은행  ', holder: ' 황경하 ' });
    expect(r).toEqual({
      ok: true,
      value: { taxType: 'withholding', bankName: '국민은행', account: '123-456-789012', holder: '황경하' },
    });
  });

  it('사업자(invoice)도 받는다', () => {
    expect(validatePayoutSection({ ...payout(), taxType: 'invoice' }).ok).toBe(true);
  });

  it('세금 유형이 없거나 모르는 값이면 거부한다', () => {
    expect(validatePayoutSection({ ...payout(), taxType: undefined }).ok).toBe(false);
    expect(validatePayoutSection({ ...payout(), taxType: 'individual' }).ok).toBe(false);
  });

  it('빈 값은 거부한다', () => {
    expect(validatePayoutSection({ ...payout(), bankName: '   ' }).ok).toBe(false);
    expect(validatePayoutSection({ ...payout(), account: '' }).ok).toBe(false);
    expect(validatePayoutSection({ ...payout(), holder: '' }).ok).toBe(false);
  });

  it('과도한 길이는 거부한다', () => {
    expect(validatePayoutSection({ ...payout(), bankName: '가'.repeat(CREATOR_LIMITS.payoutBankNameMax + 1) }).ok).toBe(false);
    expect(validatePayoutSection({ ...payout(), account: '1'.repeat(CREATOR_LIMITS.payoutAccountMax + 1) }).ok).toBe(false);
    expect(validatePayoutSection({ ...payout(), holder: '가'.repeat(CREATOR_LIMITS.payoutHolderMax + 1) }).ok).toBe(false);
  });

  it('계좌번호에 숫자·하이픈 외 문자가 있으면 거부한다', () => {
    for (const bad of ['123 456 789', '123-456-789012원', 'abc-123', '123.456.789']) {
      expect(validatePayoutSection({ ...payout(), account: bad }).ok).toBe(false);
    }
  });

  it('은행 목록은 검사하지 않는다 — 우리가 모르는 은행도 받는다', () => {
    expect(validatePayoutSection({ ...payout(), bankName: '토스뱅크' }).ok).toBe(true);
  });
});
