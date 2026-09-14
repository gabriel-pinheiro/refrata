import type { DocumentView } from "@refrata/client";
import { allFixtures, type Fixture, type Table } from "@refrata/core";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react";

import { PanelHeader } from "@/components/panel-header";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useLatestWins } from "@/lib/use-latest-wins";
import { useSelection } from "@/selection/selection";

import {
  DEFAULT_CAMERA,
  pan,
  toStage,
  viewBox,
  zoomAt,
  type Camera,
} from "./camera";
import { FixtureShape } from "./fixture-shape";

/**
 * The schematic front view of the rig: every placed Element as a flat shape
 * lit by its resolved colour times dimmer, on a dark canvas with the floor
 * line. Click selects a Fixture, a click inside a selected Fixture selects
 * the Element under the cursor, drag moves the Fixture (one undo step),
 * wheel zooms around the pointer, dragging the background pans. Zoom and
 * pan are per session and never saved.
 */
export function RigView({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { selection, select } = useSelection();
  const fixtures = useDocumentPath<Table<Fixture>>(view, ["fixtures"]) ?? {};
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | undefined>(undefined);
  const place = useLatestWins(
    (move: {
      readonly fixtureId: string;
      readonly x: number;
      readonly y: number;
    }) =>
      command("fixture.place", {
        fixtureId: move.fixtureId,
        position: { x: move.x, y: move.y },
      }),
  );

  useEffect(() => {
    const element = svgRef.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pointer = (
    event: PointerEvent<SVGSVGElement>,
  ): { px: number; py: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { px: event.clientX - rect.left, py: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    const { px, py } = pointer(event);
    const target = (event.target as SVGElement).closest<SVGElement>(
      "[data-fixture]",
    );
    const fixtureId = target?.dataset.fixture;
    const elementKey = target?.dataset.element;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (fixtureId === undefined) {
      gesture.current = { kind: "pan", px, py };
      return;
    }
    const fixture = fixtures[fixtureId];
    if (fixture?.kind !== "fixture") return;
    const at = toStage(camera, size, px, py);
    gesture.current = {
      kind: "drag",
      fixtureId,
      elementKey: elementKey ?? "root",
      startPx: px,
      startPy: py,
      offsetX: fixture.position.x - at.x,
      offsetY: fixture.position.y - at.y,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const current = gesture.current;
    if (current === undefined) return;
    const { px, py } = pointer(event);
    if (current.kind === "pan") {
      setCamera((previous) => pan(previous, px - current.px, py - current.py));
      gesture.current = { ...current, px, py };
      return;
    }
    if (
      !current.moved &&
      Math.hypot(px - current.startPx, py - current.startPy) < 4
    )
      return;
    current.moved = true;
    const at = toStage(camera, size, px, py);
    place({
      fixtureId: current.fixtureId,
      x: round(at.x + current.offsetX),
      y: round(at.y + current.offsetY),
    });
  };

  const onPointerUp = (): void => {
    const current = gesture.current;
    gesture.current = undefined;
    if (current === undefined || current.kind === "pan" || current.moved)
      return;
    // A click: the Fixture, or an Element of the Fixture already selected.
    const selectedFixture =
      selection?.kind === "fixture"
        ? selection.id
        : selection?.kind === "element"
          ? selection.id.slice(0, selection.id.lastIndexOf("/"))
          : undefined;
    if (selectedFixture === current.fixtureId && current.elementKey !== "root")
      select({
        kind: "element",
        id: `${current.fixtureId}/${current.elementKey}`,
      });
    else select({ kind: "fixture", id: current.fixtureId });
  };

  const onWheel = (event: WheelEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.0015);
    setCamera((previous) =>
      zoomAt(
        previous,
        size,
        event.clientX - rect.left,
        event.clientY - rect.top,
        factor,
      ),
    );
  };

  const placed = allFixtures(fixtures);
  const selectedFixture =
    selection?.kind === "fixture"
      ? selection.id
      : selection?.kind === "element"
        ? selection.id.slice(0, selection.id.lastIndexOf("/"))
        : undefined;
  const box = viewBox(camera, size);
  const extent = Math.max(size.width, size.height) / camera.scale;
  return (
    <main className="flex h-full min-h-0 flex-col bg-background">
      <PanelHeader>Rig View</PanelHeader>
      <svg
        ref={svgRef}
        className="min-h-0 flex-1 touch-none select-none"
        viewBox={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClick={(event) => {
          if ((event.target as SVGElement).closest("[data-fixture]") === null)
            select(undefined);
        }}
      >
        {/* Stage y runs up; the viewBox is written in flipped y, so flip once here. */}
        <g transform="scale(1,-1)">
          <line
            x1={camera.x - extent}
            x2={camera.x + extent}
            y1={0}
            y2={0}
            className="stroke-muted-foreground/40"
            strokeWidth={1.5 / camera.scale}
          />
          <line
            x1={0}
            x2={0}
            y1={-0.1}
            y2={0.1}
            className="stroke-muted-foreground/40"
            strokeWidth={1.5 / camera.scale}
          />
          {placed.map((fixture) => (
            <FixtureShape
              key={fixture.id}
              view={view}
              fixture={fixture}
              scale={camera.scale}
              selected={selectedFixture === fixture.id}
              selectedElement={
                selection?.kind === "element" &&
                selection.id.startsWith(`${fixture.id}/`)
                  ? selection.id.slice(fixture.id.length + 1)
                  : undefined
              }
            />
          ))}
        </g>
      </svg>
      {placed.length === 0 && (
        <p className="pointer-events-none -mt-24 text-center text-xs text-muted-foreground">
          No Fixtures yet. Add one from the navigator and it appears here.
        </p>
      )}
    </main>
  );
}

type Gesture =
  | { readonly kind: "pan"; readonly px: number; readonly py: number }
  | {
      readonly kind: "drag";
      readonly fixtureId: string;
      readonly elementKey: string;
      readonly startPx: number;
      readonly startPy: number;
      readonly offsetX: number;
      readonly offsetY: number;
      moved: boolean;
    };

/** Positions are kept to centimetres so a drag does not fill the file with float noise. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
