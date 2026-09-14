import type { DocumentView } from "@refrata/client";
import {
  elementRef,
  elementsOf,
  placeShape,
  settings,
  type Color,
  type PatchedFixture,
  type PlacedShape,
  type StoredFixtureType,
} from "@refrata/core";
import { useMemo } from "react";

import { useDocumentPath } from "@/lib/client";
import { useResolved } from "@/lib/use-resolved";

import { outlinesOf, type OutlineBox } from "./outline-boxes";

/**
 * One Fixture's shapes at its Position, each filled with its Element's
 * resolved colour times dimmer (white times dimmer when it has no colour).
 * The group carries `data-fixture` and each shape `data-element`, which is
 * how the view knows what was clicked. A picked Element key that is one
 * shape strokes it; one covering several shapes (a picked root, so the
 * whole Fixture) draws one box around them. An outlined key (a Target or
 * a Set member) does the same, dashed.
 */
export function FixtureShape({
  view,
  fixture,
  scale,
  picked,
  outlined,
}: {
  readonly view: DocumentView;
  readonly fixture: PatchedFixture;
  readonly scale: number;
  readonly picked: readonly string[];
  readonly outlined: readonly string[];
}) {
  const stored = useDocumentPath<StoredFixtureType>(view, [
    "fixtureTypes",
    fixture.typeKey,
  ]);
  const mode = stored?.type.modes[fixture.modeKey];
  const elements = useMemo(
    () => (mode === undefined ? [] : elementsOf(mode)),
    [mode],
  );
  const shapes = useMemo(
    () => (mode === undefined ? [] : placeShape(mode.shape, elements)),
    [mode, elements],
  );
  const pad = settings.rigView.cellMetres * settings.rigView.outlinePad;
  const pickedOutlines = useMemo(
    () => outlinesOf(shapes, elements, picked, pad),
    [shapes, elements, picked, pad],
  );
  const outlinedOutlines = useMemo(
    () => outlinesOf(shapes, elements, outlined, pad),
    [shapes, elements, outlined, pad],
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
          picked={pickedOutlines.single.has(shape.key)}
          outlined={outlinedOutlines.single.has(shape.key)}
          name={
            mode?.elements[shape.key]?.name === undefined
              ? fixture.name
              : `${fixture.name} · ${mode.elements[shape.key]?.name ?? ""}`
          }
        />
      ))}
      {outlinedOutlines.boxes.map((box, index) => (
        <OutlineRect key={`o${String(index)}`} box={box} scale={scale} dashed />
      ))}
      {pickedOutlines.boxes.map((box, index) => (
        <OutlineRect key={`p${String(index)}`} box={box} scale={scale} />
      ))}
    </g>
  );
}

/** One box around several shapes: solid for a pick, dashed for an outline. Clicks fall through to the shapes. */
function OutlineRect({
  box,
  scale,
  dashed = false,
}: {
  readonly box: OutlineBox;
  readonly scale: number;
  readonly dashed?: boolean;
}) {
  const radius = settings.rigView.cellMetres * settings.rigView.outlinePad;
  return (
    <rect
      x={box.x - box.width / 2}
      y={box.y - box.height / 2}
      width={box.width}
      height={box.height}
      rx={radius}
      className="pointer-events-none fill-none stroke-selection"
      strokeWidth={(dashed ? 1.5 : 2) / scale}
      strokeDasharray={
        dashed ? `${String(3 / scale)} ${String(2 / scale)}` : undefined
      }
    />
  );
}

function ElementShape({
  view,
  fixtureId,
  shape,
  scale,
  picked,
  outlined,
  name,
}: {
  readonly view: DocumentView;
  readonly fixtureId: string;
  readonly shape: PlacedShape;
  readonly scale: number;
  readonly picked: boolean;
  readonly outlined: boolean;
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
      className={
        picked || outlined ? "stroke-selection" : "stroke-muted-foreground/50"
      }
      strokeWidth={(picked ? 2 : outlined ? 1.5 : 1) / scale}
      strokeDasharray={
        outlined && !picked
          ? `${String(3 / scale)} ${String(2 / scale)}`
          : undefined
      }
    >
      <title>{name}</title>
    </rect>
  );
}
