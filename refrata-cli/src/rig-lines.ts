import {
  declaredTags,
  fixtureElements,
  fixtureFootprint,
  fixtureModeOf,
  formatFrame,
  personTags,
  universeRuns,
  type Document,
  type Element,
  type Fixture,
  type PatchedFixture,
} from "@refrata/core";
import type { LibraryEntry } from "@refrata/protocol";

import { formatTreeNodes, treeNodes } from "./tree-nodes.ts";

/**
 * The Rig as the CLI shows it: Fixtures in their Groups with their Elements
 * under them and each one's Tags (declared, then the person's after a +),
 * the library as one line per type, and a Fixture's Patch as
 * `Universe 1 @ 4 (32ch, 32 channels)`, and a Universe as runs of
 * addresses, each patched Fixture's and each free gap's, with the bytes
 * going out over them.
 */
export function describePatch(
  document: Document,
  fixture: PatchedFixture,
): string {
  const footprint = fixtureFootprint(document, fixture);
  const width = `${String(footprint)} ${footprint === 1 ? "channel" : "channels"}`;
  if (fixture.patch === null) return `unpatched (${fixture.modeKey}, ${width})`;
  const universe =
    document.universes[fixture.patch.universeId]?.name ??
    fixture.patch.universeId;
  return `${universe} @ ${String(fixture.patch.address)} (${fixture.modeKey}, ${width})`;
}

/** "[panel-1 panel odd top +hero]": declared Tags, then the person's marked with a +. */
export function describeTags(
  fixture: PatchedFixture,
  element: Element,
): string {
  const tags = [
    ...declaredTags(fixture, element),
    ...personTags(fixture, element.key).map((tag) => `+${tag}`),
  ];
  return `[${tags.join(" ")}]`;
}

function describeFixture(document: Document, fixture: Fixture): string {
  const head = `“${fixture.name}”  ${fixture.id}`;
  if (fixture.kind === "group") return `Group ${head}`;
  const root = fixtureElements(document, fixture).find(
    (element) => element.parentKey === null,
  );
  const tags = root === undefined ? "" : `  ${describeTags(fixture, root)}`;
  const actions = Object.keys(fixtureModeOf(document, fixture)?.actions ?? {});
  const runs = actions.length === 0 ? "" : `  actions: ${actions.join(", ")}`;
  return `Fixture ${head}  ${fixture.typeKey}  ${describePatch(document, fixture)}${tags}${runs}`;
}

/** Fixtures in their Groups, each Fixture followed by its Element tree. */
export function formatFixtures(document: Document): string[] {
  const nodes = treeNodes(document.fixtures);
  const lines: string[] = [];
  const visit = (rows: typeof nodes, depth: number): void => {
    for (const row of rows) {
      lines.push(
        ...formatTreeNodes(
          [{ ...row, children: [] }],
          (fixture) => describeFixture(document, fixture),
          depth,
        ),
      );
      if (row.kind === "fixture")
        for (const element of fixtureElements(document, row)) {
          if (element.parentKey === null) continue;
          const parameters = Object.keys(element.parameters).join(", ");
          lines.push(
            `${"  ".repeat(depth + element.depth)}${element.name}  ${row.id}/${element.key}${parameters === "" ? "" : `  ${parameters}`}  ${describeTags(row, element)}`,
          );
        }
      visit(row.children, depth + 1);
    }
  };
  visit(nodes, 0);
  return lines;
}

export function formatLibrary(entries: readonly LibraryEntry[]): string[] {
  return entries.map(
    (entry) =>
      `${entry.key.padEnd(24)} ${entry.manufacturer} ${entry.model}  modes: ${entry.modes
        .map((mode) => `${mode.key} (${String(mode.footprint)}ch)`)
        .join(
          ", ",
        )}${entry.source === "installation" ? "  [from the Installation]" : ""}${entry.stale === true ? "  [the Installation's copy differs: fixtures reload]" : ""}`,
  );
}

/** One run of `refrata dmx --map`: what is patched over it, or null for a free gap. */
export interface UniverseMapRun {
  readonly start: number;
  readonly end: number;
  readonly fixture: {
    readonly id: string;
    readonly name: string;
    readonly modeKey: string;
  } | null;
  readonly bytes: readonly number[];
}

/** A Universe's runs with the bytes of `frame` (512, from address 1) cut to each. */
export function universeMapRuns(
  document: Document,
  universeId: string,
  frame: readonly number[],
): readonly UniverseMapRun[] {
  return universeRuns(document, universeId).map((run) => ({
    start: run.start,
    end: run.end,
    fixture:
      run.fixture === undefined
        ? null
        : {
            id: run.fixture.id,
            name: run.fixture.name,
            modeKey: run.fixture.modeKey,
          },
    bytes: frame.slice(run.start - 1, run.end),
  }));
}

/**
 * `4-6      Par (3ch, 3 channels)   0 0 255`: one line per run. A free gap
 * prints its bytes only when something (the DMX Tester) forces them above 0.
 */
export function formatUniverseMap(runs: readonly UniverseMapRun[]): string[] {
  const label = (run: UniverseMapRun): string => {
    if (run.fixture === null) return "free";
    const width = run.end - run.start + 1;
    return `${run.fixture.name} (${run.fixture.modeKey}, ${String(width)} ${width === 1 ? "channel" : "channels"})`;
  };
  const labels = runs.map(label);
  const labelWidth = Math.max(...labels.map((text) => text.length));
  return runs.map((run, index) => {
    const range = `${String(run.start)}-${String(run.end)}`.padEnd(8);
    const shown =
      run.fixture !== null || run.bytes.some((byte) => byte !== 0)
        ? `  ${formatFrame(run.bytes)}`
        : "";
    return `${range} ${(labels[index] ?? "").padEnd(labelWidth)}${shown}`.trimEnd();
  });
}
