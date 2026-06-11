const STYLES = {
  easy: "bg-easy-bg text-easy",
  medium: "bg-medium-bg text-medium",
  hard: "bg-hard-bg text-hard",
} as const;

const LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const;

type Difficulty = keyof typeof STYLES;

export function DifficultyBadge({ level }: { level: Difficulty }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[level]}`}>
      {LABELS[level]}
    </span>
  );
}
