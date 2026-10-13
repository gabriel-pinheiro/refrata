import { cn } from "@/lib/utils";

/** A line of a list that opens something; `selected` marks the one that is picked. */
export const listRow = (selected: boolean): string =>
  cn(
    "flex min-h-8 w-full min-w-0 cursor-default flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-left text-xs hover:bg-muted/40",
    selected && "bg-accent/60 shadow-[inset_2px_0_0_var(--selection)]",
  );

export const LIST_HEAD =
  "flex h-6 items-center gap-3 border-b px-3 text-[0.625rem] font-medium tracking-wider text-muted-foreground/80 uppercase";
