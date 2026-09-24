import {
  effectiveValue,
  getAtPath,
  linkAt,
  listAddresses,
  resolveAddress,
  unknownAddress,
  type Document,
} from "@refrata/core";
import type { Command } from "commander";

import type { Cli } from "../cli.ts";
import { resolveAddressNames, resolvePathNames } from "../names.ts";
import { inTypedTerms } from "../result.ts";

/** Address heads: a path starting with one is read as an Address. */
const ADDRESS_HEADS = new Set([
  "installation",
  "layer",
  "scene",
  "controller",
  "macro",
  "fixture",
  "element",
]);

/**
 * Why `get` found nothing: for an Address, what is there instead (a
 * Layer's declared Parameters, Cues, Targets or Attributes), in the words
 * the person typed; otherwise where to look.
 */
function noValue(document: Document, typed: string, address: string): string {
  if (ADDRESS_HEADS.has(typed.split("/")[0] ?? ""))
    return (
      inTypedTerms(
        new Error(unknownAddress(document, address)),
        address,
        typed,
      ) as Error
    ).message;
  return `No value at “${typed}”: neither a document path nor an Address. \`refrata get\` alone prints the Installation; \`refrata addresses\` lists every Address.`;
}

/** "Energy · Value": the owner tells same-labelled rows apart. */
export function addressLabel(entry: {
  readonly owner?: string | undefined;
  readonly label: string;
}): string {
  return entry.owner === undefined
    ? entry.label
    : `${entry.owner} · ${entry.label}`;
}

/** Rows as columns each as wide as its widest cell, two spaces apart. */
export function formatTable(rows: readonly (readonly string[])[]): string {
  const widths: number[] = [];
  for (const row of rows)
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  return rows
    .map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index] ?? 0))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

export function registerRead(program: Command, cli: Cli): void {
  program
    .command("get [path]")
    .description(
      "Read the Installation, or one value by document path (controllers, installation/name, macros/<id|name>/actions) or by Address (controller/Energy/value, installation/blackout), a linked Address at its effective value. Nothing there is an error; --json wraps the value with the revision.",
    )
    .action((path: string | undefined) =>
      cli.withDocument(async (client, summary) => {
        const { document, view } = await cli.replica(client, summary.id);
        const revision = view.revision.get();
        if (path === undefined) {
          cli.print({ path: null, revision, value: document }, () =>
            JSON.stringify(document, null, 2),
          );
          return;
        }
        const resolved = resolvePathNames(document, path);
        const atPath = getAtPath(document, resolved.split("/"));
        if (atPath !== undefined) {
          cli.print({ path: resolved, revision, value: atPath }, () =>
            JSON.stringify(atPath, null, 2),
          );
          return;
        }
        // Not a document path: an Address, read the way a Link or OSC sees it.
        const address = resolveAddressNames(document, path);
        const entry = resolveAddress(document, address);
        if (entry === undefined)
          throw new Error(noValue(document, path, address));
        if (entry.type === "trigger")
          throw new Error(
            `“${path}” is a trigger, not a value; fire it with \`refrata trigger\`.`,
          );
        const value = effectiveValue(document, entry);
        cli.print({ path: address, revision, value }, () =>
          JSON.stringify(value, null, 2),
        );
      }),
    );

  program
    .command("addresses")
    .description(
      "List every controllable Address in the Installation with its value and Controller.",
    )
    .action(() =>
      cli.withDocument(async (client, summary) => {
        const { document } = await cli.replica(client, summary.id);
        const items = listAddresses(document).map((entry) => {
          const link = linkAt(document, entry.address);
          const controller =
            link === undefined
              ? undefined
              : document.controllers[link.controllerId];
          return {
            ...entry,
            value: getAtPath(document, entry.path) ?? entry.default,
            ...(link === undefined
              ? {}
              : {
                  link: {
                    id: link.id,
                    controllerId: link.controllerId,
                    anchors: link.anchors,
                    effective: effectiveValue(document, entry),
                  },
                }),
            controlledBy: controller?.name,
          };
        });
        cli.print(items, () =>
          formatTable(
            items.map((item) => [
              item.address,
              item.type,
              item.type === "trigger"
                ? "-"
                : JSON.stringify(item.link?.effective ?? item.value),
              addressLabel(item),
              item.controlledBy === undefined ? "" : `← ${item.controlledBy}`,
            ]),
          ),
        );
      }),
    );
}
