// Shared stat card. Server component (no client state).
export function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-3">
      <div className="text-xs opacity-60">{label}</div>
      <div className={`text-xl font-bold ${className}`}>{value}</div>
    </div>
  );
}
