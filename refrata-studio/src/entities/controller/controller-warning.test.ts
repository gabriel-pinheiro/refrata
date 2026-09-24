import type { Controller, Link, Table } from "@refrata/core";
import { describe, expect, it } from "vitest";

import {
  controllerWarning,
  countControllerWarnings,
  linkedControllers,
} from "./controller-warning.ts";

const controllers = {
  energy: { id: "energy", kind: "number", name: "Energy", value: 0 },
  tint: { id: "tint", kind: "color", name: "Tint", value: [1, 1, 1, 1] },
  bank: { id: "bank", kind: "group", name: "Bank" },
} as unknown as Record<"energy" | "tint" | "bank", Controller>;
const links = {
  l: { id: "l", controllerId: "energy", address: "installation/master" },
} as unknown as Table<Link>;

describe("controllerWarning", () => {
  it("warns a Number or Color Controller nothing is linked to, never a Group", () => {
    const linked = linkedControllers(links);
    expect(controllerWarning(controllers.energy, linked)).toBeUndefined();
    expect(controllerWarning(controllers.tint, linked)?.label).toBe(
      "Not linked",
    );
    expect(controllerWarning(controllers.bank, linked)).toBeUndefined();
  });

  it("counts the rows that would warn", () => {
    expect(countControllerWarnings(controllers, links)).toBe(1);
    expect(countControllerWarnings(controllers, {})).toBe(2);
    expect(countControllerWarnings({}, links)).toBe(0);
  });
});
