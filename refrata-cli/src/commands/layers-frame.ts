import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { formatCommandResult } from "../result.ts";
import { visualLayer } from "./visual-layer.ts";

/** `layers frame`: the Frame of a Layer running a Geometry Visual. */
export function registerLayersFrame(layers: Command, cli: Cli): void {
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
}
