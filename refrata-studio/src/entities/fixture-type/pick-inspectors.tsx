import type { DocumentView } from "@refrata/client";
import { useEffect } from "react";

import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { useRemoveEntities } from "@/selection/remove-selection";
import { useSelection } from "@/selection/selection";

import { ActionEditor } from "./action-editor";
import { ChannelEditor } from "./channel-editor";
import { ElementEditor } from "./element-editor";
import { ModeEditor } from "./mode-editor";
import { ParameterEditor } from "./parameter-editor";
import { useScope, type Scope } from "./scope";
import { pickTitle } from "./summaries";
import { TypeEditor } from "./type-editor";
import { parsePick, pickSelection, type Pick, type TypeKind } from "./type-ref";

/** Whether the Mode still has what a pick names. */
function exists(scope: Scope, pick: Pick): boolean {
  switch (pick.kind) {
    case "type":
    case "mode":
      return true;
    case "channel":
      return scope.rows.some((row) => row.key === pick.key);
    case "element":
      return pick.key in scope.mode.elements;
    case "parameter":
      return (
        scope.mode.elements[pick.element]?.parameters[pick.attribute] !==
        undefined
      );
    case "action":
      return pick.key in scope.mode.actions;
  }
}

/**
 * The inspector of one thing picked in the Fixture Editor: a heading with
 * what it is and its key, then its form. When the thing is gone (removed,
 * undone, its type replaced) the selection is cleared.
 */
function PickInspector({
  view,
  typeKey,
  modeKey,
  pick,
}: {
  readonly view: DocumentView;
  readonly typeKey: string;
  readonly modeKey: string | undefined;
  readonly pick: Pick;
}) {
  const firstMode = Object.keys(
    view.get()?.fixtureTypes[typeKey]?.type.modes ?? {},
  )[0];
  const scope = useScope(view, typeKey, modeKey ?? firstMode ?? "");
  const { select } = useSelection();
  const removeEntities = useRemoveEntities();
  const gone = scope === undefined || !exists(scope, pick);
  useEffect(() => {
    if (gone) select(undefined);
  }, [gone, select]);
  if (scope === undefined || gone) return null;
  const onRemove = (): void =>
    removeEntities([pickSelection(scope.typeKey, scope.modeKey, pick)]);
  const key =
    pick.kind === "type"
      ? scope.typeKey
      : pick.kind === "mode"
        ? scope.modeKey
        : pick.kind === "parameter"
          ? `${pick.element}/${pick.attribute}`
          : pick.key;
  return (
    <>
      <InspectorHeading name={pickTitle({ ...scope, pick })} id={key} />
      {pick.kind === "type" && <TypeEditor scope={scope} onRemove={onRemove} />}
      {pick.kind === "mode" && <ModeEditor scope={scope} onRemove={onRemove} />}
      {pick.kind === "channel" && (
        <ChannelEditor
          scope={scope}
          channelKey={pick.key}
          onRemove={onRemove}
        />
      )}
      {pick.kind === "element" && (
        <ElementEditor
          scope={scope}
          elementKey={pick.key}
          onRemove={onRemove}
        />
      )}
      {pick.kind === "parameter" && (
        <ParameterEditor
          scope={scope}
          element={pick.element}
          attribute={pick.attribute}
          onRemove={onRemove}
        />
      )}
      {pick.kind === "action" && (
        <ActionEditor scope={scope} actionKey={pick.key} onRemove={onRemove} />
      )}
    </>
  );
}

/** The inspector component of one of the Fixture Editor's entity kinds. */
export function pickInspector(kind: TypeKind) {
  return function TypePickInspector({
    view,
    id,
  }: {
    readonly view: DocumentView;
    readonly id: string;
  }) {
    const ref = parsePick(kind, id);
    return ref === undefined ? null : (
      <PickInspector
        view={view}
        typeKey={ref.typeKey}
        modeKey={ref.modeKey}
        pick={ref.pick}
      />
    );
  };
}
