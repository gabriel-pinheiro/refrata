import type { PresetKind } from "@refrata/core";
import { Bookmark, Folder, type LucideIcon } from "lucide-react";

export const presetIcons: Record<PresetKind, LucideIcon> = {
  preset: Bookmark,
  group: Folder,
};

export const presetKindLabels: Record<PresetKind, string> = {
  preset: "Preset",
  group: "Group",
};
