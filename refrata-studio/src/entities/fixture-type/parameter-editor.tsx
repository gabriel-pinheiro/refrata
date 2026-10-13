import {
  addressText,
  attributeInfo,
  attributeOf,
  ENCODABLE_ATTRIBUTES,
  encodedChannels,
  isAttributeKey,
  topByte,
} from "@refrata/core";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Block, Field, FieldGrid } from "@/inspector/fields/form-block";
import { Choice, NumberBox, TextBox } from "@/inspector/fields/form-inputs";

import { ByteBar } from "./byte-bar";
import { EncodeEditor } from "./encode-editor";
import { NotesBox } from "./notes-box";
import { ProbeFader } from "./probe-fader";
import type { Scope } from "./scope";
import { useProbe } from "./use-probe";
import { ValueField } from "./value-field";

/**
 * Everything one Parameter of an Element declares: its Attribute, its
 * Default and Highlight, a number's range and unit when the device differs
 * from the Attribute, its Encoding, and the Channels it touches drawn with
 * every range on them, this Parameter's bright.
 */
export function ParameterEditor({
  scope,
  element,
  attribute,
  onRemove,
}: {
  readonly scope: Scope;
  readonly element: string;
  readonly attribute: string;
  readonly onRemove: () => void;
}) {
  const probe = useProbe(scope);
  const owner = scope.mode.elements[element];
  const parameter = owner?.parameters[attribute];
  if (owner === undefined || parameter === undefined) return null;
  const info = attributeInfo(attribute);
  const definition = isAttributeKey(attribute)
    ? attributeOf(attribute)
    : undefined;
  const update = (change: object): void =>
    void scope.run("type.parameter.update", { element, attribute, ...change });
  const touched = encodedChannels(parameter.encode)
    .map((key) => scope.rows.find((row) => row.key === key))
    .filter((row) => row !== undefined);
  return (
    <div className="min-w-0">
      <Block
        title={`Parameter of ${owner.name}`}
        actions={
          <Button variant="ghost" size="xs" onClick={onRemove}>
            <Trash2 /> Remove
          </Button>
        }
      >
        <FieldGrid min="9rem">
          <Field label="Attribute" hint={`A ${info.kind}, in ${info.family}`}>
            <Choice
              value={attribute}
              options={ENCODABLE_ATTRIBUTES.filter(
                (key) => key === attribute || !(key in owner.parameters),
              ).map((key) => ({ value: key, label: attributeOf(key).label }))}
              onChange={(to) => {
                if (to === attribute) return;
                void scope
                  .run("type.parameter.update", { element, attribute, to })
                  .then((result) => {
                    if (result !== undefined)
                      scope.open({ kind: "parameter", element, attribute: to });
                  });
              }}
            />
          </Field>
          <Field label="Default">
            <ValueField
              attribute={attribute}
              parameter={parameter}
              label="Default"
              value={parameter.default}
              onChange={(value) => update({ default: value })}
            />
          </Field>
          <Field label="Highlight">
            <span className="flex min-w-0 items-center gap-2">
              <Checkbox
                aria-label="Has a Highlight value"
                checked={parameter.highlight !== undefined}
                onCheckedChange={(on) =>
                  update({
                    highlight: on
                      ? (parameter.default ?? definition?.default ?? null)
                      : null,
                  })
                }
              />
              {parameter.highlight === undefined ? (
                <span className="text-xs text-muted-foreground">
                  Left alone
                </span>
              ) : (
                <ValueField
                  attribute={attribute}
                  parameter={parameter}
                  label="Highlight"
                  value={parameter.highlight}
                  onChange={(value) => update({ highlight: value })}
                />
              )}
            </span>
          </Field>
        </FieldGrid>
        {definition?.kind === "number" && definition.percent !== true && (
          <FieldGrid min="5rem">
            <Field label="Lowest">
              <NumberBox
                label="Lowest"
                min={-100000}
                max={100000}
                value={parameter.min ?? definition.min}
                onChange={(min) => update({ min })}
              />
            </Field>
            <Field label="Highest">
              <NumberBox
                label="Highest"
                min={-100000}
                max={100000}
                value={parameter.max ?? definition.max}
                onChange={(max) => update({ max })}
              />
            </Field>
            <Field label="Unit">
              <TextBox
                label="Unit"
                value={parameter.unit ?? definition.unit ?? ""}
                onChange={(unit) => update({ unit })}
              />
            </Field>
          </FieldGrid>
        )}
      </Block>
      <Block title="Encoding">
        <EncodeEditor
          scope={scope}
          probe={probe}
          element={element}
          attribute={attribute}
        />
      </Block>
      <Block title="On the wire">
        {touched.map((row) => (
          <div key={row.key} className="grid min-w-0 gap-1">
            <button
              type="button"
              className="w-fit text-xs hover:underline"
              onClick={() => scope.open({ kind: "channel", key: row.key })}
            >
              <span className="text-muted-foreground tabular-nums">
                {addressText(row)}
              </span>{" "}
              {row.name}
            </button>
            <ByteBar
              segments={row.segments}
              focus={{ element, attribute }}
              value={
                probe === null
                  ? undefined
                  : topByte(row.bytes, probe.values[row.key] ?? 0)
              }
            />
            {probe !== null && (
              <ProbeFader
                row={row}
                value={probe.values[row.key] ?? 0}
                onChange={probe.set}
              />
            )}
          </div>
        ))}
      </Block>
      <Block title="Notes">
        <NotesBox
          label="Notes"
          placeholder="What the Encoding cannot say"
          value={parameter.notes ?? ""}
          onChange={(notes) => update({ notes })}
        />
      </Block>
    </div>
  );
}
