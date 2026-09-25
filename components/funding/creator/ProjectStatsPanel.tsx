import { formatPriceAmount } from '../../../data/pricing';
import type { CreatorProjectStats } from '../../../lib/funding/creatorStats';

/**
 * 개설자가 보는 모금 현황 — **집계만** 그린다.
 *
 * 후원자 이름·응원 메시지·연락처·배송지는 이 컴포넌트가 받는 `CreatorProjectStats`에
 * 애초에 없다. 개설자 약관 제8조가 "후원자의 개인정보는 스튜디오가 보유하며, 개설자에게
 * 제공하지 않습니다"라고 적고 있어 그 문장이 바뀌기 전에는 집계가 한계다 —
 * `lib/funding/creatorStats.ts`의 주석 참조.
 *
 * 읽기 전용이다. 편집 화면의 저장 안 한 입력 이탈 가드(`onDirtyChange`)와 아무 관계가 없다.
 */
export function ProjectStatsPanel({ stats }: { stats: CreatorProjectStats }) {
  // 공개 상세(FundingProgress)와 같은 처방 — 막대는 100%에서 멈추고 숫자는 실제 값을 적는다.
  const barPercent = Math.min(100, stats.percent);
  return (
    <section aria-labelledby="creator-stats-heading" className="glass-card mt-8 rounded-2xl p-5">
      <h2 id="creator-stats-heading" className="typo-body font-semibold">모금 현황</h2>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
        {formatPriceAmount(stats.raisedAmount)}원
      </p>
      {/* 후원자 '수'가 아니라 '건수'다 — 집계가 COUNT(*)라 한 사람이 두 번 후원하면 2다
          (components/funding/FundingProgress.tsx와 같은 라벨). */}
      <p className="typo-card-meta mt-2">
        목표 {formatPriceAmount(stats.goalAmount)}원 ·{' '}
        <span className="font-semibold text-primary dark:text-violet-300">{stats.percent}%</span> · {stats.backerCount}건
      </p>
      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-label="펀딩 달성률"
        aria-valuenow={barPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${barPercent}%` }} />
      </div>

      {stats.rewards.length > 0 && (
        <>
          <h3 className="typo-body mt-6 font-semibold">리워드별 판매 수량</h3>
          <ul className="mt-2 space-y-1">
            {stats.rewards.map((r) => (
              <li key={r.rewardId} className="flex items-baseline justify-between gap-3 typo-caption">
                <span className="text-gray-700 dark:text-gray-300">{r.title}</span>
                <span className="tabular-nums text-gray-900 dark:text-gray-100">
                  {r.quantity}개{r.totalQuantity !== null ? ` / ${r.totalQuantity}개` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="typo-caption mt-5 text-gray-500 dark:text-gray-400">
        후원자의 이름·응원 메시지·연락처·배송지는 스튜디오가 보유하며 개설자에게 제공하지 않습니다(개설자 약관 제8조).
      </p>
    </section>
  );
}
