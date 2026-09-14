import type { EntityModule } from "@/entities";

import { LayerInspector } from "./layer-inspector";

/** Layers are rows under their Scene in the navigator. */
export const layerEntity: EntityModule = {
  label: "Layers",
  Inspector: LayerInspector,
};
