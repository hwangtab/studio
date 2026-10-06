import { refundFootnotes, refundLines, type ShowLocale } from '../../lib/shows/i18n';

/** 취소환불표 — 예매 폼과 티켓 관리 화면이 함께 쓴다. */
export default function RefundPolicyList({ className = '', locale = 'ko' }: { className?: string; locale?: ShowLocale }) {
  return (
    <div className={className}>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
        {refundLines(locale).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-500 dark:text-gray-400">
        {refundFootnotes(locale).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
