import { useCallback, useEffect, useRef, useState } from 'react';

import PledgeWizard from './PledgeWizard';
import { Button } from '../ui/Button';
import ResponsiveImage from '../ResponsiveImage';
import { formatPriceAmount } from '../../data/pricing';
import type { FundingProject, FundingReward } from '../../lib/funding/projects';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/scrollLock';
import { useFocusTrapDialog } from '../../utils/useFocusTrapDialog';
import { imageAspectRatio } from '../../lib/funding/imageAspect';
import { trackMicroEvent } from '../../utils/analytics';
import { X } from '@/lib/lucide-icons';

interface Props {
  project: FundingProject;
  reward: FundingReward | null;
  /**
   * 리워드 없이 **결제 화면으로 바로** 연다. 하단 고정 바·히어로의 "펀딩하기"가 쓴다 —
   * 예전엔 그 버튼들이 리워드 목록으로 스크롤만 해서, 모바일에서는 긴 본문 끝까지 내려간 뒤
   * 카드를 다시 골라야 했다. 모든 "펀딩하기"가 같은 결제 화면에 닿게 한다(2026-09-29 통일).
   * 담은 것 없이 시작하므로 PledgeWizard가 리워드 목록을 펼쳐 보인다.
   */
  checkout?: boolean;
  remaining: Record<string, number | null>;
  onClose: () => void;
}

const stockLabel = (remaining: number | null): string =>
  remaining === null ? '수량 제한 없음' : remaining > 0 ? `${remaining}개 남음` : '품절';

/**
 * 리워드 카드를 누르면 뜨는 모달. 1단계는 리워드 상세, 2단계가 후원 폼·결제다.
 *
 * 2단계는 **누른 리워드로 시작하되 요약만 보인다**(2026-10-04, 되돌림) — 다른 리워드는
 * "다른 리워드 보기"로 접어 두고, 펼치면 라디오로 바꿀 수 있다(PledgeWizard.tsx의
 * lockedReward). 2026-09-28~10-04 사이 "담기"로 여러 리워드를 한 주문에 **더할** 수 있게
 * 열어 둔 적이 있는데, 그 기간 실제 결제 완료 12건이 전부 리워드 1개였다 — "두 리워드를
 * 원하는 사람" 문제가 그 볼륨에서는 실재하지 않았다. 여러 개를 더하는 "담기" 자체를
 * 되돌렸을 뿐, 다른 선택지를 보는 길은 남겨 둔다 — 완전히 숨기면 바꾸려고 모달을 닫고
 * 다른 카드를 눌러야 해서 불편하다.
 *
 * 리워드 없이 연 결제 화면(`checkout`, 하단 바·히어로의 "펀딩하기")은 펼친 상태로 시작한다
 * — 아직 고른 것이 없으므로 라디오 목록이 바로 보인다.
 *
 * 폼과 결제는 `/ko/funding/[slug]/pledge` 페이지와 **같은 `PledgeWizard`를 렌더한다** —
 * 약관 동의와 `terms_version` 기록이 한 벌로 유지되도록 복제하지 않는다. 카드는 여전히
 * 진짜 링크라서, JS가 죽으면 모달 없이 그 페이지로 이동한다.
 */
export default function RewardModal({ project, reward, checkout = false, remaining, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<'detail' | 'pledge'>('detail');

  const isOpen = reward !== null || checkout;

  // 리워드가 바뀌면 상세부터, 결제 화면으로 바로 연 경우는 결제부터 시작한다.
  // effect가 아니라 **렌더 중에** 맞춘다 — effect는 첫 렌더 뒤에 돌아서, 모달을 닫았다 다른
  // 리워드로 다시 열 때 이전 단계('pledge')가 한 프레임 그려지며 결제폼이 마운트됐다 사라졌다.
  const stepKey = reward ? `reward:${reward.id}` : checkout ? 'checkout' : null;
  const [stepKeyState, setStepKeyState] = useState<string | null>(stepKey);
  let currentStep = step;
  if (stepKey !== stepKeyState) {
    setStepKeyState(stepKey);
    if (stepKey !== null) {
      currentStep = reward ? 'detail' : 'pledge';
      setStep(currentStep);
    }
  }

  /**
   * 단계가 바뀌면 본문 스크롤을 맨 위로 되돌린다. 본문(`bodyRef`)은 두 단계가 같은 스크롤
   * 컨테이너를 쓰므로, 상세에서 내려 둔 위치가 폼으로 그대로 넘어가 폼의 맨 위(담은 리워드)가
   * 잘린 채 시작했다 — 후원자가 다시 위로 올려야 했다(2026-09-29 운영자 지적).
   */
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [step, reward, checkout]);

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

  if (!isOpen) return null;

  const left = reward ? remaining[reward.id] ?? reward.totalQuantity : null;
  const soldOut = left !== null && left <= 0;
  // 리워드 없이 연 결제 화면은 상세 단계가 없다.
  const showDetail = reward !== null && currentStep === 'detail';

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
            {showDetail ? '리워드' : '펀딩하기'} · {project.title}
          </p>
          {/* 닫기는 공용 Modal 셸과 같은 버튼(ghost · icon · pill · lucide X). 셸 자체를 Modal로
              바꾸지 않은 이유는 이 모달만의 계약 때문이다 — 대화상자 이름은 본문 안 리워드 제목
              (aria-labelledby="reward-modal-title")이고, 머리 글줄은 제목이 아니라 보조 문구이며,
              포커스 복원 시점을 close()가 직접 쥔다(restoreOnCleanup: false). */}
          <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" shape="pill" onClick={close} aria-label="닫기">
            <X size={20} aria-hidden="true" />
          </Button>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {showDetail && reward ? (
            <div>
              {reward.image && (
                <ResponsiveImage
                  src={reward.image}
                  alt=""
                  containerClassName="relative mb-5 block w-full overflow-hidden rounded-xl"
                  containerStyle={{ aspectRatio: imageAspectRatio(reward.image) ?? '4 / 3' }}
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
                {reward.requiresShipping && <li>배송지를 입력받아요.</li>}
              </ul>
            </div>
          ) : (
            <>
              <h2 id="reward-modal-title" className="sr-only">
                {reward ? `${reward.title} 펀딩하기` : `${project.title} 펀딩하기`}
              </h2>
              <PledgeWizard
                project={project}
                // 누른 리워드로 시작한다. 리워드 없이 열었으면(checkout) 라디오로 고른다.
                initialRewardId={reward?.id ?? null}
                // 카드를 눌러 들어왔으면 그 리워드로 시작한다(요약으로 접힌 채) — 리워드 없이 연
                // 결제 화면은 처음부터 펼친다.
                lockedReward={reward !== null}
                remaining={remaining}
                // 결제 버튼 바를 모달 본문 바닥에 붙인다 — 상세 단계의 고정 바와 같은 모양.
                layout="modal"
              />
            </>
          )}
        </div>

        {/*
          상세 단계의 펀딩 버튼은 **본문 밖, 모달 바닥에 고정**한다. 본문 안에 두었을 때는 이미지
          (책 표지는 세로로 길다)와 설명 아래로 밀려 모바일에서 화면 밖에 있었다 — iPhone 13에서
          버튼 위쪽이 822~1,099px, 화면 높이 664px(2026-09-29 실측). 금액을 함께 적어 무엇을
          누르는지 버튼만 보고도 알게 한다.
        */}
        {showDetail && reward && (
          <div className="border-t border-gray-200 bg-gray-50 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 dark:border-gray-700 dark:bg-gray-900">
            <Button
              type="button"
              size="lg"
              fullWidth
              disabled={soldOut}
              onClick={() => {
                setStep('pledge');
                // 후원 폼 진입 — /pledge 페이지와 같은 이벤트. 예전엔 페이지에서만 쏴서, 대부분이
                // 거치는 이 모달 경로가 GA 퍼널에서 빠져 있었다.
                trackMicroEvent('funding_pledge_start', { component: 'funding_reward_modal', landing_slug: project.slug });
              }}
            >
              {soldOut ? '품절' : `${formatPriceAmount(reward.amount)}원 · 펀딩하기`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
