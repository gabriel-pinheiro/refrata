import type { DocumentView } from "@refrata/client";
import {
  ALL_TARGETS_LABEL,
  ALL_TARGETS_REF,
  ATTRIBUTES,
  isAllTargetsRef,
  layerAttributes,
  resolveAddress,
  rowAddress,
  rowRefLabel,
  settings,
  storedRow,
  targetAttributes,
  type AddressValue,
  type AttributeFamily,
  type AttributeKey,
  type Document,
  type LookLayer,
} from "@refrata/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Control } from "@/inspector/fields/address-row";
import { LinkedControl, LinkMenu } from "@/inspector/fields/link-row";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand } from "@/lib/client";
import { useLatestWins } from "@/lib/use-latest-wins";
import { cn } from "@/lib/utils";

const FAMILY_LABELS: Record<AttributeFamily, string> = {
  intensity: "Intensity",
  color: "Color",
  position: "Position",
  beam: "Beam",
  gobo: "Gobo",
  control: "Control",
};

/** Attributes grouped by family, in vocabulary order. */
function byFamily(attributes: readonly AttributeKey[]): readonly {
  readonly family: AttributeFamily;
  readonly keys: AttributeKey[];
}[] {
  const groups: { family: AttributeFamily; keys: AttributeKey[] }[] = [];
  for (const key of attributes) {
    const family = ATTRIBUTES[key].family;
    const last = groups[groups.length - 1];
    if (last?.family === family) last.keys.push(key);
    else groups.push({ family, keys: [key] });
  }
  return groups;
}

/**
 * One line of a Look Layer for one row ref (a Target, or All Targets): the
 * Control checkbox, the Attribute, then the Control when the row exists (or
 * the Controller driving it) and its Link menu. The control wraps under
 * the label when the inspector is too narrow to give it a usable width. A
 * Target's line with no row of its own says when an All Targets row reaches
 * it, and one with its own row that it overrides All Targets.
 */
function LookLine({
  view,
  document,
  layer,
  rowRef,
  attribute,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly rowRef: string;
  readonly attribute: AttributeKey;
}) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const row = storedRow(layer, rowRef, attribute);
  const resolved = resolveAddress(
    document,
    rowAddress(layer.id, rowRef, attribute),
  );
  const links =
    resolved === undefined
      ? undefined
      : rowLinks(
          resolved,
          `${layer.name} ${rowRefLabel(document, rowRef)} ${resolved.label}`,
        );
  const linked = links?.link !== undefined && links.controller !== undefined;
  const present = row !== undefined || linked;
  const shared = isAllTargetsRef(rowRef)
    ? undefined
    : storedRow(layer, ALL_TARGETS_REF, attribute);
  const send = useLatestWins((value: AddressValue) =>
    resolved === undefined
      ? Promise.resolve()
      : command("address.edit", { address: resolved.address, value }),
  );
  const toggle = (on: boolean): void => {
    void command(on ? "layer.row.set" : "layer.row.release", {
      layerId: layer.id,
      targets: [rowRef],
      attribute,
    });
  };
  const label = ATTRIBUTES[attribute].label;
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="flex items-center gap-1.5">
        <Checkbox
          aria-label={`${label} row`}
          checked={present}
          onCheckedChange={(next) => toggle(next)}
        />
        <span
          className={cn(
            "w-16 shrink-0 truncate text-xs",
            !present && "text-muted-foreground",
          )}
          title={label}
        >
          {label}
        </span>
        {shared !== undefined && (
          <span
            className="shrink-0 text-[0.625rem] text-muted-foreground/70 italic"
            title={
              present
                ? `This row overrides the ${ALL_TARGETS_LABEL} row`
                : `The ${ALL_TARGETS_LABEL} row reaches this Target`
            }
          >
            {present ? "overrides all" : "from all"}
          </span>
        )}
      </span>
      {present && resolved !== undefined && links !== undefined ? (
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          style={{ flexBasis: settings.inspector.controlWrapPx }}
        >
          {linked ? (
            <LinkedControl resolved={resolved} links={links} />
          ) : (
            <Control
              resolved={resolved}
              value={row?.value ?? resolved.default ?? 0}
              send={send}
            />
          )}
          <LinkMenu resolved={resolved} links={links} />
        </div>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );
}

/** Lines for `attributes` grouped under family captions, for one row ref. */
function FamilyLines({
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
    <>
      {byFamily(attributes).map((group) => (
        <div key={group.family} className="grid gap-1">
          <span className="text-[0.625rem] tracking-wider text-muted-foreground/70 uppercase">
            {FAMILY_LABELS[group.family]}
          </span>
          {group.keys.map((attribute) => (
            <LookLine
              key={attribute}
              view={view}
              document={document}
              layer={layer}
              rowRef={rowRef}
              attribute={attribute}
            />
          ))}
        </div>
      ))}
    </>
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
    <FamilyLines
      view={view}
      document={document}
      layer={layer}
      attributes={attributes}
      rowRef={ALL_TARGETS_REF}
    />
  );
}

/** One Target's block: its label as a collapsible header, then one line per Attribute it has. */
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
        <div className="grid gap-1.5 px-3 pt-0.5 pb-3">
          {attributes.length === 0 ? (
            <p className="text-[0.6875rem]/relaxed text-muted-foreground">
              Nothing here has a Parameter.
            </p>
          ) : (
            <FamilyLines
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
