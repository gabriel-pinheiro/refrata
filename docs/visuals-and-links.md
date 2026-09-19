# Visuals, Slots, Links and the Look Layer

Three questions from the second review, answered in one place, and the Visual
SDK as the slice 4 grill settled it (section 5): what a Visual
is written against, how Visual Parameters relate to fixture Parameters and to
Difracta's Parameter Links, and whether the Look Layer is a concept of its own
or just a static Visual. Terms in [../GLOSSARY.md](../GLOSSARY.md).

## 1. A Visual is written against kinds, bound to Attributes at the Layer

The mental model in the review was: a Visual applies to an Attribute (colour,
dimmer) and can be attached to whatever Parameter fills that Attribute on a
fixture; some Visuals could apply to a kind instead (any number). The second
half is the general case, so take it as the rule:

- a Visual declares **Slots**, its typed outputs: LFO one number, Circle two
  numbers, Rainbow one color, Shimmer and Chase a color and a number (section
  5 says why);
- a Layer holds a **Slot Binding** per Slot: which Attribute it reaches, or
  none, and for a number two anchors mapping the Slot's 0 to 1 into the
  Attribute's units, the same anchors a Difracta Parameter Link has;
- each Visual ships a default binding per Slot (LFO to `dimmer`, Circle `x` to
  `pan` and `y` to `tilt`), so the common case is zero clicks, and the Layer
  can rebind (LFO to `zoom`, to `strobe`, to `iris`).

A Contribution lands on every Element of the Layer's Targets that has a
Parameter for the bound Attribute. Elements without it ignore it. So the same
LFO Layer over a mixed Set moves the dimmer of the washes and the dimmer of
the movers, and a Circle Layer over the same Set moves only the movers.

What this buys: a small Visual library. One Smooth Fade serves dimmer, strobe,
zoom and pan. One Rainbow serves colour on every fixture, discrete gamut or
not, because Encoding does the snapping downstream. Attribute-specific Visuals
still exist when the semantics matter (a Circle knows it is drawing in
pan-tilt space) but they are the exception, expressed as default bindings.

Units: a number Slot is always 0 to 1 and the binding's anchors carry the
units. A Visual therefore never sees degrees or hertz. When it should (a
Circle with a radius in degrees), the radius is a Visual Parameter in degrees
and the Slot still leaves 0 to 1 over the binding's range. This is the same
division Difracta makes between a Parameter's units and a Link's anchors.

## 2. Two graphs, not one

Difracta has two ways a value moves: the stack (Layers composite into a
Surface) and the link graph (a Controller drives an Address). The review asks
whether fixture Parameters and Visual Parameters can be the same thing and
whether a Visual's Parameter can be a Target of another Visual. Keep the two
graphs separate, because they have different arities:

| Graph      | Writers per value | Combination                 | Writes to                                                       |
| ---------- | ----------------- | --------------------------- | --------------------------------------------------------------- |
| Stack      | many Layers       | ordered, alpha, blend mode  | Element Parameters, through Targets                             |
| Link graph | one Controller    | none; the Link is the value | Layer Addresses: opacity, enabled, Visual Parameters, Look rows |

Consequences, each of which is a rule in the glossary:

- **Element Parameters are only reached through the stack.** Linking a
  Controller straight onto `Atomic 2 › Aura › dimmer` would need a rule for
  how it fights the stack. Instead, that fader is a Look Layer at the top with
  a `dimmer` row linked to the Controller. The row shows "controlled by", the
  Layer shows in the stack, and opacity still applies. Nothing is lost and
  there is one road to the fixtures.
- **Visual Parameters are only reached through the link graph.** They are
  single-writer settings, and the "controlled by, hand edits refused" marker
  that Difracta already has is exactly the guarantee the review asked for.
- **A Visual does not target another Visual.** Targets are Elements and Sets;
  keeping Visual Parameters out of that list keeps "Target" meaning one thing.
  The modulation that the question is really about ("an LFO on Shimmer's
  rate") is a Controller whose value is generated rather than set by hand. A
  generated Controller is a Visual-like thing living beside Controllers, with
  one number or colour output, an OSC leaf like any Controller, and Links to
  as many Addresses as wanted. Chataigne users know it as an LFO module. This
  is deferred but the shape is fixed: Controllers get a source kind.

The two homes of "Parameter" therefore differ in one attribute, arity, and
share everything else (kind, unit, range, default, Address, Control). Calling
both Parameter and qualifying with Element or Visual when needed follows
Difracta, where a Layer's `param/<name>` and a Controller's `value` are both
Parameters and nobody is confused.

## 3. Look Layer: the static Visual with a derived schema

The review proposes static Visuals that set fixed values, controlled through
Controllers and Macros, and asks whether the Look Layer is a new concept at
all. It is the same concept; what differs is where its Parameter list comes
from. Three ways to build "these fixtures, this colour, this level":

**A. One static Visual with a fixed schema.** It would have to enumerate every
Attribute in the vocabulary to be usable on any Target, and show them all
whether or not the Targets have them. Nobody wants a gobo row on a wash.

**B. One static Visual per kind, bound through Slots.** `Static Number` with a
number Slot bound to `dimmer`, `Static Color` bound to `color`, `Static
Choice`. This is the minimal design and it works with nothing new. Costs: a
look with colour, level, position and gobo is five Layers; the value of every
member of a Target is the same, since a Slot emits one value per Target; and a
"capture what is on stage now" command would produce a pile of Layers.

**C. A Layer whose rows are derived from its Targets.** One row per Attribute
found across the Targets' Elements, each row released or set with an alpha,
optionally per Element. This is B with the schema computed instead of coded,
and one Layer instead of five.

The deciding case is the moving head. A focus position ("Centre Stage") is
different pan and tilt for every mover, always, because they hang in different
places. Neither A nor B can hold a per-Element value, since a Slot emits one
value per Target and a fixed schema has nowhere to put a table keyed by the
Targets' Elements. C can: a row is either one value for all or a value per
Element. The same table is what a hand-painted pixel look needs, and what a
"capture" command fills.

So the Look Layer stays, understood as: _the static Visual, with its Parameter
Schema derived from its Targets and per-Element values allowed_. Everything
the review wanted from static Visuals holds: every row is an Address, so it is
driven by a Controller through a Link, set by a Macro, and shown or hidden by
the Layer's enabled switch. There is no new mechanism, only a Layer kind whose
inspector is computed.

The shape chosen in slice 2: rows are stored per Target, keyed by the
Target's reference, one row per Attribute with a value and an alpha, released
when absent, plus the Layer's own "All Targets" rows keyed by Attribute that
every Target takes unless its own row overrides them. A row on a Fixture Set
Target fans to every member, so a member that joins the Set later inherits
the row; a member that needs its own value is added as a Target of its own
after the Set ("Override" on the member) and wins by the Target rule. The inspector shows the "All Targets" rows,
then one block per Target with a Control checkbox per Parameter, each block
saying when a row overrides or comes from All Targets. The alpha is stored
and blended but has no Address or control yet, so it reads as 1. The
per-Element table inside a Set Target was declined for good in the slice 3
grill: the mover case that justified the Look Layer in the first place is one
Target per Element, and a table keyed by member would go stale under a rule
Set whose members come and go.

And it is where Presets will attach: a row can reference a Preset instead of
holding its own value, so ten Look Layers pointing at `Centre Stage` all move
when the position is refocused on the day. That is grandMA3's central
productivity feature and it lands naturally here, later.

## 4. Blackout and Master, stated simply

Blackout is a switch: every `dimmer` to 0 after Resolve, nothing else touched,
released at once. Master is a number: every `dimmer` scaled after Resolve.
Both are Installation-level Addresses, so a hub reaches them without a Layer:
Blackout through a Macro, Master through a Controller linked to it. The
review's worry, "how to control all dimmer Attributes, or all colour
Attributes, easily", has one answer for everything else: a Look Layer
or a Filter Layer targeting a Set of every Fixture (a rule Set whose one Rule
has no Tags; there is no built-in one). A "tint everything" is a Look Layer
on that `All` with a `color` row at low alpha; a "dim the floor" is a
Master Filter on `Floor`. Only the two that must survive any stack, Blackout
and Master, are built in.

## 5. The Visual SDK and the first Catalog

Settled in the slice 4 grill. A Visual is a definition (Slots with default
bindings, Parameter Schema, Cues, whether it distributes across Targets, a
one-line description) and a `create` that returns an instance. The instance owns its state
and integrates `dt`; it never sees absolute time. This is Difracta's shape
with Contributions where Difracta has a canvas.

**Where it runs.** In the Runtime, beside the Output loop, on its tick, with
no worker: seven small Visuals over some thirty Targets at the Output rate is
little work, all of it first-party, and a worker would add a frame of latency
and a serialisation at both ends. Resolve stays pure: each frame it is handed
the Contributions of every Visual Layer and composes them as it composes a
Look Layer's. A Scene that is not playing has no instances, so its Visuals
cannot be previewed, as its Look Layers cannot.

**Lifetime.** One instance per Visual Layer of the playing Scene, made when
the Scene plays, disposed when another plays, stepped every frame whether the
Layer is enabled or visible. The deciding case: two Chases at one rate, the
second enabled by a Macro mid-song. Made on enable it lands at an arbitrary
phase; stepped from Scene play they are locked. "Start at step 1 when I hit
the pad" is the `restart` Cue, not a side effect of `enabled`. Edits never
remake an instance; choosing another Visual does; playing the playing Scene
again remakes them all.

**What a Visual sees.** Its Parameter Values, `dt`, Cues, and the Targets
after Spread as key, index and count. The key decides it: Shimmer keeps an
envelope per Target, and by index a Fixture tagged into a rule Set mid-show
would shift every sparkle. No Tags (a Visual reading Tags is written against
the rig, and "only the odd ones" is a Rule), no Position (order is the Set's;
geometry is its own grill). A grandMA3 phaser spreads phase across the
selection order, which is index and count; a QLC+ chaser knows its step list.

**One or many Targets is not a constraint.** An LFO with `phase spread` 0 is
"one" and at 0.5 is a wave, so declaring it "one" would forbid the wave. What
remains is a hint, "distributes across Targets", for the classic mistake: a
Chase over one Target flashes everything together, and Studio offers to
spread it.

**Value Visuals and envelope Visuals.** LFO, Rainbow, the Statics and Circle
write a moving value at alpha 1. Shimmer and Chase are envelopes: their real
output is a level per Target, and the question is what it reveals. Each has a
color Slot carrying its `color` Parameter and a number Slot carrying its
`level` Parameter, both at alpha equal to the envelope, and either binding may
be none. `level` on `dimmer` alone twinkles a look in its own colours; `color`
alone is a white sparkle over a lit look; both is the case that decides it,
since over `dimmer` 0.4 a white sparkle on `color` alone is white at 40 % and
two Layers could never sparkle in step. The fade is the Contribution's alpha,
not the colour's; the colour's own alpha still multiplies in and reads as
"how strong at the peak". A Target outside its envelope gets no Contribution,
so nothing is ever written as transparent white. A number Slot never needs to
drive a colour's alpha: every Slot already carries one.

**Parameters and anchors.** Anchors calibrate a Layer to its fixtures and are
not Addresses; Visual Parameters work inside the Slot's 0 to 1 and are. So
the LFO has `low` and `high` (grandMA3's phaser words, in the same role) as
well as anchors, as the envelope Visuals have `level`: one Controller on
every `high` pulls the rig's LFOs down together while each Layer's anchors
keep a par and a Strobe equalised. Opacity cannot do that; it mixes toward
the look below and raises the floor. They never share a name: the binding
row shows a range in the Attribute's units, never "min" and "max".

**One Blend Mode per Layer**, shared by its Slots. The case it cannot do is
Shimmer's `color` on `normal` with its `level` on `max`, which differs only
when `level` is below the look underneath; a Blend Mode per binding is the
fix if it ever bites.

| Visual        | Slots (default binding)            | Parameters                                                 | Cues              |
| ------------- | ---------------------------------- | ---------------------------------------------------------- | ----------------- |
| LFO           | number (`dimmer`)                  | waveform, rate, `low`, `high`, phase spread                | `sync`            |
| Shimmer       | `color` (`color`), `level` (none)  | color, level, count, fade in, hold, fade out, rate, jitter | `fire`            |
| Chase         | `level` (`dimmer`), `color` (none) | color, level, rate, order, tail, fade                      | `step`, `restart` |
| Rainbow       | color (`color`)                    | rate, spread of hue across Targets, saturation             | `sync`            |
| Static Number | number (`dimmer`)                  | value                                                      |                   |
| Static Color  | color (`color`)                    | color                                                      |                   |
| Circle        | `x` (`pan`), `y` (`tilt`)          | rate, radius, center x, center y, phase spread             | `sync`            |

Shimmer: each firing picks `count` Targets at random, idle ones first; each
rises over `fade in`, holds, falls over `fade out`, then releases; a Target
picked again re-attacks from where it is and never jumps down. `rate` is
firings per second and fires the same `fire` Cue from inside, so rate 0 is
the hub's to drive; `jitter` 0 is metronomic and 1, the default, is random
intervals, which is what reads as a shimmer.

Chase is positional, not timed: the head stays lit until the next step, so it
reads the same advanced by a pad at 60 bpm or 240; `tail` is how many Targets
behind the head still glow, at falling levels; `fade` is how fast a level
moves to its new value at a step, 0 for hard steps. `order` is forward,
backward, bounce, centre-out, ends-in or random; centre-out over eight lights
pairs and takes four steps. A `step` from the hub re-arms the automatic
timer, which is tap sync.

Circle stays minimal until a mover exists: on `add` the centre is the look
below, on `normal` its own `center`. Here it proves two Slots.
