import {
  linkAt,
  REGION_AIMS,
  REGION_AXES,
  REGION_FORMS,
  regionPlace,
  type Document,
  type RegionAimName,
  type RegionAxis,
  type VisualLayer,
} from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { formatRegion, regionReport } from "../region-lines.ts";
import { formatCommandResult } from "../result.ts";
import { valuePreset } from "./aim.ts";
import { visualLayer } from "./visual-layer.ts";

interface RegionOptions {
  readonly form?: string;
  readonly from?: string;
  readonly to?: string;
  readonly center?: string;
  readonly width?: string;
  readonly height?: string;
  readonly link: string[];
  readonly unlink: string[];
  readonly remove: boolean;
}

const collect = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

function degreesOf(option: string, text: string): number {
  const value = Number(text.trim().replace(/°$/, ""));
  if (text.trim() === "" || !Number.isFinite(value))
    throw new Error(`--${option} takes degrees, not “${text}”.`);
  return value;
}

/** `30,-12.5` as pan and tilt; either side may be left out (`30,` or `,-12.5`) to keep that axis. */
function aimOf(
  option: string,
  text: string,
): Partial<Record<RegionAxis, number>> {
  const parts = text.split(",");
  if (parts.length !== 2)
    throw new Error(
      `--${option} takes pan and tilt in degrees as <pan>,<tilt>, not “${text}”.`,
    );
  const aim: Partial<Record<RegionAxis, number>> = {};
  REGION_AXES.forEach((axis, index) => {
    const part = parts[index] ?? "";
    if (part.trim() !== "") aim[axis] = degreesOf(option, part);
  });
  return aim;
}

/** The places `from`, `to.pan` or `center` names: both axes of an Aim, or one. */
function placesOf(layer: VisualLayer, text: string): string[] {
  const [aim = "", axis] = text.trim().toLowerCase().split(".");
  if (!REGION_AIMS.includes(aim as RegionAimName))
    throw new Error(
      `“${text}” is not an Aim of a Region; they are ${REGION_AIMS.join(", ")}, or one axis of them such as from.pan.`,
    );
  if (axis !== undefined && !REGION_AXES.includes(axis as RegionAxis))
    throw new Error(`“${axis}” is not pan or tilt.`);
  return (axis === undefined ? REGION_AXES : [axis as RegionAxis]).map((each) =>
    regionPlace(layer.id, aim as RegionAimName, each),
  );
}

/** What `--link from=Table` says: the places of the Aim and the Preset to link them to. */
function linkOf(document: Document, layer: VisualLayer, text: string) {
  const at = text.indexOf("=");
  if (at <= 0 || at === text.length - 1)
    throw new Error(
      `--link takes <aim>=<preset>, such as from="Table Blue", not “${text}”.`,
    );
  return {
    presetId: valuePreset(document, text.slice(at + 1)).id,
    addresses: placesOf(layer, text.slice(0, at)),
  };
}

/** `layers region`: the Region of a Layer running a movement Visual. */
export function registerLayersRegion(layers: Command, cli: Cli): void {
  layers
    .command("region <layer>")
    .description(
      'Read or set the Region of a Layer running a movement Visual (Figure, Flyout, Sweep): the box in pan and tilt the Visual draws inside, which each mover takes as its own. By corners, --from and --to, each <pan>,<tilt> in degrees: the Visual\'s 0 is at from and its 1 at to, so a Flyout flies from one to the other and corners may run backwards. By center and size, --center <pan>,<tilt> with --width and --height in degrees. --form writes the same box the other way. --link <aim>=<preset> links an Aim (from, to, center, or one axis such as from.pan) to a Preset, so each Element takes its own entry and one the Preset has nothing for is released; --unlink <aim> lets it go back to the degrees typed under it. On Blend Mode add a Region is center and size only, its center an offset from what is below, and takes no Preset. --remove sends its two Slots back to Slot Bindings. Without options it prints the Region, what each Element takes from a Preset, and the ends a mover cannot go to. layers region Fly --from -30,-30 --to 30,60; layers region Fly --link from="Crowd Low" --link to="Crowd High"; layers region Circle --form center --center 0,20 --width 40 --height 20.',
    )
    .option("--form <form>", `write it by ${REGION_FORMS.join(" or ")}`)
    .option("--from <pan,tilt>", "the corner at the Visual's 0")
    .option("--to <pan,tilt>", "the corner at the Visual's 1")
    .option("--center <pan,tilt>", "the center; an offset on Blend Mode add")
    .option("--width <degrees>", "the size along pan, by center")
    .option("--height <degrees>", "the size along tilt, by center")
    .option(
      "--link <aim=preset>",
      "link an Aim to a Preset; repeat for several",
      collect,
      [] as string[],
    )
    .option(
      "--unlink <aim>",
      "unlink an Aim; repeat for several",
      collect,
      [] as string[],
    )
    .option("--remove", "remove the Region; its Slots take bindings", false)
    .action((text: string, options: RegionOptions) =>
      cli.withDocument(async (client, summary) => {
        const { document, view } = await cli.replica(client, summary.id);
        const layer = visualLayer(document, text);
        const steps: [string, unknown][] = [];
        if (options.remove)
          steps.push(["layer.region.remove", { layerId: layer.id }]);
        for (const aim of options.unlink) {
          const [first = "", second] = placesOf(layer, aim);
          const link = linkAt(document, first);
          if (second !== undefined)
            steps.push(["aim.unlink", { pan: first, tilt: second }]);
          else if (link !== undefined)
            steps.push(["link.remove", { linkId: link.id }]);
        }
        const set: Record<string, unknown> = {};
        if (options.form !== undefined) set.form = options.form;
        for (const aim of ["from", "to", "center"] as const) {
          const given = options[aim];
          if (given !== undefined) set[aim] = aimOf(aim, given);
        }
        for (const size of ["width", "height"] as const) {
          const given = options[size];
          if (given !== undefined) set[size] = degreesOf(size, given);
        }
        if (Object.keys(set).length > 0)
          steps.push(["layer.region.set", { layerId: layer.id, ...set }]);
        for (const link of options.link)
          steps.push(["link.preset", linkOf(document, layer, link)]);
        const results: { command: string; result: CommandResult }[] = [];
        let revision: number | undefined;
        for (const [command, payload] of steps) {
          const result = await client.command<CommandResult>(
            summary.id,
            command,
            payload,
          );
          results.push({ command, result });
          revision = result.revision;
        }
        const after =
          revision === undefined
            ? document
            : ((await cli.caughtUp(view, revision)) ?? document);
        const now = visualLayer(after, layer.id);
        const report = regionReport(after, now);
        cli.print({ layerId: layer.id, results, region: report ?? null }, () =>
          [
            ...results.map(({ command, result }) =>
              formatCommandResult(result, command),
            ),
            ...(report === undefined
              ? [
                  `“${now.name}” has no Region; its Slots go through their bindings.`,
                ]
              : formatRegion(after, now, report)),
          ].join("\n"),
        );
      }),
    );
}
