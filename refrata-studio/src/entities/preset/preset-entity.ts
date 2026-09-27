import type { EntityModule } from "@/entities";
import { groupParent } from "@/navigator/ancestor-rows";

import { PresetInspector } from "./preset-inspector";
import { PresetsSection } from "./presets-section";

export const presetEntity: EntityModule = {
  label: "Presets",
  Section: PresetsSection,
  Inspector: PresetInspector,
  parent: groupParent("preset", (document) => document.presets),
  removal: {
    noun: "Preset",
    command: "preset.remove",
    payload: (id) => ({ presetId: id }),
    find: (document, id) => document.presets[id],
  },
};
