import { z } from "zod";

import { accepted, defineCommand, rejected } from "../command/command.ts";
import { ensureFixtureType } from "../document/fixture-types.ts";
import {
  childFixtures,
  nextFreeAddress,
  patchProblem,
  placementFor,
} from "../document/fixtures.ts";
import { uniqueName } from "../document/names.ts";
import { orderedEntries } from "../document/order.ts";
import type { Patch } from "../document/patch.ts";
import {
  FIXTURE_KINDS,
  FIXTURE_LABELS,
  type Fixture,
  type FixturePatch,
} from "../document/rig.ts";
import { orderKeyForNew } from "../document/tree.ts";
import { generateId, id } from "../ids.ts";
import { applyPatches } from "../document/patch.ts";
import { elementsOf } from "../rig/elements.ts";
import { footprintOf, FixtureTypeSchema } from "../rig/fixture-type.ts";
import { placeShape, shapeWidth } from "../rig/shapes.ts";

/**
 * A new Fixture copies its Fixture Type into the Installation (pass
 * `fixtureType` unless the Installation holds the key already), takes the
 * next free address of its Universe (the first Universe unless told, or
 * stays unpatched when nothing fits), and lands one gap to the right of the
 * rightmost Fixture. A Group only arranges Fixtures in the navigator.
 */
export const fixtureCreate = defineCommand({
  name: "fixture.create",
  kind: "authoring",
  description:
    "Add a Fixture of a Fixture Type and Mode (patched at the next free address) or a Group.",
  payload: z
    .object({
      id: z.string().min(1).optional(),
      kind: z.enum(FIXTURE_KINDS).default("fixture"),
      /** Group to add into; null for the root. */
      parentId: z.string().min(1).nullable().default(null),
      name: z.string().trim().min(1).max(120).optional(),
      typeKey: z.string().min(1).optional(),
      modeKey: z.string().min(1).optional(),
      /** The Fixture Type itself, when the Installation does not hold `typeKey` yet. */
      fixtureType: FixtureTypeSchema.optional(),
      /** Universe to patch into; defaults to the first. */
      universeId: z.string().min(1).optional(),
      /** Start address; defaults to the next free run. */
      address: z.number().int().min(1).max(512).optional(),
      /** Leave the Fixture unpatched. */
      unpatched: z.boolean().optional(),
      /** Sibling to land after; null or absent for first. */
      after: z.string().min(1).nullable().optional(),
    })
    .strict(),
  label: ({ kind }) => `Add ${FIXTURE_LABELS[kind]}`,
  apply({ document, payload }) {
    const fixtureId =
      payload.id === undefined
        ? generateId("fixture")
        : id("fixture", payload.id);
    if (fixtureId in document.fixtures)
      return rejected(`Fixture “${fixtureId}” already exists.`);
    if (payload.parentId !== null) {
      const parent = document.fixtures[payload.parentId];
      if (parent?.kind !== "group")
        return rejected(`“${payload.parentId}” is not a Fixture Group.`);
    }
    const siblings = childFixtures(document.fixtures, payload.parentId);
    const order = orderKeyForNew(siblings, payload.after ?? null, "Fixture");
    if (typeof order !== "string") return rejected(order.error);
    const taken = siblings.map((sibling) => sibling.name);
    if (payload.kind === "group") {
      const group: Fixture = {
        id: fixtureId,
        kind: "group",
        name: uniqueName(taken, payload.name ?? "Group"),
        parentId: payload.parentId,
        order,
      };
      return accepted([
        { op: "set", path: ["fixtures", fixtureId], value: group },
      ]);
    }
    if (payload.typeKey === undefined || payload.modeKey === undefined)
      return rejected("A Fixture needs typeKey and modeKey.");
    const typePatches = ensureFixtureType(
      document,
      payload.typeKey,
      payload.fixtureType,
    );
    if ("error" in typePatches) return rejected(typePatches.error);
    const withType = applyPatches(document, typePatches);
    const mode =
      withType.fixtureTypes[payload.typeKey]?.type.modes[payload.modeKey];
    if (mode === undefined)
      return rejected(
        `Fixture Type “${payload.typeKey}” has no Mode “${payload.modeKey}”.`,
      );
    const patch = patchFor(withType, payload, footprintOf(mode));
    if (typeof patch === "string") return rejected(patch);
    const fixture: Fixture = {
      id: fixtureId,
      kind: "fixture",
      name: uniqueName(
        taken,
        payload.name ??
          withType.fixtureTypes[payload.typeKey]?.type.model ??
          "Fixture",
      ),
      parentId: payload.parentId,
      order,
      typeKey: payload.typeKey,
      modeKey: payload.modeKey,
      patch,
      position: placementFor(
        withType,
        shapeWidth(placeShape(mode.shape, elementsOf(mode))),
      ),
      tags: [],
      elementTags: {},
    };
    const patches: Patch[] = [
      ...typePatches,
      { op: "set", path: ["fixtures", fixtureId], value: fixture },
    ];
    return accepted(patches);
  },
});

/** The Patch for a new Fixture, null when unpatched or nothing fits, or an error for a bad request. */
function patchFor(
  document: Parameters<typeof patchProblem>[0],
  payload: {
    readonly universeId?: string | undefined;
    readonly address?: number | undefined;
    readonly unpatched?: boolean | undefined;
  },
  footprint: number,
): FixturePatch | null | string {
  if (payload.unpatched === true) return null;
  const universeId =
    payload.universeId ?? orderedEntries(document.universes)[0]?.id;
  if (universeId === undefined) return null;
  if (!(universeId in document.universes))
    return `Universe “${universeId}” does not exist.`;
  if (payload.address !== undefined) {
    const problem = patchProblem(
      document,
      universeId,
      payload.address,
      footprint,
    );
    return problem ?? { universeId, address: payload.address };
  }
  const address = nextFreeAddress(document, universeId, footprint);
  return address === undefined ? null : { universeId, address };
}
