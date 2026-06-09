// Shared stat card. Mono tabular value, uppercase mono label (dev-tool aesthetic).
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
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold num ${className}`}>{value}</div>
    </div>
  );
}
