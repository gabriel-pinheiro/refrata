import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A labelled control, the label above it, so a form reads the same in the inspector and in the centre. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1", className)}>
      <span className="truncate text-[0.6875rem] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint !== undefined && (
        <span className="text-[0.625rem]/snug text-muted-foreground/80">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Fields side by side, wrapping to as many columns as fit. */
export function FieldGrid({
  min = "7rem",
  children,
}: {
  readonly min?: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      className="grid gap-x-3 gap-y-2"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

/** A titled block of an editor, with room for buttons at the right of its title. */
export function Block({
  title,
  actions,
  children,
}: {
  readonly title: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-2 border-t px-3 py-3 first:border-t-0">
      <div className="flex min-h-5 items-center gap-2">
        <h4 className="min-w-0 flex-1 truncate text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </h4>
        {actions}
      </div>
      {children}
    </section>
  );
}
