import type { DocumentView } from "@refrata/client";
import type { ComponentType } from "react";

import { controllerEntity } from "./controller/controller-entity";
import { elementEntity, fixtureEntity } from "./fixture/fixture-entity";
import { layerEntity } from "./layer/layer-entity";
import { macroEntity } from "./macro/macro-entity";
import { sceneEntity } from "./scene/scene-entity";
import { setEntity } from "./set/set-entity";
import { outputEntity, universeEntity } from "./universe/universe-entity";

/**
 * What one entity kind contributes to Studio: its navigator section and its
 * inspector. Each kind lives in its own folder under `entities/`; adding a
 * kind is one folder plus one line in `entities` below.
 */
export interface EntityModule {
  /** Section label in the navigator, plural. */
  readonly label: string;
  /** Top-level kinds have a section; child kinds render rows under their parent instead. */
  readonly Section?: ComponentType<{ readonly view: DocumentView }>;
  readonly Inspector: ComponentType<{
    readonly view: DocumentView;
    readonly id: string;
  }>;
}

export const entities = {
  universe: universeEntity,
  output: outputEntity,
  fixture: fixtureEntity,
  element: elementEntity,
  set: setEntity,
  scene: sceneEntity,
  layer: layerEntity,
  controller: controllerEntity,
  macro: macroEntity,
} as const satisfies Record<string, EntityModule>;

export type EntityKind = keyof typeof entities;

export const entityKinds = Object.keys(entities) as readonly EntityKind[];
