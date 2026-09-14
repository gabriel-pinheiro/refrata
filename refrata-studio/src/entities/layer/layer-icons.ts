import type { LayerKind } from "@refrata/core";
import { Folder, Layers2, type LucideIcon } from "lucide-react";

export const layerIcons: Record<LayerKind, LucideIcon> = {
  look: Layers2,
  group: Folder,
};
