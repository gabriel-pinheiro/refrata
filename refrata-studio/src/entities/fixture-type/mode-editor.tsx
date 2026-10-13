import { footprintOf, keyFromName, type Shape } from "@refrata/core";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Block, Field, FieldGrid } from "@/inspector/fields/form-block";
import { Choice, NumberBox, TextBox } from "@/inspector/fields/form-inputs";

import { NotesBox } from "./notes-box";
import type { Scope } from "./scope";

const TEMPLATES: Record<Shape["template"], { label: string; fresh: Shape }> = {
  single: { label: "Single", fresh: { template: "single" } },
  bar: { label: "Bar", fresh: { template: "bar", tag: "pixel", count: 8 } },
  grid: {
    label: "Grid",
    fresh: { template: "grid", tag: "pixel", cols: 8, rows: 4 },
  },
  "strobe-backlight": {
    label: "Strobe and backlight",
    fresh: { template: "strobe-backlight", sections: 8, panels: 8 },
  },
};

/** The Mode's own facts: its name, its notes and the Shape Template the Rig View draws it with. */
export function ModeEditor({
  scope,
  onRemove,
}: {
  readonly scope: Scope;
  readonly onRemove: () => void;
}) {
  const { mode } = scope;
  const shape = mode.shape;
  const update = (change: object): void =>
    void scope.run("type.mode.update", change);
  const count = (
    label: string,
    value: number,
    next: (value: number) => Shape,
  ) => (
    <Field label={label}>
      <NumberBox
        label={label}
        min={1}
        max={512}
        value={value}
        onChange={(typed) => update({ shape: next(Math.round(typed)) })}
      />
    </Field>
  );
  return (
    <>
      <Block
        title="Mode"
        actions={
          <Button variant="ghost" size="xs" onClick={onRemove}>
            <Trash2 /> Remove
          </Button>
        }
      >
        <FieldGrid min="9rem">
          <Field label="Name">
            <TextBox
              label="Mode name"
              value={mode.name}
              onChange={(name) => {
                if (name.trim() !== "") update({ name: name.trim() });
              }}
            />
          </Field>
          <Field label="Key">
            <span className="flex h-6 items-center font-mono text-xs text-muted-foreground">
              {scope.modeKey}
            </span>
          </Field>
          <Field label="Footprint">
            <span className="flex h-6 items-center text-xs tabular-nums">
              {String(footprintOf(mode))}
            </span>
          </Field>
        </FieldGrid>
        <Field label="Notes">
          <NotesBox
            label="Mode notes"
            value={mode.notes ?? ""}
            onChange={(notes) => update({ notes })}
          />
        </Field>
      </Block>
      <Block title="Shape Template">
        <FieldGrid min="8rem">
          <Field label="Template">
            <Choice
              value={shape.template}
              options={Object.entries(TEMPLATES).map(([value, each]) => ({
                value: value as Shape["template"],
                label: each.label,
              }))}
              onChange={(template) => {
                if (template !== shape.template)
                  update({ shape: TEMPLATES[template].fresh });
              }}
            />
          </Field>
          {"tag" in shape && (
            <Field label="Tag of its cells">
              <TextBox
                label="Tag"
                value={shape.tag}
                onChange={(typed) => {
                  const tag = keyFromName(typed);
                  if (tag !== "") update({ shape: { ...shape, tag } });
                }}
              />
            </Field>
          )}
          {shape.template === "bar" &&
            count("Cells", shape.count, (next) => ({ ...shape, count: next }))}
          {shape.template === "grid" &&
            count("Columns", shape.cols, (next) => ({ ...shape, cols: next }))}
          {shape.template === "grid" &&
            count("Rows", shape.rows, (next) => ({ ...shape, rows: next }))}
          {shape.template === "strobe-backlight" &&
            count("Sections", shape.sections, (next) => ({
              ...shape,
              sections: next,
            }))}
          {shape.template === "strobe-backlight" &&
            count("Panels", shape.panels, (next) => ({
              ...shape,
              panels: next,
            }))}
        </FieldGrid>
      </Block>
    </>
  );
}
