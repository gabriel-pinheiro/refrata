import type { EntityModule } from "@/entities";

import { SetInspector } from "./set-inspector";
import { SetsSection } from "./sets-section";

export const setEntity: EntityModule = {
  label: "Sets",
  Section: SetsSection,
  Inspector: SetInspector,
};
