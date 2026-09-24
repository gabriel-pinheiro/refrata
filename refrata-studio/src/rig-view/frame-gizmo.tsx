import type { DocumentView } from "@refrata/client";
import {
  visualDefinition,
  type Color,
  type Frame,
  type VisualLayer,
} from "@refrata/core";

import { useDocumentPath } from "@/lib/client";
import { usePose } from "@/lib/use-pose";

import {
  CORNER_HANDLES,
  EDGE_HANDLES,
  handleAnchor,
  handleCursor,
} from "./frame-handles";

/** How far above the Frame's top edge the rotate handle floats, in pixels. */
const ROTATE_OFFSET_PX = 18;
/** A resize handle's side, in pixels. */
const HANDLE_PX = 7;
/** How wide the outline grabs for a move, in pixels, so the fixtures inside the Frame stay clickable. */
const GRAB_PX = 10;

/**
 * A selected Layer's Frame in the Rig View: its outline with a handle on
 * each edge and corner and one above it to rotate, and under them the
 * figure its Geometry Visual draws from the streamed pose, in the Frame's
 * own space. The group carries `data-frame` and each handle
 * `data-handle`, which is how the view knows what was grabbed; the body
 * moves by its outline only, so the fixtures inside stay clickable.
 * Without a pose (the Layer's Scene is not playing) only the Frame is
 * drawn.
 */
export function FrameGizmo({
  view,
  layerId,
  scale,
}: {
  readonly view: DocumentView;
  readonly layerId: string;
  readonly scale: number;
}) {
  const layer = useDocumentPath<VisualLayer>(view, ["layers", layerId]);
  const pose = usePose(view, layerId);
  const frame = layer?.frame;
  const definition =
    layer === undefined ? undefined : visualDefinition(layer.visual);
  if (layer === undefined || frame === undefined) return null;
  const figure =
    pose === null || pose === undefined || definition?.geometry === undefined
      ? []
      : definition.geometry.figure(layer.parameters, pose, frame);
  const handle = HANDLE_PX / scale;
  const stroke = 1.5 / scale;
  return (
    <g
      data-frame={layerId}
      transform={`translate(${String(frame.x)},${String(frame.y)}) rotate(${String(frame.rotation)})`}
    >
      <title>{`${layer.name} Frame`}</title>
      <clipPath id={`frame-clip-${layerId}`}>
        <rect
          x={-frame.width / 2}
          y={-frame.height / 2}
          width={frame.width}
          height={frame.height}
        />
      </clipPath>
      <rect
        x={-frame.width / 2}
        y={-frame.height / 2}
        width={frame.width}
        height={frame.height}
        className="pointer-events-none fill-selection/5 stroke-selection"
        strokeWidth={stroke}
        strokeDasharray={`${String(4 / scale)} ${String(3 / scale)}`}
      />
      <rect
        data-handle="move"
        x={-frame.width / 2}
        y={-frame.height / 2}
        width={frame.width}
        height={frame.height}
        fill="none"
        stroke="transparent"
        strokeWidth={GRAB_PX / scale}
        pointerEvents="stroke"
        style={{ cursor: handleCursor("move", frame.rotation) }}
      />
      <g
        clipPath={`url(#frame-clip-${layerId})`}
        className="pointer-events-none"
      >
        {figure.map((path, index) => (
          <path
            key={index}
            d={path.d}
            fill={path.strokeWidth === undefined ? fillOf(path.color) : "none"}
            stroke={
              path.strokeWidth === undefined ? "none" : fillOf(path.color)
            }
            strokeWidth={path.strokeWidth}
            className={
              path.color === undefined
                ? path.strokeWidth === undefined
                  ? "fill-selection"
                  : "stroke-selection"
                : undefined
            }
            opacity={path.alpha}
          />
        ))}
      </g>
      {[...EDGE_HANDLES, ...CORNER_HANDLES].map((key) => {
        const anchor = handleAnchor(key);
        return (
          <rect
            key={key}
            data-handle={key}
            x={(anchor.x * frame.width - handle) / 2}
            y={(anchor.y * frame.height - handle) / 2}
            width={handle}
            height={handle}
            className="fill-background stroke-selection"
            strokeWidth={stroke}
            style={{ cursor: handleCursor(key, frame.rotation) }}
          />
        );
      })}
      <line
        x1={0}
        y1={frame.height / 2}
        x2={0}
        y2={frame.height / 2 + ROTATE_OFFSET_PX / scale}
        className="pointer-events-none stroke-selection"
        strokeWidth={stroke}
      />
      <circle
        data-handle="rotate"
        cx={0}
        cy={frame.height / 2 + ROTATE_OFFSET_PX / scale}
        r={handle / 2}
        className="fill-background stroke-selection"
        strokeWidth={stroke}
        style={{ cursor: handleCursor("rotate", frame.rotation) }}
      />
    </g>
  );
}

/** A figure path's colour as CSS, or undefined to take the selection colour from the class. */
function fillOf(color: Color | undefined): string | undefined {
  if (color === undefined) return undefined;
  const channel = (value: number): string =>
    String(Math.round(Math.min(1, Math.max(0, value)) * 255));
  return `rgb(${channel(color[0])}, ${channel(color[1])}, ${channel(color[2])})`;
}

/** Whether a Layer draws a Frame in the Rig View: a Visual Layer running a Geometry Visual, with a Frame. */
export function hasFrame(
  layer:
    | {
        readonly kind: string;
        readonly visual?: string;
        readonly frame?: Frame;
      }
    | undefined,
): boolean {
  return (
    layer?.kind === "visual" &&
    layer.frame !== undefined &&
    visualDefinition(layer.visual ?? "")?.geometry !== undefined
  );
}
