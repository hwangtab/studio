import { useCallback, useEffect, useRef, useState } from 'react';

import PledgeWizard from './PledgeWizard';
import ResponsiveImage from '../ResponsiveImage';
import { formatPriceAmount } from '../../data/pricing';
import type { FundingProject, FundingReward } from '../../lib/funding/projects';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollLock';
import { useFocusTrapDialog } from '../../utils/useFocusTrapDialog';

interface Props {
  project: FundingProject;
  reward: FundingReward | null;
  remaining: Record<string, number | null>;
  onClose: () => void;
}

const stockLabel = (remaining: number | null): string =>
  remaining === null ? '수량 제한 없음' : remaining > 0 ? `${remaining}개 남음` : '품절';

/**
 * 리워드 카드를 누르면 뜨는 모달. 1단계는 리워드 상세, 2단계가 후원 폼·결제다.
 *
 * 폼과 결제는 `/ko/funding/[slug]/pledge` 페이지와 **같은 `PledgeWizard`를 렌더한다** —
 * 약관 동의와 `terms_version` 기록이 한 벌로 유지되도록 복제하지 않는다. 카드는 여전히
 * 진짜 링크라서, JS가 죽으면 모달 없이 그 페이지로 이동한다.
 */
export default function RewardModal({ project, reward, remaining, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<'detail' | 'pledge'>('detail');

  const isOpen = reward !== null;

  // 리워드가 바뀌면 항상 상세부터 다시 시작한다.
  useEffect(() => {
    if (reward) setStep('detail');
  }, [reward]);

  /**
   * 트랩은 모달이 열려 있는 동안 계속 켜 둔다.
   *
   * 예전에는 결제 단계에서 껐다 — 결제위젯 iframe이 트랩의 포커스 대상 목록에 없어서,
   * 켜 둔 채로는 키보드 사용자가 카드번호 칸에 못 들어갔기 때문이다. 지금은 그 목록에
   * `iframe`을 넣어(utils/useFocusTrapDialog.ts) 원인 쪽을 고쳤다. 트랩을 끄면 Tab이
   * 모달 뒤 배경으로 새어 나간다.
   */
  const { restoreFocus } = useFocusTrapDialog({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    // 되돌리는 시점은 모달이 실제로 닫힐 때다 — 아래 close()가 직접 부른다.
    restoreOnCleanup: false,
  });

  const close = useCallback(() => {
    restoreFocus();
    onClose();
  }, [onClose, restoreFocus]);

  // Escape는 트랩과 무관하게 항상 받는다 — 위 훅에 onClose를 넘기면 결제 단계에서
  // 트랩이 꺼질 때 닫기까지 함께 사라진다.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  if (!reward) return null;

  const left = remaining[reward.id] ?? reward.totalQuantity;
  const soldOut = left !== null && left <= 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="reward-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-gray-50 shadow-2xl sm:rounded-2xl dark:bg-gray-900"
      >
        <div className="glass-bar sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <p className="typo-card-meta truncate">
            {step === 'detail' ? '리워드' : '후원하기'} · {project.title}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="닫기"
            className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:text-gray-300 dark:focus-visible:ring-primary-lighter/70 dark:hover:bg-gray-700"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-5 sm:p-6">
          {step === 'detail' ? (
            <div>
              {reward.image && (
                <ResponsiveImage
                  src={reward.image}
                  alt=""
                  containerClassName="relative mb-5 block aspect-[4/3] w-full overflow-hidden rounded-xl"
                  className="object-cover"
                />
              )}
              <p className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
                {formatPriceAmount(reward.amount)}원
              </p>
              <h2 id="reward-modal-title" className="typo-card-title mt-2 text-gray-900 dark:text-white">
                {reward.title}
              </h2>
              <p className="typo-card-body mt-4 whitespace-pre-line">{reward.description}</p>
              <ul className="typo-card-meta mt-6 space-y-1 border-t border-gray-200/70 pt-4 dark:border-gray-700/70">
                <li>예상 전달: {reward.estimatedDelivery}</li>
                <li>{stockLabel(left)}</li>
                {reward.requiresShipping && <li>배송지를 입력받습니다.</li>}
              </ul>
              <button
                type="button"
                disabled={soldOut}
                onClick={() => setStep('pledge')}
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-xl bg-primary px-8 text-lg font-bold text-white shadow-md transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
              >
                {soldOut ? '품절' : '이 리워드로 후원하기'}
              </button>
            </div>
          ) : (
            <>
              <h2 id="reward-modal-title" className="sr-only">
                {reward.title} 후원하기
              </h2>
              <PledgeWizard
                project={project}
                initialRewardId={reward.id}
                remaining={remaining}
                // 카드를 눌러 이미 고르고 들어왔다. 여기서 또 고르게 하지 않는다.
                lockedReward
                // 모달 본문이 자체 스크롤 컨테이너라 sticky 요약이 폼 위로 떠 겹친다.
                stickySummary={false}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
