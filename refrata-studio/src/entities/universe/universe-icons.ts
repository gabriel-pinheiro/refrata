import type { OutputKind } from "@refrata/core";
import { Cable, Radio, Usb, type LucideIcon } from "lucide-react";

export const universeIcon: LucideIcon = Radio;

export const outputIcons: Record<OutputKind, LucideIcon> = {
  "enttec-open-dmx": Usb,
  "enttec-usb-pro": Cable,
};
