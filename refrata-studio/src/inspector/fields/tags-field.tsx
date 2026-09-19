import type { DocumentView } from "@refrata/client";
import {
  declaredTags,
  locateElement,
  personTags,
  tagsInUse,
} from "@refrata/core";
import { Pencil } from "lucide-react";
import { useMemo } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCommand, useSignal } from "@/lib/client";

import { TagChip } from "./tag-chip";
import { TagInput } from "./tag-input";
import { useTagRename } from "./use-tag-rename";

const shared = (lists: readonly (readonly string[])[]): readonly string[] =>
  (lists[0] ?? []).filter((tag) => lists.every((list) => list.includes(tag)));

/**
 * The Tags of one Element or of several at once (`<fixtureId>/root` is the
 * Fixture). Declared Tags are locked chips; a person's have a cross and
 * "Rename…" on their context menu. For several refs the chips are the Tags
 * all of them share, and adding or removing writes to all, one undo step.
 */
export function TagsField({
  view,
  refs,
}: {
  readonly view: DocumentView;
  readonly refs: readonly string[];
}) {
  const command = useCommand(view);
  const document = useSignal(view.document);
  const { rename, dialog } = useTagRename(view);
  const uses = useMemo(
    () => (document === undefined ? [] : tagsInUse(document)),
    [document],
  );
  if (document === undefined) return null;
  const located = refs.flatMap((ref) => {
    const found = locateElement(document, ref);
    return found === undefined ? [] : [found];
  });
  const declared = shared(
    located.map(({ fixture, element }) => declaredTags(fixture, element)),
  );
  const own = shared(
    located.map(({ fixture, element }) => personTags(fixture, element.key)),
  );
  const several = refs.length > 1;
  return (
    <div className="grid gap-1.5">
      {declared.length + own.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {declared.map((tag) => (
            <TagChip key={tag} tag={tag} locked />
          ))}
          {own.map((tag) => (
            <ContextMenu key={tag}>
              <ContextMenuTrigger className="max-w-full">
                <TagChip
                  tag={tag}
                  onRemove={() =>
                    void command("fixture.tags.remove", { refs, tags: [tag] })
                  }
                />
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => rename(tag)}>
                  <Pencil /> Rename…
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}
      {several && (
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          {declared.length + own.length === 0
            ? "These share no Tag. "
            : "The Tags all of these share. "}
          A Tag added here goes on every one of them.
        </p>
      )}
      <TagInput
        label="Add Tag"
        placeholder="Add Tag…"
        uses={uses}
        exclude={[...declared, ...own]}
        onAdd={(tag) => void command("fixture.tags.add", { refs, tags: [tag] })}
      />
      {dialog}
    </div>
  );
}
