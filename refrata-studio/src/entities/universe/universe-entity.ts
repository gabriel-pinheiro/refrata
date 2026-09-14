import type { EntityModule } from "@/entities";

import { OutputInspector } from "./output-inspector";
import { UniverseInspector } from "./universe-inspector";
import { UniversesSection } from "./universes-section";

export const universeEntity: EntityModule = {
  label: "Universes",
  Section: UniversesSection,
  Inspector: UniverseInspector,
};

/** Outputs are rows under their Universe. */
export const outputEntity: EntityModule = {
  label: "Outputs",
  Inspector: OutputInspector,
};
