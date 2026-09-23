import { settings } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { resolveId } from "../names.ts";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The DMX Tester from the shell: hold a range of raw channels at the bytes
 * given, keep it alive for a while, release it. What the tab does, for
 * scripts and for checking a dongle without Studio.
 */
export function registerTester(program: Command, cli: Cli): void {
  const tester = program
    .command("tester")
    .description(
      "Hold raw DMX channels for the DMX Tester (the default), or release them.",
    );

  tester
    .command("hold <universe> <address> <byte...>", { isDefault: true })
    .description(
      `Hold channels from <address> at the bytes given (0 to 255, "-" leaves one released) for ${String(settings.cli.testerHoldMs / 1000)} s, touching them so the runtime keeps them, then release. Blackout kills the tester with the rest of the frame.`,
    )
    .option(
      "--hold <seconds>",
      "how long to hold before releasing; 0 leaves them held until the runtime's timeout",
    )
    .action(
      (
        universe: string,
        address: string,
        bytes: string[],
        local: { hold?: string },
      ) =>
        cli.withDocument(async (client, summary) => {
          const { document } = await cli.replica(client, summary.id);
          const universeId = resolveId(document, "universes", universe);
          const start = Number.parseInt(address, 10);
          if (!Number.isInteger(start))
            throw new Error(`“${address}” is not a channel number.`);
          const values: Record<string, number | null> = {};
          bytes.forEach((text, index) => {
            const byte = text === "-" ? null : Number.parseInt(text, 10);
            if (byte !== null && !Number.isInteger(byte))
              throw new Error(`“${text}” is not a byte.`);
            values[String(start + index)] = byte;
          });
          const held = await client.command<CommandResult>(
            summary.id,
            "tester.hold",
            { universeId, address: start, count: bytes.length },
          );
          const set = await client.command<CommandResult>(
            summary.id,
            "tester.set",
            { values },
          );
          const holdMs =
            local.hold === undefined
              ? settings.cli.testerHoldMs
              : Number(local.hold) * 1000;
          const range = `channels ${String(start)} to ${String(start + bytes.length - 1)} of ${document.universes[universeId]?.name ?? universeId}`;
          if (holdMs <= 0) {
            cli.print(
              { universeId, address: start, values, held: true },
              () =>
                `Holding ${range} until the runtime's timeout (${String(settings.tester.timeoutMs / 1000)} s without a touch)`,
            );
            return;
          }
          const until = Date.now() + holdMs;
          while (Date.now() < until) {
            await sleep(
              Math.min(settings.tester.keepaliveMs, until - Date.now()),
            );
            await client.request("tester.touch", { documentId: summary.id });
          }
          await client.command<CommandResult>(summary.id, "tester.release", {});
          cli.print(
            {
              universeId,
              address: start,
              values,
              held: false,
              heldMs: holdMs,
              revision: set.revision ?? held.revision,
            },
            () => `Held ${range} for ${String(holdMs / 1000)} s, released`,
          );
        }),
    );

  tester
    .command("release")
    .description("Release the DMX Tester's range.")
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const result = await client.command<CommandResult>(
          summary.id,
          "tester.release",
          {},
        );
        cli.print(result, () =>
          result.changed
            ? "DMX Tester released"
            : "The DMX Tester held nothing.",
        );
      }),
    );
}
