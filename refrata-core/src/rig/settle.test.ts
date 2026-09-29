import { describe, expect, it } from "vitest";

import beamJson from "../../../refrata-library/generic/beam-moving-head.json" with { type: "json" };
import { executeCommand } from "../command/execute.ts";
import { createBuiltInRegistry } from "../commands/index.ts";
import { emptyDocument, type Document } from "../document/document.ts";
import { parseFixtureType } from "./fixture-type.ts";
import { universeFrame } from "./frames.ts";
import { Settle } from "./settle.ts";

const RED = [1, 0, 0, 1] as const;
const AMBER = [1, 0.706, 0, 1] as const;
const AZURE = [0, 0.314, 1, 1] as const;
const BLUE = [0, 0, 1, 1] as const;
const TICK = 0.025;

type Rgba = readonly [number, number, number, number];

interface Stage {
  readonly document: Document;
  readonly color: Rgba;
}

/** One beam patched at address 1, of `type`. */
function rig(type: unknown = beamJson): Document {
  const result = executeCommand(
    createBuiltInRegistry(),
    emptyDocument("Club"),
    "fixture.create",
    {
      id: "beam",
      typeKey: "generic/beam-moving-head",
      modeKey: "12ch",
      fixtureType: type,
      name: "Beam",
    },
  );
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

const root = beamJson.modes["12ch"].elements.root;

/** The beam's type with some of its root's Parameters replaced. */
function withRoot(parameters: Record<string, unknown>): unknown {
  return {
    ...beamJson,
    modes: {
      "12ch": {
        ...beamJson.modes["12ch"],
        elements: {
          root: { ...root, parameters: { ...root.parameters, ...parameters } },
        },
      },
    },
  };
}

const beam = rig();

/** The beam asked for `color` at full, optionally under Blackout. */
function stage(color: Rgba, blackout = false, document = beam): Stage {
  return {
    document: {
      ...document,
      operational: { ...document.operational, blackout },
    },
    color,
  };
}

/** Steps `settle` once and returns the beam's dimmer and the byte its colour Channel is sent. */
function step(
  settle: Settle,
  { document, color }: Stage,
): { readonly dimmer: unknown; readonly wheel: number | undefined } {
  const resolved = settle.step(
    document,
    new Map([["beam/root", { dimmer: 1, color }]]),
    TICK,
  );
  const universeId = Object.keys(document.universes)[0] ?? "";
  return {
    dimmer: resolved.get("beam/root")?.dimmer,
    wheel: universeFrame(document, universeId, resolved)[7],
  };
}

/** How many ticks the beam stays dark from now on, the colour held. */
function darkTicks(settle: Settle, asked: Stage): number {
  let ticks = 0;
  while (step(settle, asked).dimmer === 0) ticks += 1;
  return ticks;
}

describe("Settle", () => {
  it("takes a wheel first seen to be where it is asked", () => {
    expect(step(new Settle(), stage(BLUE))).toEqual({ dimmer: 1, wheel: 110 });
  });

  it("goes dark for base plus the slots crossed, then lets go at once", () => {
    const settle = new Settle();
    step(settle, stage(RED));
    // Red to Azure is two slots: 0.08 + 2 x 0.052 s, 8 ticks of 25 ms.
    expect(step(settle, stage(AZURE))).toEqual({ dimmer: 0, wheel: 30 });
    expect(darkTicks(settle, stage(AZURE))).toBe(7);
    expect(step(settle, stage(AZURE)).dimmer).toBe(1);
  });

  it("changes lit between neighbouring slots", () => {
    const settle = new Settle();
    step(settle, stage(RED));
    expect(step(settle, stage(AMBER))).toEqual({ dimmer: 1, wheel: 20 });
    expect(step(settle, stage(RED)).dimmer).toBe(1);
  });

  it("settles a change made during the dark from where the wheel has got to", () => {
    const settle = new Settle();
    step(settle, stage(RED));
    step(settle, stage(AZURE));
    // One tick on, the wheel is half a slot from Amber: 0.025 + 0.08 s.
    expect(step(settle, stage(AMBER))).toEqual({ dimmer: 0, wheel: 20 });
    expect(darkTicks(settle, stage(AMBER))).toBe(4);
  });

  it("is never dark for longer than the whole wheel takes, however fast the colour changed", () => {
    const settle = new Settle();
    step(settle, stage(RED));
    for (let tick = 0; tick < 400; tick += 1)
      step(settle, stage(tick % 2 === 0 ? BLUE : RED));
    // At most Red to Blue, ten slots: 0.08 + 10 x 0.052 s from the last change.
    expect(darkTicks(settle, stage(BLUE))).toBeLessThanOrEqual(25);
  });

  it("settles from the slot at byte 0 when Blackout is let go", () => {
    const settle = new Settle();
    step(settle, stage(BLUE));
    step(settle, stage(BLUE, true));
    expect(step(settle, stage(BLUE)).dimmer).toBe(0);
    // White to Blue is eleven slots: 0.08 + 11 x 0.052 s.
    expect(darkTicks(settle, stage(BLUE))).toBe(26);
  });

  it("sends nothing but zeros under Blackout", () => {
    const settle = new Settle();
    step(settle, stage(BLUE));
    expect(step(settle, stage(BLUE, true)).wheel).toBe(0);
  });

  it("leaves a type without a settle time alone", () => {
    const document = rig(
      withRoot({ color: { ...root.parameters.color, settle: undefined } }),
    );
    const settle = new Settle();
    step(settle, stage(RED, false, document));
    expect(step(settle, stage(BLUE, false, document)).dimmer).toBe(1);
  });

  it("is refused on a Parameter without swatches", () => {
    const type = withRoot({
      dimmer: {
        ...root.parameters.dimmer,
        settle: { base: 0.1, perSlot: 0.05 },
      },
    });
    const parsed = parseFixtureType(type);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("settle time");
  });
});
