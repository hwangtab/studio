import React from 'react';
import Link from 'next/link';
import { MessageCircle } from '@/lib/lucide-icons';
import { Button } from '../ui/Button';
import { ChoiceCard, ChoiceGroup } from '../ui/Choice';
import { Checkbox } from '../ui/Checkbox';
import { Field, Select } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { formatPriceAmount } from '../../data/pricing';
import {
  computeReleaseBudget,
  RELEASE_BUDGET_MAX_SONGS,
  type FundingSource,
  type TrackScale,
} from '../../lib/release/budget';
import { makeQuoteCode } from '../../lib/quote/estimate';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

const won = (n: number) => `${formatPriceAmount(n)}원`;

const SCALES: { id: TrackScale; label: string }[] = [
  { id: 'l1', label: '보컬 + 반주 위주 (10트랙 이하)' },
  { id: 'l2', label: '밴드 편성 (11~30트랙)' },
  { id: 'l3', label: '대편성 (31트랙 이상)' },
];
const SOURCES: { id: FundingSource; label: string }[] = [
  { id: 'self', label: '직접 준비' },
  { id: 'funding', label: '크라우드펀딩' },
  { id: 'grant', label: '예술지원사업' },
  { id: 'unsure', label: '아직 몰라요' },
];
const SONG_OPTIONS = Array.from({ length: RELEASE_BUDGET_MAX_SONGS }, (_, i) => i + 1);

/** 결과 아래 안내 — 계산에 넣지 않은 것. 약속이 아니라 범위를 말한다. */
const EXCLUDED_NOTE = '세션 연주비는 연주자 실비만 따로 받아요(섭외 수수료 없음). 커버 아트워크·뮤직비디오·CD·LP는 별도예요.';

/**
 * 발매 예산 계산기 — /release-project 티어 카드 바로 아래, 펼친 채로(운영자 결정 2026-10-12, ko 전용).
 *
 * 티어 카드의 "~부터" 가격을 본 사람이 "내 경우엔?"을 바로 계산한다. 발매 카톡 상담 대부분이 견적·예산
 * 질문이라 그 답을 페이지에서 먼저 준다. 펀딩 목표액 계산기(얼마를 모아야 하나)와 다르다 — 이건 받는 것의
 * 값이다. 기본값은 1곡(싱글 번들)이라 처음 보는 숫자가 티어 카드의 가장 낮은 값과 같다.
 *
 * 식은 lib/release/budget.ts 하나(전부 data/pricing.ts 상수). 결과 버튼은 요약과 견적 코드를 복사한 뒤
 * 카카오톡을 연다 — 이름·연락처를 받지 않는다(견적 요청서와 같은 방식).
 */
const ReleaseBudgetCalculator = ({ kakaoUrl, id }: { kakaoUrl: string; id?: string }) => {
  const [songs, setSongs] = React.useState(1);
  const [trackScale, setTrackScale] = React.useState<TrackScale>('l1');
  const [arrangementSongs, setArrangementSongs] = React.useState(0);
  const [vocalTuning, setVocalTuning] = React.useState(false);
  const [fundingSource, setFundingSource] = React.useState<FundingSource>('self');
  const [code, setCode] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const usedRef = React.useRef(false);

  React.useEffect(() => {
    setCode(makeQuoteCode((n) => crypto.getRandomValues(new Uint8Array(n))));
  }, []);

  const touch = () => {
    setCopied(false);
    if (usedRef.current) return;
    usedRef.current = true;
    trackMicroEvent('micro_release_budget', { locale: 'ko', component: 'ReleaseBudgetCalculator', cta_id: 'release_budget_use' });
  };

  const budget = computeReleaseBudget({ songs, trackScale, arrangementSongs, vocalTuning, fundingSource });
  const scaleLabel = SCALES.find((s) => s.id === trackScale)?.label ?? '';
  const sourceLabel = SOURCES.find((s) => s.id === fundingSource)?.label ?? '';

  const summary = [
    `[스튜디오 놀 발매 예산 ${code}]`,
    `곡 수: ${songs}곡 · 편성: ${scaleLabel}`,
    `편곡 필요: ${arrangementSongs}곡 · 보컬 튜닝: ${vocalTuning ? '필요' : '없음'}`,
    `제작비 마련: ${sourceLabel}`,
    ...budget.lines.map((l) => `- ${l.label}: ${won(l.amount)}`),
    `예상 예산: ${won(budget.total)} (부가세 포함)`,
  ].join('\n');

  const onKakao = () => {
    trackLeadEvent('lead_click_kakao', {
      locale: 'ko',
      component: 'ReleaseBudgetCalculator',
      cta_id: 'release_budget_kakao',
      quote_code: code,
      quote_service: 'release',
    });
    try {
      void navigator.clipboard?.writeText(summary).then(
        () => setCopied(true),
        () => undefined,
      );
    } catch {
      // 클립보드가 막힌 환경이어도 카톡은 그대로 연다.
    }
  };

  return (
    <div id={id} className="scroll-mt-24 glass-card rounded-2xl p-6 sm:p-8 max-w-5xl mx-auto">
      <h3 className="typo-card-title text-gray-900 dark:text-white mb-1">내 발매 예산 계산해 보기</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">곡 수와 편성을 고르면 공개한 정가로 바로 계산돼요.</p>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <Field id="release-budget-songs" label="몇 곡을 내시나요?">
            <Select
              value={songs}
              onChange={(e) => {
                const next = Number(e.target.value);
                setSongs(next);
                setArrangementSongs((a) => Math.min(a, next));
                touch();
              }}
            >
              {SONG_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}곡
                </option>
              ))}
            </Select>
          </Field>
          <ChoiceGroup label="곡의 편성 (트랙 수)" variant="pill">
            {SCALES.map((s) => (
              <ChoiceCard
                key={s.id}
                variant="pill"
                name="release-budget-scale"
                value={s.id}
                checked={trackScale === s.id}
                onChange={() => {
                  setTrackScale(s.id);
                  touch();
                }}
                title={s.label}
              />
            ))}
          </ChoiceGroup>
          <Field id="release-budget-arrangement" label="편곡이 필요한 곡" hint="반주가 이미 있으면 0곡이에요. 편곡 등급은 편성과 같아요.">
            <Select
              value={arrangementSongs}
              onChange={(e) => {
                setArrangementSongs(Number(e.target.value));
                touch();
              }}
            >
              {Array.from({ length: songs + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}곡
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox
            checked={vocalTuning}
            onChange={(e) => {
              setVocalTuning(e.target.checked);
              touch();
            }}
            label="정교한 보컬 튜닝·박자 보정"
          />
          <ChoiceGroup label="제작비는 어떻게 마련하세요?" variant="pill">
            {SOURCES.map((s) => (
              <ChoiceCard
                key={s.id}
                variant="pill"
                name="release-budget-source"
                value={s.id}
                checked={fundingSource === s.id}
                onChange={() => {
                  setFundingSource(s.id);
                  touch();
                }}
                title={s.label}
              />
            ))}
          </ChoiceGroup>
        </div>

        <Panel variant="inset" padding="default" className="self-start">
          <div aria-live="polite" aria-atomic="true">
            <p className="text-sm text-gray-500 dark:text-gray-400">예상 예산</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{won(budget.total)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">부가세 포함</p>
          </div>
          <dl className="space-y-2 text-sm">
            {budget.lines.map((l) => (
              <div key={l.id} className="flex justify-between gap-4">
                <dt className="text-gray-600 dark:text-gray-400">{l.label}</dt>
                <dd className="text-gray-900 dark:text-white tabular-nums whitespace-nowrap">{won(l.amount)}</dd>
              </div>
            ))}
          </dl>
          {fundingSource === 'funding' && (
            <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
              설계비와 제작비는 펀딩이 끝나 모금액을 정산할 때 모금액에서 받아요.{' '}
              <Link href="/ko/crowdfunding-design#funding-goal" prefetch={false} className="font-semibold text-primary underline underline-offset-4 dark:text-primary-lighter">
                목표액 계산해 보기
              </Link>
            </p>
          )}
          {fundingSource === 'grant' && (
            <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
              신청서는 본인이 써요. 견적서·제작 사양·일정표 같은 제작처 서류는 저희가 드려요.
            </p>
          )}
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{EXCLUDED_NOTE}</p>
        </Panel>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild variant="kakao" shape="block" size="lg">
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onKakao}
            className="w-full sm:w-auto h-auto min-h-[48px] py-4 px-10 text-base text-center whitespace-normal leading-snug font-bold touch-manipulation"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            이 예산으로 카톡 상담
          </a>
        </Button>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center" role="status">
          {copied
            ? '계산 내용을 복사했어요. 카카오톡 대화창에 붙여 넣어 주세요.'
            : `실제 금액은 곡 상태를 보고 상담에서 확정해요. 견적 코드 ${code}`}
        </p>
      </div>
    </div>
  );
};

export default ReleaseBudgetCalculator;
