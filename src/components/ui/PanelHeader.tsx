import type { ReactNode } from "react";

/**
 * A panel's header strip: the channel name on the left — small, uppercase,
 * tracked, in the label grey — and, where the panel has one, its live value or
 * its actions on the right. One hairline under it (`.panel-header` in
 * styles.css). Purely presentational: it renders what it is handed.
 *
 * It is the same strip on every panel that carries one — a dashboard widget,
 * the same widget popped into its own window, and its card in the Manager's
 * preview — so a panel reads the same wherever it is drawn.
 */
export function PanelHeader({
  title,
  children,
  className = "",
}: {
  title: string;
  /** Right-aligned content: a live value, or the panel's actions. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`panel-header ${className}`}>
      <span className="label-caps min-w-0 flex-1 truncate">{title}</span>
      {children}
    </header>
  );
}
