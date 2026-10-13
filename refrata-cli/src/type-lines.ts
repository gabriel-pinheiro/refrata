import {
  addressText,
  channelRows,
  fixturesOfType,
  footprintOf,
  originOf,
  originText,
  RULES,
  type ChannelRow,
  type Document,
  type FixtureTypeStanding,
  type Mode,
  type Segment,
} from "@refrata/core";

/**
 * Fixture Types as the CLI shows them: the Installation's types one per
 * line with where each came from, how it stands against the library and
 * how many Fixtures use it, and one Mode as the chart a manual prints.
 */
export type Standings = Readonly<Record<string, FixtureTypeStanding>>;

const plural = (count: number, noun: string): string =>
  `${String(count)} ${noun}${count === 1 ? "" : "s"}`;

/** The key of the held type `text` names: a key, or a model or "manufacturer model" ignoring case. */
export function resolveTypeKey(document: Document, text: string): string {
  if (text in document.fixtureTypes) return text;
  const wanted = text.trim().toLowerCase();
  const matches = Object.values(document.fixtureTypes).filter(
    ({ type }) =>
      type.model.toLowerCase() === wanted ||
      `${type.manufacturer} ${type.model}`.toLowerCase() === wanted,
  );
  const [only] = matches;
  if (only !== undefined && matches.length === 1) return only.type.key;
  throw new Error(
    matches.length === 0
      ? `The Installation holds no Fixture Type “${text}”. "types" lists them.`
      : `${String(matches.length)} Fixture Types are called “${text}”; use a key: ${matches.map(({ type }) => type.key).join(", ")}.`,
  );
}

/** The Installation's types, one per line, by key. */
export function formatTypes(
  document: Document,
  standings: Standings,
): string[] {
  const held = Object.values(document.fixtureTypes).sort((a, b) =>
    a.type.key.localeCompare(b.type.key),
  );
  if (held.length === 0) return ["The Installation holds no Fixture Types."];
  return held.map(({ type, ...stored }) => {
    const users = fixturesOfType(document.fixtures, type.key).length;
    const modes = Object.entries(type.modes)
      .map(([key, mode]) => `${key} (${String(footprintOf(mode))}ch)`)
      .join(", ");
    return `${type.key.padEnd(28)} ${type.manufacturer} ${type.model}  [${originText(originOf(stored), standings[type.key])}]  ${plural(users, "Fixture")}  modes: ${modes}`;
  });
}

function rangeText(segment: Segment): string {
  const bytes =
    segment.from === segment.to
      ? String(segment.from)
      : `${String(segment.from)}-${String(segment.to)}`;
  return `${bytes} ${segment.label}`;
}

/** What writes a Channel: each Parameter with its rule, and the named ranges it has there. */
function writtenBy(row: ChannelRow): string {
  if (row.writers.length === 0) return "not mapped";
  return row.writers
    .map((writer) => {
      const ranges = row.segments
        .filter(
          (segment) =>
            segment.element === writer.element &&
            segment.attribute === writer.attribute &&
            segment.kind !== "scale" &&
            segment.kind !== "mix",
        )
        .map(rangeText);
      const head = `${writer.attribute} (${RULES[writer.rule].label.toLowerCase()})`;
      return ranges.length === 0 ? head : `${head}: ${ranges.join(", ")}`;
    })
    .join("; ");
}

/**
 * One Mode as a chart: a head line, then a line per Channel with its place
 * in the Footprint, its name, its width when wider than a byte, its
 * Element, the Parameters that write it and their ranges; then its Actions.
 */
export function formatChart(modeKey: string, mode: Mode): string[] {
  const rows = channelRows(mode);
  const lines = [
    `Mode ${modeKey} “${mode.name}”  Footprint ${String(footprintOf(mode))}  ${plural(Object.keys(mode.elements).length, "Element")}`,
  ];
  const place = Math.max(...rows.map((row) => addressText(row).length));
  const name = Math.max(...rows.map((row) => row.name.length));
  const element = Math.max(...rows.map((row) => row.element.length));
  for (const row of rows) {
    const width = row.bytes === 1 ? "      " : `${String(row.bytes * 8)} bit`;
    lines.push(
      `${addressText(row).padEnd(place)}  ${row.name.padEnd(name)}  ${width}  ${row.element.padEnd(element)}  ${writtenBy(row)}`,
    );
  }
  for (const [key, action] of Object.entries(mode.actions)) {
    const row = rows.find((each) => each.key === action.channel);
    lines.push(
      `Action ${key} “${action.name}”  byte ${String(action.byte)} on ${row === undefined ? action.channel : `${addressText(row)} ${row.name}`} for ${String(action.seconds)} s`,
    );
  }
  return lines;
}
