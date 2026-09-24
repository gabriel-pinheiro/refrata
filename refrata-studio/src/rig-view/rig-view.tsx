import type { DocumentView } from "@refrata/client";
import {
  allFixtures,
  type Fixture,
  type Frame,
  type StoredFixtureType,
  type Table,
} from "@refrata/core";
import { useMemo, useRef, useState, type PointerEvent } from "react";

import { PanelHeader } from "@/components/panel-header";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useLatestWins } from "@/lib/use-latest-wins";
import { usePoseStream } from "@/lib/use-pose";
import { pickedRefs } from "@/selection/selected-targets";
import {
  pickModeOf,
  useSelection,
  type PickMode,
  type Selection,
} from "@/selection/selection";

import { pan, toStage, viewBox } from "./camera";
import { FixtureShape } from "./fixture-shape";
import { FrameGizmo } from "./frame-gizmo";
import { dragFrame, isFrameHandle, type FrameHandle } from "./frame-handles";
import {
  elementsInRect,
  normalizeRect,
  placedFixtures,
  type Rect,
} from "./marquee";
import { useOutlined } from "./outlined";
import { useRigCanvas } from "./use-rig-canvas";

/**
 * The schematic front view of the rig: every placed Element as a flat shape
 * lit by its resolved colour times dimmer, on a dark canvas with the floor
 * line. Click selects a Fixture, a click inside a selected Fixture selects
 * the Element under the cursor; shift extends the selection and ctrl
 * toggles it; a drag on empty canvas is a marquee selecting every Fixture
 * inside; a drag on a shape moves the Fixture (one undo step); the middle
 * button or Alt with the left one pans, and so does scrolling, both ways on
 * a trackpad; ctrl with the wheel, or a pinch, zooms around the pointer.
 * Selected Fixtures and Elements are outlined, and so are the Targets of
 * the selected Layers and the members of the selected Sets. A selected
 * Layer running a Geometry Visual shows its Frame with the Visual's
 * figure inside; dragging the Frame's body, edges, corners or rotate
 * handle sets it (one undo step). Zoom and pan are per session and never
 * saved; the view opens framing the whole rig.
 */
export function RigView({ view }: { readonly view: DocumentView }) {
  const command = useCommand(view);
  const { selected, select } = useSelection();
  const picked = pickedRefs(selected);
  const loadedFixtures = useDocumentPath<Table<Fixture>>(view, ["fixtures"]);
  const loadedTypes = useDocumentPath<Table<StoredFixtureType>>(view, [
    "fixtureTypes",
  ]);
  const fixtures = loadedFixtures ?? {};
  const types = loadedTypes ?? {};
  const outlined = useOutlined(view, selected);
  const loadedPlaced = useMemo(
    () =>
      loadedFixtures === undefined || loadedTypes === undefined
        ? undefined
        : placedFixtures(loadedFixtures, loadedTypes),
    [loadedFixtures, loadedTypes],
  );
  const { svgRef, camera, setCamera, size } = useRigCanvas(loadedPlaced);
  const selectedLayers = selected.flatMap((item) =>
    item.kind === "layer" ? [item.id] : [],
  );
  usePoseStream(view, selectedLayers);
  const [marquee, setMarquee] = useState<Rect | undefined>(undefined);
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
  const placeFrame = useLatestWins(
    (move: { readonly layerId: string; readonly frame: Frame }) =>
      command("layer.frame.set", move),
  );

  const pointer = (
    event: PointerEvent<SVGSVGElement>,
  ): { px: number; py: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { px: event.clientX - rect.left, py: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0 && event.button !== 1) return;
    const { px, py } = pointer(event);
    const target = (event.target as SVGElement).closest<SVGElement>(
      "[data-fixture]",
    );
    const fixtureId = target?.dataset.fixture;
    const elementKey = target?.dataset.element;
    event.currentTarget.setPointerCapture(event.pointerId);
    const mode = pickModeOf(event);
    if (event.button === 1 || event.altKey) {
      gesture.current = { kind: "pan", px, py };
      return;
    }
    const grabbed = frameHandleAt(event.target as SVGElement);
    if (grabbed !== undefined && event.button === 0) {
      const layer = view.get()?.layers[grabbed.layerId];
      const frame = layer?.kind === "visual" ? layer.frame : undefined;
      if (frame !== undefined) {
        gesture.current = {
          kind: "frame",
          layerId: grabbed.layerId,
          handle: grabbed.handle,
          start: frame,
          from: toStage(camera, size, px, py),
        };
        return;
      }
    }
    if (fixtureId === undefined) {
      const at = toStage(camera, size, px, py);
      gesture.current = { kind: "marquee", start: at, mode, moved: false };
      return;
    }
    const fixture = fixtures[fixtureId];
    if (fixture?.kind !== "fixture") return;
    const at = toStage(camera, size, px, py);
    gesture.current = {
      kind: "drag",
      fixtureId,
      elementKey: elementKey ?? "root",
      mode,
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
    if (current.kind === "frame") {
      placeFrame({
        layerId: current.layerId,
        frame: dragFrame(
          current.start,
          current.handle,
          current.from,
          toStage(camera, size, px, py),
        ),
      });
      return;
    }
    if (current.kind === "marquee") {
      const at = toStage(camera, size, px, py);
      const rect: Rect = {
        x1: current.start.x,
        y1: current.start.y,
        x2: at.x,
        y2: at.y,
      };
      if (
        !current.moved &&
        Math.abs(rect.x2 - rect.x1) * camera.scale < 4 &&
        Math.abs(rect.y2 - rect.y1) * camera.scale < 4
      )
        return;
      current.moved = true;
      setMarquee(rect);
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
    if (current === undefined || current.kind === "pan") return;
    if (current.kind === "frame") return;
    if (current.kind === "marquee") {
      const rect = marquee;
      setMarquee(undefined);
      if (!current.moved || rect === undefined) {
        // A click on empty canvas: clear, unless extending.
        if (current.mode === "replace") select(undefined);
        return;
      }
      const refs = elementsInRect(
        placedFixtures(fixtures, types),
        normalizeRect(rect),
      );
      select(refs.map(itemOf), current.mode);
      return;
    }
    if (current.moved) return;
    // A click: the Fixture, or an Element of a Fixture already selected.
    const inside =
      current.elementKey !== "root" &&
      selected.some(
        (item) => item.kind === "fixture" && item.id === current.fixtureId,
      );
    select(
      inside
        ? { kind: "element", id: `${current.fixtureId}/${current.elementKey}` }
        : { kind: "fixture", id: current.fixtureId },
      current.mode,
    );
  };

  const placed = allFixtures(fixtures);
  const box = viewBox(camera, size);
  const extent = Math.max(size.width, size.height) / camera.scale;
  const shown = marquee === undefined ? undefined : normalizeRect(marquee);
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
              picked={keysOf(picked, fixture.id)}
              outlined={keysOf(outlined, fixture.id)}
            />
          ))}
          {selectedLayers.map((layerId) => (
            <FrameGizmo
              key={layerId}
              view={view}
              layerId={layerId}
              scale={camera.scale}
            />
          ))}
          {shown !== undefined && (
            <rect
              x={shown.x1}
              y={shown.y1}
              width={shown.x2 - shown.x1}
              height={shown.y2 - shown.y1}
              className="fill-selection/10 stroke-selection"
              strokeWidth={1 / camera.scale}
              strokeDasharray={`${String(4 / camera.scale)} ${String(3 / camera.scale)}`}
            />
          )}
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

/** The Frame handle under a pointer, from the gizmo's data attributes; undefined off any Frame. */
function frameHandleAt(
  target: SVGElement,
): { readonly layerId: string; readonly handle: FrameHandle } | undefined {
  const handle = target.closest<SVGElement>("[data-handle]")?.dataset.handle;
  const layerId = target.closest<SVGElement>("[data-frame]")?.dataset.frame;
  if (layerId === undefined || !isFrameHandle(handle)) return undefined;
  return { layerId, handle };
}

type Gesture =
  | { readonly kind: "pan"; readonly px: number; readonly py: number }
  | {
      readonly kind: "frame";
      readonly layerId: string;
      readonly handle: FrameHandle;
      readonly start: Frame;
      readonly from: { readonly x: number; readonly y: number };
    }
  | {
      readonly kind: "marquee";
      readonly start: { readonly x: number; readonly y: number };
      readonly mode: PickMode;
      moved: boolean;
    }
  | {
      readonly kind: "drag";
      readonly fixtureId: string;
      readonly elementKey: string;
      readonly mode: PickMode;
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

/** The selection item an Element ref stands for: the Fixture for its root, else the Element. */
function itemOf(ref: string): Selection {
  return ref.endsWith("/root")
    ? { kind: "fixture", id: ref.slice(0, -"/root".length) }
    : { kind: "element", id: ref };
}

/** The Element keys of `refs` that belong to `fixtureId`. */
function keysOf(refs: readonly string[], fixtureId: string): readonly string[] {
  const prefix = `${fixtureId}/`;
  return refs
    .filter((ref) => ref.startsWith(prefix))
    .map((ref) => ref.slice(prefix.length));
}
