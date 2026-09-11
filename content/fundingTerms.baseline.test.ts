/** @jest-environment node */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { FUNDING_TERMS_VERSION } from '../lib/funding/policy';
import {
  assertBaselineUpdateAllowed,
  serializeAgreedDocuments,
  TERMS_VERSION_PATTERN,
  type FundingTermsBaseline,
} from './fundingTermsHash';

/**
 * 약관 판본 게이트 — 동의 문서의 내용이 바뀌었는데 `FUNDING_TERMS_VERSION`이 그대로면 실패한다.
 *
 * `funding_pledges.terms_version`은 "그때 이 내용에 동의했다"는 증거다. 내용이 바뀌었는데
 * 문자열이 같으면 서로 다른 문서에 동의한 후원 행들이 같은 판본을 갖게 되어 그 증거가 무효가 된다.
 * 예전엔 이 규칙이 lib/funding/policy.ts의 주석에만 있었다.
 *
 * 배경·대상 문서는 content/fundingTermsHash.ts 머리주석 참조.
 */

const BASELINE_PATH = path.join(process.cwd(), 'content/funding-terms.baseline.json');

const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const HOW_TO_UPDATE = [
  '갱신 절차:',
  '  1. lib/funding/policy.ts의 FUNDING_TERMS_VERSION을 올린다 (funding-terms-YYYY-MM-DD,',
  '     같은 날 두 번째 개정이면 -r2 / -r3 접미사).',
  '  2. UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts 로 기준선을 다시 쓴다.',
  '     ①을 빠뜨리고 ②만 실행하면 갱신 경로가 스스로 거부한다(assertBaselineUpdateAllowed).',
  '  3. 바뀐 판본과 content/funding-terms.baseline.json을 같은 커밋에 넣고, 무엇이 바뀌었는지 적는다.',
  '',
  '이미 후원이 들어온 뒤 내용을 바꾸는 경우: 기존 후원 행의 terms_version은 옛 문자열 그대로 둔다.',
  '옛 판본의 본문은 git 이력으로만 남으므로, 커밋 메시지에 "어느 조항이 어떻게 바뀌었는지"를 남길 것.',
].join('\n');

const readBaseline = (): FundingTermsBaseline | null =>
  fs.existsSync(BASELINE_PATH) ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as FundingTermsBaseline) : null;

describe('펀딩 약관 판본 게이트', () => {
  const serialized = serializeAgreedDocuments();
  const hash = sha256(serialized);

  if (process.env.UPDATE_FUNDING_TERMS_BASELINE === '1') {
    it('기준선을 갱신한다 (UPDATE_FUNDING_TERMS_BASELINE=1)', () => {
      // 갱신 경로도 같은 규칙을 지킨다 — 여기서 막지 않으면 자물쇠 옆에 열쇠를 걸어 두는 셈이다.
      // 파일이 없는 최초 생성은 ALLOW_BASELINE_CREATE=1을 명시했을 때만 통과한다.
      assertBaselineUpdateAllowed(readBaseline(), { version: FUNDING_TERMS_VERSION, hash }, process.env.ALLOW_BASELINE_CREATE === '1');
      const payload: FundingTermsBaseline = {
        note: '후원자가 동의하는 문서 묶음(펀딩 약관 + ko 개인정보 처리방침 + 공유 상수)의 내용 해시. 내용이 바뀌면 FUNDING_TERMS_VERSION을 먼저 올린 뒤 UPDATE_FUNDING_TERMS_BASELINE=1 로 갱신할 것.',
        version: FUNDING_TERMS_VERSION,
        hash,
        covers: [
          'pages/[locale]/funding/terms.tsx — FUNDING_TERMS_SECTIONS',
          'pages/[locale]/privacy-policy.tsx — POLICY_COPY_BY_LOCALE.ko',
          'lib/funding/policy.ts — 보유기간·법정 보존·결제 대기 시간·수집 항목·이용 목적·수탁자',
        ],
      };
      fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 1)}\n`);
      expect(readBaseline()).toMatchObject({ version: FUNDING_TERMS_VERSION, hash });
    });
    return;
  }

  const baseline = readBaseline()!;

  it('동의 문서의 내용이 바뀌었으면 FUNDING_TERMS_VERSION도 함께 바뀌어 있다', () => {
    expect(
      baseline.hash === hash || baseline.version !== FUNDING_TERMS_VERSION
        ? ''
        : [
            '펀딩 약관·처리방침의 내용이 바뀌었는데 FUNDING_TERMS_VERSION이 그대로다.',
            `  현재 판본: ${FUNDING_TERMS_VERSION}`,
            `  기준선 해시: ${baseline.hash}`,
            `  현재   해시: ${hash}`,
            '',
            '왜 위험한가: funding_pledges.terms_version은 "그때 이 내용에 동의했다"는 증거다.',
            '내용이 바뀌었는데 문자열이 같으면, 서로 다른 문서에 동의한 후원 행들이 같은 판본을',
            '갖게 되어 동의 기록의 증거 능력이 통째로 무효가 된다.',
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

  // 내용은 그대로인데 판본만 바뀐 경우도 기준선을 다시 써야 한다 — 안 그러면 다음 개정 때
  // "기준선 판본 ≠ 현재 판본"이라는 이유만으로 위 첫 단언이 조용히 빠져나간다.
  it('내용이 그대로면 기준선 판본도 현재 판본과 같다', () => {
    expect(
      baseline.hash !== hash || baseline.version === FUNDING_TERMS_VERSION
        ? ''
        : [
            `내용은 그대로인데 기준선 판본(${baseline.version})이 현재 판본(${FUNDING_TERMS_VERSION})과 다르다.`,
            '판본만 올렸다면 기준선도 함께 갱신할 것.',
            HOW_TO_UPDATE,
          ].join('\n'),
    ).toBe('');
  });

  it('판본 문자열은 날짜 형식을 지킨다 — 정렬 가능해야 옛 판본을 찾을 수 있다', () => {
    expect(FUNDING_TERMS_VERSION).toMatch(TERMS_VERSION_PATTERN);
    // 같은 날 두 번째 개정은 -r2부터. -r1은 접미사 없는 첫 판본과 헷갈리므로 금지한다.
    expect('funding-terms-2026-09-11-r1').not.toMatch(TERMS_VERSION_PATTERN);
    expect('funding-terms-2026-9-11').not.toMatch(TERMS_VERSION_PATTERN);
    expect('funding-terms-2026-09-11-r2').toMatch(TERMS_VERSION_PATTERN);
  });

  // 이전 패턴(-r[2-9]\d*)은 첫 자리를 [2-9]로 고정해 -r10~-r19·-r100~-r199처럼 십의 자리
  // 이상이 붙는 접미사를 전부 거부했다 — 같은 날 열 번째 이상 개정에서 판본을 못 올리는 버그였다.
  it('판본 접미사는 -r10 이상(선행 0 없음)도 받는다', () => {
    for (const ok of ['funding-terms-2026-09-11-r2', 'funding-terms-2026-09-11-r9', 'funding-terms-2026-09-11-r10', 'funding-terms-2026-09-11-r19', 'funding-terms-2026-09-11-r100']) {
      expect(ok).toMatch(TERMS_VERSION_PATTERN);
    }
    for (const bad of ['funding-terms-2026-09-11-r0', 'funding-terms-2026-09-11-r1', 'funding-terms-2026-09-11-r01']) {
      expect(bad).not.toMatch(TERMS_VERSION_PATTERN);
    }
  });

  it('직렬화 대상에 약관 16개 조항과 처리방침 펀딩 절이 모두 들어간다', () => {
    for (const heading of ['제1조 (목적)', '제8조 (청약철회의 권리 및 기간)', '제16조 (준거법 및 문의처)']) {
      expect(serialized).toContain(heading);
    }
    expect(serialized).toContain('9. 펀딩 개인정보의 처리위탁');
    expect(serialized).toContain('4. 제3자 제공 및 처리위탁');
    // 후원자가 읽는 문장에 보간되는 공유 상수도 해시에 들어간다.
    expect(serialized).toContain('리워드 전달 완료 후 1년');
    expect(serialized).toContain('TOSS_HOLD_SECONDS=900');
  });

  // 해시는 export된 데이터 구조에서 나온다 — className·주석·비-ko 카피에는 반응하지 않고
  // 후원자가 읽는 텍스트에만 반응해야 한다. 실제 조항 한 줄을 바꿔 그것을 확인한다.
  it('조항 본문이 한 글자만 바뀌어도 해시가 달라진다', () => {
    const tampered = serialized.replace('3영업일 이내에 처리합니다', '5영업일 이내에 처리합니다');
    expect(tampered).not.toBe(serialized); // 대상 문장이 실제로 직렬화에 들어 있다
    expect(sha256(tampered)).not.toBe(hash);
  });
});

/**
 * 갱신 경로의 자물쇠. 리뷰 샌드박스에서 재현된 우회(제10조를 고치고 버전은 그대로 둔 채
 * 절차 ②만 실행 → 기준선이 "옛 버전 + 새 해시"로 기록되고 재실행하면 통과)를 고정한다.
 */
describe('assertBaselineUpdateAllowed — 갱신 경로 우회 차단', () => {
  const existing = { version: 'funding-terms-2026-09-11', hash: 'a'.repeat(64) };

  it('내용이 바뀌었는데 판본이 그대로면 기준선을 쓰지 못하게 막는다', () => {
    expect(() => assertBaselineUpdateAllowed(existing, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/FUNDING_TERMS_VERSION이 그대로다/);
  });

  it('막는 이유와 다음에 할 일을 함께 말한다', () => {
    try {
      assertBaselineUpdateAllowed(existing, { version: existing.version, hash: 'b'.repeat(64) });
      throw new Error('던지지 않았다');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/같은 판본을 갖게 된다/);
      expect(message).toMatch(/FUNDING_TERMS_VERSION을 올린 뒤/);
    }
  });

  it('판본을 올렸으면 통과시킨다', () => {
    expect(() => assertBaselineUpdateAllowed(existing, { version: 'funding-terms-2026-09-12', hash: 'b'.repeat(64) })).not.toThrow();
  });

  it('내용이 그대로면(판본만 손봄) 통과시킨다', () => {
    expect(() => assertBaselineUpdateAllowed(existing, { version: existing.version, hash: existing.hash })).not.toThrow();
  });

  it('최초 생성은 allowCreate=true를 명시했을 때만 통과시킨다', () => {
    expect(() => assertBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }, true)).not.toThrow();
  });

  // 실측된 두 번째 우회: 거부 메시지를 본 사람이 baseline 파일을 지우면 existing이 null이 되어
  // "최초 생성"으로 취급되고, 옛 판본 문자열 + 새 내용이 그대로 기준선이 되어 이후 검사가 초록이 된다.
  it('기준선 파일이 없는데 플래그 없이 갱신하면 거부한다(파일 삭제 우회 차단)', () => {
    expect(() => assertBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }))
      .toThrow(/찾을 수 없다/);
  });

  it('allowCreate 기본값은 false다 — 인자를 생략해도 거부가 기본 동작이다', () => {
    expect(() => assertBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) }, false))
      .toThrow(/ALLOW_BASELINE_CREATE=1/);
  });

  it('파일 삭제 우회 거부 메시지는 "지우고 다시 만들라"가 아니라 git 복구를 안내한다', () => {
    try {
      assertBaselineUpdateAllowed(null, { version: existing.version, hash: 'b'.repeat(64) });
      throw new Error('던지지 않았다');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/git checkout/);
      expect(message).toMatch(/ALLOW_BASELINE_CREATE=1/);
    }
  });
});
