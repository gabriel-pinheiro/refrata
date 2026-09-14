# Glossary (draft)

Canonical vocabulary for the project. Terms describe intended scope; nothing
here is implemented. Prefer these terms in docs, code and conversation, and do
not introduce near-synonyms.

The base is [Difracta](../difracta/docs/GLOSSARY.md): one Runtime holds one
document, a web Studio edits it through commands, everything controllable is an
Address, and performance input arrives over OSC/OSCQuery from a hub such as
Chataigne. Terms Difracta already defines with the same meaning (Runtime, Studio,
Command, Address, Revision, Inspector, Navigator, Group, Controller, Macro,
Autosave) are not repeated; only the terms that differ or are new are here.

Five sections, read bottom-up: the wire, the fixture library, the Rig,
composition, and the Rig View. Rig-side terms end with an **Elsewhere** line saying what grandMA3
and QLC+ call the same idea, so the two reference glossaries can be read against
this one; composition terms have no console counterpart and say so in
[docs/comparison-walkthrough.md](docs/comparison-walkthrough.md). Terms marked
_deferred_ or _not in the first build_ are designed but not planned for the
first version. The reasoning behind each choice is in `docs/`, indexed in
[README.md](README.md).

## 1. Wire

### DMX

The protocol that carries numeric levels to equipment: 512 slots of one byte
each per line, refreshed continuously. Nothing above the wire layer speaks in
DMX values.

**Elsewhere:** the same in both.

### DMX Address

One slot of a Universe, numbered 1 to 512. A multi-byte Channel occupies
consecutive DMX Addresses.

Do not call a DMX Address a Channel: a Channel is a slot in a Mode's layout, a
DMX Address is where it lands in a Universe once patched.

**Elsewhere:** grandMA3 "DMX address", QLC+ "DMX address"; both also say "DMX
channel" for the slot itself.

### Universe

A named bank of 512 DMX Addresses that Fixtures are patched into, such as
`Truss Front` or `Floor`. A Universe is an Installation entity with a stable id and a
unique name; the wire number a protocol needs lives on its Outputs, not on the
Universe. A Universe with no Output is still programmable and visible in
previews; it is just silent.

**Elsewhere:** both number Universes. grandMA3 maps "local universe N" to
protocol universes in its DMX Protocols setup; QLC+ gives each numbered Universe
one input line, one output line and one feedback line.

### DMX Frame

The 512 values a Universe holds at one instant, produced by the Runtime from
Parameter Values through each Fixture's Encoding. Outputs send DMX Frames; the
Studio previews them. A DMX Frame is Runtime state, never saved.

The Runtime produces a DMX Frame for every Universe at `output.rateHz` (40 in
settings) whenever the Installation has a Universe, Outputs or not, so a rig
can be checked with nothing plugged in. Every frame goes to every Output of
its Universe; nothing is sent only on change.

The CLI prints a Universe's current DMX Frame as a **frame dump**: the 512
bytes in order, with runs of equal bytes grouped, such as
`<2x 0> 127 127 12 <507x 0>`.

**Elsewhere:** implicit in both ("DMX output").

### Output

One delivery of one Universe to the world: a kind (Art-Net, sACN, Enttec DMX
USB Pro, Open DMX, OLA, and later others) and the kind's settings, such as a
destination IP with net, subnet and universe numbers, an sACN universe and
priority, or a serial widget and port index. An Output carries exactly one
Universe; a Universe may have several Outputs (a network node and a USB backup
at once) or none. The Runtime opens one socket or device per distinct target
and shares it between the Outputs that use it.

The first build ships one kind only: an Enttec-compatible USB widget over a
serial port, named `enttec-open-dmx` or `enttec-usb-pro` once the widget in
hand is identified. Art-Net and sACN are designed and deferred. A serial Output
names its widget by FTDI serial number, or `any` for the first widget found;
Output Status reports the device path actually opened.

Output settings belong to the Installation, because they describe the rig's network.
Whether an Output is actually delivering is live state (Output Status), not
part of the file.

Do not model the box. A four-port Art-Net node is four Outputs pointing at the
same IP, and a two-port USB widget is two Outputs naming the same device with
different port indexes.

**Elsewhere:** QLC+ "output line" of an "input/output plugin"; grandMA3 a row in
the DMX Protocols configuration plus the console's own "DMX ports".

### Output Status

Live state per Output: delivering, device missing, no route to host, and the
frames per second actually sent. Reported by the Runtime to Studio the way
Difracta reports Output Telemetry. Never saved.

## 2. Library

### Fixture Library

The set of Fixture Types the Runtime knows: a bundled snapshot of the Open
Fixture Library, types imported from GDTF, OFL JSON or QLC+ `.qxf` files, and
types authored by hand. Studio picks from it when adding a Fixture; the CLI lists
and describes it. It is the Difracta Catalog's counterpart.

A Fixture Type used by an Installation is copied into the Installation, so a file opens the same
on another machine and a later library update never silently changes a rig.
The copy is dropped when the last Fixture using it goes. Fixture Types have no
navigator section; the Add Fixture picker lists the library. Types are JSON
files, validated with Zod, carrying a `formatVersion` from day one, loaded from
a `refrata-library/` folder at startup.

**Elsewhere:** grandMA3 "fixture library" with types imported into the show;
QLC+ installed definitions referenced by manufacturer and model.

### Fixture Type

A reusable description of one device model: manufacturer, model, physical facts
(weight, lumens, beam angle, later a visualizer shape) and one or more Modes.
A Fixture Type controls nothing by itself; a Mode does.

**Elsewhere:** grandMA3 "fixture type", QLC+ "fixture definition".

### Mode

One DMX personality of a Fixture Type, such as `3ch`, `14ch Extended` or
`Pixel 68ch`. A Mode declares four things: its Channel Layout, its Element tree,
the Parameters each Element exposes, and the Encoding that turns Parameter
Values into Channel bytes. After a Fixture is patched, the Mode is the only place
where Channels exist.

**Elsewhere:** grandMA3 "DMX mode", QLC+ "mode" or "personality".

### Channel Layout

The ordered list of Channels a Mode occupies, in wire order. Its length in DMX
Addresses is the Mode's Footprint.

**Elsewhere:** the channel list of a QLC+ mode; the DMX Channels of a GDTF DMX
mode.

### Channel

One slot of a Channel Layout: a name for humans, a width of one, two or three
bytes, the Element it belongs to, and a safe default byte value. A Channel is
written only by Encoding. It has no semantic of its own: the semantic lives in
the Parameters that feed it.

A two-byte Channel is one Channel, never a "coarse" and a "fine" Channel.

**Elsewhere:** QLC+ "channel" (with a channel group, a preset and capabilities:
the semantic is on the channel there). grandMA3 and GDTF "DMX channel" with
coarse and fine bytes and, inside it, logical channels and channel functions.

### Footprint

The number of DMX Addresses a Mode occupies. A Fixture patched at address `a`
occupies `a` through `a + Footprint - 1` in its Universe.

**Elsewhere:** the same word in the Open Fixture Library and several consoles;
grandMA3 shows it as the mode's channel count.

### Element

One controllable part of a device: a node in the tree a Mode declares. Every
Element has a key unique within its Mode (`aura`, `pixel-3`), a name, an ordered
list of child Elements and a set of Parameters. The root Element stands for the
whole device and holds device-wide Parameters such as a master dimmer or a
control channel. A device with one beam and no parts is a single root Element.

Elements form a tree of any depth, so a strobe can be `Strobe → Section 1..8`
next to `Backlight → Panel 1..8`, and a moving head with a pixel ring can be
`Beam` next to `Ring → LED 1..12`. Intermediate Elements are the way a Mode says
"these parts belong together"; they may have Parameters of their own or none.

Setting a Parameter on an Element that does not have it, but whose descendants
do, sets it on every descendant that has it. An Element that lacks a Parameter
its descendants share shows their values as a summary. This is what makes
"color the whole Backlight" and "color Panel 3" the same gesture. The summary
is designed here and shown from slice 2; in slice 1 an intermediate Element's
inspector lists only its own Parameters.

Elements are not Installation entities. They are derived from the Mode of the
Fixture's copied-in Fixture Type and referenced everywhere as
`<fixtureId>/<key>`, so a Fixture Set or a Look Layer row can point at
`Panel 3 of Atomic 2` without a row for it. A key is unique within its Mode,
so the reference is as stable as an id: changing a Fixture's Mode keeps every
reference whose key survives and drops the rest. Nothing a person owns lives on
an Element; Tags are added to Fixtures.

Do not call an Element a Fixture, a Head, a Cell or a Sub-fixture; do not call a
non-root Element a Pixel unless it is one.

**Elsewhere:** QLC+ "head": a flat list, one per light source, a channel belongs
to at most one head and common channels stay outside every head. grandMA3
"sub-fixture" or "child fixture": a tree from the GDTF geometry, addressed
`5.1`, `5.1.2`; selecting the parent selects one fixture, and a value set there
for an attribute only the children have goes to the children. The Open Fixture
Library "pixel" of a "matrix".

### Attribute

One entry of the project's fixed vocabulary of controllable things: a key, a
Parameter kind, a unit and a default. Examples: `dimmer` (number, percent),
`color` (color), `pan` and `tilt` (number, degrees), `strobe` (number, hertz),
`shutter` (choice), `gobo1` (choice), `gobo1-rotation` (number, rpm), `zoom`,
`focus`, `iris`, `color-temperature` (number, kelvin), `control` (choice). A
repeated thing gets an ordinal in its key (`gobo1`, `gobo2`). Each Attribute
also carries a family tag (Intensity, Color, Position, Beam, Gobo, Control)
used only to group rows in Studio; it is a field, not a concept.

There is one `color` Attribute for every fixture, mixing or not. A colour wheel
fixture has a `color` Parameter with a discrete gamut (see Parameter); there is
no separate wheel Attribute to program.

Attributes exist so that programming can say "the dimmer of everything
selected" and mean the same across brands. A Fixture Type may declare a custom
Attribute for something the vocabulary lacks; it is namespaced to that type and
never matches another type's.

Do not use Attribute for a value; a value belongs to a Parameter.

**Elsewhere:** grandMA3 "attribute" (a global list, grouped in features and
feature groups; note that grandMA3's own word "parameter" means something else,
a counted unit of output). QLC+ has no attribute; the nearest thing is a
channel's "preset" such as `IntensityRed` or `PositionPan`. GDTF "attribute",
OFL "capability type".

### Parameter

An Element's concrete version of one Attribute in one Mode: the Attribute's kind
and unit, plus this device's range, step, options, default and highlight value,
and the Channels its Encoding writes. `Aura` in the Atomic's 14ch Mode has a
`color` Parameter feeding three Channels and a `dimmer` Parameter feeding one;
`Panel 3` of the rig's zoned strobe has its own `color` Parameter.

A Parameter has one of four kinds, the same four Difracta uses: number, color,
choice or boolean. Numbers carry a unit and a range in physical terms when the
library knows them (degrees, hertz, milliseconds, kelvin) and 0 to 1 otherwise;
intensity is always 0 to 1. A color is device-independent, one RGB color, and
never a set of emitter levels. A choice lists options with a key, a label and
optionally a swatch or image, such as gobo slots or control functions.

A color Parameter declares a gamut: continuous for mixing fixtures, or discrete
for a colour wheel, a list of swatches with the wheel's real colours (and
half-positions when the wheel allows them). A continuous colour landing on a
discrete gamut snaps to the nearest swatch, the way the APC mini module's
hardware palette snaps to the pad's native colours, and Studio shows both the
colour asked for and the swatch chosen. Brightness stays with `dimmer`; a
colour never drives intensity.

A Parameter may feed zero, one or many Channels, and a Channel may be fed by
several Parameters; see Encoding.

A Parameter whose hardware travels (a wheel, a pan motor) may declare a
**settle time**: how long the device needs to physically reach a new value,
as a base plus a per-step or per-degree term. GDTF carries it as RealFade
and RealAcceleration; when the library lacks it, the Fixture Type carries a
guess a person can correct. It is what a Settle Filter reads.

The word has two homes, the same two as in Difracta. An **Element Parameter**
is a fixture control: many Layers contribute to it and Resolve composites them.
A **Visual Parameter** is a Layer setting declared by a Visual's Parameter
Schema, such as Shimmer's colour or rate: one source at a time, by hand or
through a Parameter Link. Both share the shape (kind, unit, range, default,
Address) so one Control edits either; say which home when the sentence is
ambiguous.

Do not confuse with grandMA3's "parameter". Do not put a Parameter's value in
the Mode: a Mode declares Parameters, an Installation holds Parameter Values.

**Elsewhere:** the closest is grandMA3 "attribute of a fixture" together with its
GDTF channel functions; QLC+ has no layer above the channel, so a QLC+ Parameter
is the channel itself.

### Parameter Value

One value for one Parameter of one Element, in the Parameter's kind and unit.
Parameter Values are what Look Layer rows store, what Contributions carry, what
Resolve produces and what Encoding reads. The resolved one is live state that
Studio and the CLI can read; it is never written directly, because the stack
is the only road to a fixture (see Controller and Parameter Link).

**Elsewhere:** grandMA3 "value" of an attribute in the programmer or a cue; QLC+
a channel value 0 to 255 in a scene.

### Default

The Parameter Value a Parameter takes when nothing sets it: the state the
fixture rests in. Defaults are declared by the Mode and are what a fresh Installation
outputs: shutter open, dimmer zero, pan and tilt centred, control "no function".

**Elsewhere:** grandMA3 default values in the fixture type; QLC+ default channel
values in the definition.

### Highlight

An optional per-Parameter value the Mode declares for making a fixture visibly
identifiable: dimmer full, color white, shutter open, gobo open. The Runtime
applies them to the real fixture, so a person sees on the truss which device
they picked; before any Layer exists it is the only way light leaves an Output.

Each Element has a boolean Address `element/<fixtureId>/<key>/highlight` in the
operational state, next to Blackout: a performance write, replicated, never
saved, never undoable. Studio holds it from mouse down to mouse up; the CLI
holds it for two seconds by default, with `--on` and `--off` for a sticky
switch. The Runtime clears any highlight after thirty seconds, in case the
client that set it vanished. Highlighting a non-root Element lights that part
alone.

**Elsewhere:** grandMA3 "highlight" values in the fixture type, applied to the
selection while the Highlight key is on; QLC+ has no equivalent beyond flashing
an intensity channel.

### Encoding

The Mode's rules that compute each Channel's bytes from the Parameter Values of
its Element and of that Element's ancestors. Encoding is the only place the
project ever converts between Parameters and DMX, and it runs one way:
Parameters to bytes.

The rules cover every shape that real fixtures have:

- one Parameter, one Channel: `dimmer` scaled to one byte;
- one Parameter, several Channels: `color` split into red, green, blue and an
  extracted white; `pan` spread over a two-byte Channel;
- a Parameter with no Channel of its own: a `dimmer` on a fixture with only RGB
  channels multiplies the color bytes (a "virtual dimmer");
- several Parameters, one Channel: `shutter` and `strobe` share one byte, and
  the rule states which wins (a strobe rate above zero beats an open shutter);
- a Channel whose meaning depends on another Parameter: `gobo1-rotation` writes
  the same byte as `gobo1-angle` and a `gobo1-mode` choice decides which rule
  applies;
- a choice mapped to byte ranges: gobo slot 3 is byte 40, a control function
  "reset" is byte 12;
- a colour on a discrete gamut: the nearest swatch's byte range, and on a CMY
  fixture the inverted components.

Importers from OFL, GDTF and `.qxf` produce Encoding rules; a person authoring a
Fixture Type composes them from a small set of primitives. Studio never shows
them to a programmer.

Two fixed rules of the first build: a `color` landing on red, green, blue and
white emitters takes the white as the smallest of the three and subtracts it
from each of them, so the hue stays exact (a setting to choose otherwise is
deferred); and the alpha of a Color value is ignored, since Encoding sees one
colour, not a blend.

**Elsewhere:** GDTF channel functions with physical from/to plus relations of
type Multiply and mode masters; QLC+ capabilities (byte ranges with names) with
tool code that knows the presets.

## 3. Rig

### Installation

The top-level document: one complete production, held one at a time by the
Runtime and saved as one `.refrata` file. An Installation owns its Rig and its
programming. The word is Difracta's, kept so the two projects share a shell;
"show" is what consoles say and is not a term here (QLC+ also uses it for a
timeline function).

**Elsewhere:** grandMA3 "show file", QLC+ "workspace".

### Rig

The physical half of an Installation: its Universes, Outputs, Fixtures with their
Elements and Tags, and Fixture Sets, plus the Fixture Types copied in. The Rig
is what the setup phase produces and what programming takes for granted. It is
a layer name, not an entity.

**Elsewhere:** grandMA3 "patch" in the broad sense; QLC+ fixtures plus
input/output configuration.

### Fixture

One device in the Rig: a name, a Fixture Type, a Mode, a Patch and the Element
tree the Mode gives it. A Fixture is the root Element of that tree, so anything
said of Elements is true of it: it is selectable, it carries the device-wide
Parameters, and setting a Parameter on it that only its parts have fans down to
the parts.

Fixtures are Installation entities with stable ids and unique names. The
`fixtures` table holds `group` and `fixture` rows sharing Difracta's tree shape,
so Fixtures are arranged in navigator Groups like every other entity; Elements
are not rows, and nothing can be dropped into a Fixture in the navigator. Two
Fixtures may share a Fixture Type and Mode; each still has its own Elements,
derived from that Mode.

Do not say "physical fixture" or "logical fixture": the device is the Fixture
and its controllable parts are its Elements.

**Elsewhere:** grandMA3 "fixture" (with a fixture id and sub-fixtures), QLC+
"fixture" (with heads).

### Patch

The assignment of a Fixture to one Universe and one start DMX Address. A Fixture
may be unpatched and still exist, be selected and be programmed; it then
contributes to no DMX Frame. Two Fixtures cannot overlap in one Universe: the
command refuses and names the colliding Fixture, and a Mode change whose
Footprint would collide is refused the same way rather than unpatching. A new
Fixture takes the next free address in its Universe, and a new Installation
starts with one Universe named `Universe 1`, so the first Fixture needs no
setup step.

A Mode's Footprint is one contiguous run in v1; fixtures whose modes span two
separate address ranges are deferred.

**Elsewhere:** grandMA3 "patch" (universe.address, may be unpatched, may also be
"multipatched"), QLC+ universe plus address on the fixture.

### Tag

A label on an Element. A Mode declares Tags on the Elements it creates (`aura`,
`beam`, `panel`, `bottom`, `odd`, `row-1`), imported from Open Fixture Library
pixel groups and GDTF geometry names; every Element's own key is a Tag, and a
Fixture's root carries its Fixture Type's key as a Tag (`atomic-3000-led`). A
person adds Tags to Fixtures in the Rig (`truss-left`, `floor`, `warm`). A Tag
on an Element is inherited by every descendant, so a Fixture tagged
`truss-left` makes its Panels match `truss-left`.

Tags are how Fixture Sets are written by rule, and how a Mode's own
groupings ("all bottom Panels") reach the whole rig without a Set per Fixture.

**Elsewhere:** the Open Fixture Library "pixel group" inside one fixture;
grandMA3 fixture "classes" and "layers" in the patch, which only organize.

### Fixture Set

A named, ordered collection of Elements, stored in the Installation for picking a
selection in one gesture and for use as a Target: `Wash Left`, `Wash Checker
A`, `All Aura Panels`, `Atomic Bottom Panels`. It is written one of two ways:

- by list: an explicit ordered list of Elements, from any Fixtures and any
  depth, so one Set may hold a whole Fixture next to one Panel of another;
- by rule: every Element carrying all of the given Tags, resolved live, ordered
  by Fixture order in the navigator then by tree order. `bottom` +
  `atomic-3000-led` is every bottom Panel of every Atomic; adding
  `truss-left` narrows it.

Order is part of the Set and is what effects spread along. A Fixture Set only
points; it stores no Parameter Values. Removing a Fixture removes it from every
Set, and a Mode change that drops an Element key drops that member with a
removal warning. An empty Set is allowed. The built-in Set `All` is the rule
with no Tags. A grid arrangement for spatial effects is deferred; see
docs/moving-heads-and-geometry.md.

Sets by list ship in slice 2; Sets by rule in slice 3. A rule Set persists its
rule, so a Fixture added later with the right Tags joins the Set on its own
and takes whatever a Look Layer says about that Set.

Do not call a Fixture Set a Group: Group is the navigator folder, as in
Difracta, and has no meaning in the Rig.

**Elsewhere:** grandMA3 "group" (a stored selection with order and selection
grid positions), QLC+ "fixture group" (fixtures or heads on a grid, used by RGB
Matrix). Neither has Sets by rule.

### Selection

The transient list of Elements a Studio session has picked, used to make a
Fixture Set, to fill a Layer's Target list, and to Highlight. Shift-click and
ctrl-click extend it in the Rig View and in the navigator's Fixture rows, and
a marquee drag on empty canvas picks everything inside. Picking a Fixture Set
selects its members; picking a Fixture selects its root Element. Two actions
read it: "New Set from selection" and "Add selection", which adds the picked
Elements as a Set's members or as a Layer's Targets. Selection is per Studio
session, never saved; a Fixture Set is its saved form. Programming itself does
not read the Selection: Layers read their Targets.

**Elsewhere:** grandMA3 "selection" (with a selection grid), QLC+ has no
persistent selection outside an editor.

## 4. Composition

Terms for authoring a show as a stack of Layers, the Difracta way. Reasoned in
[docs/layers-model.md](docs/layers-model.md), [docs/visuals-and-links.md](docs/visuals-and-links.md)
and [docs/transitions.md](docs/transitions.md).

### Target

What a Layer renders into: one Element or one Fixture Set. A Layer holds an
ordered list of Targets. To a Visual a Target is one opaque controllable thing
that accepts Contributions; the Runtime expands it to Elements and applies the
Rig's fan-down rule.

When two Targets of one Layer reach the same Element for the same Attribute,
the Element's own Target beats a value fanned down from an ancestor Target,
and among equals the later entry in the Target list wins. So a Layer with the
Fixture root and its Panel 3 as Targets says "all green, Panel 3 white".

Do not say "Fixture Target"; Target is the whole term, as in Difracta.

### Spread

A flag on one Target entry of a Layer. Off, a Fixture Set is one Target. On,
the Set is replaced at resolve time by its ordered members, one Target each, so
a Chase given `All Atomics` spread steps device by device and given `All Aura
Panels` spread steps panel by panel. A spread Element expands to its children.
Spread is one level deep; grids are deferred.

### Contribution

One value for one Parameter of one Element with an alpha from 0 to 1, produced
by a Layer for one frame. It is the lighting counterpart of Difracta's RGBA
pixel: the unit everything composes in. Every Parameter kind has an alpha, not
only colour. In Studio the alpha field of a row is labelled "Alpha"; the word
Contribution names the whole value-and-alpha, not the alpha.

### Release

A Contribution with alpha 0, or the absence of one: the Layer says nothing
about that Parameter and what is below shows through. Release is transparency
for every Parameter kind, and it is how a Layer above leaves a number set by a
Layer below in force instead of overriding it with zero.

### Blend Mode

How a Contribution combines with what is accumulated below it, per Parameter
kind: `normal` (alpha-over for colours, crossfade toward the value for numbers,
top wins at alpha one half for choices and booleans), `add`, `multiply`, `max`
and `min`. `max` on `dimmer` is the console's HTP; `add` on `pan` is a relative
offset.

### Resolve

The Runtime's per-frame computation of every Element's Parameter Values: start
from the Mode's Defaults, apply each Layer's Contributions bottom to top with
its opacity and Blend Mode, then hand the result to Encoding. A colour on a
discrete gamut is snapped to its swatch as part of Resolve, so Filters, Studio
and Encoding all see the swatch the fixture will actually show. Resolve happens
in the Runtime at the Output rate; Studio shows resolved values it is streamed.

### Scene

A saved, ordered stack of Layers, topmost first, as in Difracta. One Scene is
active at a time, and playing one is a cut until Transitions arrive. A Scene is
complete: nothing tracks from the previous one, and what no Layer sets is at
Default. Scenes have an order among themselves, which Next and Previous will
follow.

Selecting a Scene in Studio edits it and does not play it; the play button on
its row does. The Rig View always shows the active Scene, and the status
strip warns when the Scene being edited is not the one playing, so a show is
never changed by clicking around the navigator.

### Transition (designed, not in the first build)

Transition, Transition Time, Move in Black, Layer Fade and Next/Previous are
specified in docs/transitions.md and left out of the first build, which cuts
between Scenes as Difracta does. Until then a hub fades a Layer through a
Controller on its opacity.

Playing a Scene while another is active crossfades the two resolved outputs
over the incoming Scene's Transition Time: numbers and colours interpolate,
choices and booleans take the new value at the start, subject to Move in
Black. Both stacks run during the Transition; the old one's Visual instances
are dropped at the end. A play that interrupts a Transition freezes the
current output as a still and fades from it. Difracta cuts; lighting cannot.

### Transition Time

A Scene's default time for arriving, stored on the Scene being played to, as
consoles store a fade on the cue you go to. The `play` trigger takes an
optional time that overrides it for one firing. Per-family times (dimmer up,
dimmer down, colour, position) are deferred; the single time is their default
when they come.

### Move in Black

The always-on rule that changes happen while dark. During a Transition an
Element whose `dimmer` resolves to 0 in the outgoing Scene takes all its other
Parameters from the incoming Scene at once; an Element whose `dimmer` resolves
to 0 in the incoming Scene keeps its outgoing values until its dimmer has
reached 0. It reads the resolved Parameter, so fixtures with a virtual dimmer
qualify. Fixtures with no `dimmer` are never dark.

**Elsewhere:** grandMA3 "MIB", a per-cue or per-fixture setting; Eos "mark".

### Layer Fade

Two times on every Layer, fade-in and fade-out, default 0. Flipping `enabled`
on ramps an envelope up over the fade-in; off ramps it down over the fade-out
while the Layer keeps running. Effective opacity is opacity × envelope, so a
Look Layer easing in is a crossfade from the stack below to its values. A
Group's envelope scales everything inside it. Manual fades remain a
Controller on opacity.

### Next and Previous

Two Installation Addresses that play the Scene after or before the active one in
navigator order, with that Scene's Transition. Scene order plus these two
triggers is the cue list; they do not wrap.

### Layer

One entry in a Scene's stack: name, enabled, position, an ordered list of
Targets with Spread flags, opacity, Blend Mode and Layer Fade times. Layer
opacity is the fader: give it a Controller and a hub rides it. A Layer is one
of four kinds: Look Layer, Visual Layer, Filter Layer or Group.

### Look Layer

The static Visual: a Layer whose rows are not declared by code but derived
from its Targets, one row per Attribute found across their Elements. Rows are
stored per Target, an Element or a Fixture Set: one row per Attribute, each a
value and an alpha (default 1), released when absent. A Set Target's rows fan
to its members, so a member added later inherits them without reopening the
Layer; to override one member, that Element is added as a Target of its own
and wins by the Target rule. The inspector's "All Targets" section is a
convenience that writes one Attribute to every Target at once. Every row and
its alpha is an Address, so a Controller can drive it through a Parameter Link
and the row shows who drives it. It is the console's programmer frozen into a
Layer, and the most common Layer in a show.

A value per Element inside one Set Target (a mover's focus position is per
Element by nature) is deferred: today that is one Target per Element.

### Slot

One typed output a Visual declares: Shimmer has one color Slot, an LFO one
number Slot, Circle two number Slots (`x`, `y`). Numbers leave a Slot in
0 to 1. A Visual is written against kinds, never against a fixture; it does
not know whether its number Slot ends up on a dimmer or a zoom.

### Slot Binding

A Layer's assignment of one of its Visual's Slots to an Attribute, with two
anchors mapping 0 and 1 into the Attribute's units, exactly as a Difracta
Parameter Link maps a Controller. A Visual declares a default binding for each
Slot (`x` to `pan`, the number Slot of an LFO to `dimmer`); the Layer may
rebind, so one LFO serves dimmer, strobe, zoom or iris. A Contribution lands on
every Element of the Layer's Targets that has a Parameter for the bound
Attribute; the others ignore it.

### Visual Layer

A Layer running one Visual over its Targets. The Visual declares its Slots
with default bindings, its Parameter Schema, whether it takes one Target or
many, and the Cues it answers; each frame it produces one Contribution per
Slot per Target, and the Slot Bindings say which Attribute each reaches.

### Controller and Parameter Link

Difracta's, unchanged in role: a Controller is an Installation-owned named value with an
OSC leaf; a Parameter Link makes one Controller drive one Address, and a driven
Address shows "controlled by" and refuses hand edits. What is linkable is a
Layer's Address: its opacity, enabled, a Visual Parameter, a Look Layer row.
Element Parameters are never linked directly; the stack is the only road to a
fixture, so "a fader on Atomic 2's dimmer" is a Look Layer row with a Link.
Controllers may later be generated (an LFO, an envelope, audio) instead of
set by hand, which is how a Visual-like source modulates another Visual's
Parameter without entering the stack. See docs/visuals-and-links.md.

### Filter Layer

A Layer that transforms the accumulated values below it for its Targets, or for
everything when it has none: Smooth (ease changes of an Attribute over a time),
Master (scale `dimmer`), Tint, Limit (clamp a range), Invert, Settle (see
below). Difracta's Filter scoped to Targets. Unlike Encoding, a Filter has
state and time, so it can react to a change, not only to a value.

### Settle Filter (deferred)

A Filter that would hide hardware travel: when a discrete Parameter of an
Element below it changes swatch or slot, it contributes `dimmer` 0 for that
Parameter's settle time, then releases. Deferred: the fixture-side answer, a
`control` option such as "blackout on colour change" that most wheel fixtures
offer, is preferred because only the fixture knows when the wheel has
arrived. Kept here so the settle time on Parameter has a stated purpose.

### Group

Difracta's navigator folder and stack folder, unchanged: a Group in a stack
has `enabled` and nothing else. A Group opacity as a submaster was proposed
and declined in the slice 2 grill; opacity stays on Layers, and a submaster is
a Controller linked to the opacity of the Layers it should ride.

### Blackout

A Runtime switch that forces every `dimmer` to 0 (and `shutter` closed where
one exists) after Resolve, leaving colour, position and everything else as the
stack left them, so releasing it restores the look at once. Not saved. It is
an Address, so a hub's button reaches it through a Macro; it is not linkable
to a Controller.

### Master

The Installation's grand master: one number from 0 to 1 that scales every `dimmer`
after Resolve, before Encoding. Saved with the Installation and an Address,
linkable to a Controller, since a grand master on a hub fader is the first
thing a show asks for. Anything finer ("all colours", "the floor package") is
a Look Layer or a Filter Layer targeting the Set `All` or a smaller one; no
other global controls exist.

## 5. Rig View

Terms for seeing the rig in Studio without hardware. Reasoned in
[docs/rig-view.md](docs/rig-view.md).

### Position

A Fixture's place in stage space: `x`, `y`, `z` in metres and a rotation about
each axis, stored on the Fixture. The origin is centre stage on the floor; `x`
runs to the right as the audience sees it, `y` up, `z` toward the audience. A
new Fixture lands one shape width to the right of the rightmost existing
Fixture, on the floor line, so a fresh rig reads as a row before anyone drags;
the first Fixture lands at the origin. Elements have no Position of their own;
their offsets come from the Shape Template. Position is what the
front view draws and what geometry Visuals will read later.

### Shape Template

A named, parameterized layout a Mode picks to say how its Elements are drawn:
`single` (the root as one rectangle), `bar(n)` (n Elements with a Tag in a
row), `grid(cols, rows)` (row-major), `strobe-backlight(sections, panels)`
(two rows, two Tags). A template binds Elements by Tag, in tree order, and
places them relative to the Fixture's Position; Elements it does not place are
not drawn. Shapes are schematic and not to scale. Importers pick `grid` for a
pixel matrix; hand-written types name a template and its Tags.

### Rig View

The Studio panel that draws every placed Element as a flat shape filled with
its resolved `color` times `dimmer` (white times `dimmer` when the Element has
no `color`) on a dark canvas, in front view (`x`, `y`, and the rotation about
`z`). Clicking selects a Fixture or an Element, shift-click and ctrl-click
extend the Selection, a marquee on empty canvas picks everything inside,
dragging a shape moves its Fixture through an undoable command, and zoom and
pan are per session. When a Layer or a Fixture Set is selected the view
outlines its Targets or members, so what a Layer reaches is visible. It reads
the Resolved Stream and shows Defaults and Highlight before any Layer exists.
Always schematic; a beam-like 3D view is a later, separate view.

### Resolved Stream

The Runtime's live feed of resolved Parameter Values to a Studio session. A
session subscribes by Fixture id and receives every Element's values for every
Attribute of those Fixtures: a full set first, then only the values that
changed, coalesced to `stream.rateHz` (20 in settings, never above
`output.rateHz`). The Rig View and an inspector on the same Fixture share one
subscription. Values are Parameter Values in physical units, never bytes.
Never saved.

## Deferred terminology

- **Preset**: a stored, named bundle of Attribute values, per Element where
  needed, that Look Layers reference so that fixing the Preset fixes every
  Layer. Named now, detailed after the stack is agreed.
- **Multiple active Scenes** with an order between them.
- **Generated Controller**: a Controller whose value comes from an LFO, an
  envelope or audio instead of a hand or a hub, linkable like any Controller.
- **Tempo**: an Installation-level rate that Visuals may sync to.
- **Positions handed to Visuals** per Target so gradients and sweeps follow
  the real rig; see docs/moving-heads-and-geometry.md. Position itself is in
  section 5.
- **Grid** on a Fixture Set for spatial effects and matrices.
- **Multipatch**: a second Patch that mirrors a Fixture's output elsewhere.
- **Multi-range Modes** (GDTF "breaks").
- **Emitter Parameters**: raw red, green, blue, white levels beside `color`.
- **Activation pairs**: Attributes stored together when one is touched (pan and
  tilt), a programming-layer concern.
- **DMX input**, merging and RDM.
- **Fixture Type Editor** in Studio; v1 authors types as files.
