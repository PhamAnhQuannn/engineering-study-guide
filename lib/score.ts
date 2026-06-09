// Shared score → Tailwind color class. Used by the dashboard and progress page.
export function scoreColor(score: number | null): string {
  if (score == null) return "opacity-40";
  if (score < 50) return "text-red-600 dark:text-red-400";
  if (score < 70) return "text-amber-600 dark:text-amber-400";
  if (score < 85) return "text-blue-600 dark:text-blue-400";
  return "text-green-600 dark:text-green-400";
}
