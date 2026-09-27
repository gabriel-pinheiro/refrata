import type { DocumentView } from "@refrata/client";
import {
  ALL_TARGETS_LABEL,
  ALL_TARGETS_REF,
  isAllTargetsRef,
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
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand } from "@/lib/client";
import { cn } from "@/lib/utils";

const AIM_AXES = ["pan", "tilt"] as const satisfies readonly AttributeKey[];

/** Whether a row ref's Attributes hold both halves of an Aim, so one Aim line stands for the two. */
export function hasAim(attributes: readonly AttributeKey[]): boolean {
  return AIM_AXES.every((axis) => attributes.includes(axis));
}

/**
 * A Look Layer's `pan` and `tilt` rows for one row ref as one Aim line:
 * one checkbox ticks both rows on (each at its Highlight or Default, as a
 * row's own does) or releases both with their Links, one undo step either
 * way (`layer.aim.set`, `layer.aim.release`), and the Aim control edits
 * them over their two Addresses as one step. Its limits and flags come
 * from the Elements each row is measured against (`rowReach`). A row ticked on alone, from the
 * CLI or an older file, shows the checkbox part-way; ticking it adds the
 * other.
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
  const present = (axis: AimAxis | undefined): boolean =>
    axis !== undefined &&
    (axis.value !== undefined || axis.links.link !== undefined);
  const count = [pan, tilt].filter(present).length;
  const shared = isAllTargetsRef(rowRef)
    ? false
    : AIM_AXES.some(
        (axis) => storedRow(layer, ALL_TARGETS_REF, axis) !== undefined,
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
          <AimControl label="Aim" pan={pan} tilt={tilt} onEdit={edit} />
        </div>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );
}
