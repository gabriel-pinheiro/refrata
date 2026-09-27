import type { EntityModule } from "@/entities";

import { PresetInspector } from "./preset-inspector";
import { PresetsSection } from "./presets-section";

export const presetEntity: EntityModule = {
  label: "Presets",
  Section: PresetsSection,
  Inspector: PresetInspector,
  removal: {
    noun: "Preset",
    command: "preset.remove",
    payload: (id) => ({ presetId: id }),
    find: (document, id) => document.presets[id],
  },
};
