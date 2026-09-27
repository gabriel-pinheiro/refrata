import type { DocumentView } from "@refrata/client";
import {
  ALL_TARGETS_REF,
  layerAttributes,
  rowRefLabel,
  targetAttributes,
  type AttributeKey,
  type Document,
  type LookLayer,
} from "@refrata/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { FamilyLines } from "@/inspector/fields/family-lines";

import { AimLine } from "./aim-line";
import { LookLine } from "./look-line";
import { SetTargetMembers } from "./set-target-members";

/** Lines for `attributes` grouped under family captions, for one row ref; `pan` and `tilt` together are one Aim line. */
function RowLines({
  view,
  document,
  layer,
  attributes,
  rowRef,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly attributes: readonly AttributeKey[];
  readonly rowRef: string;
}) {
  return (
    <FamilyLines
      attributes={attributes}
      aim={() => (
        <AimLine
          view={view}
          document={document}
          layer={layer}
          rowRef={rowRef}
        />
      )}
      line={(attribute) => (
        <LookLine
          view={view}
          document={document}
          layer={layer}
          rowRef={rowRef}
          attribute={attribute}
        />
      )}
    />
  );
}

/** The "All Targets" lines: one per Attribute found across the Targets, each the Layer's own row that every Target takes unless it has its own. */
export function AllTargetsRows({
  view,
  document,
  layer,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
}) {
  const attributes = layerAttributes(document, layer);
  if (attributes.length === 0)
    return (
      <p className="text-[0.6875rem]/relaxed text-muted-foreground">
        No Targets yet. Add some above.
      </p>
    );
  return (
    <RowLines
      view={view}
      document={document}
      layer={layer}
      attributes={attributes}
      rowRef={ALL_TARGETS_REF}
    />
  );
}

/** One Target's block: its label as a collapsible header, a Set's members to override, then one line per Attribute it has. */
export function TargetBlock({
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
  const [open, setOpen] = useState(true);
  const attributes = targetAttributes(document, target);
  const count = Object.keys(layer.rows[target] ?? {}).length;
  return (
    <section className="border-t">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-7 w-full items-center gap-1 px-2 text-xs hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {rowRefLabel(document, target)}
        </span>
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
          {count === 0 ? "released" : `${String(count)} set`}
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5 px-3 pt-0.5 pb-3">
          <SetTargetMembers
            view={view}
            document={document}
            layer={layer}
            target={target}
          />
          {attributes.length === 0 ? (
            <p className="text-[0.6875rem]/relaxed text-muted-foreground">
              Nothing here has a Parameter.
            </p>
          ) : (
            <RowLines
              view={view}
              document={document}
              layer={layer}
              attributes={attributes}
              rowRef={target}
            />
          )}
        </div>
      )}
    </section>
  );
}
