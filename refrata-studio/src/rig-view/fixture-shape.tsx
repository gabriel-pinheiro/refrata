import type { DocumentView } from "@refrata/client";
import {
  elementRef,
  elementsOf,
  placeShape,
  type Color,
  type PatchedFixture,
  type PlacedShape,
  type StoredFixtureType,
} from "@refrata/core";
import { useMemo } from "react";

import { useDocumentPath } from "@/lib/client";
import { useResolved } from "@/lib/use-resolved";

/**
 * One Fixture's shapes at its Position, each filled with its Element's
 * resolved colour times dimmer (white times dimmer when it has no colour).
 * The group carries `data-fixture` and each shape `data-element`, which is
 * how the view knows what was clicked.
 */
export function FixtureShape({
  view,
  fixture,
  scale,
  selected,
  selectedElement,
}: {
  readonly view: DocumentView;
  readonly fixture: PatchedFixture;
  readonly scale: number;
  readonly selected: boolean;
  readonly selectedElement: string | undefined;
}) {
  const stored = useDocumentPath<StoredFixtureType>(view, [
    "fixtureTypes",
    fixture.typeKey,
  ]);
  const mode = stored?.type.modes[fixture.modeKey];
  const shapes = useMemo(
    () => (mode === undefined ? [] : placeShape(mode.shape, elementsOf(mode))),
    [mode],
  );
  const { x, y, rz } = fixture.position;
  return (
    <g
      data-fixture={fixture.id}
      transform={`translate(${String(x)},${String(y)}) rotate(${String(rz)})`}
      className="cursor-grab active:cursor-grabbing"
    >
      <title>{fixture.name}</title>
      {shapes.map((shape) => (
        <ElementShape
          key={shape.key}
          view={view}
          fixtureId={fixture.id}
          shape={shape}
          scale={scale}
          selected={
            selected &&
            (selectedElement === undefined || selectedElement === shape.key)
          }
          name={
            mode?.elements[shape.key]?.name === undefined
              ? fixture.name
              : `${fixture.name} · ${mode.elements[shape.key]?.name ?? ""}`
          }
        />
      ))}
    </g>
  );
}

function ElementShape({
  view,
  fixtureId,
  shape,
  scale,
  selected,
  name,
}: {
  readonly view: DocumentView;
  readonly fixtureId: string;
  readonly shape: PlacedShape;
  readonly scale: number;
  readonly selected: boolean;
  readonly name: string;
}) {
  const resolved = useResolved(view, elementRef(fixtureId, shape.key));
  const dimmer = typeof resolved?.dimmer === "number" ? resolved.dimmer : 0;
  const color = Array.isArray(resolved?.color)
    ? (resolved.color as Color)
    : ([1, 1, 1, 1] as const);
  const lit = (channel: number): number => Math.round(channel * dimmer * 255);
  const gap = Math.min(shape.width, shape.height) * 0.06;
  return (
    <rect
      data-fixture={fixtureId}
      data-element={shape.key}
      x={shape.x - shape.width / 2 + gap}
      y={shape.y - shape.height / 2 + gap}
      width={shape.width - gap * 2}
      height={shape.height - gap * 2}
      rx={gap}
      fill={`rgb(${String(lit(color[0]))}, ${String(lit(color[1]))}, ${String(lit(color[2]))})`}
      className={selected ? "stroke-selection" : "stroke-muted-foreground/50"}
      strokeWidth={(selected ? 2 : 1) / scale}
    >
      <title>{name}</title>
    </rect>
  );
}
