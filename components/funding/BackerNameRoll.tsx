export default function BackerNameRoll({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="typo-card-subtitle text-gray-900 dark:text-white">함께한 후원자</h2>
      <p className="typo-card-body mt-3 leading-7">{names.join(' · ')}</p>
    </div>
  );
}
