/** @jest-environment node */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { POLICY_COPY_BY_LOCALE } from '../data/privacyPolicy';
import {
  KNOWN_PAYMENT_METHODS,
  POLICY_DESCRIBED_METHODS,
} from '../lib/payments/knownMethods';

/**
 * 결제수단 목록 ↔ 개인정보 처리방침 1항의 드리프트 게이트.
 *
 * 1항은 **결제수단별로** 승인 응답에 무엇이 저장되는지 고지한다. 그 고지는 우리가 받는
 * 수단의 집합이 바뀌면 함께 움직여야 하는데, 둘 사이에 아무 연결이 없었다 — 목록을 늘리면
 * 문서가 낡고, 문서를 고치면 목록이 낡는다. 어느 쪽도 실패로 드러나지 않는다.
 *
 * 그래서 **둘을 한 기준선에 묶는다.** 한쪽만 바뀌면 이 테스트가 서고, 갱신하려면 다른
 * 쪽을 반드시 다시 읽게 된다(`content/fundingTerms.baseline.test.ts`의 해시 게이트와 같은
 * 방식이다. 리터럴 스캔·항목 대조가 아니라 해시인 이유: 1항은 자유 문장이라 "어느 수단을
 * 설명한다"를 기계가 문장에서 안전하게 추출할 수 없다).
 */

const BASELINE_PATH = path.join(process.cwd(), 'content/payment-methods.baseline.json');

interface PaymentMethodsBaseline {
  note: string;
  methods: string[];
  policyDescribedMethods: string[];
  /** ko 처리방침 1항 본문의 sha256. */
  policyParagraphSha256: string;
}

const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const POLICY_HEADING = '1. 수집하는 개인정보 항목';

const policyParagraph = (): string => {
  const section = POLICY_COPY_BY_LOCALE.ko.sections.find((s) => s.heading === POLICY_HEADING);
  if (!section) {
    throw new Error(
      `개인정보 처리방침 ko에서 "${POLICY_HEADING}" 항을 찾지 못했다. 항 제목이 바뀌었다면 이 게이트의 POLICY_HEADING도 함께 고칠 것 — 못 찾은 채로 통과시키면 게이트가 아무것도 지키지 않는다.`,
    );
  }
  return section.body;
};

const HOW_TO_UPDATE = [
  '이 테스트가 섰다는 것은 결제수단 목록과 처리방침 1항 중 한쪽만 움직였다는 뜻이다.',
  '',
  '수단을 새로 받기로 한 경우:',
  '  1. 그 수단의 승인 응답에 무엇이 실리는지 확인해 처리방침 1항에 반영한다.',
  '     ⚠ ko 본문은 후원자 동의 문서라, 먼저 FUNDING_TERMS_VERSION을 올린 뒤',
  '     UPDATE_FUNDING_TERMS_BASELINE=1 로 약관 기준선도 다시 써야 한다.',
  '  2. lib/payments/knownMethods.ts의 목록에 값을 더하고, 그 값을 어디서 확인했는지',
  '     (저장소인지 토스 문서인지) 주석에 적는다.',
  '  3. UPDATE_PAYMENT_METHODS_BASELINE=1 npx jest content/paymentMethods.baseline.test.ts',
  '  4. 같은 커밋에 왜 바뀌는지 적는다 — 이유 없는 갱신은 게이트를 무력화한다.',
  '',
  '문구만 다듬은 경우에도 3·4를 거친다. 그때 목록이 여전히 맞는지 한 번 더 보게 하는 것이',
  '이 게이트의 목적이다.',
].join('\n');

const readBaseline = (): PaymentMethodsBaseline | null =>
  fs.existsSync(BASELINE_PATH) ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as PaymentMethodsBaseline) : null;

describe('결제수단 ↔ 처리방침 드리프트 게이트', () => {
  const methods = [...KNOWN_PAYMENT_METHODS];
  const described = [...POLICY_DESCRIBED_METHODS];
  const paragraph = policyParagraph();
  const hash = sha256(paragraph);

  if (process.env.UPDATE_PAYMENT_METHODS_BASELINE === '1') {
    it('기준선을 갱신한다 (UPDATE_PAYMENT_METHODS_BASELINE=1)', () => {
      const payload: PaymentMethodsBaseline = {
        note: '결제수단 목록(lib/payments/knownMethods.ts)과 개인정보 처리방침 ko 1항을 묶어 둔 기준선. 한쪽만 바뀌면 CI가 선다.',
        methods,
        policyDescribedMethods: described,
        policyParagraphSha256: hash,
      };
      fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 1)}\n`);
      expect(readBaseline()).toMatchObject({ methods, policyParagraphSha256: hash });
    });
    return;
  }

  const baseline = readBaseline();

  it('기준선 파일이 있다', () => {
    expect(baseline).not.toBeNull();
  });

  it('아는 결제수단 목록이 기준선과 같다', () => {
    expect({ methods, hint: HOW_TO_UPDATE }).toEqual({ methods: baseline!.methods, hint: HOW_TO_UPDATE });
  });

  it('처리방침 1항 본문이 기준선과 같다', () => {
    expect({ hash, hint: HOW_TO_UPDATE }).toEqual({ hash: baseline!.policyParagraphSha256, hint: HOW_TO_UPDATE });
  });

  it('항목까지 설명하는 수단은 목록에 있고, 1항 본문이 실제로 그 수단을 언급한다', () => {
    expect(described).toEqual(baseline!.policyDescribedMethods);
    for (const method of described) {
      expect(methods).toContain(method);
      // 문서가 어느 수단의 설명을 통째로 빼면 여기서 선다.
      expect(paragraph).toContain(method);
    }
  });
});
