/** @jest-environment node */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../data/pricing';
import { FUNDING_CREATOR_TERMS_VERSION, FUNDING_PAYOUT_BUSINESS_DAYS } from '../lib/funding/policy';
import {
  assertCreatorTermsBaselineUpdateAllowed,
  serializeCreatorTerms,
  CREATOR_TERMS_VERSION_PATTERN,
  type FundingCreatorTermsBaseline,
} from './creatorTermsHash';

/**
 * 개설자 약관 판본 게이트 — 약관 내용이 바뀌었는데 `FUNDING_CREATOR_TERMS_VERSION`이
 * 그대로면 실패한다. `content/fundingTerms.baseline.test.ts`(후원자 약관 게이트)를 본떴다 —
 * 배경·이유는 그 파일과 content/creatorTermsHash.ts 머리주석 참조.
 */

const BASELINE_PATH = path.join(process.cwd(), 'content/creator-terms.baseline.json');

const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const HOW_TO_UPDATE = [
  '갱신 절차:',
  '  1. lib/funding/policy.ts의 FUNDING_CREATOR_TERMS_VERSION을 올린다 (funding-creator-terms-YYYY-MM-DD,',
  '     같은 날 두 번째 개정이면 -r2 / -r3 접미사).',
  '  2. UPDATE_CREATOR_TERMS_BASELINE=1 npx jest content/creatorTerms.baseline.test.ts 로 기준선을 다시 쓴다.',
  '     ①을 빠뜨리고 ②만 실행하면 갱신 경로가 스스로 거부한다(assertCreatorTermsBaselineUpdateAllowed).',
  '  3. 바뀐 판본과 content/creator-terms.baseline.json을 같은 커밋에 넣고, 무엇이 바뀌었는지 적는다.',
  '',
  '이미 심사를 신청한 개설자가 있는 상태에서 내용을 바꾸는 경우: 기존 프로젝트 행의',
  'creator_terms_version은 옛 문자열 그대로 둔다. 옛 판본의 본문은 git 이력으로만 남으므로,',
  '커밋 메시지에 "어느 조항이 어떻게 바뀌었는지"를 남길 것.',
].join('\n');

const readBaseline = (): FundingCreatorTermsBaseline | null =>
  fs.existsSync(BASELINE_PATH) ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as FundingCreatorTermsBaseline) : null;

describe('개설자 약관 판본 게이트', () => {
  const serialized = serializeCreatorTerms();
  const hash = sha256(serialized);

  if (process.env.UPDATE_CREATOR_TERMS_BASELINE === '1') {
    it('기준선을 갱신한다 (UPDATE_CREATOR_TERMS_BASELINE=1)', () => {
      // 갱신 경로도 같은 규칙을 지킨다 — 여기서 막지 않으면 자물쇠 옆에 열쇠를 걸어 두는 셈이다.
      // 파일이 없는 최초 생성은 ALLOW_BASELINE_CREATE=1을 명시했을 때만 통과한다.
      assertCreatorTermsBaselineUpdateAllowed(readBaseline(), { version: FUNDING_CREATOR_TERMS_VERSION, hash }, process.env.ALLOW_BASELINE_CREATE === '1');
      const payload: FundingCreatorTermsBaseline = {
        note: '개설자가 심사를 신청할 때 동의하는 개설자 약관(FUNDING_CREATOR_TERMS_SECTIONS)의 내용 해시. 내용이 바뀌면 FUNDING_CREATOR_TERMS_VERSION을 먼저 올린 뒤 UPDATE_CREATOR_TERMS_BASELINE=1 로 갱신할 것.',
        version: FUNDING_CREATOR_TERMS_VERSION,
        hash,
        covers: [
          'pages/[locale]/funding/creator-terms.tsx — FUNDING_CREATOR_TERMS_SECTIONS',
          'data/pricing.ts · lib/funding/policy.ts — 제6조에 보간되는 수수료율·원천징수율·정산 시점',
        ],
      };
      fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 1)}\n`);
      expect(readBaseline()).toMatchObject({ version: FUNDING_CREATOR_TERMS_VERSION, hash });
    });
    return;
  }

  const baseline = readBaseline()!;

  it('약관 내용이 바뀌었으면 FUNDING_CREATOR_TERMS_VERSION도 함께 바뀌어 있다', () => {
    expect(
      baseline.hash === hash || baseline.version !== FUNDING_CREATOR_TERMS_VERSION
        ? ''
        : [
            '개설자 약관의 내용이 바뀌었는데 FUNDING_CREATOR_TERMS_VERSION이 그대로다.',
            `  현재 판본: ${FUNDING_CREATOR_TERMS_VERSION}`,
            `  기준선 해시: ${baseline.hash}`,
            `  현재   해시: ${hash}`,
            '',
            '왜 위험한가: funding_projects.creator_terms_version은 "그때 이 내용에 동의했다"는',
            '증거다. 내용이 바뀌었는데 문자열이 같으면, 서로 다른 문서에 동의한 개설자들이 같은',
            '판본을 갖게 되어 동의 기록의 증거 능력이 통째로 무효가 된다.',
            '',
            HOW_TO_UPDATE,
          ].join('\n'),
    ).toBe('');
  });

  it('내용이 바뀌고 버전도 올렸다면 기준선도 함께 갱신돼 있다', () => {
    expect(
      baseline.hash === hash
        ? ''
        : [
            `기준선이 오래됐다 — 내용 해시가 다르다 (기준선 ${baseline.hash.slice(0, 12)}… vs 현재 ${hash.slice(0, 12)}…).`,
            HOW_TO_UPDATE,
          ].join('\n'),
    ).toBe('');
  });

  it('내용이 그대로면 기준선 판본도 현재 판본과 같다', () => {
    expect(
      baseline.hash !== hash || baseline.version === FUNDING_CREATOR_TERMS_VERSION
        ? ''
        : [
            `내용은 그대로인데 기준선 판본(${baseline.version})이 현재 판본(${FUNDING_CREATOR_TERMS_VERSION})과 다르다.`,
            '판본만 올렸다면 기준선도 함께 갱신할 것.',
            HOW_TO_UPDATE,
          ].join('\n'),
    ).toBe('');
  });

  it('판본 문자열은 날짜 형식을 지킨다 — 정렬 가능해야 옛 판본을 찾을 수 있다', () => {
    expect(FUNDING_CREATOR_TERMS_VERSION).toMatch(CREATOR_TERMS_VERSION_PATTERN);
    expect('funding-creator-terms-2026-09-18-r1').not.toMatch(CREATOR_TERMS_VERSION_PATTERN);
    expect('funding-creator-terms-2026-9-18').not.toMatch(CREATOR_TERMS_VERSION_PATTERN);
    expect('funding-creator-terms-2026-09-18-r2').toMatch(CREATOR_TERMS_VERSION_PATTERN);
  });

  it('판본 접미사는 -r10 이상(선행 0 없음)도 받는다', () => {
    for (const ok of ['funding-creator-terms-2026-09-18-r2', 'funding-creator-terms-2026-09-18-r9', 'funding-creator-terms-2026-09-18-r10', 'funding-creator-terms-2026-09-18-r100']) {
      expect(ok).toMatch(CREATOR_TERMS_VERSION_PATTERN);
    }
    for (const bad of ['funding-creator-terms-2026-09-18-r0', 'funding-creator-terms-2026-09-18-r1', 'funding-creator-terms-2026-09-18-r01']) {
      expect(bad).not.toMatch(CREATOR_TERMS_VERSION_PATTERN);
    }
  });

  it('직렬화 대상에 개설자 약관 8개 조항이 모두 들어간다', () => {
    for (const heading of [
      '제1조 (목적과 당사자)',
      '제2조 (심사)',
      '제3조 (승인 뒤에도 바뀌는 것과 바뀌지 않는 것)',
      '제4조 (콘텐츠 권리 보증)',
      '제5조 (금지 콘텐츠)',
      '제6조 (수수료와 정산)',
      '제7조 (리워드 미이행에 대한 책임)',
      '제8조 (서포터 개인정보의 취급)',
    ]) {
      expect(serialized).toContain(heading);
    }
  });

  // 2026-09-23 이전에는 이 자리에 정반대 테스트가 있었다 — "6조에 숫자가 없다". 요율과
  // 정산 시점이 정해지지 않았던 동안 6조가 "별도 정산 계약으로 정한다" 한 줄이었기
  // 때문이다. 정산 기능이 열리면서 그 전제가 사라졌고, 실제로 체결하는 별도 계약도 없다.
  // 지금 지켜야 할 것은 반대다 — 6조의 숫자가 **상수에서 온 값과 같아야** 한다.
  it('6조(수수료와 정산)가 상수에서 보간한 확정 요율·정산 시점을 말한다', () => {
    const feeSection = serialized.split('제6조')[1]?.split('제7조')[0] ?? '';
    expect(feeSection).toContain(`${FUNDING_PLATFORM_FEE_PERCENT}%`);
    expect(feeSection).toContain(`${FUNDING_PAYMENT_FEE_PERCENT}%`);
    // 문장까지 함께 본다 — FUNDING_WITHHOLDING_PERCENT와 FUNDING_PAYMENT_FEE_PERCENT가 둘 다
    // 3.3이라, 요율 숫자만 찾으면 원천징수 문장을 통째로 지워도 결제 수수료 문장이 통과시킨다.
    expect(feeSection).toContain(`원천징수세액 ${FUNDING_WITHHOLDING_PERCENT}%`);
    expect(feeSection).toContain(`플랫폼 수수료는 ${FUNDING_PLATFORM_FEE_PERCENT}%`);
    expect(feeSection).toContain(`결제 수수료는 ${FUNDING_PAYMENT_FEE_PERCENT}%`);
    expect(feeSection).toContain(`영업일 ${FUNDING_PAYOUT_BUSINESS_DAYS}일`);
    // 실제로 체결하지 않는 "별도 정산 계약"을 다시 들여놓지 않는다 — 없는 계약을 가리키는
    // 조항은 요율을 안 적는 것보다 나쁘다.
    expect(feeSection).not.toContain('별도로 체결하는 정산 계약');
  });

  // 계산 순서(lib/funding/payout.ts computeFundingPayout): netGross = gross − refund →
  // 수수료 → 원천징수. 문서가 다른 순서를 말하면 같은 모금액에서 다른 금액이 나온다.
  it('6조가 환불을 먼저 빼고 그 금액에 수수료를 매긴다고 적는다', () => {
    const feeSection = serialized.split('제6조')[1]?.split('제7조')[0] ?? '';
    expect(feeSection).toContain('환불된 금액을 먼저 뺀 뒤');
    expect(feeSection).toContain('환불을 먼저 뺀 금액을 기준으로 계산합니다');
  });

  // 요율이 움직이면 해시도 움직여야 한다. 지금 직렬화에는 그 값이 **두 경로**로 실린다 —
  // 6조 본문의 보간과 상수 블록. 둘 중 하나만 있어도 해시는 달라지므로, 두 경로를 각각
  // 확인한다. 상수 블록이 있는 이유는 본문 경로가 사라지는 개정(요율을 표로 빼거나 숫자를
  // 리터럴로 적는 경우)에 대비한 것이다(content/creatorTermsHash.ts 머리주석).
  it('요율이 바뀌면 본문 경로로도 상수 블록 경로로도 해시가 달라진다', () => {
    const viaBody = serialized.replace(
      `플랫폼 수수료는 ${FUNDING_PLATFORM_FEE_PERCENT}%`,
      '플랫폼 수수료는 10%',
    );
    expect(viaBody).not.toBe(serialized);
    expect(sha256(viaBody)).not.toBe(hash);

    const viaConstants = serialized.replace(
      `FUNDING_PLATFORM_FEE_PERCENT=${FUNDING_PLATFORM_FEE_PERCENT}`,
      'FUNDING_PLATFORM_FEE_PERCENT=10',
    );
    expect(viaConstants).not.toBe(serialized);
    expect(sha256(viaConstants)).not.toBe(hash);
  });

  // 3번 지적(적대적 검토) — 정산 시점을 조건 없이 단정하면 바로 다음 문장의 선행조건과
  // 갈린다. recordFundingPayout은 계좌(no_payout_account)와 세금 처리 구분(no_tax_type)이
  // 둘 다 있어야 기록한다.
  it('6조의 정산 시점이 정산 정보 등록을 전제로 걸려 있다', () => {
    const feeSection = serialized.split('제6조')[1]?.split('제7조')[0] ?? '';
    expect(feeSection).toContain('위 정산 정보가 모두 등록되어 있는 경우');
    expect(feeSection).toContain('세금 처리 구분을 모두 등록해야 합니다');
  });

  // 1번 지적 — payoutEmail.ts breakdownLines는 환불액·원천징수세액을 각각 금액이 0보다 클
  // 때만 넣는다. 그 둘을 무조건 담긴다고 적으면 환불 없는 프로젝트·사업자 개설자의 메일이
  // 약관과 다르다.
  it('6조가 메일 내역의 조건부 항목을 조건부로 적는다', () => {
    const feeSection = serialized.split('제6조')[1]?.split('제7조')[0] ?? '';
    expect(feeSection).toContain('환불이나 원천징수가 있으면 그 금액도 함께 적습니다');
  });

  it('조항 본문이 한 글자만 바뀌어도 해시가 달라진다', () => {
    const tampered = serialized.replace('스튜디오를 면책합니다', '스튜디오에 책임을 묻지 않습니다');
    expect(tampered).not.toBe(serialized);
    expect(sha256(tampered)).not.toBe(hash);
  });
});

/**
 * 갱신 경로의 자물쇠. content/fundingTerms.baseline.test.ts의 같은 이름 describe와
 * 같은 사고(내용을 고치고 버전은 그대로 둔 채 갱신 경로만 실행 → "옛 버전 + 새 해시"로
 * 기록되고 재실행하면 통과)를 개설자 약관 쪽에서도 고정한다.
 */
describe('assertCreatorTermsBaselineUpdateAllowed — 갱신 경로 우회 차단', () => {
  const existing = { version: 'funding-creator-terms-2026-09-18', hash: 'a'.repeat(64) };

  it('내용이 바뀌었는데 판본이 그대로면 기준선을 쓰지 못하게 막는다', () => {
    expect(() => assertCreatorTermsBaselineUpdateAllowed(existing, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/FUNDING_CREATOR_TERMS_VERSION이 그대로다/);
  });

  it('막는 이유와 다음에 할 일을 함께 말한다', () => {
    try {
      assertCreatorTermsBaselineUpdateAllowed(existing, { version: existing.version, hash: 'b'.repeat(64) });
      throw new Error('던지지 않았다');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/같은 판본을 갖게 된다/);
      expect(message).toMatch(/FUNDING_CREATOR_TERMS_VERSION을 올린 뒤/);
    }
  });

  it('판본을 올렸으면 통과시킨다', () => {
    expect(() => assertCreatorTermsBaselineUpdateAllowed(existing, { version: 'funding-creator-terms-2026-09-19', hash: 'b'.repeat(64) })).not.toThrow();
  });

  it('내용이 그대로면(판본만 손봄) 통과시킨다', () => {
    expect(() => assertCreatorTermsBaselineUpdateAllowed(existing, { version: existing.version, hash: existing.hash })).not.toThrow();
  });

  it('최초 생성은 allowCreate=true를 명시했을 때만 통과시킨다', () => {
    expect(() => assertCreatorTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }, true)).not.toThrow();
  });

  it('기준선 파일이 없는데 플래그 없이 갱신하면 거부한다(파일 삭제 우회 차단)', () => {
    expect(() => assertCreatorTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/찾을 수 없다/);
  });

  it('allowCreate 기본값은 false다 — 인자를 생략해도 거부가 기본 동작이다', () => {
    expect(() => assertCreatorTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }, false))
      .toThrow(/ALLOW_BASELINE_CREATE=1/);
  });

  it('파일 삭제 우회 거부 메시지는 "지우고 다시 만들라"가 아니라 git 복구를 안내한다', () => {
    try {
      assertCreatorTermsBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) });
      throw new Error('던지지 않았다');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/git checkout/);
      expect(message).toMatch(/ALLOW_BASELINE_CREATE=1/);
    }
  });
});
