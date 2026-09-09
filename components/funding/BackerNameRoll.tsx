export default function BackerNameRoll({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">함께한 후원자</h2>
      <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">{names.join(' · ')}</p>
    </div>
  );
}
