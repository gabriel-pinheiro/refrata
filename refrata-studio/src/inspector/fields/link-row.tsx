import {
  type AddressValue,
  type Controller,
  type Link,
  type ResolvedAddress,
  type ValuePreset,
} from "@refrata/core";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { colorToHex, displayUnit, formatNumber } from "./address-format";
import { unitGap, ValueWithUnit } from "./editable-readout";

/** How a row takes part in Parameter Links: its Link, if any, and the Controllers and Presets it could take. */
export interface RowLinks {
  readonly link: Link | undefined;
  /** The Link's Controller, when a Controller drives the row. */
  readonly controller: Controller | undefined;
  /** The Link's Preset, when a Preset drives the row. */
  readonly preset: ValuePreset | undefined;
  /** What the Address shows while a Controller drives it. */
  readonly effective: AddressValue;
  /** Controllers able to drive this row, in navigator order. */
  readonly candidates: readonly Controller[];
  /** False for what no Controller may drive whatever its type, such as an Aim of a Region; absent, the type decides. */
  readonly takesController?: boolean;
  /** Whether the row is resolved per Element, so a Preset can drive it. */
  readonly takesPreset: boolean;
  /** Presets the row could take, in navigator order. */
  readonly presets: readonly ValuePreset[];
  readonly onLink: (controllerId: string) => void;
  readonly onLinkPreset: (presetId: string) => void;
  /** Makes a new Controller named after the row and links it. */
  readonly onCreate: (kind: "number" | "color") => void;
  /** Makes a new Preset named after the row, holding what the row shows, and links it. */
  readonly onCreatePreset: () => void;
  readonly onUnlink: () => void;
  readonly onOpen: (controllerId: string) => void;
  readonly onOpenPreset: (presetId: string) => void;
}

/** What drives a linked row: its name, what to call it and how to go to it. */
export interface LinkSource {
  readonly name: string;
  readonly noun: "Controller" | "Preset";
  readonly open: () => void;
}

/** The Controller or Preset driving a row, or undefined while nothing does. */
export function linkSource(
  links: RowLinks | undefined,
): LinkSource | undefined {
  if (links?.link === undefined) return undefined;
  const { controller, preset } = links;
  if (controller !== undefined)
    return {
      name: controller.name,
      noun: "Controller",
      open: () => links.onOpen(controller.id),
    };
  if (preset !== undefined)
    return {
      name: preset.name,
      noun: "Preset",
      open: () => links.onOpenPreset(preset.id),
    };
  return undefined;
}

/**
 * The effective value, read-only, and a chip with the Controller's name and
 * value that opens it. A number shows as its readout alone: the chip needs
 * the room a slider would take, and the value is not draggable here anyway.
 * The chip wraps under the value rather than squeezing when the row is
 * narrow, and truncates its name only once it has a line to itself. A row a
 * Preset drives has one value per Element, so it shows the Preset's chip
 * alone.
 */
export function LinkedControl({
  resolved,
  links,
}: {
  readonly resolved: ResolvedAddress;
  readonly links: RowLinks;
}) {
  const { controller, effective, preset } = links;
  if (preset !== undefined)
    return (
      <div className="flex min-w-0 flex-1 items-center">
        <Button
          variant="outline"
          size="xs"
          className="max-w-full min-w-0 shrink overflow-hidden border-selection/60 text-foreground"
          title={`Controlled by Preset ${preset.name}. Change it on the Preset.`}
          onClick={() => links.onOpenPreset(preset.id)}
        >
          <Link2 className="text-selection" />
          <span className="truncate">{preset.name}</span>
        </Button>
      </div>
    );
  if (controller === undefined || controller.kind === "group") return null;
  const range = resolved.range ?? { min: 0, max: 1 };
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
      {resolved.type === "number" && (
        <NumberReadout
          label={resolved.label}
          text={formatNumber(
            typeof effective === "number" ? effective : 0,
            range,
          )}
          unit={displayUnit(range)}
        />
      )}
      {resolved.type === "boolean" && (
        <Switch
          aria-label={resolved.label}
          checked={effective === true}
          disabled
        />
      )}
      {resolved.type === "color" && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            aria-label={`${resolved.label} color`}
            className="size-5 shrink-0 rounded-sm border border-input"
            style={{ background: cssColor(effective) }}
          />
          <span className="w-[4.25rem] shrink-0 px-1 text-[0.6875rem] text-muted-foreground tabular-nums">
            {typeof effective === "object"
              ? colorToHex(effective).toUpperCase()
              : ""}
          </span>
        </span>
      )}
      <Button
        variant="outline"
        size="xs"
        className="max-w-full min-w-0 shrink overflow-hidden border-selection/60 text-foreground"
        title={`Controlled by ${controller.name}. Change it on the Controller.`}
        onClick={() => links.onOpen(controller.id)}
      >
        <Link2 className="text-selection" />
        <span className="truncate">{controller.name}</span>
        {controller.kind === "number" ? (
          <span className="text-muted-foreground tabular-nums">
            {Math.round(controller.value * 100)}%
          </span>
        ) : (
          <span
            className="size-2.5 shrink-0 rounded-[2px] border border-input"
            style={{ background: cssColor(controller.value) }}
          />
        )}
      </Button>
    </div>
  );
}

function cssColor(value: AddressValue): string {
  if (typeof value !== "object") return "transparent";
  const [r, g, b, a] = value;
  return `rgba(${String(Math.round(r * 255))}, ${String(Math.round(g * 255))}, ${String(Math.round(b * 255))}, ${String(a)})`;
}

function NumberReadout({
  label,
  text,
  unit,
}: {
  readonly label: string;
  readonly text: string;
  readonly unit: string;
}) {
  return (
    <span
      aria-label={label}
      title={`${text}${unitGap(unit)}${unit}`}
      className="min-w-14 shrink-0 px-1 text-right text-[0.6875rem] whitespace-nowrap text-muted-foreground tabular-nums"
    >
      <ValueWithUnit text={text} unit={unit} />
    </span>
  );
}
