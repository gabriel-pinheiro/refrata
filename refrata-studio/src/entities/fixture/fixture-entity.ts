import type { EntityModule } from "@/entities";
import { groupParent } from "@/navigator/ancestor-rows";

import { ElementInspector } from "./element-inspector";
import { elementParent } from "./element-parent";
import { FixtureInspector } from "./fixture-inspector";
import { FixturesSection } from "./fixtures-section";

export const fixtureEntity: EntityModule = {
  label: "Fixtures",
  Section: FixturesSection,
  Inspector: FixtureInspector,
  parent: groupParent("fixture", (document) => document.fixtures),
  removal: {
    noun: "Fixture",
    command: "fixture.remove",
    payload: (id) => ({ fixtureId: id }),
    find: (document, id) => document.fixtures[id],
  },
};

/**
 * Elements are rows under their Fixture; their id is `<fixtureId>/<key>`.
 * They are parts of their Fixture's type, so they have no Remove.
 */
export const elementEntity: EntityModule = {
  label: "Elements",
  Inspector: ElementInspector,
  parent: elementParent,
};
