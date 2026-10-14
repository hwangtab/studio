/** @jest-environment node */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../data/pricing';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../lib/funding/policy';
import { MIN_LEAD_DAYS } from '../lib/shows/organizer/draft';
import { SHOW_ORGANIZER_TERMS_VERSION } from '../lib/shows/organizer/policy';
import { REFUND_POLICY_FOOTNOTES, refundTierLines } from '../lib/shows/refundPolicy';
import {
  assertShowOrganizerTermsBaselineUpdateAllowed,
  serializeShowOrganizerTerms,
  SHOW_ORGANIZER_TERMS_VERSION_PATTERN,
  type ShowOrganizerTermsBaseline,
} from './showOrganizerTermsHash';

/**
 * 공연 주최자 약관 판본 게이트 — 약관 내용이 바뀌었는데 `SHOW_ORGANIZER_TERMS_VERSION`이 그대로면
 * 실패한다. `content/creatorTerms.baseline.test.ts`(펀딩 개설자 약관 게이트)를 본떴다.
 */

const BASELINE_PATH = path.join(process.cwd(), 'content/show-organizer-terms.baseline.json');

const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const HOW_TO_UPDATE = [
  '갱신 절차:',
  '  1. lib/shows/organizer/policy.ts의 SHOW_ORGANIZER_TERMS_VERSION을 올린다 (show-organizer-terms-YYYY-MM-DD,',
  '     같은 날 두 번째 개정이면 -r2 / -r3 접미사).',
  '  2. UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1 npx jest content/showOrganizerTerms.baseline.test.ts 로 기준선을 다시 쓴다.',
  '     ①을 빠뜨리고 ②만 실행하면 갱신 경로가 스스로 거부한다(assertShowOrganizerTermsBaselineUpdateAllowed).',
  '  3. 바뀐 판본과 content/show-organizer-terms.baseline.json을 같은 커밋에 넣고, 무엇이 바뀌었는지 적는다.',
  '',
  '이미 제출한 주최자가 있는 상태에서 내용을 바꾸는 경우: 기존 행의 organizer_terms_version은',
  '옛 문자열 그대로 둔다. 옛 판본의 본문은 git 이력으로만 남으므로, 커밋 메시지에',
  '"어느 조항이 어떻게 바뀌었는지"를 남길 것.',
].join('\n');

const readBaseline = (): ShowOrganizerTermsBaseline | null =>
  fs.existsSync(BASELINE_PATH) ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as ShowOrganizerTermsBaseline) : null;

/** 조항 하나 — 제목 줄(`\n제N조 (`)로 자른다. 본문 속 "제7조를 따릅니다" 같은 참조에 걸리지 않게. */
const section = (serialized: string, from: string, to?: string): string => {
  const after = serialized.split(from)[1] ?? '';
  return to ? (after.split(to)[0] ?? '') : after;
};

describe('공연 주최자 약관 판본 게이트', () => {
  const serialized = serializeShowOrganizerTerms();
  const hash = sha256(serialized);

  if (process.env.UPDATE_SHOW_ORGANIZER_TERMS_BASELINE === '1') {
    it('기준선을 갱신한다 (UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1)', () => {
      assertShowOrganizerTermsBaselineUpdateAllowed(readBaseline(), { version: SHOW_ORGANIZER_TERMS_VERSION, hash }, process.env.ALLOW_BASELINE_CREATE === '1');
      const payload: ShowOrganizerTermsBaseline = {
        note: '주최자가 공연을 제출할 때 동의하는 공연 주최자 약관(SHOW_ORGANIZER_TERMS_SECTIONS)의 내용 해시. 내용이 바뀌면 SHOW_ORGANIZER_TERMS_VERSION을 먼저 올린 뒤 UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1 로 갱신할 것.',
        version: SHOW_ORGANIZER_TERMS_VERSION,
        hash,
        covers: [
          'pages/[locale]/shows/organizer-terms.tsx — SHOW_ORGANIZER_TERMS_SECTIONS',
          'data/pricing.ts · lib/funding/policy.ts · lib/shows/organizer/draft.ts — 본문에 보간되는 수수료율·원천징수율·정산 시점·첫 회차 최소 기간',
        ],
      };
      fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 1)}\n`);
      expect(readBaseline()).toMatchObject({ version: SHOW_ORGANIZER_TERMS_VERSION, hash });
    });
    return;
  }

  const baseline = readBaseline();

  it('기준선 파일이 있다', () => {
    expect(baseline).not.toBeNull();
  });

  it('약관 내용이 바뀌었으면 SHOW_ORGANIZER_TERMS_VERSION도 함께 바뀌어 있다', () => {
    expect(
      !baseline || baseline.hash === hash || baseline.version !== SHOW_ORGANIZER_TERMS_VERSION
        ? ''
        : [
            '공연 주최자 약관의 내용이 바뀌었는데 SHOW_ORGANIZER_TERMS_VERSION이 그대로다.',
            `  현재 판본: ${SHOW_ORGANIZER_TERMS_VERSION}`,
            `  기준선 해시: ${baseline.hash}`,
            `  현재   해시: ${hash}`,
            '',
            '왜 위험한가: show_submissions.organizer_terms_version은 "그때 이 내용에 동의했다"는',
            '증거다. 내용이 바뀌었는데 문자열이 같으면, 서로 다른 문서에 동의한 주최자들이 같은',
            '판본을 갖게 되어 동의 기록의 증거 능력이 통째로 무효가 된다.',
            '',
            HOW_TO_UPDATE,
          ].join('\n'),
    ).toBe('');
  });

  it('내용이 바뀌고 버전도 올렸다면 기준선도 함께 갱신돼 있다', () => {
    expect(
      baseline?.hash === hash
        ? ''
        : [`기준선이 오래됐다 — 내용 해시가 다르다 (기준선 ${baseline?.hash.slice(0, 12)}… vs 현재 ${hash.slice(0, 12)}…).`, HOW_TO_UPDATE].join('\n'),
    ).toBe('');
  });

  it('내용이 그대로면 기준선 판본도 현재 판본과 같다', () => {
    expect(
      !baseline || baseline.hash !== hash || baseline.version === SHOW_ORGANIZER_TERMS_VERSION
        ? ''
        : [`내용은 그대로인데 기준선 판본(${baseline.version})이 현재 판본(${SHOW_ORGANIZER_TERMS_VERSION})과 다르다.`, '판본만 올렸다면 기준선도 함께 갱신할 것.', HOW_TO_UPDATE].join('\n'),
    ).toBe('');
  });

  it('판본 문자열은 날짜 형식을 지킨다', () => {
    expect(SHOW_ORGANIZER_TERMS_VERSION).toMatch(SHOW_ORGANIZER_TERMS_VERSION_PATTERN);
    for (const ok of ['show-organizer-terms-2026-10-14-r2', 'show-organizer-terms-2026-10-14-r10']) {
      expect(ok).toMatch(SHOW_ORGANIZER_TERMS_VERSION_PATTERN);
    }
    for (const bad of ['show-organizer-terms-2026-10-14-r0', 'show-organizer-terms-2026-10-14-r1', 'show-organizer-terms-2026-10-14-r01', 'show-organizer-terms-2026-10-4']) {
      expect(bad).not.toMatch(SHOW_ORGANIZER_TERMS_VERSION_PATTERN);
    }
  });

  it('직렬화 대상에 8개 조항이 모두 들어간다', () => {
    for (const heading of [
      '제1조 (판매자와 주최자)',
      '제2조 (심사)',
      '제3조 (승인 뒤에 바꿀 수 있는 것과 없는 것)',
      '제4조 (권리 보증)',
      '제5조 (금지 내용)',
      '제6조 (수수료와 정산)',
      '제7조 (취소와 환불)',
      '제8조 (관객 개인정보)',
    ]) {
      expect(serialized).toContain(heading);
    }
  });

  it('직렬화 대상에 보간 상수 다섯 개가 따로 실린다', () => {
    expect(serialized).toContain(`FUNDING_PLATFORM_FEE_PERCENT=${FUNDING_PLATFORM_FEE_PERCENT}`);
    expect(serialized).toContain(`FUNDING_PAYMENT_FEE_PERCENT=${FUNDING_PAYMENT_FEE_PERCENT}`);
    expect(serialized).toContain(`FUNDING_WITHHOLDING_PERCENT=${FUNDING_WITHHOLDING_PERCENT}`);
    expect(serialized).toContain(`FUNDING_PAYOUT_BUSINESS_DAYS=${FUNDING_PAYOUT_BUSINESS_DAYS}`);
    expect(serialized).toContain(`MIN_LEAD_DAYS=${MIN_LEAD_DAYS}`);
  });

  it('2조가 첫 회차 최소 기간을 상수에서 말한다', () => {
    expect(section(serialized, '\n제2조 (', '\n제3조 (')).toContain(`${MIN_LEAD_DAYS}일이 지난 뒤`);
  });

  it('6조가 상수에서 보간한 요율·원천징수·정산 시점(마지막 회차 기준)을 말한다', () => {
    const fee = section(serialized, '\n제6조 (', '\n제7조 (');
    expect(fee).toContain(`플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}%`);
    expect(fee).toContain(`결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%`);
    expect(fee).toContain('부가가치세를 포함한 요율');
    expect(fee).toContain(`원천징수 ${FUNDING_WITHHOLDING_PERCENT}%`);
    expect(fee).toContain(`마지막 회차가 끝난 날부터 영업일 ${FUNDING_PAYOUT_BUSINESS_DAYS}일 이내`);
    expect(fee).toContain('환불된 금액을 먼저 뺀 뒤');
  });

  it('7조가 회차 취소 때 전액 환불과 결제 수수료 주최자 부담(사유 무관·정산금 공제·부족분 청구)을 말한다', () => {
    const cancel = section(serialized, '\n제7조 (', '\n제8조 (');
    expect(cancel).toContain('전액을 환불합니다');
    expect(cancel).toContain(`결제 수수료(${FUNDING_PAYMENT_FEE_PERCENT}%)는 스튜디오의 귀책 사유로 취소된 경우가 아니면 주최자가 부담합니다`);
    expect(cancel).toContain('정산금에서 빼고');
    expect(cancel).toContain('주최자에게 청구합니다');
    expect(cancel).toContain('공연마다 따로 정하지 않습니다');
  });

  it('7조 본문과 상수 블록이 환불표·안내를 refundPolicy.ts에서 그대로 싣는다', () => {
    const cancel = section(serialized, '\n제7조 (', '\n제8조 (');
    for (const line of refundTierLines()) expect(cancel).toContain(line);
    for (const note of REFUND_POLICY_FOOTNOTES) expect(cancel).toContain(note);
    for (const line of refundTierLines()) expect(serialized).toContain(`REFUND_TIER ${line}`);
    for (const note of REFUND_POLICY_FOOTNOTES) expect(serialized).toContain(`REFUND_FOOTNOTE ${note}`);
  });

  it('3조는 회차가 취소되는 변경만 제7조로 보낸다', () => {
    expect(section(serialized, '\n제3조 (', '\n제4조 (')).toContain('그 변경으로 회차가 취소되면 제7조를 따릅니다');
  });

  it('8조가 관객 이름·연락처를 주최자에게 주지 않는다고 말한다', () => {
    expect(section(serialized, '\n제8조 (', '\n##')).toContain('관객의 이름과 연락처를 주최자에게 제공하지 않습니다');
  });

  it('요율이 바뀌면 본문 경로로도 상수 블록 경로로도 해시가 달라진다', () => {
    const viaBody = serialized.replace(`플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}%`, '플랫폼 수수료 10%');
    expect(viaBody).not.toBe(serialized);
    expect(sha256(viaBody)).not.toBe(hash);
    const viaConstants = serialized.replace(`MIN_LEAD_DAYS=${MIN_LEAD_DAYS}`, 'MIN_LEAD_DAYS=3');
    expect(viaConstants).not.toBe(serialized);
    expect(sha256(viaConstants)).not.toBe(hash);
  });

  it('조항 본문이 한 글자만 바뀌어도 해시가 달라진다', () => {
    const tampered = serialized.replace('스튜디오를 면책합니다', '스튜디오에 책임을 묻지 않습니다');
    expect(tampered).not.toBe(serialized);
    expect(sha256(tampered)).not.toBe(hash);
  });
});

describe('assertShowOrganizerTermsBaselineUpdateAllowed — 갱신 경로 우회 차단', () => {
  const existing = { version: 'show-organizer-terms-2026-10-14', hash: 'a'.repeat(64) };

  it('내용이 바뀌었는데 판본이 그대로면 기준선을 쓰지 못하게 막는다', () => {
    expect(() => assertShowOrganizerTermsBaselineUpdateAllowed(existing, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/SHOW_ORGANIZER_TERMS_VERSION이 그대로다/);
  });

  it('판본을 올렸으면 통과시킨다', () => {
    expect(() => assertShowOrganizerTermsBaselineUpdateAllowed(existing, { version: 'show-organizer-terms-2026-10-15', hash: 'b'.repeat(64) })).not.toThrow();
  });

  it('내용이 그대로면(판본만 손봄) 통과시킨다', () => {
    expect(() => assertShowOrganizerTermsBaselineUpdateAllowed(existing, { version: existing.version, hash: existing.hash })).not.toThrow();
  });

  it('최초 생성은 allowCreate=true를 명시했을 때만 통과시킨다', () => {
    expect(() => assertShowOrganizerTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }, true)).not.toThrow();
    expect(() => assertShowOrganizerTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/ALLOW_BASELINE_CREATE=1/);
  });

  it('파일 삭제 우회 거부 메시지는 git 복구를 안내한다', () => {
    expect(() => assertShowOrganizerTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/git checkout/);
  });
});
