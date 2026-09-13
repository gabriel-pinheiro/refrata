import type { CommandDefinition } from "../command/command.ts";
import { CommandRegistry } from "../command/registry.ts";
import { addressEdit } from "./address.edit.ts";
import { addressSet, addressToggle } from "./address.set.ts";
import { addressTrigger } from "./address.trigger.ts";
import { controllerCreate } from "./controller.create.ts";
import { controllerDuplicate } from "./controller.duplicate.ts";
import { controllerMove } from "./controller.move.ts";
import { controllerRemove } from "./controller.remove.ts";
import { controllerRename } from "./controller.rename.ts";
import { controllerUngroup } from "./controller.ungroup.ts";
import { entityMove } from "./entity.move.ts";
import { installationRename } from "./installation.rename.ts";
import { linkCreate } from "./link.create.ts";
import { linkRemove } from "./link.remove.ts";
import { linkUpdate } from "./link.update.ts";
import { macroActionMove } from "./macro.action.move.ts";
import { macroActionRemove } from "./macro.action.remove.ts";
import { macroActionUpdate } from "./macro.action.update.ts";
import { macroActionsAdd } from "./macro.actions.add.ts";
import { macroCreate } from "./macro.create.ts";
import { macroDuplicate } from "./macro.duplicate.ts";
import { macroMove } from "./macro.move.ts";
import { macroRemove } from "./macro.remove.ts";
import { macroRename } from "./macro.rename.ts";
import { macroUngroup } from "./macro.ungroup.ts";

/** Every built-in command. Add one import line per new command file. */
export const builtInCommands: readonly CommandDefinition<never>[] = [
  installationRename,
  controllerCreate,
  controllerRename,
  controllerMove,
  controllerDuplicate,
  controllerUngroup,
  controllerRemove,
  linkCreate,
  linkUpdate,
  linkRemove,
  macroCreate,
  macroRename,
  macroMove,
  macroUngroup,
  macroDuplicate,
  macroRemove,
  macroActionsAdd,
  macroActionUpdate,
  macroActionRemove,
  macroActionMove,
  addressEdit,
  addressSet,
  addressToggle,
  addressTrigger,
  entityMove,
] as unknown as readonly CommandDefinition<never>[];

/** Every built-in command in one registry, the one the runtime and the tests use. */
export function createBuiltInRegistry(): CommandRegistry {
  return new CommandRegistry(builtInCommands);
}
