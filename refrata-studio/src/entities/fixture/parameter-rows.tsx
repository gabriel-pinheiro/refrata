import type { DocumentView } from "@refrata/client";
import type { Color, Element, ParameterValues } from "@refrata/core";
import { Sun } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { colorToHex, formatNumber } from "@/inspector/fields/address-format";
import { FieldRow } from "@/inspector/fields/field-row";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { useClient } from "@/lib/client";
import { useResolved } from "@/lib/use-resolved";

/**
 * An Element's Parameters with their resolved values from the Resolved
 * Stream, read-only until Layers exist, plus the Highlight button: held
 * down, the Element takes its Highlight values on the real fixture.
 */
export function ParameterRows({
  view,
  elementId,
  element,
}: {
  readonly view: DocumentView;
  readonly elementId: string;
  readonly element: Element;
}) {
  const resolved = useResolved(view, elementId);
  const parameters = Object.entries(element.parameters);
  return (
    <InspectorSection
      storageKey="parameters"
      label="Parameters"
      actions={<HighlightButton view={view} elementId={elementId} />}
    >
      {parameters.length === 0 ? (
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          {element.name} has no Parameters of its own; its parts do.
        </p>
      ) : (
        parameters.map(([key, parameter]) => (
          <FieldRow key={key} label={parameter.definition.label}>
            <Readout parameter={parameter} value={resolved?.[key]} />
          </FieldRow>
        ))
      )}
    </InspectorSection>
  );
}

function Readout({
  parameter,
  value,
}: {
  readonly parameter: Element["parameters"][keyof Element["parameters"]] &
    object;
  readonly value: ParameterValues[string] | undefined;
}) {
  const definition = parameter.definition;
  const shown = value ?? definition.default;
  switch (definition.kind) {
    case "number":
      return (
        <span className="text-xs tabular-nums">
          {formatNumber(typeof shown === "number" ? shown : 0, definition)}
          {definition.percent === true ? "%" : (definition.unit ?? "")}
        </span>
      );
    case "color": {
      const color = (Array.isArray(shown) ? shown : [0, 0, 0, 1]) as Color;
      return (
        <span className="flex items-center gap-1.5 text-xs">
          <span
            className="size-4 rounded-[3px] border border-input"
            style={{ background: colorToHex(color) }}
          />
          <span className="font-mono text-[0.6875rem] text-muted-foreground uppercase">
            {colorToHex(color)}
          </span>
        </span>
      );
    }
    case "choice":
      return (
        <span className="text-xs">
          {definition.options.find((option) => option.value === shown)?.label ??
            String(shown)}
        </span>
      );
    case "boolean":
      return <span className="text-xs">{shown === true ? "On" : "Off"}</span>;
  }
}

/** Held down, lights the Element at its Highlight values; released, lets go. */
export function HighlightButton({
  view,
  elementId,
}: {
  readonly view: DocumentView;
  readonly elementId: string;
}) {
  const client = useClient();
  const held = useRef(false);
  const address = `element/${elementId}/highlight`;
  const set = (value: boolean): void => {
    if (held.current === value) return;
    held.current = value;
    client.input(view.documentId, address, value);
  };
  return (
    <Button
      variant="outline"
      size="xs"
      title="Hold to light this at its Highlight values"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") set(true);
      }}
      onKeyUp={() => set(false)}
      onBlur={() => set(false)}
    >
      <Sun /> Highlight
    </Button>
  );
}
