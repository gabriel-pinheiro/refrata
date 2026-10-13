import {
  attributeInfo,
  followable,
  followedValues,
  nextSpreadRange,
} from "@refrata/core";

import { Field, FieldGrid } from "@/inspector/fields/form-block";
import { Choice } from "@/inspector/fields/form-inputs";

import type { EncodeProps } from "./encode-parts";
import { RangesTable } from "./ranges-table";

/**
 * A `spread`: the Parameter it follows, the Channel the two share, and for
 * each value of that Parameter the byte range this one runs along, or none.
 */
export function SpreadFields({
  scope,
  parameter,
  element,
  attribute,
  current,
  encode,
}: EncodeProps) {
  if (!("spread" in parameter.encode)) return null;
  const rule = parameter.encode;
  const siblings = scope.mode.elements[element]?.parameters ?? {};
  const byLabel = attributeInfo(rule.by).label;
  const row = scope.rows.find((each) => each.key === rule.spread);
  const values = followedValues(rule.by, siblings[rule.by]);
  const example = values.find((each) => rule.ranges[each.value] !== undefined);
  const exampleBytes =
    example === undefined ? undefined : rule.ranges[example.value];
  return (
    <>
      <FieldGrid min="9rem">
        <Field label="Follows">
          <Choice
            value={rule.by}
            options={followable(scope.mode, element, attribute).map((key) => ({
              value: key,
              label: attributeInfo(key).label,
            }))}
            onChange={(follows) => encode({ follows })}
          />
        </Field>
        <Field label="Shared Channel">
          <span className="flex h-6 items-center text-xs">
            {row === undefined
              ? rule.spread
              : `${String(row.address)} ${row.name}, the one ${byLabel} writes`}
          </span>
        </Field>
      </FieldGrid>
      <RangesTable
        title={`While ${byLabel} is`}
        current={current(rule.spread)}
        rows={values.map((each) => ({
          label: each.label,
          bytes: rule.ranges[each.value],
        }))}
        onBytes={(index, bytes) => {
          const value = values[index]?.value;
          if (value !== undefined) encode({ ranges: { [value]: bytes } });
        }}
        onToggle={(index, on) => {
          const value = values[index]?.value;
          if (value === undefined) return;
          encode({
            ranges: {
              [value]: on ? nextSpreadRange(scope.mode, rule.spread) : null,
            },
          });
        }}
      />
      {example !== undefined && exampleBytes !== undefined && (
        <p className="text-[0.6875rem]/snug text-muted-foreground">
          While {byLabel} is {example.label}, 1% to 100% runs from byte{" "}
          {String(exampleBytes[0])} to {String(exampleBytes[1])}. At 0% this
          writes nothing and {byLabel} keeps the Channel.
        </p>
      )}
    </>
  );
}
