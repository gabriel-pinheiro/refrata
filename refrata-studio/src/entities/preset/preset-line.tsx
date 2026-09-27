import type { DocumentView } from "@refrata/client";
import {
  ALL_ELEMENTS_LABEL,
  ALL_TARGETS_REF,
  ATTRIBUTES,
  isAllTargetsRef,
  presetRefLabel,
  presetRowAddress,
  presetRowReach,
  presetStoredRow,
  resolveAddress,
  settings,
  type AddressValue,
  type AttributeKey,
  type Document,
  type ValuePreset,
} from "@refrata/core";

import { Checkbox } from "@/components/ui/checkbox";
import { Control } from "@/inspector/fields/address-row";
import type { AimValue } from "@/inspector/fields/aim-nudge";
import { AimControl, type AimAxis } from "@/inspector/fields/aim-row";
import { LinkMenu } from "@/inspector/fields/link-menu";
import { LinkedControl, linkSource } from "@/inspector/fields/link-row";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand } from "@/lib/client";
import { useLatestWins } from "@/lib/use-latest-wins";
import { cn } from "@/lib/utils";

const AIM_AXES = ["pan", "tilt"] as const satisfies readonly AttributeKey[];

interface LineProps {
  readonly view: DocumentView;
  readonly document: Document;
  readonly preset: ValuePreset;
  /** An Element of the Preset, or the All Elements ref. */
  readonly rowRef: string;
}

/** "from all" on a line the All Elements row reaches, "overrides all" on one that has its own. */
function SharedNote({
  present,
  noun,
}: {
  readonly present: boolean;
  readonly noun: string;
}) {
  return (
    <span
      className="shrink-0 text-[0.625rem] text-muted-foreground/70 italic"
      title={
        present
          ? `This ${noun} overrides the ${ALL_ELEMENTS_LABEL} ${noun}`
          : `The ${ALL_ELEMENTS_LABEL} ${noun} reaches this Element`
      }
    >
      {present ? "overrides all" : "from all"}
    </span>
  );
}

/**
 * One line of a Preset for one row ref (an Element, or All Elements): the
 * checkbox that ticks the row on or releases it, the Attribute, then the
 * Control when the row exists, or the Controller driving it, and its Link
 * menu. An Element's line says when the All Elements row reaches it or is
 * overridden by it.
 */
export function PresetLine({
  view,
  document,
  preset,
  rowRef,
  attribute,
}: LineProps & { readonly attribute: AttributeKey }) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const row = presetStoredRow(preset, rowRef, attribute);
  const resolved = resolveAddress(
    document,
    presetRowAddress(preset.id, rowRef, attribute),
  );
  const links =
    resolved === undefined
      ? undefined
      : rowLinks(
          resolved,
          `${preset.name} ${presetRefLabel(document, rowRef)} ${resolved.label}`,
        );
  const linked = linkSource(links) !== undefined;
  const present = row !== undefined || linked;
  const shared =
    !isAllTargetsRef(rowRef) &&
    presetStoredRow(preset, ALL_TARGETS_REF, attribute) !== undefined;
  const send = useLatestWins((value: AddressValue) =>
    resolved === undefined
      ? Promise.resolve()
      : command("address.edit", { address: resolved.address, value }),
  );
  const label = ATTRIBUTES[attribute].label;
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="flex items-center gap-1.5">
        <Checkbox
          aria-label={`${label} row`}
          checked={present}
          onCheckedChange={(next) =>
            void command(next ? "preset.row.set" : "preset.row.release", {
              presetId: preset.id,
              elements: [rowRef],
              attribute,
            })
          }
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
        {shared && <SharedNote present={present} noun="row" />}
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

/**
 * A Preset's `pan` and `tilt` rows for one row ref as one Aim line: one
 * checkbox ticks both rows on or releases both with their Links, one undo
 * step either way (`preset.aim.set`, `preset.aim.release`), and the Aim
 * control edits them over their two Addresses as one step, within what the
 * Element can reach.
 */
export function PresetAimLine({ view, document, preset, rowRef }: LineProps) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const axes: Partial<Record<(typeof AIM_AXES)[number], AimAxis>> = {};
  for (const attribute of AIM_AXES) {
    const resolved = resolveAddress(
      document,
      presetRowAddress(preset.id, rowRef, attribute),
    );
    if (resolved === undefined) continue;
    const stored = presetStoredRow(preset, rowRef, attribute)?.value;
    axes[attribute] = {
      resolved,
      value: typeof stored === "number" ? stored : undefined,
      links: rowLinks(
        resolved,
        `${preset.name} ${presetRefLabel(document, rowRef)} ${resolved.label}`,
      ),
      reach: presetRowReach(document, preset, rowRef, attribute),
    };
  }
  const { pan, tilt } = axes;
  const count = [pan, tilt].filter(
    (axis) =>
      axis !== undefined &&
      (axis.value !== undefined || axis.links.link !== undefined),
  ).length;
  const shared =
    !isAllTargetsRef(rowRef) &&
    AIM_AXES.some(
      (axis) => presetStoredRow(preset, ALL_TARGETS_REF, axis) !== undefined,
    );
  const edit = (value: AimValue): Promise<void> =>
    pan === undefined || tilt === undefined
      ? Promise.resolve()
      : command("aim.edit", {
          pan: pan.resolved.address,
          tilt: tilt.resolved.address,
          value,
        });
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="flex items-center gap-1.5 self-start pt-0.5">
        <Checkbox
          aria-label="Aim rows"
          checked={count === 2}
          indeterminate={count === 1}
          onCheckedChange={(next) =>
            void command(next ? "preset.aim.set" : "preset.aim.release", {
              presetId: preset.id,
              elements: [rowRef],
            })
          }
        />
        <span
          className={cn(
            "min-w-16 shrink-0 text-xs whitespace-nowrap",
            count === 0 && "text-muted-foreground",
          )}
          title="Pan and Tilt"
        >
          Aim
        </span>
        {shared && <SharedNote present={count > 0} noun="Aim" />}
      </span>
      {count > 0 && pan !== undefined && tilt !== undefined ? (
        <div
          className="flex min-w-0 flex-1"
          style={{ flexBasis: settings.inspector.controlWrapPx }}
        >
          <AimControl label="Aim" pan={pan} tilt={tilt} onEdit={edit} />
        </div>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );
}
