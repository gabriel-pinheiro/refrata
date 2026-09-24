import { OUTPUT_LABELS } from "@refrata/core";

import type { EntityModule } from "@/entities";

import { OutputInspector } from "./output-inspector";
import { UniverseInspector } from "./universe-inspector";
import { UniversesSection } from "./universes-section";

export const universeEntity: EntityModule = {
  label: "Universes",
  Section: UniversesSection,
  Inspector: UniverseInspector,
  removal: {
    noun: "Universe",
    command: "universe.remove",
    payload: (id) => ({ universeId: id }),
    find: (document, id) => document.universes[id],
  },
};

/** Outputs are rows under their Universe. */
export const outputEntity: EntityModule = {
  label: "Outputs",
  Inspector: OutputInspector,
  removal: {
    noun: "Output",
    command: "output.remove",
    payload: (id) => ({ outputId: id }),
    find: (document, id) => {
      const output = document.outputs[id];
      return output === undefined
        ? undefined
        : { name: `${OUTPUT_LABELS[output.kind]} · ${output.device}` };
    },
  },
};
