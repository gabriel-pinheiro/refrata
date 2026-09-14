import type { FixtureSetKind } from "@refrata/core";
import { Folder, Group, type LucideIcon } from "lucide-react";

export const setIcons: Record<FixtureSetKind, LucideIcon> = {
  set: Group,
  group: Folder,
};
