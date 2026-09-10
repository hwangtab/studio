export default function FundingMobileCta({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95">
      <a href="#rewards" className="flex h-14 w-full items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-md">
        후원하기
      </a>
    </div>
  );
}
