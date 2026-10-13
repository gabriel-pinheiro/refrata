import {
  attributeInfo,
  nameFromKey,
  typeRemovalProblem,
  type Document,
  type Mode,
} from "@refrata/core";

import type { EntityModule } from "@/entities";

import { pickInspector } from "./pick-inspectors";
import { parsePick, type TypeKind } from "./type-ref";

function modeOf(document: Document, kind: TypeKind, id: string) {
  const ref = parsePick(kind, id);
  const type =
    ref === undefined ? undefined : document.fixtureTypes[ref.typeKey]?.type;
  const mode: Mode | undefined =
    ref?.modeKey === undefined ? undefined : type?.modes[ref.modeKey];
  return { ref, type, mode };
}

/** The payload fields every `type.*` command on a Mode starts with. */
function modeRef(kind: TypeKind, id: string) {
  const ref = parsePick(kind, id);
  return { typeKey: ref?.typeKey, modeKey: ref?.modeKey };
}

/** The key of the Channel, Element or Action a pick names. */
function keyOf(kind: TypeKind, id: string): string | undefined {
  const pick = parsePick(kind, id)?.pick;
  return pick !== undefined && "key" in pick ? pick.key : undefined;
}

/**
 * The Fixture Editor's kinds: a Fixture Type and, inside one of its Modes,
 * the Mode itself, a Channel, an Element, a Parameter and an Action. None
 * has a navigator section: the editor is the only place they are listed.
 * Each has an inspector and a Remove; what may not go is the command's to
 * refuse, in its own words.
 */
export const fixtureTypeEntity: EntityModule = {
  label: "Fixture Types",
  Inspector: pickInspector("fixtureType"),
  removal: {
    noun: "Fixture Type",
    command: "type.remove",
    payload: (id) => ({ typeKey: id }),
    find: (document, id) => {
      const type = document.fixtureTypes[id]?.type;
      return type === undefined
        ? undefined
        : { name: `${type.manufacturer} ${type.model}` };
    },
    refusal: (document, id) =>
      typeRemovalProblem(
        document.fixtures,
        document.fixtureTypes[id]?.type.model ?? id,
        id,
      ),
  },
};

export const typeModeEntity: EntityModule = {
  label: "Modes",
  Inspector: pickInspector("typeMode"),
  removal: {
    noun: "Mode",
    command: "type.mode.remove",
    payload: (id) => modeRef("typeMode", id),
    find: (document, id) => modeOf(document, "typeMode", id).mode,
  },
};

export const typeChannelEntity: EntityModule = {
  label: "Channels",
  Inspector: pickInspector("typeChannel"),
  removal: {
    noun: "Channel",
    command: "type.channel.remove",
    payload: (id) => ({
      ...modeRef("typeChannel", id),
      channel: keyOf("typeChannel", id),
    }),
    find: (document, id) => {
      const { mode } = modeOf(document, "typeChannel", id);
      const key = keyOf("typeChannel", id);
      return key !== undefined &&
        mode?.channels.some((channel) => channel.key === key) === true
        ? { name: nameFromKey(key) }
        : undefined;
    },
  },
};

export const typeElementEntity: EntityModule = {
  label: "Elements",
  Inspector: pickInspector("typeElement"),
  removal: {
    noun: "Element",
    command: "type.element.remove",
    payload: (id) => ({
      ...modeRef("typeElement", id),
      element: keyOf("typeElement", id),
    }),
    find: (document, id) => {
      const { ref, mode } = modeOf(document, "typeElement", id);
      return ref?.pick.kind === "element"
        ? mode?.elements[ref.pick.key]
        : undefined;
    },
  },
};

export const typeParameterEntity: EntityModule = {
  label: "Parameters",
  Inspector: pickInspector("typeParameter"),
  removal: {
    noun: "Parameter",
    command: "type.parameter.remove",
    payload: (id) => {
      const pick = parsePick("typeParameter", id)?.pick;
      return {
        ...modeRef("typeParameter", id),
        ...(pick?.kind === "parameter"
          ? { element: pick.element, attribute: pick.attribute }
          : {}),
      };
    },
    find: (document, id) => {
      const { ref, mode } = modeOf(document, "typeParameter", id);
      if (ref?.pick.kind !== "parameter") return undefined;
      const element = mode?.elements[ref.pick.element];
      return element?.parameters[ref.pick.attribute] === undefined
        ? undefined
        : {
            name: `${attributeInfo(ref.pick.attribute).label} of ${element.name}`,
          };
    },
  },
};

export const typeActionEntity: EntityModule = {
  label: "Actions",
  Inspector: pickInspector("typeAction"),
  removal: {
    noun: "Action",
    command: "type.action.remove",
    payload: (id) => ({
      ...modeRef("typeAction", id),
      action: keyOf("typeAction", id),
    }),
    find: (document, id) => {
      const { ref, mode } = modeOf(document, "typeAction", id);
      return ref?.pick.kind === "action"
        ? mode?.actions[ref.pick.key]
        : undefined;
    },
  },
};
