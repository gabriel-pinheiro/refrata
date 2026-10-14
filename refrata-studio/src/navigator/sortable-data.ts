import type { DragLocationHistory } from "@atlaskit/pragmatic-drag-and-drop/types";

/** What a dragged row carries; drop targets add `listId` and an edge or `inside`. */
export interface DragData {
  readonly kind: string;
  readonly id: string;
  readonly listId: string;
}

export function dragData(data: Record<string, unknown>): DragData | undefined {
  const { kind, id, listId } = data;
  return typeof kind === "string" &&
    typeof id === "string" &&
    typeof listId === "string"
    ? { kind, id, listId }
    : undefined;
}

/**
 * Whether the pointer is over the dragged row itself, or over the rows an
 * open Group holds under it. A drop there moves nothing.
 */
export function overSource(
  source: { readonly element: Element },
  location: DragLocationHistory,
): boolean {
  return location.current.dropTargets.some(
    (target) => target.element === source.element,
  );
}
