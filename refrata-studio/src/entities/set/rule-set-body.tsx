import type { DocumentView } from "@refrata/client";
import {
  setMembers,
  tagsInUse,
  targetLabel,
  type Document,
  type MemberSet,
  type Rule,
} from "@refrata/core";
import { GripVertical, ListChecks, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { TagChip } from "@/inspector/fields/tag-chip";
import { TagInput } from "@/inspector/fields/tag-input";
import { useCommand } from "@/lib/client";
import { SortableItem, SortableList } from "@/navigator/sortable";

/**
 * A Set by rule: its Rules, one line of Tag chips each (all of them must be
 * met, on an Element or above it; none means every Fixture), reordered by
 * drag since members come out Rule by Rule; then the members it has now,
 * read-only; then the one-way conversion to a list.
 */
export function RuleSetBody({
  view,
  document,
  set,
  rules,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly set: MemberSet;
  readonly rules: readonly Rule[];
}) {
  const command = useCommand(view);
  const uses = useMemo(() => tagsInUse(document), [document]);
  const carried = useMemo(() => new Set(uses.map((use) => use.tag)), [uses]);
  // A new Rule is drafted here and stored with its first Tag: stored empty
  // it would mean every Fixture, which is rarely what "Add Rule" is for.
  const [drafting, setDrafting] = useState(false);
  const everyFixture = rules.some((rule) => rule.length === 0);
  const members = setMembers(document, set);
  const ids = rules.map((_, index) => String(index));
  const move = (id: string, after: string | null): void => {
    const index = Number(id);
    const afterIndex = after === null ? -1 : Number(after);
    void command("set.rules.move", {
      setId: set.id,
      index,
      to: afterIndex < index ? afterIndex + 1 : afterIndex,
    });
  };
  return (
    <>
      <InspectorSection
        storageKey="rules"
        label="Rules"
        actions={
          <Button
            variant="ghost"
            size="xs"
            disabled={drafting}
            onClick={() => setDrafting(true)}
          >
            <Plus /> Add Rule
          </Button>
        }
      >
        {rules.length === 0 && !drafting ? (
          <p className="text-[0.6875rem]/relaxed text-muted-foreground">
            {set.name} has no Rules, so it is empty. A Rule takes every Element
            that meets all of its Tags.
          </p>
        ) : (
          <SortableList
            kind="set-rule"
            listId={`set-rule:${set.id}`}
            ids={ids}
            selectedId={undefined}
            onMove={move}
          >
            <ol
              className="grid grid-cols-[minmax(0,1fr)] gap-1.5"
              aria-label="Rules"
            >
              {rules.map((rule, index) => (
                <SortableItem key={ids[index]} id={String(index)}>
                  <RuleLine
                    rule={rule}
                    uses={uses}
                    carried={carried}
                    onChange={(tags) =>
                      void (tags.length === 0
                        ? command("set.rules.remove", { setId: set.id, index })
                        : command("set.rules.update", {
                            setId: set.id,
                            index,
                            tags,
                          }))
                    }
                    onRemove={() =>
                      void command("set.rules.remove", { setId: set.id, index })
                    }
                  />
                </SortableItem>
              ))}
            </ol>
          </SortableList>
        )}
        {drafting && (
          <ul className="grid">
            <RuleLine
              rule={[]}
              draft
              uses={uses}
              carried={carried}
              onChange={(tags) => {
                setDrafting(false);
                void command("set.rules.add", { setId: set.id, tags });
              }}
              onRemove={() => setDrafting(false)}
              onEveryFixture={
                everyFixture
                  ? undefined
                  : () => {
                      setDrafting(false);
                      void command("set.rules.add", {
                        setId: set.id,
                        tags: [],
                      });
                    }
              }
            />
          </ul>
        )}
      </InspectorSection>
      <InspectorSection
        storageKey="members"
        label={`Members (${String(members.length)})`}
      >
        {members.length === 0 ? (
          <p className="text-[0.6875rem]/relaxed text-muted-foreground">
            Nothing in the rig meets these Rules yet.
          </p>
        ) : (
          <ol
            className="grid grid-cols-[minmax(0,1fr)] gap-px"
            aria-label="Members"
          >
            {members.map((ref) => (
              <li
                key={ref}
                className="flex h-5 items-center truncate pl-1 text-xs text-muted-foreground"
                title={ref}
              >
                {targetLabel(document, ref)}
              </li>
            ))}
          </ol>
        )}
      </InspectorSection>
      <InspectorSection storageKey="convert" label="Convert">
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          A list keeps these {String(members.length)} members and lets you
          reorder or drop them by hand. Its Rules go: Fixtures tagged later will
          no longer join.
        </p>
        <Button
          variant="outline"
          size="xs"
          className="justify-self-start"
          onClick={() => void command("set.convert", { setId: set.id })}
        >
          <ListChecks /> Convert to list
        </Button>
      </InspectorSection>
    </>
  );
}

function RuleLine({
  rule,
  draft = false,
  uses,
  carried,
  onChange,
  onRemove,
  onEveryFixture,
}: {
  readonly rule: Rule;
  /** Not stored yet: it becomes a Rule with its first Tag. */
  readonly draft?: boolean;
  readonly uses: ReturnType<typeof tagsInUse>;
  readonly carried: ReadonlySet<string>;
  readonly onChange: (tags: readonly string[]) => void;
  readonly onRemove: () => void;
  /** On a draft: store it with no Tags, the Rule every Fixture meets. */
  readonly onEveryFixture?: (() => void) | undefined;
}) {
  return (
    <li className="flex items-start gap-1 rounded-md border bg-input/10 p-1.5">
      {!draft && (
        <GripVertical className="mt-1 size-3 shrink-0 cursor-grab text-muted-foreground/60" />
      )}
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex min-h-5 flex-wrap items-center gap-1">
          {draft ? (
            <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              New Rule: pick its first Tag
              {onEveryFixture !== undefined && (
                <Button variant="outline" size="xs" onClick={onEveryFixture}>
                  or every Fixture
                </Button>
              )}
            </span>
          ) : rule.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              every Fixture
            </span>
          ) : (
            rule.map((tag, at) => (
              <span key={tag} className="flex max-w-full items-center gap-1">
                {at > 0 && (
                  <span className="text-[0.625rem] text-muted-foreground">
                    +
                  </span>
                )}
                <TagChip
                  tag={tag}
                  note={carried.has(tag) ? undefined : "matches nothing"}
                  onRemove={() =>
                    onChange(rule.filter((other) => other !== tag))
                  }
                />
              </span>
            ))
          )}
        </div>
        <TagInput
          label="Add Tag to Rule"
          placeholder={
            draft ? "Tag…" : rule.length === 0 ? "Narrow by Tag…" : "and Tag…"
          }
          uses={uses}
          exclude={rule}
          typeKeys
          onAdd={(tag) => onChange([...rule, tag])}
        />
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={draft ? "Discard Rule" : "Remove Rule"}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  );
}
