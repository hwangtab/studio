import { Button } from '../ui/Button';

/**
 * 모바일(<lg) 하단 고정 "펀딩하기" 바. **결제 화면을 바로 연다**(onOpen — 리워드 없이 연 결제
 * 모달). 예전엔 `#rewards`로 스크롤만 해서, 리워드 목록이 긴 본문 끝에 있는 모바일에서는
 * 한참 내려간 뒤 카드를 다시 골라야 했다(2026-09-29 통일 — 모든 "펀딩하기"는 같은 결제 화면).
 *
 * 진짜 링크(/pledge)로 둔다 — 자바스크립트가 죽으면 모달 대신 그 페이지로 간다. 공용 Button을
 * 써서 모달·결제 화면의 고정 버튼과 크기·모서리·포커스 표시를 맞춘다.
 */
export default function FundingMobileCta({ visible, href, onOpen }: { visible: boolean; href: string; onOpen: () => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95">
      <Button asChild size="lg" fullWidth>
        <a
          href={href}
          onClick={(e) => {
            // 새 탭 열기(⌘·Ctrl·가운데 클릭)는 그대로 둔다.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onOpen();
          }}
        >
          펀딩하기
        </a>
      </Button>
    </div>
  );
}
