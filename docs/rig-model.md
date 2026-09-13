# The Rig model: how the setup layer holds together

This note is the reasoning behind the setup-layer terms in
[../GLOSSARY.md](../GLOSSARY.md). It explains how grandMA3 and QLC+ think about
the same problems, what each gets right, which way this project goes and why,
and then walks four real rigs through the model to check that it holds. It ends
with the decisions that are still open.

Facts about the other systems come from the grandMA3 2.4 manual, the QLC+ 4/5
documentation, the GDTF specification and the Open Fixture Library (OFL) format
docs, checked on 2026-09-13.

## 1. Three ways of thinking

### QLC+: the channel is the unit

In QLC+ a fixture definition is a list of channels. Each channel carries its
own semantic: a _channel group_ (Intensity, Colour, Pan, Gobo, ...), a _preset_
that names the exact role (`IntensityRed`, `PositionPanFine`, `ColorMacro`),
and _capabilities_, which are byte ranges with names ("40-49: Gobo 3"). A mode
is an ordered subset of those channels. A _head_ is a set of channels that
belong to one light source; a channel is in at most one head, and channels
that are not in any head (master dimmer, strobe) are "common".

Programming works on channel values. A scene stores, per fixture, a value from
0 to 255 for each enabled channel. The colour tool and the position tool know
which channels are red, green, blue, pan and tilt through the presets, so they
feel semantic, but what they write are bytes. A 16-bit pan is two channels the
tool happens to write together.

What is good about it: nothing is hidden. The definition format is small and
thousands of fixtures exist. What is bad: nothing generalizes. A "red at 50 %"
scene is meaningless on a CMY fixture, a "pan 45°" scene is meaningless on
another mover, and every feature that wants to be semantic (palettes, EFX, RGB
Matrix) reimplements the mapping from meaning to channels.

### grandMA3 and GDTF: the attribute is the unit

grandMA3 programs _attributes_: `Dimmer`, `Pan`, `ColorRGB_R`, `Gobo1`, drawn
from one global vocabulary organized in _features_ and _feature groups_. The
fixture type, built on GDTF, describes how attributes become bytes: a _DMX
channel_ has one or more _logical channels_ (one per attribute it can carry),
each with _channel functions_ (byte ranges that map to a physical range, say
0.29 Hz to 16.7 Hz) and _channel sets_ (named points, such as gobo names). A
channel can have no DMX offset at all: it is then _virtual_, and a _relation_
of type Multiply lets a virtual `Dimmer` scale the real colour channels. A
_mode master_ makes one channel's meaning depend on another's value.

The physical structure is a _geometry_ tree. A geometry with its own channels
becomes a _sub-fixture_, addressed `5.1`, `5.1.2`. Selecting fixture 5 selects
one fixture; a value set on it for an attribute only the children have goes to
the children, and the parent shows a summary of the children's values.

What is good about it: presets and effects are portable, colour is handled in
a device-independent way, resolution is an encoding detail, and multi-part
devices are a tree. What is bad: the fixture type format is large and
intimidating, the words are overloaded (grandMA3's "parameter" is a counted
unit, not a control), and a person needs weeks to get productive.

### The Open Fixture Library: a library format, not a console

OFL is not a controller; it is an open, JSON-based fixture library with
importers and exporters for QLC+, GDTF and others. Its channels carry
_capabilities_ with typed physical entities (an `Intensity`, a
`ColorIntensity` with a colour, a `Pan` with an angle range, a `ShutterStrobe`
with a speed range, `WheelSlot`, `Effect`...). Multi-part fixtures are a
_matrix_: a 3D array of _pixel keys_, _template channels_ that are stamped out
per pixel with `$pixelKey`, and _pixel groups_ defined by name lists or by rule
(`{"x": ["odd"]}`, `{"y": ["<=4"]}`). Modes insert the matrix channels
`perPixel` or `perChannel`. _Switching channels_ cover the "channel 5 means
something else when channel 4 is in this range" case, and _fine channel
aliases_ cover 16 and 24-bit values.

Why it matters: it is the largest open library, it already carries physical
units and matrix structure, and it is the natural bundled source for this
project.

### This project: the parameter is the unit, the channel is an encoding detail

The choice is the grandMA3 shape with fewer words. Programming, live control,
OSC, presets and effects only ever see Parameters on Elements. A Mode owns the
one table that turns Parameter Values into bytes, called the Encoding, and that
table is filled by importers. QLC+'s honesty is kept for the person authoring a
fixture type, who works channel by channel; grandMA3's portability is kept for
the person programming, who never does.

## 2. Term by term

### Universe and Output

grandMA3 numbers local universes and maps them to protocol universes in a
setup table; QLC+ numbers them and hangs one input line and one output line off
each. Both are the same model: the universe is internal, the protocol address
is a property of the route out.

Here a Universe is named and id-keyed, like every Difracta entity, and an Output
is the route: kind plus kind settings, carrying exactly one Universe. There is
no entity for the box. Reasons:

- Both references already model per-universe routes, not devices.
- sACN has no device at all (multicast), so a device entity would be empty for
  the most common protocol.
- A four-port node is four IP-and-universe routes to the same IP; the Runtime
  can share the socket without the user modelling it.
- USB widgets with two ports are rare; two Outputs naming the same device with
  a port index cover them.

A device entity can be added later if many-port USB boxes turn out common; it
would sit under Outputs, not replace them.

Output settings go in the Installation file. An Art-Net destination is a fact about the
rig's LAN, and both references save it with the show. Serial device paths are
machine-specific and will bite when a file moves; the mitigation is that
Output Status says "device missing" loudly rather than pretending.

### Fixture Type and Mode

Same split in both references and in OFL and GDTF; keep it. The one decision is
what a Mode contains. Here it contains everything control needs: the Channel
Layout, the Element tree, the Parameters, the Encoding. A Fixture Type holds
only what is true of the device regardless of mode.

Copy the Fixture Type into the Installation when a Fixture uses it. grandMA3 does this;
QLC+ references the installed library by manufacturer and model, and a
workspace opened on another machine with an older library shows missing
fixtures. Self-contained files are worth the duplication.

### Element (and why not Physical/Logical Fixture)

The proposal in the brief was a _Physical Fixture_ (patched device) and
_Logical Fixtures_ (its controllable parts), with a worry that panels and
strobe sections feel like different kinds of parts.

What both references teach is that the unit you select and program must be one
kind of thing, whatever its depth. QLC+ has a flat list of heads and common
channels outside them, which cannot say "the eight panels belong together but
the four strobe sections are something else": all twelve are just heads.
grandMA3 has a tree, and the tree says it for free: `Backlight` is a node with
eight children, `Strobe` is a node with four.

So the model is a tree of Elements, any depth, declared by the Mode, and the
Fixture is the root Element. The worry in the brief dissolves into the tree:
the "concept" that groups the panels is their parent Element, and the strobe
section that feels like a separate fixture is a sibling subtree. Two rules make
the tree cheap to use, and both are grandMA3's:

- fan-down: setting a Parameter on an Element that lacks it but whose
  descendants have it sets every descendant that has it;
- summary: an Element without a Parameter its descendants share displays
  their values (min to max), so a parent row is never blank.

Why one entity kind rather than Fixture plus Element as two tables: everything
downstream (Selection, Fixture Sets, cues, Addresses) points at "the thing with
Parameters", and a root that is not also that thing forces a special case in
each of them. The root just carries extra fields: type, mode, patch.

Why the word Element: "head" collides with the moving head; "cell" (Eos,
Avolites) reads wrong for an intermediate node like `Backlight`; "sub-fixture"
(grandMA3) cannot name the root; "part" is fine in prose but vague in code;
"pixel" is one kind of Element, not all of them. ChamSys uses "element" for
exactly this and it reads well at every depth: the Aura element, the Panel 3
element, the root element.

Elements are instantiated per Fixture as entities with ids. That costs table
rows (an 8×4 wash rig with single-element fixtures costs nothing; a 32-pixel
bar costs 33 rows) and buys stable references from Sets and cues, the
Difracta way. Changing a Fixture's Mode rebuilds the tree by key so
`pixel-3` keeps its id across `16ch` and `Pixel 68ch` if both declare it.

### Attribute and Parameter

Two words where the brief had one, and each earns its place:

- Attribute is the vocabulary entry, so that "dimmer of everything selected"
  means one thing across brands. grandMA3 has it (attribute), QLC+ only has the
  channel preset, and the absence is exactly why QLC+ scenes do not travel.
  grandMA3's feature groups and QLC+'s channel groups (Intensity, Color,
  Position...) are only a grouping of the vocabulary; here that is a field on
  the Attribute, not a concept.
- Parameter is the Element's own version: this device's range, options,
  default, highlight, Channels. It is the same word Difracta uses for a
  Visual's declared value, and it plays the same role, so the Studio's four
  Controls carry over unchanged. See docs/visuals-and-links.md for the two
  homes of the word.

The kinds are Difracta's four: number, color, choice, boolean. Two things that
tempt a fifth kind were rejected:

- position as an XY kind: pan and tilt are two numbers; the XY pad is a Control
  concern, and grandMA3 also keeps them as two attributes paired by an
  activation group;
- emitter colours as a kind: `color` is one device-independent RGB, and
  the Encoding decides the emitter split (white extraction, CMY inversion,
  amber and UV heuristics). Raw emitter Parameters are deferred, see the open
  decisions.

Units are physical when the library knows them. OFL capabilities carry angles,
hertz, milliseconds and kelvin; GDTF channel functions carry physical from and
to. A "strobe 10 Hz" or "pan 45°" preset then works on any fixture that has
the Attribute. Intensity is always 0 to 1. When a definition has no physical
data the range falls back to 0 to 1 and the Parameter says so.

### Encoding

The name for the one place bytes are computed. The brief listed 1:1, 1:many and
1:0; the references add two shapes the model must also carry:

- many:1, where several Parameters share one byte. Shutter and strobe on one
  channel is the everyday case. GDTF handles it with several logical channels
  on one DMX channel; QLC+ handles it by not having a shutter concept at all,
  the channel is the shutter. Here the rule for the Channel names the
  precedence: strobe above zero wins over an open shutter, a closed shutter
  wins over both.
- conditional, where a byte's meaning depends on another Parameter: gobo
  angle versus gobo rotation speed selected by a gobo mode. GDTF calls the
  selector a mode master, OFL a switching channel.

Encoding is authored from primitives (scale, split bytes, colour split, multiply
by, range for choice, precedence list, condition) and normally produced by an
importer. It is the setup-only edge of the model: no Studio surface outside a
future Fixture Type Editor shows it.

### Fixture Set and the "mode-provided sets" question

The brief wants stored, orderable selections that can cross Fixtures (`Wash
Left`) or stay inside one (`Full Atomic`), and asks whether a Mode should ship
Sets of its own ("all RGB panels") and whether that should be the same concept
as the user-made ones.

grandMA3 groups and QLC+ fixture groups are both user-made, ordered, and can
hold sub-fixtures or heads. OFL pixel groups are the library-side idea: named
subsets of a fixture's pixels by list or by rule.

The position taken:

- Fixture Set is the one stored concept, user-made, an ordered list of
  Elements. Its name avoids Group (reserved for navigator folders) and
  Selection (the transient thing).
- The everyday "all RGB panels" need is already covered by the tree: select
  the `Backlight` Element. No Set is needed for it, and the brief's own
  intuition that the panels "belong together" is what the tree encodes.
- What the tree cannot express is overlapping partitions: odd panels, left
  half, bottom row. These are rarely wanted for one fixture; they are wanted
  for "the bottom panels of every Atomic on the truss". So instead of Sets
  per Fixture, a Mode declares **Tags** on its Elements (`odd`, `bottom`,
  `row-1`, and every Element key such as `aura`), imported from OFL pixel
  groups and GDTF geometry names, people add Tags to Fixtures in the Rig
  (`truss-left`), Tags inherit down the tree, and a Fixture Set can be written
  **by rule**: all Elements carrying all of the given Tags, resolved live.
  Tags compose across fixtures; per-fixture derived Sets would not.

Tags and Sets by rule are in v1: they are what makes the library's own
groupings reach a whole rig without clicking.

### Installation, Rig, Patch, Selection

Installation is Difracta's word for the document and is kept so the two
projects share a shell and a codebase shape. "Show" is the industry word for
the file (grandMA3 show file; Hog and Eos too), but QLC+ uses it for a
timeline, and consistency with Difracta won. Rig names the physical half so
"setup phase" has a noun; it is a layer, not an entity. Patch is universe plus start address, may be empty, may not
overlap. Selection is the transient list of Elements; Fixture Set is its saved
form.

## 3. Worked examples

### A 3-channel RGB par

Fixture Type `Generic / RGB Par`, Mode `3ch`: Channels red, green, blue. One
root Element with two Parameters:

| Parameter | Kind   | Channels         | Encoding                          |
| --------- | ------ | ---------------- | --------------------------------- |
| `color`   | color  | red, green, blue | colour split, no white extraction |
| `dimmer`  | number | none             | multiplies the three colour bytes |

The importer adds `dimmer` whenever a Mode has colour emitters and no
intensity channel. That is GDTF's virtual channel plus Multiply relation and
grandMA3's "virtual dimmer", expressed without a channel that does not exist.
A Fixture Set of eight of these next to eight RGBW pars behaves identically
under "dimmer 50 %, color amber", which is the whole point.

### Martin Atomic 3000 LED, `14ch Extended` (real chart)

The real fixture's Beam (228 white LEDs) and Aura (64 RGB LEDs) are each one
zone; the zoned version from the brief is treated in the next example. The
14-channel chart, from the manual, is:

| Ch  | Function                                                                   |
| --- | -------------------------------------------------------------------------- |
| 1   | Beam flash intensity (0 blackout, 1-255)                                   |
| 2   | Beam flash duration 7-650 ms                                               |
| 3   | Beam flash rate (0-5 none, 6-255 = 0.289-16.67 Hz)                         |
| 4   | Beam effect (none, ramp up, ramp down, up+down, random, ...)               |
| 5   | Control (10-14 reset, 23-26 dimming curves, 54-58 fan modes)               |
| 6   | FX select                                                                  |
| 7   | FX speed                                                                   |
| 8   | unused                                                                     |
| 9   | Aura shutter (0-19 closed, 20-49 open, 50-200 flash, 211-255 random flash) |
| 10  | Aura dimmer                                                                |
| 11  | Aura red                                                                   |
| 12  | Aura green                                                                 |
| 13  | Aura blue                                                                  |
| 14  | Aura colour preset (0-10 = RGB mixing on, 11+ = gel presets, effects)      |

Element tree and Parameters:

```text
Atomic (root)          control: choice  → ch 5 (default "no function")
                       fx: choice       → ch 6
                       fx-speed: number → ch 7
├── Beam               dimmer: number 0..1        → ch 1
│                      strobe: number Hz          → ch 3 (0 → byte 0, else 6..255)
│                      strobe-duration: number ms → ch 2
│                      strobe-effect: choice      → ch 4
└── Aura               shutter: choice {closed, open, random}  ┐
                       strobe: number Hz                        ┴→ ch 9 (precedence rule)
                       dimmer: number 0..1        → ch 10
                       color: color               → ch 11, 12, 13
                       color-preset: choice       → ch 14 (default "rgb mixing")
```

What the example exercises:

- a root with device-wide Parameters and two child Elements with the same
  Attribute (`dimmer`, `strobe`) meaning different hardware;
- fan-down: "dimmer 100 %" on the root sets Beam and Aura dimmers; "strobe
  10 Hz" on the root sets both strobes; "color red" on the root reaches only
  the Aura, because only it has `color`;
- many:1 with precedence on channel 9;
- a `control` choice with a dangerous byte range (reset) behind a safe default;
- a fixture-side override: when `color-preset` is not "rgb mixing", the
  fixture ignores its RGB channels. The model represents both Parameters
  honestly and the Parameter's notes say so; nothing in the Encoding can or
  should hide it.

Whether Beam is the root itself or a child is the library author's call. With
FX macros driving both arrays, a neutral root reads best.

### A zoned strobe (hypothetical, as in the brief)

Take the brief's device: eight RGB backlight panels and four strobe sections,
individually controllable, plus whole-device controls. Real fixtures of this
shape exist (pixel-mappable strobes such as GLP's JDC1 have segmented white
tubes and RGB pixel rows).

```text
Zoned Strobe (root)    control, fx, fx-speed
├── Strobe             strobe: Hz, strobe-duration: ms, strobe-effect  (section-wide)
│   ├── Section 1      dimmer
│   ├── Section 2      dimmer
│   ├── Section 3      dimmer
│   └── Section 4      dimmer
└── Backlight          dimmer (master, real channel)
    ├── Panel 1        color
    ├── ...
    └── Panel 8        color
```

- "All RGB panels" is the `Backlight` Element: colour set there fans to eight
  panels. No Set is needed.
- "All strobe sections" is the `Strobe` Element.
- `Full Strobe` as a Fixture Set with the twelve leaves is possible but
  redundant; the root already implies its subtree.
- `Backlight Odd Panels` across twenty of these is a Fixture Set by rule:
  Tags `odd` plus the Fixture Type's key, forty Elements without a click.
- Backlight's own `dimmer` is a real channel here, so it is not a virtual
  dimmer; it lives on the intermediate Element and fan-down does not touch it
  when a Panel's `color` is set.

### A moving head with 16-bit pan and a gobo wheel

Mode `16ch`: pan (two bytes), tilt (two bytes), dimmer, shutter/strobe,
colour wheel, gobo wheel, gobo rotation, focus, zoom, prism, control. One root
Element.

| Parameter        | Kind   | Channels       | Encoding                                       |
| ---------------- | ------ | -------------- | ---------------------------------------------- |
| `pan`            | number | pan (2 bytes)  | -270°..270° across 16 bits                     |
| `tilt`           | number | tilt (2 bytes) | -135°..135° across 16 bits                     |
| `dimmer`         | number | dimmer         | scale                                          |
| `shutter`        | choice | shutter        | closed 0, open 32, pulse ranges                |
| `strobe`         | number | shutter        | Hz mapped into 64-95; above zero beats shutter |
| `color-wheel1`   | choice | colour         | slot ranges, with swatches                     |
| `gobo1`          | choice | gobo           | slot ranges, with images                       |
| `gobo1-mode`     | choice | rotation       | index / rotate                                 |
| `gobo1-angle`    | number | rotation       | degrees, when mode is index                    |
| `gobo1-rotation` | number | rotation       | rpm, when mode is rotate                       |
| `focus`, `zoom`  | number | one each       | 0..1                                           |
| `control`        | choice | control        | safe default                                   |

A "pan 45°" preset from another brand's mover lands correctly because
Encoding, not the preset, knows the byte range. The gobo trio is the
conditional case: one byte, three Parameters, one selector.

### An 8×4 grid of washes

Thirty-two Fixtures of one type, single-element each, patched across two
Universes. The Sets the brief lists (`Wash Left`, `Wash Right`, `Checker A`,
`Checker B`, `Front`, `Back`) are six Fixture Sets, each an ordered list of
root Elements. Nothing in the Rig knows the grid; a Set's order is enough for
effects that spread along a list. A stored grid on a Set is deferred and would
be the place to put it, the way QLC+'s fixture group and grandMA3's selection
grid do.

## 4. Open decisions

Each has a recommendation; the choice changes what gets written next.

1. **One entity for Fixture and Element, or two tables.** Recommended: one
   `elements` table where roots carry type, mode and patch, exactly as
   Difracta's `layers` table holds Visual Layers, Filter Layers and Groups. A
   `fixtures` view is a filter on `parentId == null`.
2. **Physical units versus normalized 0..1 everywhere.** Recommended: physical
   when known, 0..1 otherwise, always 0..1 for intensity. The cost is
   unit-aware Controls; the gain is presets and effects that travel.
3. **Raw emitter Parameters** (`red`, `white`, `amber`) beside `color`.
   Recommended: not in v1. `color` is the single truth and white extraction is
   an Encoding setting on the Mode. Revisit if programmers ask for "white
   only" looks that a colour cannot express.
4. **Tags versus per-Fixture derived Sets** for library-provided subsets.
   Decided: Tags plus Sets by rule, in v1.
5. **Overlapping Patch.** Recommended: refused, with Multipatch as a later
   explicit feature rather than a permitted overlap.
6. **Where machine-specific Output settings live.** Recommended: in the Installation,
   like both references, with Output Status making a missing device obvious.
7. **The name of the project's file and document.** Decided: Installation,
   Difracta's word, over Show, Production, Project or Rig.
