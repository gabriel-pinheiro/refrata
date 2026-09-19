import {
  normaliseTag,
  tagsInUse,
  type Document,
  type TagUse,
} from "@refrata/core";

/**
 * Tags and Rules as the CLI reads and shows them: what a person types is
 * normalised ("Truss Left" becomes truss-left), a Rule is a comma list of
 * Tags shown as "panel + odd", and the Rule with no Tags is "every Fixture".
 */
export interface NormalisedTags {
  readonly tags: string[];
  /** One line per Tag that changed on the way in. */
  readonly notes: string[];
}

/** Tags as typed, normalised; a Tag with nothing usable in it is an error. */
export function normaliseTags(texts: readonly string[]): NormalisedTags {
  const tags: string[] = [];
  const notes: string[] = [];
  for (const text of texts) {
    const tag = normaliseTag(text);
    if (tag === "")
      throw new Error(
        `“${text}” has nothing a Tag can keep (lowercase letters, digits and dashes).`,
      );
    if (tag !== text) notes.push(`“${text}” is written ${tag}`);
    if (!tags.includes(tag)) tags.push(tag);
  }
  return { tags, notes };
}

/** A Rule from its comma list: "panel,odd"; the empty text is the Rule with no Tags. */
export function parseRule(text: string): NormalisedTags {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return normaliseTags(parts);
}

/** "panel + odd", or "every Fixture"; Tags in `unmatched` are marked. */
export function formatRule(
  rule: readonly string[],
  unmatched: ReadonlySet<string> = new Set(),
): string {
  if (rule.length === 0) return "every Fixture";
  return rule
    .map((tag) => (unmatched.has(tag) ? `${tag} (matches nothing)` : tag))
    .join(" + ");
}

/** The Tags among `rules` that no Element of the Rig carries. */
export function unmatchedTags(
  document: Document,
  rules: readonly (readonly string[])[],
): ReadonlySet<string> {
  const present = new Set(tagsInUse(document).map((use) => use.tag));
  return new Set(rules.flat().filter((tag) => !present.has(tag)));
}

function describeSource(use: TagUse): string {
  if (use.declared && use.person) return "declared and person's";
  return use.declared ? "declared" : "person's";
}

/** One line per Tag in the Rig: its count and who put it there. */
export function formatTags(document: Document): string[] {
  const uses = tagsInUse(document);
  const width = Math.max(0, ...uses.map((use) => use.tag.length));
  return uses.map(
    (use) =>
      `${use.tag.padEnd(width)}  ${String(use.count).padStart(3)} ${use.count === 1 ? "Element " : "Elements"}  ${describeSource(use)}`,
  );
}

/** A 1-based Rule number as a person types it, as the command's index. */
export function ruleIndex(text: string): number {
  const number = Number(text);
  if (!Number.isInteger(number) || number < 1)
    throw new Error(`“${text}” is not a Rule number; Rules count from 1.`);
  return number - 1;
}
