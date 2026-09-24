import { ChevronDown, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EntityKind } from "@/entities";
import { isBoolean, useStoredState } from "@/lib/storage";
import { useSelection } from "@/selection/selection";

import { NavigatorEmptyRow, type CreateItem } from "./navigator-row";

/**
 * Collapsible group of rows with a create button; the open state is
 * remembered per browser, starting from `defaultExpanded`. A collapsed
 * section still shows while the latest selected item is an entity of a kind
 * it `holds`, so a created or chip-selected entity is never hidden; that
 * reveal is not remembered, and collapsing by hand hides it again until the
 * selection moves. A collapsed section with `warnings` shows an amber mark
 * on its header, so a row's warning is never hidden without a hint.
 */
export function NavigatorSection({
  storageKey,
  label,
  holds,
  defaultExpanded = true,
  empty,
  warnings = 0,
  onCreate,
  createItems,
  children,
}: {
  readonly storageKey: string;
  readonly label: string;
  /** Entity kinds whose rows live in this section, its own and nested ones. */
  readonly holds: readonly EntityKind[];
  readonly defaultExpanded?: boolean | undefined;
  /** Shown in place of rows while the section has none. */
  readonly empty?: string | undefined;
  /** How many rows inside would show a warning; marked on the header while collapsed. */
  readonly warnings?: number | undefined;
  readonly onCreate?: (() => void) | undefined;
  /** Several kinds of entries: the "+" opens a menu of these instead. */
  readonly createItems?: readonly CreateItem[] | undefined;
  readonly children: ReactNode;
}) {
  const [stored, setStored] = useStoredState(
    `refrata.navigator.${storageKey}`,
    defaultExpanded,
    isBoolean,
  );
  const revealing = useRevealFor(holds);
  const expanded = stored || revealing.active;
  const setExpanded = (next: boolean): void => {
    setStored(next);
    if (!next) revealing.dismiss();
  };
  return (
    <section>
      <div className="flex h-6 items-center pr-1 pl-2">
        <button
          type="button"
          aria-expanded={expanded}
          className="flex h-full min-w-0 flex-1 items-center gap-1 text-[0.625rem] font-medium tracking-wider text-muted-foreground/80 uppercase hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <span className="truncate">{label}</span>
        </button>
        {!expanded && warnings > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="mr-1 grid size-5 shrink-0 place-items-center text-amber-300"
                  data-testid="section-warnings"
                />
              }
            >
              <TriangleAlert aria-hidden className="size-3" />
              <span className="sr-only">{attentionText(warnings)}</span>
            </TooltipTrigger>
            <TooltipContent>{attentionText(warnings)}</TooltipContent>
          </Tooltip>
        )}
        {onCreate !== undefined && (
          <button
            type="button"
            aria-label={`Add to ${label}`}
            title={`Add to ${label}`}
            className={createButtonClass}
            onClick={onCreate}
          >
            <Plus className="size-3" />
          </button>
        )}
        {createItems !== undefined && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Add to ${label}`}
              title={`Add to ${label}`}
              className={createButtonClass}
            >
              <Plus className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {createItems.map((item) => (
                <DropdownMenuItem key={item.label} onClick={item.onSelect}>
                  <item.icon /> {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {expanded &&
        (empty === undefined ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-px">
            {children}
          </div>
        ) : (
          <NavigatorEmptyRow>{empty}</NavigatorEmptyRow>
        ))}
    </section>
  );
}

/**
 * Whether the latest selected item is an entity of a kind in `holds` that
 * has not been dismissed by collapsing the section; a new selection clears
 * the dismissal.
 */
function useRevealFor(holds: readonly EntityKind[]): {
  readonly active: boolean;
  readonly dismiss: () => void;
} {
  const { selected } = useSelection();
  const latest = selected.at(-1);
  const key =
    latest !== undefined &&
    latest.kind !== "installation" &&
    holds.includes(latest.kind)
      ? `${latest.kind}:${latest.id}`
      : undefined;
  const [dismissed, setDismissed] = useState<string | undefined>(undefined);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setDismissed(undefined);
  }
  return {
    active: key !== undefined && key !== dismissed,
    dismiss: () => setDismissed(key),
  };
}

/** "1 row needs attention", "3 rows need attention". */
export function attentionText(count: number): string {
  return count === 1
    ? "1 row needs attention"
    : `${String(count)} rows need attention`;
}

const createButtonClass =
  "grid size-5 place-items-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";
