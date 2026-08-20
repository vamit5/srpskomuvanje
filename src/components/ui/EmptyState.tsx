import type { ReactNode } from "react";

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-10 text-center">
      <span className="text-4xl">{emoji}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xs text-sm text-[var(--color-text-muted)]">{description}</p>
      {action}
    </div>
  );
}
