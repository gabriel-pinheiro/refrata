import type { Controller, Link, Table } from "@refrata/core";

/** What keeps a Controller from moving anything, as a navigator warning. */
export interface ControllerWarning {
  readonly label: string;
  readonly explanation: string;
}

/** The Controllers that at least one Link names. */
export function linkedControllers(links: Table<Link>): ReadonlySet<string> {
  return new Set(Object.values(links).map((link) => link.controllerId));
}

/** The one warning a Controller's row shows: a Number or Color Controller nothing is linked to. Groups get none. */
export function controllerWarning(
  controller: Controller,
  linked: ReadonlySet<string>,
): ControllerWarning | undefined {
  if (controller.kind === "group" || linked.has(controller.id))
    return undefined;
  return {
    label: "Not linked",
    explanation:
      "This Controller moves nothing until an Address is linked to it, from that Address's row in an inspector.",
  };
}

/** How many Controller rows would warn: what a collapsed section says. */
export function countControllerWarnings(
  controllers: Table<Controller>,
  links: Table<Link>,
): number {
  const linked = linkedControllers(links);
  return Object.values(controllers).filter(
    (controller) => controllerWarning(controller, linked) !== undefined,
  ).length;
}
