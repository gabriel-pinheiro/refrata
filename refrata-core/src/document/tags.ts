import { ROOT_ELEMENT_KEY } from "../rig/fixture-type.ts";
import { elementRef, type Element } from "../rig/elements.ts";
import type { Document } from "./document.ts";
import { allFixtures, fixtureElements } from "./fixtures.ts";
import type { PatchedFixture } from "./rig.ts";

/**
 * Tags are plain text on Elements. A Mode declares some, every Element's key
 * is one, a Fixture's root carries its Fixture Type's key, and a person adds
 * their own to a Fixture (its root) or to any Element. Nothing is copied
 * onto children; Tags above an Element count only while a Rule is matched.
 */

/** "Truss Left" becomes `truss-left`; empty when nothing usable is left. */
export function normaliseTag(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The Tags a person put on one Element of a Fixture, in the order added. */
export function personTags(
  fixture: PatchedFixture,
  key: string,
): readonly string[] {
  return key === ROOT_ELEMENT_KEY
    ? fixture.tags
    : (fixture.elementTags[key] ?? []);
}

/** Where a person's Tags for one Element are stored on the Fixture row. */
export function personTagsPath(
  fixture: PatchedFixture,
  key: string,
): readonly string[] {
  return key === ROOT_ELEMENT_KEY
    ? ["fixtures", fixture.id, "tags"]
    : ["fixtures", fixture.id, "elementTags", key];
}

/** The Tags nobody can edit: the key, the Mode's, and on the root the Fixture Type's key. */
export function declaredTags(
  fixture: PatchedFixture,
  element: Element,
): readonly string[] {
  return element.parentKey === null
    ? [...new Set([...element.tags, fixture.typeKey])]
    : element.tags;
}

/** Every Tag on an Element itself: declared first, then the person's. */
export function elementTags(
  fixture: PatchedFixture,
  element: Element,
): readonly string[] {
  return [
    ...new Set([
      ...declaredTags(fixture, element),
      ...personTags(fixture, element.key),
    ]),
  ];
}

export interface TagUse {
  readonly tag: string;
  /** Elements carrying it, declared or by a person. */
  readonly count: number;
  /** Whether a Mode, a key or a Fixture Type key declares it somewhere. */
  readonly declared: boolean;
  /** Whether a person added it somewhere. */
  readonly person: boolean;
}

/** Every Tag present in the Rig with how many Elements carry it, by name. */
export function tagsInUse(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
): readonly TagUse[] {
  const uses = new Map<
    string,
    { count: number; declared: boolean; person: boolean }
  >();
  const use = (tag: string) => {
    let entry = uses.get(tag);
    if (entry === undefined) {
      entry = { count: 0, declared: false, person: false };
      uses.set(tag, entry);
    }
    return entry;
  };
  for (const fixture of allFixtures(document.fixtures))
    for (const element of fixtureElements(document, fixture)) {
      const declared = declaredTags(fixture, element);
      for (const tag of declared) use(tag).declared = true;
      for (const tag of personTags(fixture, element.key))
        use(tag).person = true;
      for (const tag of elementTags(fixture, element)) use(tag).count += 1;
    }
  return [...uses.entries()]
    .map(([tag, entry]) => ({ tag, ...entry }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * The members of one Rule: walking down from each Fixture root in navigator
 * order, the first Element at which every Tag of the Rule has been met, on
 * it or above it; nothing below a member is added. A Rule with no Tags is
 * met at every root.
 */
export function matchRule(
  document: Pick<Document, "fixtures" | "fixtureTypes">,
  rule: readonly string[],
): readonly string[] {
  const refs: string[] = [];
  for (const fixture of allFixtures(document.fixtures)) {
    const byKey = new Map(
      fixtureElements(document, fixture).map((element) => [
        element.key,
        element,
      ]),
    );
    const visit = (key: string, missing: readonly string[]): void => {
      const element = byKey.get(key);
      if (element === undefined) return;
      const own = new Set(elementTags(fixture, element));
      const left = missing.filter((tag) => !own.has(tag));
      if (left.length === 0) {
        refs.push(elementRef(fixture.id, key));
        return;
      }
      for (const child of element.children) visit(child, left);
    };
    visit(ROOT_ELEMENT_KEY, rule);
  }
  return refs;
}
