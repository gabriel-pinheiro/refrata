import type { DocumentView } from "@refrata/client";
import {
  ALL_TARGETS_LABEL,
  ALL_TARGETS_REF,
  ATTRIBUTES,
  isAllTargetsRef,
  linkAt,
  presetRowValues,
  resolveAddress,
  rowAddress,
  rowRefLabel,
  settings,
  storedRow,
  type AddressValue,
  type AttributeKey,
  type Document,
  type LookLayer,
} from "@refrata/core";

import { Checkbox } from "@/components/ui/checkbox";
import { Control } from "@/inspector/fields/address-row";
import { LinkMenu } from "@/inspector/fields/link-menu";
import { LinkedControl, linkSource } from "@/inspector/fields/link-row";
import { PresetEntries, shownEntries } from "@/inspector/fields/preset-entries";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand } from "@/lib/client";
import { useLatestWins } from "@/lib/use-latest-wins";
import { cn } from "@/lib/utils";

/**
 * One line of a Look Layer for one row ref (a Target, or All Targets): the
 * Control checkbox, the Attribute, then the Control when the row exists (or
 * the Controller driving it) and its Link menu. The control wraps under
 * the label when the inspector is too narrow to give it a usable width. A
 * Target's line with no row of its own says when an All Targets row reaches
 * it, and one with its own row that it overrides All Targets. A row a
 * Preset drives lists under it what each Element takes from the Preset.
 */
export function LookLine({
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
  const linked = linkSource(links) !== undefined;
  const present = row !== undefined || linked;
  const shared = isAllTargetsRef(rowRef)
    ? undefined
    : (storedRow(layer, ALL_TARGETS_REF, attribute) ??
      linkAt(document, rowAddress(layer.id, ALL_TARGETS_REF, attribute)));
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
            "min-w-16 shrink-0 text-xs whitespace-nowrap",
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
      {resolved !== undefined && links?.preset !== undefined && (
        <div className="basis-full pl-5">
          <PresetEntries
            label={label}
            entries={shownEntries(
              resolved,
              presetRowValues(document, layer, rowRef, attribute, links.preset),
            )}
          />
        </div>
      )}
    </div>
  );
}
