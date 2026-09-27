import {
  nudgeWithin,
  type Document,
  type LookLayer,
  type ValuePreset,
} from "@refrata/core";
import type { RefrataClient } from "@refrata/client";
import type { CommandResult, DocumentSummary } from "@refrata/protocol";
import type { Command } from "commander";

import {
  AIM_AXES,
  aimReport,
  formatAim,
  type AimAxisKey,
  type AimAxisReport,
  type AimOwner,
} from "../aim-lines.ts";
import type { Cli } from "../cli.ts";
import { resolveId, resolveRowRef } from "../names.ts";
import { formatCommandResult } from "../result.ts";

export interface AimOptions {
  readonly pan?: string;
  readonly tilt?: string;
  readonly by: boolean;
  /** A Preset to link both axes to. */
  readonly link?: string;
  readonly unlink?: boolean;
}

/** The Look Layer `text` names, or an error saying what it is instead. */
function lookLayer(document: Document, text: string): LookLayer {
  const layer = document.layers[resolveId(document, "layers", text)];
  if (layer?.kind !== "look")
    throw new Error(`“${layer?.name ?? text}” is not a Look Layer.`);
  return layer;
}

/** The Preset `text` names, or an error saying it is a Group. */
export function valuePreset(document: Document, text: string): ValuePreset {
  const preset = document.presets[resolveId(document, "presets", text)];
  if (preset?.kind !== "preset")
    throw new Error(`“${preset?.name ?? text}” is a Group, not a Preset.`);
  return preset;
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
        `${axis.axis} is controlled by ${axis.controlledBy}; change it there.`,
      );
    if (axis.value === undefined)
      throw new Error(
        `${axis.axis} is released; set it before nudging it (--${axis.axis} <degrees> without --by).`,
      );
    value[axis.axis] = nudgeWithin(axis.value, given, axis.limits);
  }
  return value;
}

/** The owner as the document holds it now, so a reply is read against the change. */
function ownerIn(document: Document, owner: AimOwner): AimOwner {
  return "layer" in owner
    ? { layer: lookLayer(document, owner.layer.id), ref: owner.ref }
    : { preset: valuePreset(document, owner.preset.id), ref: owner.ref };
}

/**
 * What `aim` and `presets aim` do with an Aim: print it, set or nudge it,
 * link both axes to a Preset, or unlink them, each as one undo step, then
 * print the Aim as it is after.
 */
export async function runAim(
  cli: Cli,
  client: RefrataClient,
  summary: DocumentSummary,
  find: (document: Document) => AimOwner,
  options: AimOptions,
): Promise<void> {
  const { document, view } = await cli.replica(client, summary.id);
  const owner = find(document);
  const report = aimReport(document, owner);
  const json = (axes: readonly AimAxisReport[]) =>
    "layer" in owner
      ? { layerId: owner.layer.id, target: owner.ref, axes }
      : { presetId: owner.preset.id, element: owner.ref, axes };
  const [pan, tilt] = AIM_AXES.map(
    (axis) => report.find((entry) => entry.axis === axis)?.address ?? "",
  );
  let command: string;
  let payload: unknown;
  if (options.link !== undefined) {
    command = "link.preset";
    payload = {
      presetId: valuePreset(document, options.link).id,
      addresses: [pan, tilt],
    };
  } else if (options.unlink === true) {
    command = "aim.unlink";
    payload = { pan, tilt };
  } else if (options.pan !== undefined || options.tilt !== undefined) {
    command = "aim.edit";
    payload = { pan, tilt, value: aimValue(report, options) };
  } else {
    cli.print(json(report), () =>
      formatAim(document, owner, report).join("\n"),
    );
    return;
  }
  const result = await client.command<CommandResult>(
    summary.id,
    command,
    payload,
  );
  const after = (await cli.caughtUp(view, result.revision)) ?? document;
  const now = ownerIn(after, owner);
  const axes = aimReport(after, now);
  cli.print({ ...result, ...json(axes) }, () =>
    [formatCommandResult(result, command), ...formatAim(after, now, axes)].join(
      "\n",
    ),
  );
}

/** `aim`: read, set, nudge, link or unlink the Aim (pan and tilt) of a Look Layer's Target or of All Targets, in degrees. */
export function registerAim(program: Command, cli: Cli): void {
  program
    .command("aim <layer> <target>")
    .description(
      'Read, set or nudge the Aim of a Look Layer\'s Target or of "all" (All Targets): its pan and tilt rows in degrees, written together as one undo step. A value is clamped to the widest range the Elements the row reaches cover (for "all", every Target\'s), with a warning; one inside it that some Element cannot reach is kept and that Element named. --link <preset> links both axes to a Preset, so each Element the row reaches takes its own entry, and --unlink lets them go. Without options it prints the Aim, its limits, what drives it and, linked to a Preset, what each Element takes. aim Base all --pan 30 --tilt -12.5; aim Base "Mover 2" --tilt 2 --by; aim Spot all --link "Table Blue".',
    )
    .option("--pan <degrees>", "pan to this, or by this with --by")
    .option("--tilt <degrees>", "tilt to this, or by this with --by")
    .option(
      "--by",
      "nudge: move by the degrees given, stopping at the limits (a value already beyond them only moves back in)",
      false,
    )
    .option("--link <preset>", "link pan and tilt to this Preset, id or name")
    .option("--unlink", "unlink pan and tilt from what drives them")
    .action((layerText: string, target: string, options: AimOptions) =>
      cli.withDocument((client, summary) =>
        runAim(
          cli,
          client,
          summary,
          (document) => ({
            layer: lookLayer(document, layerText),
            ref: resolveRowRef(document, target),
          }),
          options,
        ),
      ),
    );
}
