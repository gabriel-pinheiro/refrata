import { nudgeWithin, type Document, type LookLayer } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import {
  AIM_AXES,
  aimReport,
  formatAim,
  type AimAxisKey,
  type AimAxisReport,
} from "../aim-lines.ts";
import type { Cli } from "../cli.ts";
import { resolveId, resolveRowRef } from "../names.ts";
import { formatCommandResult } from "../result.ts";

interface AimOptions {
  readonly pan?: string;
  readonly tilt?: string;
  readonly by: boolean;
}

/** The Look Layer `text` names, or an error saying what it is instead. */
function lookLayer(document: Document, text: string): LookLayer {
  const layer = document.layers[resolveId(document, "layers", text)];
  if (layer?.kind !== "look")
    throw new Error(`“${layer?.name ?? text}” is not a Look Layer.`);
  return layer;
}

function degreesOption(axis: AimAxisKey, text: string): number {
  const value = Number(text.trim().replace(/°$/, ""));
  if (text.trim() === "" || !Number.isFinite(value))
    throw new Error(`--${axis} takes degrees, not “${text}”.`);
  return value;
}

/**
 * The degrees to write for each axis asked: as given, or with `--by` the
 * stored value moved by that much and stopped at the limits, as Studio's
 * arrow keys do. Nudging needs a free axis: one released or linked says so.
 */
function aimValue(
  report: readonly AimAxisReport[],
  options: AimOptions,
): Partial<Record<AimAxisKey, number>> {
  const value: Partial<Record<AimAxisKey, number>> = {};
  for (const axis of report) {
    const text = options[axis.axis];
    if (text === undefined) continue;
    const given = degreesOption(axis.axis, text);
    if (!options.by) {
      value[axis.axis] = given;
      continue;
    }
    if (axis.controlledBy !== undefined)
      throw new Error(
        `${axis.axis} is controlled by ${axis.controlledBy}; change it on the Controller.`,
      );
    if (axis.value === undefined)
      throw new Error(
        `${axis.axis} is released; set it before nudging it (aim ... --${axis.axis} <degrees>).`,
      );
    value[axis.axis] = nudgeWithin(axis.value, given, axis.limits);
  }
  return value;
}

/** `aim`: read, set or nudge the Aim (pan and tilt) of a Look Layer's Target or of All Targets, in degrees. */
export function registerAim(program: Command, cli: Cli): void {
  program
    .command("aim <layer> <target>")
    .description(
      'Read, set or nudge the Aim of a Look Layer\'s Target or of "all" (All Targets): its pan and tilt rows in degrees, written together as one undo step. Without --pan or --tilt it prints the Aim, the limits the Elements it reaches allow, and any Element a value is beyond. aim Base all --pan 30 --tilt -12.5; aim Base "Mover 2" --tilt 2 --by.',
    )
    .option("--pan <degrees>", "pan to this, or by this with --by")
    .option("--tilt <degrees>", "tilt to this, or by this with --by")
    .option(
      "--by",
      "nudge: move by the degrees given, stopping at the limits",
      false,
    )
    .action((layerText: string, target: string, options: AimOptions) =>
      cli.withDocument(async (client, summary) => {
        const { document, view } = await cli.replica(client, summary.id);
        const layer = lookLayer(document, layerText);
        const ref = resolveRowRef(document, target);
        const report = aimReport(document, layer, ref);
        if (options.pan === undefined && options.tilt === undefined) {
          cli.print({ layerId: layer.id, target: ref, axes: report }, () =>
            formatAim(document, layer, ref, report).join("\n"),
          );
          return;
        }
        const [pan, tilt] = AIM_AXES.map(
          (axis) => report.find((entry) => entry.axis === axis)?.address ?? "",
        );
        const result = await client.command<CommandResult>(
          summary.id,
          "aim.edit",
          { pan, tilt, value: aimValue(report, options) },
        );
        const after = (await cli.caughtUp(view, result.revision)) ?? document;
        const afterLayer = lookLayer(after, layer.id);
        const now = aimReport(after, afterLayer, ref);
        cli.print(
          { ...result, layerId: layer.id, target: ref, axes: now },
          () =>
            [
              formatCommandResult(result, "aim.edit"),
              ...formatAim(after, afterLayer, ref, now),
            ].join("\n"),
        );
      }),
    );
}
