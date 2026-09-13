# The Rig View

A schematic front view of the rig inside Studio, so an Installation can be
composed and checked without a single fixture plugged in. Terms are in
[../GLOSSARY.md](../GLOSSARY.md) section 5. This note records the decisions
and why, and what the view does not try to be.

## What it is

One Studio panel, the centre of the workspace, drawing every placed Element as
a flat shape on a dark canvas, filled with the Element's resolved `color`
multiplied by its resolved `dimmer`. An Element without a `color` Parameter
(a white strobe section, a tungsten par) draws white times `dimmer`; no gel
colour and no colour temperature, for now. Nothing else is drawn: strobe, pan
and tilt, zoom and gobo are not represented. The look is the grandMA3 fixture
sheet's colour swatches laid out in space, not a render.

## Positions

A Fixture has a Position: `x`, `y`, `z` in metres and a rotation about each
axis. The origin is centre stage on the floor, `x` to the right as the
audience sees it, `y` up, `z` toward the audience. The front view uses `x`,
`y` and the rotation about `z`; the rest is stored now so a plan view, other
2D views, a 3D view and the geometry Visuals in
docs/moving-heads-and-geometry.md read the same numbers later.

A new Fixture sits at the origin until dragged. Dragging is an undoable
command on the Fixture; there is no snap in v1. Elements have no Position of
their own.

Why metres and why 3D from day one: the numbers outlive the view. A gradient
by position, a sweep across the stage, and a mover aimed at a point all read
Position, and a 2D view that stored pixels would have to be migrated.

## Shapes

A Mode names a Shape Template and the Tags it binds. Templates in v1:

| Template                             | Places                                                               |
| ------------------------------------ | -------------------------------------------------------------------- |
| `single`                             | the root Element as one rectangle                                    |
| `bar(n)`                             | the n Elements with the given Tag, in a row, tree order              |
| `grid(cols, rows)`                   | the Elements with the given Tag, row-major                           |
| `strobe-backlight(sections, panels)` | the `section`-tagged Elements in a row above the `panel`-tagged ones |

Elements a template does not place are not drawn; a root whose children are
all placed draws nothing of its own. Shapes are schematic, not to scale: a
template has its own proportions and every fixture of a template draws the
same size, which keeps a wash next to a pixel bar readable without physical
dimensions. Importers pick `grid` from an Open Fixture Library pixel matrix;
a hand-written type names its template and Tags. An explicit per-Element
geometry in the Fixture Type file is the escape hatch if a rig needs it and is
deferred until one does.

Why templates rather than free geometry: a fixture author writes one word and
two Tags, an importer needs no layout algorithm, and a custom "Atomic-like"
type reuses `strobe-backlight` by naming it.

## Data flow

The Runtime already resolves every Element's Parameters at the Output rate.
The Resolved Stream sends a Studio session the values a view asked for,
coalesced to twenty updates per second, the rate web games use for state
replication. The Rig View subscribes to `color` and `dimmer` of the placed
Elements; an inspector row subscribes to what it shows. In slice 1 the stream
carries Defaults and Highlight only, which is enough to see a fixture light up
when highlighted. Nothing about the stream is saved.

## The view as an editor

Click selects the Fixture, shift-click extends, clicking inside a fixture
selects the Element under the cursor, so a Fixture Set or a Layer's Targets
can be filled from the picture. Drag moves the Fixture. Zoom and pan are per
Studio session and never saved. Hover shows the name.

## Not in v1, on purpose

Physical scale, glow, beams, strobe flicker, movement, several 2D views, plan
view, 3D, MVR import of positions, per-Element free geometry, grid snap.
