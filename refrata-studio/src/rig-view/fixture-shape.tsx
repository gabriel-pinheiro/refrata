import type { DocumentView } from "@refrata/client";
import {
  elementRef,
  elementsOf,
  placeShape,
  subtreeOf,
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
 * how the view knows what was clicked. A picked Element key outlines its
 * whole subtree, so a picked root outlines the Fixture; an outlined key
 * (a Target or a Set member) draws dashed.
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
  const pickedKeys = useMemo(
    () => expand(elements, picked),
    [elements, picked],
  );
  const outlinedKeys = useMemo(
    () => expand(elements, outlined),
    [elements, outlined],
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
          picked={pickedKeys.has(shape.key)}
          outlined={outlinedKeys.has(shape.key)}
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

/** Every key below each of `keys`, the keys themselves included. */
function expand(
  elements: Parameters<typeof subtreeOf>[0],
  keys: readonly string[],
): ReadonlySet<string> {
  const result = new Set<string>();
  for (const key of keys)
    for (const element of subtreeOf(elements, key)) result.add(element.key);
  return result;
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
