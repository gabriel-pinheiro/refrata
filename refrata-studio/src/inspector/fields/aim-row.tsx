import {
  nudgeWithin,
  outOfReach,
  reachLimits,
  type NumberBounds,
  type ReachedRange,
  type ResolvedAddress,
} from "@refrata/core";
import { Link2, TriangleAlert } from "lucide-react";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AimLinkMenu } from "./aim-link-menu";
import {
  arrowNudge,
  formatDegrees,
  nudgeStep,
  parseDegrees,
  type AimAxisKey,
  type AimValue,
} from "./aim-nudge";
import { AimPad } from "./aim-pad";
import { EditableReadout } from "./editable-readout";
import type { RowLinks } from "./link-row";
import { useAimEdit } from "./use-aim-edit";

/** One axis of an Aim: its Address, what is stored there, its Links and the Elements it reaches. */
export interface AimAxis {
  readonly resolved: ResolvedAddress;
  /** The value held at the Address; undefined while the axis is released. */
  readonly value: number | undefined;
  readonly links: RowLinks;
  /** The Elements the axis lands on, with their own ranges: its limits, and who to flag. */
  readonly reach: readonly ReachedRange[];
}

const AXES: readonly { readonly key: AimAxisKey; readonly title: string }[] = [
  { key: "pan", title: "Pan" },
  { key: "tilt", title: "Tilt" },
];

function isLinked(axis: AimAxis): boolean {
  return axis.links.link !== undefined && axis.links.controller !== undefined;
}

/**
 * The control of an Aim: the `pan` and `tilt` of one owner as one thing,
 * over two number Addresses. Each readout shows its degrees and types a
 * value; the row, focused, takes the arrow keys (left and right pan, up and
 * down tilt; shift coarser, ctrl finer) and its pad takes drags. Only a
 * free axis moves: a linked one shows its Controller and refuses, and a
 * released one says so. A value beyond what a reached Element can do is
 * flagged with the Element's name. `onEdit` writes either or both axes as
 * one step.
 */
export function AimControl({
  label,
  pan,
  tilt,
  onEdit,
}: {
  readonly label: string;
  readonly pan: AimAxis;
  readonly tilt: AimAxis;
  readonly onEdit: (value: AimValue) => Promise<unknown>;
}) {
  const axes = { pan, tilt };
  const free = {
    pan: pan.value !== undefined && !isLinked(pan),
    tilt: tilt.value !== undefined && !isLinked(tilt),
  };
  const limits = {
    pan: reachLimits(pan.reach, pan.resolved.range ?? { min: 0, max: 0 }),
    tilt: reachLimits(tilt.reach, tilt.resolved.range ?? { min: 0, max: 0 }),
  };
  const stored: AimValue = {};
  for (const { key } of AXES) {
    const value = axes[key].value;
    if (free[key] && value !== undefined) stored[key] = value;
  }
  const edit = useAimEdit(stored, onEdit);
  // What each axis shows: held or stored when free, the Controller's when linked.
  const shown: AimValue = {};
  for (const { key } of AXES) {
    const axis = axes[key];
    const value = isLinked(axis) ? axis.links.effective : edit.shown[key];
    if (typeof value === "number") shown[key] = value;
  }
  const move = (delta: AimValue): void => {
    const now = edit.latest();
    const next: AimValue = {};
    for (const { key } of AXES) {
      const by = delta[key];
      const from = now[key];
      if (!free[key] || by === undefined || from === undefined) continue;
      next[key] = nudgeWithin(from, by, limits[key]);
    }
    if (next.pan !== undefined || next.tilt !== undefined) edit.write(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.altKey || event.target instanceof HTMLInputElement) return;
    const nudge = arrowNudge(event.key, nudgeStep(event));
    if (nudge === undefined || !free[nudge.axis]) return;
    event.preventDefault();
    event.stopPropagation();
    move({ [nudge.axis]: nudge.delta });
  };
  const beyond = AXES.flatMap(({ key, title }) => {
    const value = shown[key];
    if (value === undefined) return [];
    const out = outOfReach(axes[key].reach, value);
    return out.length === 0
      ? []
      : [
          `${title} ${formatDegrees(value)}° is beyond ${out.map((range) => range.label).join(", ")}`,
        ];
  });
  return (
    <div className="grid min-w-0 flex-1 gap-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <div
          role="group"
          aria-label={`${label}, arrows nudge`}
          tabIndex={0}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={onKeyDown}
        >
          {AXES.map(({ key, title }) => (
            <AxisReadout
              key={key}
              title={title}
              axis={axes[key]}
              value={shown[key]}
              limits={limits[key]}
              beyond={
                shown[key] !== undefined &&
                outOfReach(axes[key].reach, shown[key]).length > 0
              }
              onCommit={(value) => edit.write({ [key]: value })}
            />
          ))}
        </div>
        <AimPad
          label={label}
          shown={shown}
          limits={limits}
          free={free}
          onMove={move}
          onKeyDown={onKeyDown}
        />
        <AimLinkMenu
          label={label}
          sections={AXES.map(({ key, title }) => ({
            key,
            title,
            resolved: axes[key].resolved,
            links: axes[key].links,
          }))}
        />
      </div>
      {beyond.length > 0 && (
        <p className="flex items-start gap-1 text-[0.625rem] text-amber-300">
          <TriangleAlert aria-hidden className="mt-px size-3 shrink-0" />
          <span>{beyond.join(". ")}</span>
        </p>
      )}
    </div>
  );
}

/** One axis's caption and value: typeable when free, the Controller's chip when linked, "released" when absent. */
function AxisReadout({
  title,
  axis,
  value,
  limits,
  beyond,
  onCommit,
}: {
  readonly title: string;
  readonly axis: AimAxis;
  readonly value: number | undefined;
  readonly limits: NumberBounds;
  readonly beyond: boolean;
  readonly onCommit: (value: number) => void;
}) {
  const { controller } = axis.links;
  const text = value === undefined ? "" : formatDegrees(value);
  const caption = (
    <span className="text-[0.625rem] text-muted-foreground/70">{title}</span>
  );
  if (isLinked(axis) && controller !== undefined)
    return (
      <span className="flex min-w-0 shrink items-center gap-1">
        {caption}
        <Button
          variant="outline"
          size="xs"
          className="max-w-full min-w-0 shrink overflow-hidden border-selection/60 text-foreground"
          title={`${title} controlled by ${controller.name}. Change it on the Controller.`}
          onClick={() => axis.links.onOpen(controller.id)}
        >
          <Link2 className="text-selection" />
          <span className={cn("tabular-nums", beyond && "text-amber-300")}>
            {text}°
          </span>
          <span className="truncate text-muted-foreground">
            {controller.name}
          </span>
        </Button>
      </span>
    );
  if (value === undefined)
    return (
      <span className="flex items-center gap-1">
        {caption}
        <span className="px-1 text-[0.6875rem] text-muted-foreground/60 italic">
          released
        </span>
      </span>
    );
  return (
    <span
      className={cn(
        "flex items-center gap-1",
        beyond && "[&_button]:text-amber-300",
      )}
    >
      {caption}
      <EditableReadout
        label={`${axis.resolved.label} degrees`}
        text={text}
        unit="°"
        className="min-w-12"
        inputClassName="w-14"
        parse={(typed) => parseDegrees(typed, limits)}
        commit={onCommit}
      />
    </span>
  );
}
