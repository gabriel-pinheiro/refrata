import type { DocumentView } from "@refrata/client";
import {
  locateSet,
  setMembers,
  targetLabel,
  type Document,
  type LookLayer,
} from "@refrata/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCommand } from "@/lib/client";

/**
 * The live members of a Set Target, closed until asked for. "Override"
 * adds the member as a Target of its own right after the Set, where its
 * rows win over the Set's; a member that already is a Target says so.
 */
export function SetTargetMembers({
  view,
  document,
  layer,
  target,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly target: string;
}) {
  const command = useCommand(view);
  const [open, setOpen] = useState(false);
  const set = locateSet(document, target);
  if (set === undefined) return null;
  const members = setMembers(document, set);
  const targeted = new Set(layer.targets.map((entry) => entry.ref));
  return (
    <div className="grid gap-px">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-5 items-center gap-1 text-[0.625rem] tracking-wider text-muted-foreground/70 uppercase hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        Members ({String(members.length)})
      </button>
      {open &&
        (members.length === 0 ? (
          <p className="text-[0.6875rem]/relaxed text-muted-foreground">
            {set.name} is empty.
          </p>
        ) : (
          <ol className="grid gap-px" aria-label={`Members of ${set.name}`}>
            {members.map((ref) => (
              <li
                key={ref}
                className="flex h-6 items-center gap-1 rounded-sm pl-4 text-xs hover:bg-sidebar-accent/60"
              >
                <span className="min-w-0 flex-1 truncate" title={ref}>
                  {targetLabel(document, ref)}
                </span>
                {targeted.has(ref) ? (
                  <span
                    className="shrink-0 pr-1.5 text-[0.625rem] text-muted-foreground italic"
                    title="Already a Target of this Layer; its block is below"
                  >
                    Target
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    title={`Add ${targetLabel(document, ref)} as a Target after ${set.name}, so its own rows win`}
                    onClick={() =>
                      void command("layer.targets.add", {
                        layerId: layer.id,
                        targets: [ref],
                        after: target,
                      })
                    }
                  >
                    Override
                  </Button>
                )}
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}
