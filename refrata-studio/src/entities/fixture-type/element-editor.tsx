import {
  addressText,
  attributeInfo,
  elementKeyFor,
  keyFromName,
  nextChannelKey,
  parentOf,
  ruleOf,
  RULES,
  subtreeKeys,
} from "@refrata/core";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useNameDialog } from "@/components/name-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Block, Field, FieldGrid } from "@/inspector/fields/form-block";
import { Choice, TextBox } from "@/inspector/fields/form-inputs";
import { TagChip } from "@/inspector/fields/tag-chip";

import { AddParameter } from "./add-parameter";
import type { Scope } from "./scope";

const ROW =
  "flex min-h-7 w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-muted/50";

/** Asks for a new Element's name, adds it under `parent` and picks it. */
export function useAddElement(
  scope: Scope,
): readonly [add: (parent: string) => void, dialog: React.ReactNode] {
  const [ask, dialog] = useNameDialog();
  const add = (parent: string): void =>
    ask({
      title: "New Element",
      label: "Name. Its key is made from it and stays.",
      initial: "",
      submitLabel: "Add",
      onSubmit: (name) => {
        const key = elementKeyFor(scope.mode, name);
        void scope.run("type.element.add", { parent, name }).then((result) => {
          if (result !== undefined && key !== undefined)
            scope.open({ kind: "element", key });
        });
      },
    });
  return [add, dialog];
}

/**
 * One Element: its name, where it hangs in the tree, its Tags, the
 * Parameters it exposes and the Channels that belong to it. The root can be
 * renamed and tagged but not moved or removed.
 */
export function ElementEditor({
  scope,
  elementKey,
  onRemove,
}: {
  readonly scope: Scope;
  readonly elementKey: string;
  readonly onRemove: () => void;
}) {
  const [tag, setTag] = useState("");
  const [addElement, dialog] = useAddElement(scope);
  const element = scope.mode.elements[elementKey];
  if (element === undefined) return null;
  const parent = parentOf(scope.mode, elementKey);
  const siblings =
    parent === undefined ? [] : (scope.mode.elements[parent]?.children ?? []);
  const place = siblings.indexOf(elementKey);
  const below = subtreeKeys(scope.mode, elementKey);
  const channels = scope.rows.filter((row) => row.element === elementKey);
  const update = (change: object): void =>
    void scope.run("type.element.update", { element: elementKey, ...change });
  const move = (to: object): void =>
    void scope.run("type.element.move", { element: elementKey, ...to });
  const addTag = (): void => {
    const next = keyFromName(tag);
    if (next !== "" && !element.tags.includes(next))
      update({ tags: [...element.tags, next] });
    setTag("");
  };
  return (
    <div className="min-w-0">
      <Block
        title={parent === undefined ? "Root Element" : "Element"}
        actions={
          parent !== undefined && (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move up"
                title="Move up among its siblings"
                disabled={place <= 0}
                onClick={() => move({ after: siblings[place - 2] ?? null })}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move down"
                title="Move down among its siblings"
                disabled={place === siblings.length - 1}
                onClick={() => move({ after: siblings[place + 1] })}
              >
                <ArrowDown />
              </Button>
              <Button variant="ghost" size="xs" onClick={onRemove}>
                <Trash2 /> Remove
              </Button>
            </>
          )
        }
      >
        <FieldGrid min="9rem">
          <Field label="Name">
            <TextBox
              label="Name"
              value={element.name}
              onChange={(name) => {
                if (name.trim() !== "") update({ name: name.trim() });
              }}
            />
          </Field>
          <Field label="Key">
            <span className="flex h-6 items-center font-mono text-xs text-muted-foreground">
              {elementKey}
            </span>
          </Field>
          {parent !== undefined && (
            <Field label="Parent">
              <Choice
                value={parent}
                options={Object.entries(scope.mode.elements)
                  .filter(([key]) => !below.includes(key))
                  .map(([key, each]) => ({ value: key, label: each.name }))}
                onChange={(to) => {
                  if (to !== parent) move({ parent: to });
                }}
              />
            </Field>
          )}
        </FieldGrid>
        <Button
          variant="outline"
          size="xs"
          className="w-fit"
          onClick={() => addElement(elementKey)}
        >
          <Plus /> Child Element
        </Button>
      </Block>
      <Block title="Tags">
        <div className="flex flex-wrap items-center gap-1">
          {element.tags.map((each) => (
            <TagChip
              key={each}
              tag={each}
              onRemove={() =>
                update({ tags: element.tags.filter((other) => other !== each) })
              }
            />
          ))}
          <Input
            aria-label="Add a Tag"
            className="h-6 w-28"
            placeholder="Add a Tag"
            value={tag}
            onChange={(event) => setTag(event.currentTarget.value)}
            onBlur={addTag}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTag();
            }}
          />
        </div>
      </Block>
      <Block title="Parameters">
        {Object.entries(element.parameters).map(([key, parameter]) => (
          <button
            key={key}
            type="button"
            className={ROW}
            onClick={() =>
              scope.open({
                kind: "parameter",
                element: elementKey,
                attribute: key,
              })
            }
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {attributeInfo(key).label}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {RULES[ruleOf(parameter.encode)].label}
            </span>
          </button>
        ))}
        <AddParameter scope={scope} element={elementKey} />
      </Block>
      <Block title="Channels">
        {channels.map((row) => (
          <button
            key={row.key}
            type="button"
            className={ROW}
            onClick={() => scope.open({ kind: "channel", key: row.key })}
          >
            <span className="w-8 shrink-0 text-muted-foreground tabular-nums">
              {addressText(row)}
            </span>
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
          </button>
        ))}
        <Button
          variant="outline"
          size="xs"
          className="w-fit"
          onClick={() => {
            const key = nextChannelKey(scope.mode);
            void scope
              .run("type.channel.add", { element: elementKey })
              .then((result) => {
                if (result !== undefined) scope.open({ kind: "channel", key });
              });
          }}
        >
          <Plus /> Channel
        </Button>
      </Block>
      {dialog}
    </div>
  );
}
