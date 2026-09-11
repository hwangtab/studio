/** @jest-environment node */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { FUNDING_TERMS_VERSION } from '../lib/funding/policy';
import { serializeAgreedDocuments, type FundingTermsBaseline } from './fundingTermsHash';

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
  '  1. lib/funding/policy.ts의 FUNDING_TERMS_VERSION을 오늘 날짜로 올린다 (예: funding-terms-YYYY-MM-DD).',
  '  2. UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts 로 기준선을 다시 쓴다.',
  '  3. 바뀐 판본과 content/funding-terms.baseline.json을 같은 커밋에 넣고, 무엇이 바뀌었는지 적는다.',
  '',
  '이미 후원이 들어온 뒤 내용을 바꾸는 경우: 기존 후원 행의 terms_version은 옛 문자열 그대로 둔다.',
  '옛 판본의 본문은 git 이력으로만 남으므로, 커밋 메시지에 "어느 조항이 어떻게 바뀌었는지"를 남길 것.',
].join('\n');

describe('펀딩 약관 판본 게이트', () => {
  const serialized = serializeAgreedDocuments();
  const hash = sha256(serialized);

  if (process.env.UPDATE_FUNDING_TERMS_BASELINE === '1') {
    it('기준선을 갱신한다 (UPDATE_FUNDING_TERMS_BASELINE=1)', () => {
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
      expect(fs.existsSync(BASELINE_PATH)).toBe(true);
    });
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as FundingTermsBaseline;

  it('동의 문서의 내용이 바뀌었으면 FUNDING_TERMS_VERSION도 함께 바뀌어 있다', () => {
    if (baseline.hash === hash) {
      expect(baseline.version).toBe(FUNDING_TERMS_VERSION);
      return;
    }
    // 내용이 바뀌었다 — 버전이 그대로면 그 자리에서 세운다.
    expect(
      baseline.version === FUNDING_TERMS_VERSION
        ? [
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
          ].join('\n')
        : '',
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

  it('판본 문자열은 날짜 형식을 지킨다 — 정렬 가능해야 옛 판본을 찾을 수 있다', () => {
    expect(FUNDING_TERMS_VERSION).toMatch(/^funding-terms-\d{4}-\d{2}-\d{2}$/);
  });

  it('직렬화 대상에 약관 16개 조항과 처리방침 펀딩 절이 모두 들어간다', () => {
    expect(serialized).toContain('제16조');
    expect(serialized).toContain('9. 펀딩 개인정보의 처리위탁');
    expect(serialized).toContain('4. 제3자 제공 및 처리위탁');
  });

  it('조항 한 글자만 바뀌어도 해시가 달라진다', () => {
    expect(sha256(`${serialized} `)).not.toBe(hash);
  });
});
