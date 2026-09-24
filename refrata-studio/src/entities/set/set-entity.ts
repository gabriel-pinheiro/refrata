import type { EntityModule } from "@/entities";

import { SetInspector } from "./set-inspector";
import { SetsSection } from "./sets-section";

export const setEntity: EntityModule = {
  label: "Sets",
  Section: SetsSection,
  Inspector: SetInspector,
  removal: {
    noun: "Fixture Set",
    command: "set.remove",
    payload: (id) => ({ setId: id }),
    find: (document, id) => document.fixtureSets[id],
  },
};
