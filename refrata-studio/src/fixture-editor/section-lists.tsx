import {
  attributeInfo,
  channelText,
  elementsOf,
  ruleOf,
  RULES,
} from "@refrata/core";

import { Badge } from "@/components/ui/badge";
import { AddParameter } from "@/entities/fixture-type/add-parameter";
import type { Scope } from "@/entities/fixture-type/scope";
import {
  channelsText,
  FAMILY_COLOR,
  ValueText,
} from "@/entities/fixture-type/summaries";
import { samePick } from "@/entities/fixture-type/type-ref";

import { LIST_HEAD, listRow } from "./rows";

/** The Element tree, each row indented under its parent. */
export function ElementList({ scope }: { readonly scope: Scope }) {
  return (
    <>
      <div className={LIST_HEAD}>
        <span className="min-w-0 flex-1">Element</span>
        <span className="hidden w-48 shrink-0 @xl:block">Tags</span>
        <span className="w-20 shrink-0 text-right">Parameters</span>
        <span className="w-16 shrink-0 text-right">Channels</span>
      </div>
      {elementsOf(scope.mode).map(({ key, depth }) => {
        const element = scope.mode.elements[key];
        if (element === undefined) return null;
        return (
          <div
            key={key}
            className={listRow(samePick(scope.pick, { kind: "element", key }))}
            onClick={(event) => scope.open({ kind: "element", key }, event)}
          >
            <span
              className="min-w-0 flex-1 truncate font-medium"
              style={{ paddingLeft: `${String(depth)}rem` }}
            >
              {element.name}
            </span>
            <span className="hidden w-48 shrink-0 flex-wrap gap-1 @xl:flex">
              {element.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </span>
            <span className="w-20 shrink-0 text-right text-muted-foreground tabular-nums">
              {String(Object.keys(element.parameters).length)}
            </span>
            <span className="w-16 shrink-0 text-right text-muted-foreground tabular-nums">
              {String(scope.rows.filter((row) => row.element === key).length)}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** Every Parameter of the Mode under its Element, with its rule, its Channels, its Default and its Highlight. */
export function ParameterList({ scope }: { readonly scope: Scope }) {
  return (
    <>
      <div className={LIST_HEAD}>
        <span className="w-32 shrink-0">Parameter</span>
        <span className="w-16 shrink-0">Rule</span>
        <span className="min-w-0 flex-1">Channels</span>
        <span className="hidden w-16 shrink-0 @xl:block">Default</span>
        <span className="hidden w-16 shrink-0 @xl:block">Highlight</span>
      </div>
      {elementsOf(scope.mode).map(({ key }) => {
        const element = scope.mode.elements[key];
        if (element === undefined) return null;
        return (
          <div key={key}>
            <div className="flex min-h-8 items-center gap-2 border-b bg-muted/30 px-3 py-1">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-xs font-semibold hover:underline"
                onClick={() => scope.open({ kind: "element", key })}
              >
                {element.name}
              </button>
              <AddParameter scope={scope} element={key} className="w-40" />
            </div>
            {Object.entries(element.parameters).map(
              ([attribute, parameter]) => {
                const info = attributeInfo(attribute);
                const pick = {
                  kind: "parameter",
                  element: key,
                  attribute,
                } as const;
                return (
                  <div
                    key={attribute}
                    className={listRow(samePick(scope.pick, pick))}
                    onClick={(event) => scope.open(pick, event)}
                  >
                    <span className="flex w-32 shrink-0 items-center gap-1.5 font-medium">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: FAMILY_COLOR[info.family] }}
                      />
                      <span className="truncate">{info.label}</span>
                    </span>
                    <span className="w-16 shrink-0 text-muted-foreground">
                      {RULES[ruleOf(parameter.encode)].label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {channelsText(scope.rows, parameter)}
                    </span>
                    <span className="hidden w-16 shrink-0 truncate @xl:block">
                      <ValueText
                        attribute={attribute}
                        parameter={parameter}
                        value={parameter.default}
                      />
                    </span>
                    <span className="hidden w-16 shrink-0 truncate @xl:block">
                      <ValueText
                        attribute={attribute}
                        parameter={parameter}
                        value={parameter.highlight}
                      />
                    </span>
                  </div>
                );
              },
            )}
          </div>
        );
      })}
    </>
  );
}

/** The Mode's Actions. */
export function ActionList({ scope }: { readonly scope: Scope }) {
  const actions = Object.entries(scope.mode.actions);
  return (
    <>
      <div className={LIST_HEAD}>
        <span className="min-w-0 flex-1">Action</span>
        <span className="w-32 shrink-0">Channel</span>
        <span className="w-12 shrink-0 text-right">Byte</span>
        <span className="w-16 shrink-0 text-right">Seconds</span>
      </div>
      {actions.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          No Action. An Action holds a byte on a Channel for a time, such as a
          reset.
        </p>
      )}
      {actions.map(([key, action]) => {
        const row = scope.rows.find((each) => each.key === action.channel);
        return (
          <div
            key={key}
            className={listRow(samePick(scope.pick, { kind: "action", key }))}
            onClick={(event) => scope.open({ kind: "action", key }, event)}
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {action.name}
            </span>
            <span className="w-32 shrink-0 truncate text-muted-foreground">
              {row === undefined ? action.channel : channelText(row)}
            </span>
            <span className="w-12 shrink-0 text-right tabular-nums">
              {String(action.byte)}
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums">
              {String(action.seconds)}
            </span>
          </div>
        );
      })}
    </>
  );
}
