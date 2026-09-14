import type { EntityModule } from "@/entities";

import { ElementInspector } from "./element-inspector";
import { FixtureInspector } from "./fixture-inspector";
import { FixturesSection } from "./fixtures-section";

export const fixtureEntity: EntityModule = {
  label: "Fixtures",
  Section: FixturesSection,
  Inspector: FixtureInspector,
};

/** Elements are rows under their Fixture; their id is `<fixtureId>/<key>`. */
export const elementEntity: EntityModule = {
  label: "Elements",
  Inspector: ElementInspector,
};
