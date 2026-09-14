import {
  ALL_TARGETS_REF,
  isAllTargetsRef,
  parseSetRef,
  sameName,
  SET_REF_PREFIX,
  setRef,
  TABLE_SCHEMAS,
  type Document,
  type TableName,
} from "@refrata/core";

/**
 * Names stand in for ids at the CLI boundary: an Address segment or a
 * payload field that names an entity may carry its name instead of its id.
 * An existing id always wins; otherwise the name must match exactly one
 * entity of the table, compared the way the document keeps names unique
 * (ignoring case and surrounding whitespace). The runtime and the domain
 * never see names: what leaves here is ids.
 */
const NOUNS: Record<TableName, string> = {
  universes: "Universe",
  outputs: "Output",
  fixtureTypes: "Fixture Type",
  fixtures: "Fixture",
  fixtureSets: "Fixture Set",
  scenes: "Scene",
  layers: "Layer",
  controllers: "Controller",
  links: "Link",
  macros: "Macro",
};

/** Address heads whose next segment names an entity. */
const ADDRESS_TABLES: Readonly<Record<string, TableName>> = {
  controller: "controllers",
  macro: "macros",
  element: "fixtures",
  scene: "scenes",
  layer: "layers",
};

/** Payload keys that hold one entity id, and which table it belongs to. */
const KEY_TABLES: Readonly<Record<string, TableName>> = {
  controllerId: "controllers",
  macroId: "macros",
  linkId: "links",
  fixtureId: "fixtures",
  universeId: "universes",
  outputId: "outputs",
  sceneId: "scenes",
  layerId: "layers",
  setId: "fixtureSets",
};

/** `parentId` and `after` belong to the table the command's prefix names. */
const PREFIX_TABLES: Readonly<Record<string, TableName>> = {
  controller: "controllers",
  macro: "macros",
  fixture: "fixtures",
  universe: "universes",
  scene: "scenes",
  layer: "layers",
  set: "fixtureSets",
};

interface Named {
  readonly id: string;
  readonly name?: string;
}

function isTable(text: string): text is TableName {
  return text in TABLE_SCHEMAS;
}

/** Where a same-named entity lives, to tell candidates apart. */
function whereabouts(
  document: Document,
  table: TableName,
  entity: Named,
): string | undefined {
  const record = entity as unknown as Record<string, unknown>;
  if (typeof record.parentId === "string") {
    const parent = (document[table] as Record<string, Named>)[record.parentId];
    return parent === undefined ? undefined : `in Group ${parent.name ?? ""}`;
  }
  return undefined;
}

/**
 * The id `text` names in `table`: itself when it is an id, the one entity
 * with that name, or undefined when nothing has it. Several entities with
 * the name are an error listing each with its id and where it lives.
 */
export function findId(
  document: Document,
  table: TableName,
  text: string,
): string | undefined {
  const entities = document[table] as Record<string, Named>;
  if (text in entities) return text;
  const matches = Object.values(entities).filter(
    (entity) => entity.name !== undefined && sameName(entity.name, text),
  );
  const [only] = matches;
  if (matches.length === 0 || only === undefined) return undefined;
  if (matches.length === 1) return only.id;
  const candidates = matches.map((entity) => {
    const where = whereabouts(document, table, entity);
    return `${entity.name ?? ""} (${entity.id}${where === undefined ? "" : `, ${where}`})`;
  });
  throw new Error(
    `“${text}” matches ${matches.length} ${NOUNS[table]}s: ${candidates.join(", ")}`,
  );
}

/** Like `findId`, but a name nothing carries is an error too. */
export function resolveId(
  document: Document,
  table: TableName,
  text: string,
): string {
  const id = findId(document, table, text);
  if (id === undefined)
    throw new Error(`No ${NOUNS[table]} is called or identified “${text}”.`);
  return id;
}

/**
 * The Target ref `text` names: `set:<id|name>` a Fixture Set, `<fixture>/<key>`
 * an Element with the Fixture resolved by id or name, a Fixture's id or name
 * alone its root Element, and a Set's name alone that Set.
 */
/** A row ref as `look` takes it: `all` for the All Targets rows, else a Target. */
export function resolveRowRef(document: Document, text: string): string {
  return isAllTargetsRef(text.toLowerCase())
    ? ALL_TARGETS_REF
    : resolveTargetRef(document, text);
}

export function resolveTargetRef(document: Document, text: string): string {
  const setName = parseSetRef(text);
  if (setName !== undefined)
    return setRef(resolveId(document, "fixtureSets", setName));
  const slash = text.indexOf("/");
  if (slash !== -1)
    return `${resolveId(document, "fixtures", text.slice(0, slash))}/${text.slice(slash + 1)}`;
  const fixtureId = findId(document, "fixtures", text);
  if (
    fixtureId !== undefined &&
    document.fixtures[fixtureId]?.kind === "fixture"
  )
    return `${fixtureId}/root`;
  const setId = findId(document, "fixtureSets", text);
  if (setId !== undefined && document.fixtureSets[setId]?.kind === "set")
    return setRef(setId);
  throw new Error(
    `No Fixture or Fixture Set is called or identified “${text}”; a Target is <fixture>, <fixture>/<key> or ${SET_REF_PREFIX}<set>.`,
  );
}

/**
 * An Address with its entity segment turned into an id:
 * `controller/Energy/value` → `controller/controller_…/value`. In a Look
 * Layer row Address the Target after `row` is resolved too:
 * `layer/Base/row/Par/dimmer` → `layer/…/row/<fixtureId>/root/dimmer`,
 * `layer/Base/row/set:Wash/color` → the Set's id.
 */
export function resolveAddressNames(
  document: Document,
  address: string,
): string {
  const segments = address.split("/");
  const [head, entity] = segments;
  const table = head === undefined ? undefined : ADDRESS_TABLES[head];
  if (table === undefined || entity === undefined || segments.length < 3)
    return address;
  const id = resolveId(document, table, entity);
  const rest = segments.slice(2);
  if (head === "layer" && rest[0] === "row" && rest.length >= 3) {
    const [, target = "", ...tail] = rest;
    // "all", a Set or a Fixture name is one segment; <fixture>/<key> is two.
    const single =
      isAllTargetsRef(target) ||
      target.startsWith(SET_REF_PREFIX) ||
      tail.length === 1 ||
      findId(document, "fixtureSets", target) !== undefined;
    const text = single ? target : `${target}/${tail[0] ?? ""}`;
    const ref = resolveRowRef(document, text);
    return [head, id, "row", ref, ...tail.slice(single ? 0 : 1)].join("/");
  }
  return [head, id, ...rest].join("/");
}

/**
 * A document path such as `controllers/Energy/value` with the name in its
 * second segment turned into an id. A segment naming nothing stays as
 * typed, so the caller reports the path the person asked for.
 */
export function resolvePathNames(document: Document, path: string): string {
  const segments = path.split("/");
  const [table, entity] = segments;
  if (table === undefined || entity === undefined || !isTable(table))
    return path;
  const id = findId(document, table, entity);
  return id === undefined ? path : [table, id, ...segments.slice(2)].join("/");
}

/**
 * A command payload with every entity reference turned into an id: the
 * `…Id` keys; `parentId` and `after` for the table the command name says
 * (or the payload's own `table`, as `entity.move` has); `address` and
 * `addresses`; lists such as `controllerIds`; and objects inside arrays
 * (Macro actions) the same way.
 */
export function resolvePayloadNames(
  document: Document,
  command: string,
  payload: unknown,
): unknown {
  if (Array.isArray(payload))
    return payload.map((item) => resolvePayloadNames(document, command, item));
  if (typeof payload !== "object" || payload === null) return payload;
  const record = payload as Record<string, unknown>;
  const prefix = command.split(".")[0] ?? "";
  const own =
    typeof record.table === "string" && isTable(record.table)
      ? record.table
      : undefined;
  const siblings = PREFIX_TABLES[prefix] ?? own;
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    resolved[key] = resolveField(document, prefix, siblings, key, value);
  }
  return resolved;
}

/**
 * The table a key's value names: `parentId` and `after` are siblings of the
 * command's entity, `id` only for `entity.move` (a create's `id` is the new
 * one), the rest by the key alone.
 */
function fieldTable(
  prefix: string,
  siblings: TableName | undefined,
  key: string,
): TableName | undefined {
  if (key === "parentId" || key === "after") return siblings;
  if (key === "id") return prefix === "entity" ? siblings : undefined;
  return KEY_TABLES[key];
}

function resolveField(
  document: Document,
  prefix: string,
  siblings: TableName | undefined,
  key: string,
  value: unknown,
): unknown {
  const table = fieldTable(prefix, siblings, key);
  if (table !== undefined && typeof value === "string")
    return resolveId(document, table, value);
  if (key === "address" && typeof value === "string")
    return resolveAddressNames(document, value);
  if (key === "addresses" && Array.isArray(value))
    return (value as unknown[]).map((item) =>
      typeof item === "string" ? resolveAddressNames(document, item) : item,
    );
  const listTable = key.endsWith("Ids")
    ? KEY_TABLES[`${key.slice(0, -3)}Id`]
    : undefined;
  if (listTable !== undefined && Array.isArray(value))
    return (value as unknown[]).map((item) =>
      typeof item === "string" ? resolveId(document, listTable, item) : item,
    );
  if (Array.isArray(value))
    return resolvePayloadNames(document, `${prefix}.`, value);
  return value;
}
