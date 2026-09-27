import type { DocumentView } from "@refrata/client";
import {
  presetRefLabel,
  presetShownAttributes,
  type AttributeKey,
  type Document,
  type ValuePreset,
} from "@refrata/core";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FamilyLines } from "@/inspector/fields/family-lines";
import { useCommand } from "@/lib/client";

import { PresetAimLine, PresetLine } from "./preset-line";

/** The lines of one row ref of a Preset, grouped by family, `pan` and `tilt` as one Aim line. */
export function PresetLines({
  view,
  document,
  preset,
  rowRef,
  attributes,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly preset: ValuePreset;
  readonly rowRef: string;
  readonly attributes: readonly AttributeKey[];
}) {
  return (
    <FamilyLines
      attributes={attributes}
      aim={() => (
        <PresetAimLine
          view={view}
          document={document}
          preset={preset}
          rowRef={rowRef}
        />
      )}
      line={(attribute) => (
        <PresetLine
          view={view}
          document={document}
          preset={preset}
          rowRef={rowRef}
          attribute={attribute}
        />
      )}
    />
  );
}

/** A Preset's Elements in order, each with a cross to take it out, as a Layer lists its Targets. */
export function ElementList({
  view,
  document,
  preset,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly preset: ValuePreset;
}) {
  const command = useCommand(view);
  return (
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-px" aria-label="Elements">
      {preset.elements.map((element) => {
        const label = presetRefLabel(document, element);
        return (
          <li
            key={element}
            className="flex h-6 items-center gap-1 rounded-sm pl-1 text-xs hover:bg-sidebar-accent/60"
          >
            <span className="min-w-0 flex-1 truncate" title={element}>
              {label}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${label}`}
              onClick={() =>
                void command("preset.elements.remove", {
                  presetId: preset.id,
                  refs: [element],
                })
              }
            >
              <X />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

/** One Element's block: its label as a collapsible header with how many rows it holds, then one line per Attribute it has. */
export function ElementBlock({
  view,
  document,
  preset,
  element,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly preset: ValuePreset;
  readonly element: string;
}) {
  const [open, setOpen] = useState(true);
  const attributes = presetShownAttributes(document, preset, element);
  const count = Object.keys(preset.rows[element] ?? {}).length;
  const label = presetRefLabel(document, element);
  return (
    <section className="border-t">
      <div className="flex h-7 items-center gap-1 pr-2 pl-2">
        <button
          type="button"
          aria-expanded={open}
          className="flex h-full min-w-0 flex-1 items-center gap-1 text-xs hover:text-foreground"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronDown className="size-3 shrink-0" />
          ) : (
            <ChevronRight className="size-3 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
            {count === 0 ? "released" : `${String(count)} set`}
          </span>
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5 px-3 pt-0.5 pb-3">
          {attributes.length === 0 ? (
            <p className="text-[0.6875rem]/relaxed text-muted-foreground">
              Nothing here has a Parameter.
            </p>
          ) : (
            <PresetLines
              view={view}
              document={document}
              preset={preset}
              rowRef={element}
              attributes={attributes}
            />
          )}
        </div>
      )}
    </section>
  );
}
