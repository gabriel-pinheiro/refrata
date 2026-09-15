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
import { fixtureCreate } from "./fixture.create.ts";
import { fixtureMove } from "./fixture.move.ts";
import { fixturePatch } from "./fixture.patch.ts";
import { fixturePlace } from "./fixture.place.ts";
import { fixtureRemove } from "./fixture.remove.ts";
import { fixtureRename } from "./fixture.rename.ts";
import { fixtureUngroup } from "./fixture.ungroup.ts";
import { fixtureUpdate } from "./fixture.update.ts";
import { installationRename } from "./installation.rename.ts";
import { layerCreate } from "./layer.create.ts";
import { layerDuplicate } from "./layer.duplicate.ts";
import { layerMove } from "./layer.move.ts";
import { layerRemove } from "./layer.remove.ts";
import { layerRename } from "./layer.rename.ts";
import { layerRowRelease } from "./layer.row.release.ts";
import { layerRowSet } from "./layer.row.set.ts";
import { layerTargetsAdd } from "./layer.targets.add.ts";
import { layerTargetsMove } from "./layer.targets.move.ts";
import { layerTargetsRemove } from "./layer.targets.remove.ts";
import { layerUngroup } from "./layer.ungroup.ts";
import { layerUpdate } from "./layer.update.ts";
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
import { outputCreate } from "./output.create.ts";
import { outputRemove } from "./output.remove.ts";
import { outputUpdate } from "./output.update.ts";
import { sceneCreate } from "./scene.create.ts";
import { sceneDuplicate } from "./scene.duplicate.ts";
import { sceneMove } from "./scene.move.ts";
import { sceneRemove } from "./scene.remove.ts";
import { sceneRename } from "./scene.rename.ts";
import { setCreate } from "./set.create.ts";
import { setMembersAdd } from "./set.members.add.ts";
import { setMembersMove } from "./set.members.move.ts";
import { setMembersRemove } from "./set.members.remove.ts";
import { setMove } from "./set.move.ts";
import { setRemove } from "./set.remove.ts";
import { setRename } from "./set.rename.ts";
import { setUngroup } from "./set.ungroup.ts";
import { testerHold } from "./tester.hold.ts";
import { testerRelease, testerSet, testerZero } from "./tester.set.ts";
import { universeCreate } from "./universe.create.ts";
import { universeRemove } from "./universe.remove.ts";
import { universeRename } from "./universe.rename.ts";

/** Every built-in command. Add one import line per new command file. */
export const builtInCommands: readonly CommandDefinition<never>[] = [
  installationRename,
  universeCreate,
  universeRename,
  universeRemove,
  outputCreate,
  outputUpdate,
  outputRemove,
  fixtureCreate,
  fixtureRename,
  fixtureMove,
  fixtureUngroup,
  fixtureUpdate,
  fixturePatch,
  fixturePlace,
  fixtureRemove,
  setCreate,
  setRename,
  setMove,
  setUngroup,
  setRemove,
  setMembersAdd,
  setMembersRemove,
  setMembersMove,
  sceneCreate,
  sceneRename,
  sceneMove,
  sceneDuplicate,
  sceneRemove,
  layerCreate,
  layerRename,
  layerMove,
  layerUngroup,
  layerDuplicate,
  layerUpdate,
  layerTargetsAdd,
  layerTargetsRemove,
  layerTargetsMove,
  layerRowSet,
  layerRowRelease,
  layerRemove,
  controllerCreate,
  controllerRename,
  controllerMove,
  controllerDuplicate,
  controllerUngroup,
  controllerRemove,
  linkCreate,
  linkUpdate,
  linkRemove,
  testerHold,
  testerSet,
  testerZero,
  testerRelease,
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
