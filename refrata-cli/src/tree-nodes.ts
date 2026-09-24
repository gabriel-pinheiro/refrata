import {
  childrenOf,
  type Controller,
  type Macro,
  type Table,
  type TreeEntity,
} from "@refrata/core";

/**
 * The shape the CLI shows the grouped tables in: Controllers and Macros as
 * their Groups' trees. The builder reads the document, the formatter turns
 * a tree into lines.
 */

/** A grouped table entity with the entities its Group holds; a leaf has none. */
export type TreeNode<TEntity> = TEntity & {
  readonly children: readonly TreeNode<TEntity>[];
};

export function treeNodes<TEntity extends TreeEntity>(
  table: Table<TEntity>,
): readonly TreeNode<TEntity>[] {
  const build = (parentId: string | null): TreeNode<TEntity>[] =>
    childrenOf(table, parentId).map((entity) => ({
      ...entity,
      children: entity.kind === "group" ? build(entity.id) : [],
    }));
  return build(null);
}

export function formatTreeNodes<TEntity extends TreeEntity>(
  nodes: readonly TreeNode<TEntity>[],
  describe: (entity: TEntity) => string,
  depth = 0,
): string[] {
  return nodes.flatMap((node) => [
    `${"  ".repeat(depth)}${describe(node)}`,
    ...formatTreeNodes(node.children, describe, depth + 1),
  ]);
}

function percent(value: number): string {
  return `${String(Math.round(value * 100))}%`;
}

export function describeController(controller: Controller): string {
  const head = `“${controller.name}”  ${controller.id}`;
  switch (controller.kind) {
    case "group":
      return `Group ${head}`;
    case "number":
      return `Number ${head}  value ${percent(controller.value)}`;
    case "color":
      return `Color ${head}  value [${controller.value.join(", ")}]`;
  }
}

/** A Macro with its action count and, in a Run Mode other than All, the mode: "runs one", "runs some 3", "runs in sequence". */
export function describeMacro(macro: Macro): string {
  const head = `“${macro.name}”  ${macro.id}`;
  if (macro.kind === "group") return `Group ${head}`;
  const count = macro.actions.length;
  const actions = `${String(count)} ${count === 1 ? "action" : "actions"}`;
  const mode =
    macro.mode === "all"
      ? ""
      : macro.mode === "some"
        ? `  runs some ${String(macro.count)}`
        : macro.mode === "sequence"
          ? "  runs in sequence"
          : "  runs one";
  return `Macro ${head}  ${actions}${mode}`;
}
