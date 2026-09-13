# Moving heads and geometry

Moving heads are deferred as a feature, but the model must already fit them,
because the moment a mover appears every layer of the design is tested at
once: Encoding (16-bit, wheels, shutter/strobe on one byte), Look Layers
(per-Element values), Visuals (two-Slot outputs, relative offsets), Filters
(movement time, range limits) and, eventually, geometry (pointing at a place
on stage, sweeping across it). This note walks a mover through each and then
says how positions enter the model so gradients and sweeps follow the real
rig. Terms in [../GLOSSARY.md](../GLOSSARY.md).

## 1. What a mover looks like in the Rig

One root Element (or a root with a pixel-ring child Element, for the ones that
have it) with Parameters:

| Attribute                                     | Kind                   | Unit    | Notes                                                |
| --------------------------------------------- | ---------------------- | ------- | ---------------------------------------------------- |
| `dimmer`                                      | number                 | 0..1    |                                                      |
| `shutter`                                     | choice                 |         | closed, open, pulse modes; shares a byte with strobe |
| `strobe`                                      | number                 | Hz      | above zero beats shutter in the Encoding             |
| `pan`, `tilt`                                 | number                 | degrees | -270..270 and -135..135, two-byte Channels           |
| `color`                                       | color                  |         | discrete gamut on a wheel, continuous on CMY/RGB     |
| `color-temperature`                           | number                 | K       | when a CTO exists                                    |
| `gobo1`                                       | choice                 |         | swatches are images                                  |
| `gobo1-mode`, `gobo1-angle`, `gobo1-rotation` | choice, number, number |         | one byte, three Parameters                           |
| `zoom`, `focus`, `iris`, `frost`, `prism`     | number or choice       | 0..1    |                                                      |
| `control`                                     | choice                 |         | dangerous ranges behind a safe default               |

Nothing here needed a term the Rig did not already have. The Encoding cases
were listed for exactly this fixture.

## 2. What programming a mover needs, and where it lands

**Focus positions are per Element.** "Centre Stage" is a different pan and
tilt for every mover. A Look Layer row with per-Element values holds it; a
Preset will later let many Look Layers share it. This is the case that
decided the Look Layer; see docs/visuals-and-links.md.

**Movement time.** Consoles give each cue a fade; movers need it more than
anything else, because a snap is visible and loud. Here it is a Smooth Filter
at the top of the stack, "Position 1.5 s", easing every change of `pan` and
`tilt` below it, whatever Layer or Scene caused it. A Transition, once built
(docs/transitions.md), is the other half, and Move in Black handles the
mover that is dark while it travels.

**Effects.** A Circle Visual has two Slots bound to `pan` and `tilt` by
default and a radius Parameter in degrees. On a Layer with blend `add`, it is
relative: the circle runs around whatever position the Look Layer below set,
and each mover draws its own circle around its own focus. On `normal` it is
absolute. Spread over a Set, with a phase Parameter, it becomes a wave of
circles. This covers grandMA3's absolute and relative phaser layers with one
blend mode.

**Pairing.** Touching pan on a console stores tilt too (GDTF's activation
group), so a cue never moves one axis without the other. In a Look Layer both
rows are independent, which is more flexible and one foot-gun: a Layer
setting only `pan` over a Layer setting both is a legal, sometimes surprising
composition. A convention (the Look Layer offers "Position" as one row pair)
is enough; no model change.

**Keeping movers off the audience.** A Limit Filter on `tilt` for a Set
`Front Truss Movers` clamps whatever the stack produces. Consoles do this in
the fixture setup; a Filter keeps it visible and per Scene if wanted.

**Wheels.** `color` on a wheel fixture snaps to the nearest swatch, and Studio
shows the swatch chosen beside the colour asked. `gobo1` is a choice whose
options carry images; a Rainbow over a mover Set colours the CMY ones smoothly
and steps the wheel ones. Nothing special is needed for the mixed Set, which
is the point of one `color` Attribute.

**Dangerous channels.** `control` rows in a Look Layer default to released, so
the Mode's safe default holds unless someone means it.

Verdict: the mover fits without a new concept. Its cost is in Encoding data
(the library carries it) and in the two Filters, Smooth and Limit, which are
worth having for washes too.

## 3. Geometry: how a sweep across the stage becomes possible

Two things in the review need positions: a gradient over fixtures by where
they hang, and a Visual that sweeps across the stage. Both reference systems
solve it in the abstract: QLC+ places fixtures or heads on a 2D grid in a
fixture group and its RGB Matrix paints the grid; grandMA3 has the selection
grid for MAtricks and, for real space, positions in the patch's Stage that
Bitmaps and 3D use.

The direction here, in three steps, each usable on its own:

1. **Order.** A spread Set hands each Target its `index` and the `count`.
   A sweep is alpha as a function of `index / count` over time. This exists
   as soon as Spread does and covers a truss of bars.
2. **Position.** A Fixture gets a position and orientation in a stage space
   (metres, origin at centre stage, entered in Studio the way Difracta's
   Surfaces are calibrated, or imported from MVR). A Mode may add per-Element
   offsets from its geometry (the Panels of a bar sit 12 cm apart). Each
   Target then carries `position`, and a Visual asks for it the way a Difracta
   Visual asks for a Path: a declared need, so a Layer over a Set with no
   positions says so. A sweep is alpha as a function of `x`; a gradient is
   colour as a function of `x`; a "from the drummer outward" is distance from
   a point. The bar's Panels get positions for free from the Mode.
3. **Pointing.** With positions and orientations, a mover can be aimed at a
   point on stage instead of at pan and tilt angles: a Look Layer row `focus`
   in stage coordinates, converted per Element by inverse kinematics. This is
   the mover's "Centre Stage" without a per-Element table, and a Visual that
   sweeps a point across the stage moves every mover to follow it. It is the
   furthest step and needs calibration to be trustworthy.

What this means for the model now: Targets carry metadata (index, count, and
later position and tags), Visuals declare which metadata they need, and Sets
by rule keep their order stable. A grid on a Set is then a fallback for rigs
nobody measured, not the primary geometry.
