import type { FixtureKind } from "@refrata/core";
import { Folder, Lightbulb, Component, type LucideIcon } from "lucide-react";

export const fixtureIcons: Record<FixtureKind, LucideIcon> = {
  fixture: Lightbulb,
  group: Folder,
};

export const fixtureKindLabels: Record<FixtureKind, string> = {
  fixture: "Fixture",
  group: "Group",
};

/** An Element below the root. */
export const elementIcon: LucideIcon = Component;
