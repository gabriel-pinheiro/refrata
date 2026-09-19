import {
  CATALOG,
  cueAddress,
  visualDefinition,
  type VisualDefinition,
} from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { resolveId } from "../names.ts";
import { formatCatalog, formatVisual } from "../visual-lines.ts";

/** The Catalog of Visuals, and firing a Visual Layer's Cue. Setting a Visual Layer up is in `layers.ts`. */
export function registerVisuals(program: Command, cli: Cli): void {
  program
    .command("visuals [id]")
    .description(
      "List the Catalog: every Visual with its Slots and default bindings, Parameters and Cues. With an id, that Visual alone. Needs no runtime.",
    )
    .action((id: string | undefined) => {
      if (id === undefined) {
        cli.print(CATALOG.map(describeForJson), () =>
          formatCatalog(CATALOG).join("\n"),
        );
        return;
      }
      const definition = visualDefinition(id);
      if (definition === undefined)
        throw new Error(
          `“${id}” is not a Visual of the Catalog; it holds ${CATALOG.map((entry) => entry.id).join(", ")}.`,
        );
      cli.print(describeForJson(definition), () =>
        formatVisual(definition).join("\n"),
      );
    });

  program
    .command("cue <layer> <key>")
    .description(
      "Fire a Cue of a Visual Layer: cue Chase step, cue Shimmer fire. Show control, never undone. Only the playing Scene's Layers have a running Visual; a Cue to any other Layer is dropped.",
    )
    .action((layer: string, key: string) =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const layerId = resolveId(document, "layers", layer);
        const found = document.layers[layerId];
        if (found?.kind !== "visual")
          throw new Error(`“${found?.name ?? layer}” is not a Visual Layer.`);
        const cues = visualDefinition(found.visual)?.cues ?? [];
        if (!cues.some((cue) => cue.key === key))
          throw new Error(
            `${found.name} has no Cue “${key}”${cues.length === 0 ? "" : `; it answers ${cues.map((cue) => cue.key).join(", ")}`}.`,
          );
        const address = cueAddress(layerId, key);
        const result = await client.command<CommandResult>(
          summary.id,
          "address.trigger",
          { address },
        );
        const playing = document.installation.activeScene === found.sceneId;
        cli.print({ address, layerId, playing, ...result }, () =>
          playing
            ? `Fired ${key} on “${found.name}”`
            : `Fired ${key} on “${found.name}”, but its Scene “${document.scenes[found.sceneId]?.name ?? found.sceneId}” is not playing, so the Cue was dropped.`,
        );
      }),
    );
}

/** A Visual as `--json` prints it: the definition without its code. */
function describeForJson(definition: VisualDefinition) {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    distributes: definition.distributes,
    slots: definition.slots,
    parameters: definition.parameters,
    cues: definition.cues,
  };
}
