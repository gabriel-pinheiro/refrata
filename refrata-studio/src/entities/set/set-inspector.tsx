import type { DocumentView } from "@refrata/client";
import { isRuleSet, targetLabel, type FixtureSet } from "@refrata/core";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { useCommand, useDocumentPath, useSignal } from "@/lib/client";
import { SortableItem, SortableList } from "@/navigator/sortable";
import { TargetPicker } from "@/entities/target/target-picker";
import { useSelection } from "@/selection/selection";

import { RuleSetBody } from "./rule-set-body";

/**
 * A Fixture Set's name and, for a Set by list, its members in order, each as
 * `Fixture › Element`, removable and draggable to reorder; "Add members"
 * opens the picker over the whole rig. A Set by rule shows its Rules
 * instead. A Group shows only its name.
 */
export function SetInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select } = useSelection();
  const [picking, setPicking] = useState(false);
  const set = useDocumentPath<FixtureSet>(view, ["fixtureSets", id]);
  // Member labels read Fixtures and their Modes.
  const document = useSignal(view.document);
  useEffect(() => {
    if (set === undefined) select({ kind: "installation" });
  }, [set, select]);
  if (set === undefined || document === undefined) return null;
  return (
    <>
      <InspectorHeading name={set.name} id={set.id} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3">
        <NameField
          label="Name"
          value={set.name}
          onCommit={(name) => void command("set.rename", { setId: id, name })}
        />
      </div>
      {set.kind === "set" && isRuleSet(set) && (
        <RuleSetBody
          view={view}
          document={document}
          set={set}
          rules={set.rules}
        />
      )}
      {set.kind === "set" && !isRuleSet(set) && (
        <InspectorSection
          storageKey="members"
          label="Members"
          actions={
            <Button variant="ghost" size="xs" onClick={() => setPicking(true)}>
              <Plus /> Add members
            </Button>
          }
        >
          {set.members.length === 0 ? (
            <p className="text-[0.6875rem]/relaxed text-muted-foreground">
              {set.name} is empty. Add members here, or select Fixtures and add
              them to it from there.
            </p>
          ) : (
            <SortableList
              kind="set-member"
              listId={`set-member:${set.id}`}
              ids={set.members}
              selectedId={undefined}
              onMove={(ref, after) =>
                void command("set.members.move", { setId: id, ref, after })
              }
            >
              <ol
                className="grid grid-cols-[minmax(0,1fr)] gap-px"
                aria-label="Members"
              >
                {set.members.map((ref) => (
                  <SortableItem key={ref} id={ref}>
                    <li className="flex h-6 items-center gap-1 rounded-sm pl-1 text-xs hover:bg-sidebar-accent/60">
                      <span className="min-w-0 flex-1 truncate" title={ref}>
                        {targetLabel(document, ref)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${targetLabel(document, ref)}`}
                        onClick={() =>
                          void command("set.members.remove", {
                            setId: id,
                            refs: [ref],
                          })
                        }
                      >
                        <X />
                      </Button>
                    </li>
                  </SortableItem>
                ))}
              </ol>
            </SortableList>
          )}
        </InspectorSection>
      )}
      {set.kind === "set" && (
        <p
          className="border-t px-3 py-2 text-[0.6875rem]/relaxed text-muted-foreground"
          data-testid="set-order"
        >
          {isRuleSet(set)
            ? "Order: Rule by Rule, and within a Rule the Fixtures' order in the navigator, then each Fixture's own tree order."
            : "Order: the list above, as dragged."}{" "}
          A Visual such as a Chase or a Rainbow walks a spread Set in this order
          {isRuleSet(set)
            ? "; reorder the Fixtures in the navigator, or convert to a list, to change it."
            : "."}
        </p>
      )}
      {picking && set.kind === "set" && (
        <TargetPicker
          view={view}
          title={`Add members to ${set.name}`}
          members
          taken={set.members}
          submitLabel={(count) => `Add ${count > 0 ? String(count) : ""}`}
          onSubmit={(refs) =>
            void command("set.members.add", { setId: id, refs })
          }
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
