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
      value: {
        taxType: 'withholding', bankName: '국민은행', account: '123-456-789012', holder: '황경하',
        residentNumber: null,
      },
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

  it('하이픈만 있고 숫자가 없거나 4자리에 못 미치면 거부한다', () => {
    // 회귀: /^[0-9-]+$/만 보던 시절엔 '-'·'--'가 통과했다. 그러면 편집 화면의 registered와
    // 정산의 hasPayoutAccount는 둘 다 true인데 뒤 4자리는 null이라, 화면은 "등록됨"인데
    // 보낼 계좌가 없는 상태로 정산 기록까지 간다.
    for (const bad of ['-', '--', '-1-2-3-', '123']) {
      expect(validatePayoutSection({ ...payout(), account: bad }).ok).toBe(false);
    }
    expect(validatePayoutSection({ ...payout(), account: '1234' }).ok).toBe(true);
  });

  it('은행 목록은 검사하지 않는다 — 우리가 모르는 은행도 받는다', () => {
    expect(validatePayoutSection({ ...payout(), bankName: '토스뱅크' }).ok).toBe(true);
  });
});

/**
 * 아래 번호는 전부 **형식만 맞춘 임의의 값**이다 — 실제 사람에게 발급된 번호가 아니고,
 * 그렇게 되지 않도록 뒤 6자리를 아무렇게나 잡았다.
 */
describe('주민등록번호 — 형식만 본다', () => {
  const payout = (residentNumber: unknown) => ({
    taxType: 'withholding', bankName: '국민은행', account: '123-456-789012', holder: '황경하', residentNumber,
  });
  const value = (input: unknown) => {
    const r = validatePayoutSection(input);
    return r.ok ? r.value : null;
  };

  it('체크섬이 안 맞는 번호도 통과한다 — 2020년 10월 이후 발급분은 뒤 6자리가 난수다', () => {
    // ⚠ 이 테스트가 이 절의 핵심이다. 옛 가중치 검증식(2,3,4,5,6,7,8,9,2,3,4,5)을 넣으면
    // 이 번호의 마지막 자리는 5여야 한다 — 실제 값은 8이다. 검증식을 되살리는 순간
    // 정상 번호를 가진 개설자가 정산 등록을 못 하게 된다.
    expect(value(payout('0503132345678'))?.residentNumber).toBe('0503132345678');
    expect(value(payout('9901011234567'))?.residentNumber).toBe('9901011234567');
  });

  it('하이픈은 받아들이고 저장 전에 지운다', () => {
    expect(value(payout('990101-1234567'))?.residentNumber).toBe('9901011234567');
  });

  it('빈 값·미입력은 null이다 — 기존 값을 유지하라는 뜻이다', () => {
    expect(value(payout(''))?.residentNumber).toBeNull();
    expect(value(payout('   '))?.residentNumber).toBeNull();
    expect(value(payout(undefined))?.residentNumber).toBeNull();
    expect(value(payout(null))?.residentNumber).toBeNull();
  });

  it('형식 위반은 거부한다', () => {
    for (const bad of [
      '990101123456',      // 12자리
      '99010112345678',    // 14자리
      '990101-123456a',    // 숫자가 아닌 글자
      '991301-1234567',    // 13월
      '990132-1234567',    // 32일
      '990100-1234567',    // 0일
      '990101-9234567',    // 성별코드 9
      '990101-0234567',    // 성별코드 0
      '990101 1234567',    // 공백 구분
    ]) {
      expect(validatePayoutSection(payout(bad)).ok).toBe(false);
    }
  });

  it('과도한 길이는 거부한다', () => {
    expect(validatePayoutSection(payout('1'.repeat(CREATOR_LIMITS.residentNumberMax + 1))).ok).toBe(false);
  });

  it('사업자면 값이 와도 버린다 — 거부가 아니라 null이다', () => {
    // 법적 근거(소득세법상 지급명세서 제출 의무)가 원천징수에만 있으므로 사업자에게는
    // 애초에 받지 않는다. 거부 메시지를 돌려주면 "값을 보냈다"는 사실만 더 남는다.
    const r = validatePayoutSection({ ...payout('9901011234567'), taxType: 'invoice' });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.residentNumber).toBeNull();
  });

  it('거부 메시지에 입력한 번호가 들어가지 않는다', () => {
    const r = validatePayoutSection(payout('99010112345'));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).not.toContain('99010112345');
  });
});
