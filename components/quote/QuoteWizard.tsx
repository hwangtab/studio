import React from 'react';
import Link from 'next/link';
import { MessageCircle } from '@/lib/lucide-icons';
import { Button } from '../ui/Button';
import {
  buildQuoteSummary,
  estimate,
  FUNDING_SOURCE_CHOICES,
  makeQuoteCode,
  READINESS_CHOICES,
  READINESS_SERVICES,
  scaleQuestionFor,
  SERVICE_CHOICES,
  TIMING_CHOICES,
  VAT_NOTE,
  type Choice,
  type QuoteAnswers,
  type QuoteService,
} from '../../lib/quote/estimate';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

interface QuoteWizardProps {
  kakaoUrl: string;
}

const pillClass = (selected: boolean) =>
  `cursor-pointer rounded-full border px-4 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-primary/70 dark:focus-within:ring-primary-lighter/70 ${
    selected
      ? 'border-primary bg-primary/10 text-primary dark:text-primary-lighter'
      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
  }`;

const ChoiceGroup = ({
  name,
  legend,
  choices,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  choices: readonly Choice[];
  value?: string;
  onChange: (id: string) => void;
}) => (
  <fieldset>
    <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{legend}</legend>
    <div className="flex flex-wrap gap-2">
      {choices.map((c) => (
        <label key={c.id} className={pillClass(value === c.id)}>
          <input
            type="radio"
            name={name}
            value={c.id}
            checked={value === c.id}
            onChange={() => onChange(c.id)}
            className="sr-only"
          />
          {c.label}
        </label>
      ))}
    </div>
  </fieldset>
);

/**
 * 견적 요청서 — 마켓(크몽·숨고)의 "요청서 → 즉시 견적"을 사이트가 대신한다(전략 축 A).
 *
 * **카톡과 경쟁하지 않고 카톡 앞단에 붙는다.** 결과 버튼은 요약과 견적 코드를 클립보드에 복사한 뒤
 * 카카오톡을 연다 — 이름·연락처를 받지 않으므로 여기서 개인정보가 생기지 않는다. 견적 코드는
 * 카톡으로 넘어온 요약과 분석 이벤트(lead_click_kakao의 quote_code)를 짝짓는 용도다.
 * 온라인 결제가 되는 상품이면 예약 링크도 함께 낸다(노란 버튼은 카톡에만 — 카카오 배색 규칙).
 */
const QuoteWizard = ({ kakaoUrl }: QuoteWizardProps) => {
  const [answers, setAnswers] = React.useState<QuoteAnswers>({});
  const [code, setCode] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    setCode(makeQuoteCode((n) => crypto.getRandomValues(new Uint8Array(n))));
  }, []);

  const update = (patch: Partial<QuoteAnswers>) => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackMicroEvent('micro_quote_start', { locale: 'ko', component: 'QuoteWizard' });
    }
    setCopied(false);
    setAnswers((prev) => ({ ...prev, ...patch }));
  };

  const chooseService = (service: QuoteService) =>
    // 서비스를 바꾸면 규모·준비 상태·제작비 답은 의미가 달라지므로 비운다(시기는 유지).
    update({ service, scale: undefined, readiness: undefined, fundingSource: undefined });

  const scaleQ = scaleQuestionFor(answers.service);
  const asksReadiness = answers.service ? READINESS_SERVICES.includes(answers.service) : false;
  const est = estimate(answers);
  const summary = est && code ? buildQuoteSummary(answers, est, code) : '';

  const onKakao = () => {
    trackLeadEvent('lead_click_kakao', {
      locale: 'ko',
      component: 'QuoteWizard',
      cta_id: 'quote_kakao',
      quote_code: code,
      quote_service: answers.service ?? '',
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
    <div className="glass-card rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto space-y-8">
      <ChoiceGroup
        name="quote-service"
        legend="1. 무엇이 필요하세요?"
        choices={SERVICE_CHOICES}
        value={answers.service}
        onChange={(id) => chooseService(id as QuoteService)}
      />

      {scaleQ && (
        <ChoiceGroup
          name="quote-scale"
          legend={`2. ${scaleQ.question}`}
          choices={scaleQ.choices}
          value={answers.scale}
          onChange={(scale) => update({ scale })}
        />
      )}

      {asksReadiness && (
        <ChoiceGroup
          name="quote-readiness"
          legend="3. 지금 어디까지 준비돼 있나요?"
          choices={READINESS_CHOICES}
          value={answers.readiness}
          onChange={(readiness) => update({ readiness })}
        />
      )}

      {answers.service === 'release' && (
        <ChoiceGroup
          name="quote-funding-source"
          legend="4. 제작비는 어떻게 마련하실 생각인가요?"
          choices={FUNDING_SOURCE_CHOICES}
          value={answers.fundingSource}
          onChange={(fundingSource) => update({ fundingSource })}
        />
      )}

      {answers.service && (
        <ChoiceGroup
          name="quote-timing"
          legend="언제쯤 시작하고 싶으세요?"
          choices={TIMING_CHOICES}
          value={answers.timing}
          onChange={(timing) => update({ timing })}
        />
      )}

      <div aria-live="polite">
        {est ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">예상 비용</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {est.priceLabel}
                <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">{VAT_NOTE[est.vat]}</span>
              </p>
            </div>
            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
              {est.basis.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              실제 금액은 곡 상태와 작업량을 보고 상담에서 확정합니다. 견적 코드 <strong className="tabular-nums">{code}</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="kakao" shape="pill" size="lg">
                <a
                  href={kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onKakao}
                  className="w-full sm:w-auto h-auto min-h-[48px] py-4 px-8 text-base text-center whitespace-normal leading-snug font-bold touch-manipulation"
                >
                  <MessageCircle className="w-5 h-5" aria-hidden="true" />
                  요약 복사하고 카카오톡으로 보내기
                </a>
              </Button>
              {est.bookingHref && (
                <Button asChild variant="outline" shape="pill" size="lg">
                  <Link
                    href={est.bookingHref}
                    prefetch={false}
                    onClick={() =>
                      trackMicroEvent('micro_click_booking_entry', { locale: 'ko', component: 'QuoteWizard', cta_id: 'quote_booking' })
                    }
                    className="w-full sm:w-auto h-auto min-h-[48px] py-4 px-8 text-base text-center whitespace-normal leading-snug font-bold"
                  >
                    바로 예약·결제하기
                  </Link>
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400" role="status">
              {copied
                ? '요약을 복사했어요. 카카오톡 대화창에 붙여 넣어 보내 주세요.'
                : '버튼을 누르면 위 답변과 견적 코드가 복사되고 카카오톡이 열립니다. 이름·연락처는 받지 않습니다.'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">질문에 답하시면 여기에 예상 비용이 바로 나옵니다.</p>
        )}
      </div>
    </div>
  );
};

export default QuoteWizard;
