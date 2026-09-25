import React from 'react';
import { MessageCircle } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import { Button } from '../ui/Button';
import { formatPriceAmount, FUNDING_DESIGN_PRICE } from '../../data/pricing';
import { PIPELINE_BUNDLE_PRICES, releasePipelineCopy, type ReleaseTierKey } from '../../data/releasePipeline';
import { computeFundingGoal } from '../../lib/funding/goal';
import { VAT_RATE } from '../../lib/booking/amounts';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

const copy = releasePipelineCopy.calculator;
const TIERS: ReleaseTierKey[] = ['single', 'ep', 'album'];
const withVat = (supply: number) => Math.round(supply * (1 + VAT_RATE));
const won = (n: number) => `${formatPriceAmount(n)}원`;

interface FundingGoalCalculatorProps {
  kakaoUrl: string;
}

/**
 * 펀딩 목표액 계산기 — 발매 페이지의 ko 전용 절(설계 §5-3).
 *
 * 목표액 = 정산 후 손에 남는 돈이 (제작비 + 설계비 + 리워드 원가·기타)를 덮는 최소 금액.
 * 식은 lib/funding/goal.ts 하나이고, 그 식은 정산 정본(lib/funding/payout.ts)과 원 단위로
 * 대조된다(goal.test.ts). 제작비·설계비는 부가세 별도 상수에 부가세를 붙여 넣는다 — 개인
 * 아티스트는 부가세를 돌려받지 못하므로 실제로 나가는 돈 기준이다.
 *
 * 카톡과 경쟁하지 않는다: 결과 버튼은 계산 요약을 클립보드에 복사한 뒤 카카오톡을 연다.
 */
const FundingGoalCalculator = ({ kakaoUrl }: FundingGoalCalculatorProps) => {
  const [tier, setTier] = React.useState<ReleaseTierKey>('ep');
  const [otherCostInput, setOtherCostInput] = React.useState('');
  const [withholding, setWithholding] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const usedRef = React.useRef(false);

  const markUsed = () => {
    if (usedRef.current) return;
    usedRef.current = true;
    trackMicroEvent('micro_pipeline_calc', { locale: 'ko', component: 'FundingGoalCalculator', cta_id: 'pipeline_calc_use' });
  };

  const otherCost = Math.max(0, Number(otherCostInput.replace(/[^0-9]/g, '')) || 0);
  const production = withVat(PIPELINE_BUNDLE_PRICES[tier]);
  const design = withVat(FUNDING_DESIGN_PRICE);
  const result = computeFundingGoal({ productionCost: production + design, otherCost, withholding });

  const summary = [
    '[발매 자금 상담 — 펀딩 목표액 계산]',
    `발매 규모: ${copy.tiers[tier]}`,
    `리워드 원가·기타 비용: ${won(otherCost)}`,
    `정산: ${withholding ? '개인(원천징수)' : '사업자(세금계산서)'}`,
    `계산된 목표액: ${won(result.goal)}`,
  ].join('\n');

  const onConsult = () => {
    trackLeadEvent('lead_click_kakao', { locale: 'ko', component: 'FundingGoalCalculator', cta_id: 'release_funding_consult' });
    try {
      void navigator.clipboard?.writeText(summary).then(
        () => setCopied(true),
        () => undefined
      );
    } catch {
      // 클립보드가 막힌 환경이어도 카톡은 그대로 연다.
    }
  };

  const rows: Array<[string, number, boolean?]> = [
    [copy.rows.production, production],
    [copy.rows.design, design],
    [copy.rows.other, otherCost],
    [copy.rows.platformFee, result.platformFee, true],
    [copy.rows.paymentFee, result.paymentFee, true],
    ...(withholding ? ([[copy.rows.withheld, result.withheld, true]] as Array<[string, number, boolean]>) : []),
  ];

  return (
    <Section variant="default" id={copy.anchorId} className="scroll-mt-24">
      <SectionHeading title={copy.title} subtitle={copy.subtitle} className="mb-10" />
      <div className="glass-card rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{copy.tierLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((key) => (
                <label
                  key={key}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-primary/70 dark:focus-within:ring-primary-lighter/70 ${
                    tier === key
                      ? 'border-primary bg-primary/10 text-primary dark:text-primary-lighter'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="funding-goal-tier"
                    value={key}
                    checked={tier === key}
                    onChange={() => {
                      setTier(key);
                      markUsed();
                    }}
                    className="sr-only"
                  />
                  {copy.tiers[key]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="funding-goal-other" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {copy.otherCostLabel}
            </label>
            <input
              id="funding-goal-other"
              inputMode="numeric"
              placeholder="0"
              value={otherCostInput ? formatPriceAmount(otherCost) : ''}
              onChange={(e) => {
                setOtherCostInput(e.target.value);
                markUsed();
              }}
              aria-describedby="funding-goal-other-help"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-right text-gray-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
            />
            <p id="funding-goal-other-help" className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {copy.otherCostHelp}
            </p>
          </div>
          <div>
            <label className="flex items-center gap-3 text-sm text-gray-900 dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={withholding}
                onChange={(e) => {
                  setWithholding(e.target.checked);
                  markUsed();
                }}
                className="h-4 w-4 accent-primary"
              />
              {copy.withholdingLabel}
            </label>
            <p className="mt-1 ml-7 text-xs text-gray-500 dark:text-gray-400">{copy.withholdingHelp}</p>
          </div>
        </div>

        <div aria-live="polite">
          <p className="text-sm text-gray-500 dark:text-gray-400">{copy.resultLabel}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-5">{won(result.goal)}</p>
          <dl className="space-y-2 text-sm">
            {rows.map(([label, value, deduction]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
                <dd className="text-gray-900 dark:text-white tabular-nums">
                  {deduction ? '−' : ''}
                  {won(value)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-gray-500 dark:text-gray-400">{copy.compare}</p>
        </div>

        <div className="md:col-span-2 flex flex-col items-center gap-3">
          <Button asChild variant="kakao" shape="pill" size="lg">
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onConsult}
              className="w-full sm:w-auto h-auto min-h-[48px] py-4 px-10 text-base text-center whitespace-normal leading-snug font-bold touch-manipulation"
            >
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
              {copy.cta}
            </a>
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center" role="status">
            {copied ? copy.copied : copy.note}
          </p>
        </div>
      </div>
    </Section>
  );
};

export default FundingGoalCalculator;
