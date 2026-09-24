import { visualDefinition, type Document } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { formatStack } from "../composition-lines.ts";
import { resolveId, resolveTargetRef } from "../names.ts";
import { parseParameterValue } from "../parameter-value.ts";
import { formatCommandResult } from "../result.ts";

const UNBOUND = "none";

/** The Visual Layer `text` names, with its id, or an error saying what it is instead. */
function visualLayer(document: Document, text: string) {
  const layerId = resolveId(document, "layers", text);
  const layer = document.layers[layerId];
  if (layer?.kind !== "visual")
    throw new Error(`“${layer?.name ?? text}” is not a Visual Layer.`);
  return layer;
}

/** A Scene's Layers: list the stack, add a Look Layer, a Visual Layer or a Group, spread a Target, and set up a Visual Layer. */
export function registerLayers(program: Command, cli: Cli): void {
  const layers = program
    .command("layers")
    .description(
      "List a Scene's Layers topmost first (the default), add one, spread a Target, or set up a Visual Layer (visual, param, bind, frame).",
    );

  layers
    .command("list <scene>", { isDefault: true })
    .description(
      "List a Scene's stack: each Look Layer with its Targets and rows, each Visual Layer with its Visual, Parameters, bindings and Cues.",
    )
    .action((scene: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const sceneId = resolveId(document, "scenes", scene);
        const own = Object.values(document.layers).filter(
          (layer) => layer.sceneId === sceneId,
        );
        cli.print(own, () => formatStack(document, sceneId).join("\n"));
      }),
    );

  layers
    .command("add <scene> <name>")
    .description(
      'Add a Layer at the top of a Scene, targeting what --target names (a Fixture, <fixture>/<key> or set:<set>), else the Set "All" or the first Set: a Look Layer, or with --visual <id> a Visual Layer running that Visual of the Catalog ("visuals" lists them).',
    )
    .option(
      "--target <ref>",
      "a Target; repeat for several",
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option("--no-targets", "start with no Targets instead of the default Set")
    .option("--visual <id>", "add a Visual Layer running this Visual")
    .option("--group", "add a Group instead", false)
    .action(
      (
        scene: string,
        name: string,
        local: {
          target: string[];
          targets: boolean;
          visual?: string;
          group: boolean;
        },
      ) =>
        cli.withDocument(async (client, summary) => {
          if (local.group && local.visual !== undefined)
            throw new Error(
              "A Group runs no Visual; drop --group or --visual.",
            );
          const { document } = await cli.replica(client, summary.id);
          const kind = local.group
            ? "group"
            : local.visual === undefined
              ? "look"
              : "visual";
          const reply = await client.command<CommandResult>(
            summary.id,
            "layer.create",
            {
              sceneId: resolveId(document, "scenes", scene),
              name,
              kind,
              ...(local.visual === undefined ? {} : { visual: local.visual }),
              ...(local.group
                ? {}
                : !local.targets
                  ? { targets: null }
                  : local.target.length === 0
                    ? {}
                    : {
                        targets: local.target.map((text) =>
                          resolveTargetRef(document, text),
                        ),
                      }),
            },
          );
          const result = await cli.named(client, summary.id, reply);
          cli.print(result, () => formatCommandResult(result, "layer.create"));
        }),
    );

  layers
    .command("spread <layer> <target> <state>")
    .description(
      'Spread one Target on or off: on, a Set counts as its members and an Element as its children, one Target each, which is what a Chase or a Rainbow steps across. A Look Layer ignores it; "layers" prints what it expands to.',
    )
    .action((layer: string, target: string, state: string) =>
      cli.withDocument(async (client, summary) => {
        if (state !== "on" && state !== "off")
          throw new Error("layers spread takes “on” or “off”.");
        const { document } = await cli.replica(client, summary.id);
        const result = await client.command<CommandResult>(
          summary.id,
          "layer.targets.spread",
          {
            layerId: resolveId(document, "layers", layer),
            ref: resolveTargetRef(document, target),
            spread: state === "on",
          },
        );
        cli.print(result, () =>
          formatCommandResult(result, "layer.targets.spread"),
        );
      }),
    );

  layers
    .command("fade <layer> <direction> <seconds>")
    .description(
      "Set a Layer Fade: layers fade Spot in 2, layers fade Spot out 0.5 --curve ease-in-out. The Layer eases in over that time when enabled and out when disabled; 0 is a cut. Curves: linear, ease-in, ease-out, ease-in-out, bounce. Undoable; the same write as edit layer/<layer>/fade/<in|out>/time.",
    )
    .option("--curve <curve>", "the curve for that direction")
    .action(
      (
        layer: string,
        direction: string,
        seconds: string,
        local: { curve?: string },
      ) =>
        cli.withDocument(async (client, summary) => {
          if (direction !== "in" && direction !== "out")
            throw new Error("layers fade takes “in” or “out”.");
          const time = Number(seconds);
          if (seconds.trim() === "" || !Number.isFinite(time))
            throw new Error(`layers fade takes seconds, not “${seconds}”.`);
          const { document } = await cli.replica(client, summary.id);
          const layerId = resolveId(document, "layers", layer);
          const writes: [string, unknown][] = [
            [`layer/${layerId}/fade/${direction}/time`, time],
          ];
          if (local.curve !== undefined)
            writes.push([
              `layer/${layerId}/fade/${direction}/curve`,
              local.curve,
            ]);
          const results: Record<string, CommandResult> = {};
          for (const [address, value] of writes)
            results[address] = await client.command<CommandResult>(
              summary.id,
              "address.edit",
              { address, value },
            );
          cli.print(results, () =>
            Object.entries(results)
              .map(([address, result]) =>
                result.changed
                  ? `${address} set (revision ${String(result.revision)})`
                  : `${address} unchanged`,
              )
              .join("\n"),
          );
        }),
    );

  layers
    .command("visual <layer> <id>")
    .description(
      "Give a Visual Layer another Visual of the Catalog; its Parameters and bindings start over from that Visual's defaults.",
    )
    .action((layer: string, id: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const result = await client.command<CommandResult>(
          summary.id,
          "layer.visual.set",
          { layerId: visualLayer(document, layer).id, visual: id },
        );
        cli.print(result, () =>
          formatCommandResult(result, "layer.visual.set"),
        );
      }),
    );

  layers
    .command("param <layer> <name> <value>")
    .description(
      "Set a Visual Parameter: layers param Breathe rate 0.5, layers param Shimmer color '[1,1,1,1]', layers param Chase order bounce. Undoable; the same write as edit layer/<layer>/param/<name>.",
    )
    .action((layer: string, name: string, value: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const found = visualLayer(document, layer);
        const definition = visualDefinition(found.visual);
        if (definition === undefined)
          throw new Error(
            `${found.name} runs “${found.visual}”, which is not a Visual of the Catalog.`,
          );
        const parameter = definition.parameters[name];
        if (parameter === undefined)
          throw new Error(
            `${definition.name} has no Parameter “${name}”; it has ${Object.keys(definition.parameters).join(", ")}.`,
          );
        const address = `layer/${found.id}/param/${name}`;
        const result = await client.command<CommandResult>(
          summary.id,
          "address.edit",
          { address, value: parseParameterValue(name, parameter, value) },
        );
        cli.print({ address, ...result }, () =>
          result.changed
            ? `${address} = ${value} (revision ${String(result.revision)})`
            : "No change.",
        );
      }),
    );

  layers
    .command("frame <layer>")
    .description(
      "Set the Frame of a Layer running a Geometry Visual (Wipe, Radar, Spectrum, Ripple): layers frame Wipe --x 0 --y 1 --width 6 --height 2 --rotation 15, fields left out keeping their value; or layers frame Wipe --fit to put it around the Layer's Targets. Metres and degrees; undoable.",
    )
    .option("--x <metres>", "the Frame's centre, stage left to right")
    .option("--y <metres>", "the Frame's centre, floor up")
    .option("--width <metres>")
    .option("--height <metres>")
    .option("--rotation <degrees>", "counterclockwise about the centre")
    .option("--fit", "fit the Frame to the Layer's Targets instead", false)
    .action(
      (
        layer: string,
        local: {
          x?: string;
          y?: string;
          width?: string;
          height?: string;
          rotation?: string;
          fit: boolean;
        },
      ) =>
        cli.withDocument(async (client, summary) => {
          const frame: Record<string, number> = {};
          for (const field of [
            "x",
            "y",
            "width",
            "height",
            "rotation",
          ] as const) {
            const text = local[field];
            if (text === undefined) continue;
            const number = Number(text);
            if (text.trim() === "" || !Number.isFinite(number))
              throw new Error(`--${field} takes a number, not “${text}”.`);
            frame[field] = number;
          }
          if (!local.fit && Object.keys(frame).length === 0)
            throw new Error(
              "layers frame needs --fit or at least one of --x, --y, --width, --height, --rotation.",
            );
          const { document } = await cli.replica(client, summary.id);
          const result = await client.command<CommandResult>(
            summary.id,
            "layer.frame.set",
            {
              layerId: visualLayer(document, layer).id,
              ...(local.fit ? { fit: true } : { frame }),
            },
          );
          cli.print(result, () =>
            formatCommandResult(result, "layer.frame.set"),
          );
        }),
    );

  layers
    .command("bind <layer> <slot> <attribute>")
    .description(
      `Bind a Slot of a Visual Layer to an Attribute, or to "${UNBOUND}": layers bind Shimmer level dimmer, layers bind Breathe value dimmer --from 0.2 --to 0.6. --from and --to are what a number Slot's 0 and 1 become, in the Attribute's units; left out they stay, or become the whole range when the Attribute changes.`,
    )
    .option("--from <number>", "the Attribute's value at the Slot's 0")
    .option("--to <number>", "the Attribute's value at the Slot's 1")
    .action(
      (
        layer: string,
        slot: string,
        attribute: string,
        local: { from?: string; to?: string },
      ) =>
        cli.withDocument(async (client, summary) => {
          const { document } = await cli.replica(client, summary.id);
          const anchors: { from?: number; to?: number } = {};
          for (const end of ["from", "to"] as const) {
            const text = local[end];
            if (text === undefined) continue;
            const number = Number(text);
            if (text.trim() === "" || !Number.isFinite(number))
              throw new Error(`--${end} takes a number, not “${text}”.`);
            anchors[end] = number;
          }
          const result = await client.command<CommandResult>(
            summary.id,
            "layer.binding.set",
            {
              layerId: visualLayer(document, layer).id,
              slot,
              attribute: attribute.toLowerCase() === UNBOUND ? null : attribute,
              ...anchors,
            },
          );
          cli.print(result, () =>
            formatCommandResult(result, "layer.binding.set"),
          );
        }),
    );
}
