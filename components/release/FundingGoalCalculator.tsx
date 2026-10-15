import React from 'react';
import { MessageCircle } from '@/lib/lucide-icons';
import { Section } from '../ui/Section';
import SectionHeading from '../ui/SectionHeading';
import { Button } from '../ui/Button';
import { ChoiceCard, ChoiceGroup } from '../ui/Choice';
import { Checkbox } from '../ui/Checkbox';
import { Field, TextInput } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { Disclosure } from '../ui/Disclosure';
import { formatPriceAmount, FUNDING_DESIGN_PRICE } from '../../data/pricing';
import { PIPELINE_BUNDLE_PRICES, releasePipelineCopy, type ReleaseTierKey } from '../../data/releasePipeline';
import { computeFundingGoal } from '../../lib/funding/goal';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

const copy = releasePipelineCopy.calculator;
type ProductionKey = ReleaseTierKey | 'none';
type DesignKey = 'design' | 'direct';
const PRODUCTIONS: ProductionKey[] = ['none', 'single', 'ep', 'album'];
const DESIGNS: DesignKey[] = ['design', 'direct'];
const productionLabel = (key: ProductionKey) => (key === 'none' ? copy.noProduction : copy.tiers[key]);
const won = (n: number) => `${formatPriceAmount(n)}원`;

interface FundingGoalCalculatorProps {
  kakaoUrl: string;
  /** 처음 고른 제작 규모. 발매 페이지는 EP, 펀딩 설계 페이지는 "제작 없음"으로 연다. */
  defaultProduction?: ProductionKey;
  /** 어느 페이지에서 쓰였는지 — 이벤트 component 값을 가른다. */
  component?: string;
  /** 배경. 펀딩 설계 페이지는 앞 절(진행 과정)에 이어 붙이려고 alternate로 쓴다. */
  variant?: 'default' | 'alternate';
  /**
   * 발매 페이지용. 펀딩을 아직 정하지 않은 방문자가 대부분이라 한 줄로 접어 두고(#funding-goal로 오면 펼침),
   * 공제 내역은 "계산 내역 보기"로 접고, 다른 펀딩 모금 중앙값 비교는 싣지 않는다 — 큰 목표액과 공제 줄이
   * 가격표보다 먼저 보여 "이만큼 모아야 한다"는 압박이 됐다(2026-10-12 운영자). 펀딩 설계 페이지는 펀딩할
   * 사람이 오는 곳이라 펼친 그대로 쓴다.
   */
  calm?: boolean;
}

/** 알약형 라디오 한 벌 — 제작 규모와 개설 방식이 같은 모양이다. 모양은 ChoiceGroup/ChoiceCard(variant="pill")가 소유한다. */
function PillRadios<K extends string>({ name, legend, options, value, label, onChange }: {
  name: string;
  legend: string;
  options: readonly K[];
  value: K;
  label: (key: K) => string;
  onChange: (key: K) => void;
}) {
  return (
    <ChoiceGroup label={legend} variant="pill">
      {options.map((key) => (
        <ChoiceCard
          key={key}
          variant="pill"
          name={name}
          value={key}
          checked={value === key}
          onChange={() => onChange(key)}
          title={label(key)}
        />
      ))}
    </ChoiceGroup>
  );
}

/**
 * 펀딩 목표액 계산기 — 발매 페이지의 ko 전용 절(설계 §5-3).
 *
 * 목표액 = 정산 후 손에 남는 돈이 (제작비 + 설계비 + 리워드 원가·기타)를 덮는 최소 금액.
 * 작은 펀딩도 같은 식이다 — 제작 없음·직접 개설을 고르면 그 항목이 0으로 빠질 뿐 흐름은 같다.
 * 식은 lib/funding/goal.ts 하나이고, 그 식은 정산 정본(lib/funding/payout.ts)과 원 단위로
 * 대조된다(goal.test.ts). 제작비·설계비 상수는 부가세 포함 표기가라 그대로 넣는다 — 개인
 * 아티스트는 부가세를 돌려받지 못하므로 실제로 나가는 돈 기준이다.
 *
 * 카톡과 경쟁하지 않는다: 결과 버튼은 계산 요약을 클립보드에 복사한 뒤 카카오톡을 연다.
 */
const FundingGoalCalculator = ({ kakaoUrl, defaultProduction = 'ep', component = 'FundingGoalCalculator', variant = 'default', calm = false }: FundingGoalCalculatorProps) => {
  const [tier, setTier] = React.useState<ProductionKey>(defaultProduction);
  const [designKey, setDesignKey] = React.useState<DesignKey>('design');
  const [otherCostInput, setOtherCostInput] = React.useState('');
  const [withholding, setWithholding] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const usedRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const openedRef = React.useRef(false);

  // 접힌 계산기는 #funding-goal로 들어오면(같은 페이지의 "목표액 계산해 보기" 링크 포함) 펼친다.
  React.useEffect(() => {
    if (!calm) return undefined;
    const sync = () => {
      if (window.location.hash === `#${copy.anchorId}`) setOpen(true);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [calm]);

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const next = e.currentTarget.open;
    setOpen(next);
    if (next && !openedRef.current) {
      openedRef.current = true;
      trackMicroEvent('micro_pipeline_calc', { locale: 'ko', component, cta_id: 'pipeline_calc_open' });
    }
  };

  const markUsed = () => {
    if (usedRef.current) return;
    usedRef.current = true;
    trackMicroEvent('micro_pipeline_calc', { locale: 'ko', component, cta_id: 'pipeline_calc_use' });
  };

  const otherCost = Math.max(0, Number(otherCostInput.replace(/[^0-9]/g, '')) || 0);
  const production = tier === 'none' ? 0 : PIPELINE_BUNDLE_PRICES[tier];
  const design = designKey === 'design' ? FUNDING_DESIGN_PRICE : 0;
  const result = computeFundingGoal({ productionCost: production + design, otherCost, withholding });

  const summary = [
    '[발매 자금 상담 — 펀딩 목표액 계산]',
    `제작: ${productionLabel(tier)}`,
    `개설: ${copy.designOptions[designKey]}`,
    `리워드 원가·기타 비용: ${won(otherCost)}`,
    `정산: ${withholding ? '개인(원천징수)' : '사업자(세금계산서)'}`,
    `계산된 목표액: ${won(result.goal)}`,
  ].join('\n');

  const onConsult = () => {
    trackLeadEvent('lead_click_kakao', { locale: 'ko', component, cta_id: 'release_funding_consult' });
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
    ...(production > 0 ? ([[copy.rows.production, production]] as Array<[string, number]>) : []),
    ...(design > 0 ? ([[copy.rows.design, design]] as Array<[string, number]>) : []),
    [copy.rows.other, otherCost],
    [copy.rows.platformFee, result.platformFee, true],
    [copy.rows.paymentFee, result.paymentFee, true],
    ...(withholding
      ? ([
        [copy.rows.vatDeduction, result.vatDeduction, true],
        [copy.rows.withheld, result.withheld, true],
      ] as Array<[string, number, boolean]>)
      : []),
  ];

  const breakdown = (
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
  );

  const calculator = (
      <div className={calm ? 'grid gap-8 md:grid-cols-2 pt-2' : 'glass-card rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto grid gap-8 md:grid-cols-2'}>
        <div className="space-y-6">
          <PillRadios
            name="funding-goal-tier"
            legend={copy.tierLabel}
            options={PRODUCTIONS}
            value={tier}
            label={productionLabel}
            onChange={(key) => { setTier(key); markUsed(); }}
          />
          <PillRadios
            name="funding-goal-design"
            legend={copy.designLabel}
            options={DESIGNS}
            value={designKey}
            label={(key) => copy.designOptions[key]}
            onChange={(key) => { setDesignKey(key); markUsed(); }}
          />
          <Field id="funding-goal-other" label={copy.otherCostLabel} hint={copy.otherCostHelp}>
            <TextInput
              inputMode="numeric"
              placeholder="0"
              value={otherCostInput ? formatPriceAmount(otherCost) : ''}
              onChange={(e) => {
                setOtherCostInput(e.target.value);
                markUsed();
              }}
              className="text-right"
            />
          </Field>
          <Checkbox
            checked={withholding}
            onChange={(e) => {
              setWithholding(e.target.checked);
              markUsed();
            }}
            emphasis
            label={copy.withholdingLabel}
            hint={copy.withholdingHelp}
          />
        </div>

        {/* calm에선 내역이 접혀 있어 짧다 — 왼쪽 열 높이로 늘이면 아래가 빈 칸으로 남는다. */}
        <Panel variant="inset" padding="default" aria-live="polite" className={calm ? 'self-start' : undefined}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{copy.resultLabel}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-5">{won(result.goal)}</p>
          {calm ? (
            <Disclosure variant="plain" summary={copy.breakdownSummary}>
              {breakdown}
            </Disclosure>
          ) : (
            <>
              {breakdown}
              <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">{copy.compare}</p>
            </>
          )}
        </Panel>

        <div className="md:col-span-2 flex flex-col items-center gap-3">
          <Button asChild variant="kakao" shape="block" size="lg">
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
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center" role="status">
            {copied ? copy.copied : copy.note}
          </p>
        </div>
      </div>
  );

  return (
    <Section variant={variant} id={copy.anchorId} className="scroll-mt-24">
      {calm ? (
        <Disclosure
          open={open}
          onToggle={onToggle}
          summary={copy.collapsedSummary}
          className="glass-card max-w-3xl mx-auto"
          summaryClassName="text-base px-6 py-4"
          bodyClassName="px-6 pb-6"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{copy.calmSubtitle}</p>
          {calculator}
        </Disclosure>
      ) : (
        <>
          <SectionHeading title={copy.title} subtitle={copy.subtitle} className="mb-10" />
          {calculator}
        </>
      )}
    </Section>
  );
};

export default FundingGoalCalculator;
