import type { DocumentView } from "@refrata/client";
import {
  ALL_TARGETS_LABEL,
  ALL_TARGETS_REF,
  isAllTargetsRef,
  linkAt,
  presetRowValues,
  resolveAddress,
  rowAddress,
  rowReach,
  rowRefLabel,
  settings,
  storedRow,
  type AttributeKey,
  type Document,
  type LookLayer,
} from "@refrata/core";

import { Checkbox } from "@/components/ui/checkbox";
import type { AimValue } from "@/inspector/fields/aim-nudge";
import { AimControl, type AimAxis } from "@/inspector/fields/aim-row";
import {
  entryText,
  PresetEntries,
  type ShownEntry,
} from "@/inspector/fields/preset-entries";
import { useAimLinks } from "@/inspector/fields/use-aim-links";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand } from "@/lib/client";
import { cn } from "@/lib/utils";

const AIM_AXES = ["pan", "tilt"] as const satisfies readonly AttributeKey[];

/**
 * A Look Layer's `pan` and `tilt` rows for one row ref as one Aim line:
 * one checkbox ticks both rows on (each at its Highlight or Default, as a
 * row's own does) or releases both with their Links, one undo step either
 * way (`layer.aim.set`, `layer.aim.release`), and the Aim control edits
 * them over their two Addresses as one step. Its limits and flags come
 * from the Elements each row is measured against (`rowReach`). A row ticked on alone, from the
 * CLI or an older file, shows the checkbox part-way; ticking it adds the
 * other. An axis a Preset drives lists under the row what each Element
 * takes from it.
 */
export function AimLine({
  view,
  document,
  layer,
  rowRef,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly rowRef: string;
}) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const aimLinks = useAimLinks(view);
  const axes: Partial<Record<(typeof AIM_AXES)[number], AimAxis>> = {};
  for (const attribute of AIM_AXES) {
    const resolved = resolveAddress(
      document,
      rowAddress(layer.id, rowRef, attribute),
    );
    if (resolved === undefined) continue;
    const links = rowLinks(
      resolved,
      `${layer.name} ${rowRefLabel(document, rowRef)} ${resolved.label}`,
    );
    const stored = storedRow(layer, rowRef, attribute)?.value;
    axes[attribute] = {
      resolved,
      value: typeof stored === "number" ? stored : undefined,
      links,
      reach: rowReach(document, layer, rowRef, attribute),
    };
  }
  const { pan, tilt } = axes;
  const owner = `${layer.name} ${rowRefLabel(document, rowRef)}`;
  const pair =
    pan === undefined || tilt === undefined
      ? undefined
      : aimLinks(
          { address: pan.resolved.address, links: pan.links },
          { address: tilt.resolved.address, links: tilt.links },
          owner,
        );
  const present = (axis: AimAxis | undefined): boolean =>
    axis !== undefined &&
    (axis.value !== undefined || axis.links.link !== undefined);
  const count = [pan, tilt].filter(present).length;
  const shared = isAllTargetsRef(rowRef)
    ? false
    : AIM_AXES.some(
        (axis) =>
          storedRow(layer, ALL_TARGETS_REF, axis) !== undefined ||
          linkAt(document, rowAddress(layer.id, ALL_TARGETS_REF, axis)) !==
            undefined,
      );
  const toggle = (on: boolean): void => {
    void command(on ? "layer.aim.set" : "layer.aim.release", {
      layerId: layer.id,
      targets: [rowRef],
    });
  };
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
          onCheckedChange={(next) => toggle(next)}
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
        {shared && (
          <span
            className="shrink-0 text-[0.625rem] text-muted-foreground/70 italic"
            title={
              count > 0
                ? `This Aim overrides the ${ALL_TARGETS_LABEL} Aim`
                : `The ${ALL_TARGETS_LABEL} Aim reaches this Target`
            }
          >
            {count > 0 ? "overrides all" : "from all"}
          </span>
        )}
      </span>
      {count > 0 && pan !== undefined && tilt !== undefined ? (
        <div
          className="flex min-w-0 flex-1"
          style={{ flexBasis: settings.inspector.controlWrapPx }}
        >
          <AimControl
            label="Aim"
            pan={pan}
            tilt={tilt}
            pair={pair}
            onEdit={edit}
          >
            <PresetEntries
              label="Aim"
              entries={aimEntries(document, layer, rowRef, pan, tilt)}
            />
          </AimControl>
        </div>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );
}

/**
 * What each Element the Aim reaches takes from the Presets driving its
 * axes, pan then tilt: an axis no Preset drives shows a dash, and one the
 * Preset has no entry for is left undefined so the list flags it. Empty
 * while no Preset drives either axis.
 */
function aimEntries(
  document: Document,
  layer: LookLayer,
  rowRef: string,
  pan: AimAxis,
  tilt: AimAxis,
): readonly ShownEntry[] {
  if (pan.links.preset === undefined && tilt.links.preset === undefined)
    return [];
  const entries = new Map<
    string,
    { label: string; parts: (string | undefined)[] }
  >();
  [pan, tilt].forEach((axis, index) => {
    const preset = axis.links.preset;
    const attribute = AIM_AXES[index];
    if (attribute === undefined) return;
    const reached =
      preset === undefined
        ? rowReach(document, layer, rowRef, attribute).map((range) => ({
            ref: range.ref,
            label: range.label,
            text: "-",
          }))
        : presetRowValues(document, layer, rowRef, attribute, preset).map(
            (entry) => ({
              ref: entry.ref,
              label: entry.label,
              text: entryText(axis.resolved, entry.value),
            }),
          );
    for (const entry of reached) {
      const shown = entries.get(entry.ref) ?? {
        label: entry.label,
        parts: ["-", "-"],
      };
      shown.parts[index] = entry.text;
      entries.set(entry.ref, shown);
    }
  });
  return [...entries].map(([ref, entry]) => ({ ref, ...entry }));
}
