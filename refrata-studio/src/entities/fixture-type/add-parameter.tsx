import {
  addParameterProblem,
  attributeOf,
  ENCODABLE_ATTRIBUTES,
  ownChannels,
} from "@refrata/core";

import { Choice } from "@/inspector/fields/form-inputs";

import type { Scope } from "./scope";

/**
 * Adds a Parameter to an Element: the Attributes it does not have yet. One
 * that cannot be filled in is listed but not offered, and the reason is
 * said; an Element with no Channel is offered none.
 */
export function AddParameter({
  scope,
  element,
  className,
}: {
  readonly scope: Scope;
  readonly element: string;
  readonly className?: string;
}) {
  const declared = scope.mode.elements[element];
  if (declared === undefined) return null;
  if (ownChannels(scope.mode, element).length === 0)
    return (
      <span className="text-[0.6875rem] text-muted-foreground">
        No Channel here, so no Parameter yet
      </span>
    );
  const free = ENCODABLE_ATTRIBUTES.filter(
    (key) => !(key in declared.parameters),
  ).map((key) => ({
    key,
    problem: addParameterProblem(scope.mode, element, key),
  }));
  const reasons = [...new Set(free.flatMap((each) => each.problem ?? []))].join(
    " ",
  );
  return (
    <span className="grid min-w-0 gap-1" title={reasons || undefined}>
      <Choice
        className={className ?? "w-44 max-w-full"}
        value={null}
        placeholder={
          free.length === 0 ? "Every Attribute is here" : "Add a Parameter"
        }
        options={free.map((each) => ({
          value: each.key,
          label: attributeOf(each.key).label,
          disabled: each.problem !== undefined,
        }))}
        onChange={(attribute) => {
          void scope
            .run("type.parameter.add", { element, attribute })
            .then((result) => {
              if (result !== undefined)
                scope.open({ kind: "parameter", element, attribute });
            });
        }}
      />
    </span>
  );
}
