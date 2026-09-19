import type { FixtureSetKind } from "@refrata/core";
import { Folder, Group, Tags, type LucideIcon } from "lucide-react";

export const setIcons: Record<FixtureSetKind, LucideIcon> = {
  set: Group,
  group: Folder,
};

/** A Set by rule: its members come from Tags. */
export const ruleSetIcon: LucideIcon = Tags;
