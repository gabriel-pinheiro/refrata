import {
  declaredTags,
  fixtureElements,
  fixtureFootprint,
  fixtureModeOf,
  personTags,
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
 * `Universe 1 @ 4 (32ch, 32 channels)`.
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
