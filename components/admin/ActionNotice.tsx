import React, { useEffect, useRef } from 'react';

import { Notice, type NoticeTone } from '../ui/Notice';

/**
 * 버튼을 누른 뒤의 결과 안내(성공·실패 한 줄). 안내는 페이지 위쪽에 뜨는데 버튼은 대개 아래쪽에 있어서,
 * 화면 밖에 뜬 안내를 못 보고 같은 버튼을 다시 누르는 일이 있었다(2026-10-22 점검 — 계약·제작 계약·구독·펀딩·공연 상세).
 * 문구가 바뀔 때 안내가 화면 밖이면 보이는 자리로 옮긴다. 이미 보이면 움직이지 않는다.
 */
export const ActionNotice = ({ message, tone = 'info', className = 'mb-4' }: { message: string | null | undefined; tone?: NoticeTone; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!message || !el) return;
    const rect = el.getBoundingClientRect();
    // 상단 바(sticky, 56px)에 가려지는 것도 화면 밖으로 본다.
    if ((rect.top < 64 || rect.bottom > window.innerHeight) && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [message]);
  if (!message) return null;
  return (
    <div ref={ref} className={className}>
      <Notice tone={tone} light>
        {message}
      </Notice>
    </div>
  );
};

export default ActionNotice;
