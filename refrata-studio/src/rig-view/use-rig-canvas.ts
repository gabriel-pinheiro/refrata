import { useEffect, useRef, useState, type RefObject } from "react";

import {
  DEFAULT_CAMERA,
  fit,
  wheel,
  type Camera,
  type CanvasSize,
} from "./camera";
import { rigBounds, type PlacedFixture } from "./marquee";

const UNMEASURED: CanvasSize = { width: 1, height: 1 };

/** Pixels kept clear around the rig when the view frames it. */
const FIT_MARGIN = 48;

/**
 * The Rig View's canvas: the SVG's measured size, the camera, and the
 * wheel on it. The camera frames the whole rig once, when the canvas is
 * measured and the rig loaded (`placed` undefined until then); after that
 * zoom and pan are the person's. A native wheel listener, since React's is
 * passive and cannot stop ctrl+wheel or a pinch from zooming the page.
 */
export function useRigCanvas(placed: readonly PlacedFixture[] | undefined): {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly camera: Camera;
  readonly setCamera: (update: (previous: Camera) => Camera) => void;
  readonly size: CanvasSize;
} {
  const svgRef = useRef<SVGSVGElement>(null);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [measured, setSize] = useState<CanvasSize | undefined>(undefined);
  const size = measured ?? UNMEASURED;
  const [framed, setFramed] = useState(false);
  if (!framed && measured !== undefined && placed !== undefined) {
    // React allows adjusting state during render.
    setFramed(true);
    const bounds = rigBounds(placed);
    if (bounds !== undefined) setCamera(fit(bounds, measured, FIT_MARGIN));
  }

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

  useEffect(() => {
    const element = svgRef.current;
    if (element === null) return;
    const onWheel = (event: globalThis.WheelEvent): void => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const input = {
        px: event.clientX - rect.left,
        py: event.clientY - rect.top,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
      };
      setCamera((previous) => wheel(previous, size, input));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [size]);

  return { svgRef, camera, setCamera, size };
}
