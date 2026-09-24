# Geometry Visuals

How a Visual comes to know where its Targets hang, so a wipe crosses the
stage, a rainbow spans it by position, a radar turns about a point and a
ripple spreads from one. Settled in the geometry grill of 2026-09-25. Terms
in [../GLOSSARY.md](../GLOSSARY.md); the road here is step 2 of
[moving-heads-and-geometry.md](moving-heads-and-geometry.md).

## 1. Position enters through a Frame, not as metres

A Visual is written against kinds, and the order-based ones (Chase, Rainbow,
Sweep's follow) stay that way forever: they see a Target as key, index and
count. A **Geometry Visual** is a second family that also sees where each
Target is. It does not see stage metres. Its Layer carries a **Frame**: a
rectangle in stage space, a centre, a width, a height and a rotation, and
the Runtime hands the Visual every Target's point in the Frame's own space,
metres from the Frame's centre, `x` along its width and `y` along its
height, with the Frame's size. The Visual's Parameters are fractions of the
Frame ("a band 25 % wide"), so they read the same on a measured rig and on
the schematic one a fresh Installation draws.

Three things follow.

**The Frame is set once, like anchors.** It is stored on the Visual Layer,
next to the Slot Bindings, and edited by one undoable command from the Rig
View gizmo, the inspector's fields and `refrata layers frame` alike. It is
not an Address: a Macro moves a Radar's speed and wedge, never its centre.
A new Layer of a Geometry Visual starts with its Frame fitted around what
its Targets draw, so it is useful before anyone drags; "Fit to Targets"
does that again, since a Frame does not follow Targets that join later.
Changing the Visual keeps the Frame while the new Visual is a Geometry
Visual and drops it otherwise.

**The Frame is a coordinate system, not a mask.** A Target outside the
Frame reaches the Visual with a point past its edges, and each Visual says
what it does there: Wipe and Radar release it (it is outside the band or
the wedge as anything else is), Spectrum holds its edge colour, Ripple
keeps measuring distance. A Frame drawn a little tighter than the rig
therefore does not black out the outer fixtures.

**Rotation is the Frame's.** No Geometry Visual has an angle Parameter; a
diagonal wipe is a turned Frame, and Radar and Ripple turn with it for
free. Wipe only says which way it runs.

## 2. Where a Target is

A Target's point is the centre of what it draws in the Rig View: a root
Element is the centre of the whole fixture (the middle of its drawn
shapes), a spread bar gives one point per pixel from the Shape Template's
offsets rotated with the Fixture, an unspread Set is the centroid of its
members, and an Element its template does not place takes its Fixture's
Position. So adding a bar's root to a Spectrum colours the bar as one, and
spreading it colours each pixel. Depth (`z`) is stored on the Fixture and
ignored here: v1 is the front plane the Rig View draws.

## 3. Seeing it: pose and figure

A Visual runs in the Runtime only, so the Rig View cannot ask an instance
where its band is. Instead each Geometry Visual's instance reports a small
serializable **pose** every frame (Wipe's band centre, Radar's heading,
Ripple's ring radii) and its definition carries a pure `figure(params,
pose, size)` that returns a few SVG paths in Frame space, each filled or
stroked at an alpha, in a colour or in the selection colour. The Runtime
streams the pose of the Layers a session asks for (`poses` in the live
protocol, coalesced to the stream rate like the Resolved Stream); the Rig
View asks for the selected Layers' and draws each Frame with its figure
under the Frame's transform, clipped to the Frame, above the fixtures at
low alpha, with the Frame's outline, a handle on each edge and corner and
one to rotate. Dragging the outline moves the Frame; the fixtures inside
stay clickable. When the Layer's Scene is not playing there is no instance,
the pose is null and only the Frame is drawn.

## 4. The first four

All distribute across Targets, so the one-Target warning applies.

| Visual   | Family   | Slots (default binding)               | Parameters                                             | Cues   | Pose        |
| -------- | -------- | ------------------------------------- | ------------------------------------------------------ | ------ | ----------- |
| Wipe     | envelope | `color` (`color`), `level` (`dimmer`) | color, level, rate, width, softness, run               | `sync` | band centre |
| Radar    | envelope | `color` (`color`), `level` (`dimmer`) | color, level, rate, angle, softness, direction         | `sync` | heading     |
| Spectrum | value    | `color` (`color`)                     | rate, hue spread, saturation                           | `sync` | phase       |
| Ripple   | envelope | `color` (`color`), `level` (`dimmer`) | color, level, rate, travel, width, softness, direction | `fire` | ring radii  |

Wipe is named for the film cut, since Sweep is the pan movement. Its band
enters from outside the Frame on Forward and Backward and turns at the edges
on Bounce. Radar starts pointing up and turns clockwise as the audience sees
it. Spectrum is Rainbow by position; Rainbow stays the order-based one.
Ripple launches a ring per Fire, or at its rate, and each ring takes Travel
seconds from the centre to the Frame's corners, or the other way on Inward.

## 5. What was left out, on purpose

A plan view and depth, MVR import of positions, per-Element real geometry
(the Shape Templates stay schematic), a Frame as an Address, and touching
the order-based Visuals. A grid on a Fixture Set is no longer needed for
spatial effects; the Frame and the Rig View's positions do that job.
