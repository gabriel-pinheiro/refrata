import { OUTPUT_LABELS, type Document } from "@refrata/core";

import type { OutputStatus } from "./live.ts";

/** The tables an Output's label is read from. */
export type OutputSource = Pick<Document, "outputs" | "universes">;

/**
 * An Output in words, the same in Studio and the CLI: "Universe 1 · Enttec
 * DMX USB Pro", with its device after when another Output would read the
 * same; its id when the document does not hold it.
 */
export function outputLabel(
  document: OutputSource | undefined,
  id: string,
): string {
  const output = document?.outputs[id];
  if (output === undefined) return id;
  const base = (candidate: typeof output): string =>
    `${document?.universes[candidate.universeId]?.name ?? candidate.universeId} · ${OUTPUT_LABELS[candidate.kind]}`;
  const label = base(output);
  const twin = Object.values(document?.outputs ?? {}).some(
    (other) => other.id !== output.id && base(other) === label,
  );
  return twin ? `${label} · ${output.device}` : label;
}

/** An Output's status in words: delivering on a path at a rate, or what keeps it from delivering. */
export function formatOutputStatus(output: OutputStatus): string {
  switch (output.state) {
    case "delivering":
      return `delivering on ${output.path ?? "?"} at ${String(output.fps)} fps`;
    case "device-missing":
      return `device missing${output.message === undefined ? "" : ` (${output.message})`}`;
    case "error":
      return `error${output.message === undefined ? "" : ` (${output.message})`}`;
  }
}

/** One line for an Output: its label, then its status. */
export function outputStatusLine(
  document: OutputSource | undefined,
  id: string,
  status: OutputStatus,
): string {
  return `${outputLabel(document, id)}: ${formatOutputStatus(status)}`;
}
