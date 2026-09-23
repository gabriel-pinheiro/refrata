# The Layers model: authoring a show as a stack

A pressure test of the idea that a show is composed the Difracta way: Scenes
made of ordered Layers, each Layer a Visual applied to Targets, blended by
opacity and blend mode. This note states the model precisely enough to find its
holes, walks it through the Atomic example and a few harder ones, and lists
where it bends and where it breaks. Terms are in [../GLOSSARY.md](../GLOSSARY.md)
section 4; they are drafts.

## 1. The model, stated precisely

The pixel version in Difracta works because every Layer produces the same kind
of thing, RGBA pixels on a Surface, and composition is defined once. The
lighting version needs an equivalent "pixel". It is:

> a **Contribution**: one value for one Parameter of one Element, with an
> **alpha** from 0 to 1.

Every kind of Parameter gets an alpha, not only colour. A colour with alpha 0.3
is a translucent tint (and a colour value's own fourth component multiplies
into it, so the colour picker's alpha is that tint); a number with alpha 0.3
is a 30 % crossfade toward that value; a choice with alpha below one half is
ignored. Alpha 0 is the
**release** the brief asks for: a Layer that says nothing about a Parameter
leaves whatever is below untouched. That one generalization is what makes
"transparency works for colour but numbers need release" go away: release is
transparency for every kind.

The stack is then resolved per Element per Parameter:

```text
out = Default of the Parameter (alpha 1)            the Scene background
for each Layer from bottom to top:
    for each Contribution the Layer makes to this Element and Parameter:
        a = contribution.alpha × layer.opacity        (a disabled Layer or Group contributes nothing)
        out = blend(out, contribution.value, a, layer.blendMode)
```

Blend per kind:

| Kind    | normal                 | add       | multiply        | max (HTP) | min |
| ------- | ---------------------- | --------- | --------------- | --------- | --- |
| color   | alpha-over             | out + a·v | out·lerp(1,v,a) | max       | min |
| number  | lerp(out, v, a)        | out + a·v | out·lerp(1,v,a) | max       | min |
| choice  | v if a ≥ 0.5, else out | —         | —               | —         | —   |
| boolean | v if a ≥ 0.5, else out | —         | —               | —         | —   |

The background is the Mode's Defaults, so a Scene with no Layers outputs the
fixtures at rest: shutter open, dimmer zero, pan and tilt centred. Nothing
tracks from a previous Scene; each Scene is complete. That is a feature, the
tracking bugs consoles are famous for cannot happen, and a cost, a Scene must
say everything it wants (usually a bottom Look Layer with "everything at
100 %").

Where a Contribution lands: a Layer addresses a **Target**; the Runtime
expands it to Elements. A Fixture Set expands to its members; an Element
expands to itself; and the Rig's fan-down rule then carries a Parameter the
Element lacks to the descendants that have it. So "color green on the Atomic
root" becomes eight Contributions on eight Panels, and "dimmer 100 % on the
Atomic root" becomes two, on Beam and Aura. Blending is always at the Element
that owns the Parameter.

## 2. Target, and the two ways to hand a Set to a Visual

The word: **Target**, as in Difracta, where it is the Surface a Layer renders
into. Here a Target is what a Layer renders into: one Element or one Fixture
Set. No separate "Fixture Target" is needed, and from a Visual's point of view
a Target is opaque: one controllable thing that accepts Contributions and
happens to have some Attributes.

Every Layer carries one **ordered list** of Targets, and every Visual is
handed the whole list after Spread, each Target as a key, an index and the
count; a Visual that does not care about order writes the same at every
index. This covers the distinction the brief draws:

- a Chase given three Targets, `Atomic 1`, `Atomic 2`, `Atomic 3`, steps
  the three devices, each flashing all eight Panels at once;
- the same Chase given twenty-four Panel Targets steps Panel by Panel.

The catch is authoring: nobody wants to click twenty-four Elements into a
Layer, and a hand-made list does not follow a Set when the Set changes. So a
Target in a Layer's list carries a **Spread** flag. Spread off, the Set is one
Target. Spread on, the Set is replaced at resolve time by its ordered members,
one Target each. A spread Element expands to its children. Then:

| Layer target list              | What the Chase sees                |
| ------------------------------ | ---------------------------------- |
| `All Atomics` (set of 3 roots) | 1 Target: all three flash together |
| `All Atomics`, spread          | 3 Targets: device by device        |
| `All Aura Panels`, spread      | 24 Targets: panel by panel         |
| `Atomic 2 › Aura`, spread      | 8 Targets: one device's panels     |

Two-level distribution ("a wave across the three Atomics and a rainbow inside
each") is what grandMA3's selection grid and MAtricks do. Spread is one level.
Deferred; when it comes, it is a grid on a Fixture Set, not a change to
Targets.

## 3. Walking the brief's example

Scene `Verse`, bottom to top:

1. **Look Layer** `Base`, Target `All Aura Panels` (as one): `color` dim green
   alpha 1, `dimmer` 0.4 alpha 1. Every Panel gets green; every Aura gets
   dimmer 0.4 through fan-down from the Panels' parent. (If the Set held
   Atomic roots instead, `dimmer` would also reach the Beams. Which Set to
   target is a real choice, and it is visible in the Set's name.)
2. **Visual Layer** `Shimmer`, Target `All Aura Panels` spread, Visual
   Shimmer, its `color` Parameter white. Shimmer writes, per Target and per
   frame, white with an alpha it animates from 0 up and back down at random
   moments, and nothing at all for a Panel between sparkles. Panels flash
   white over the green and return; nothing else is touched because only
   Shimmer's `color` Slot is bound. Bind its `level` Slot to `dimmer` as well
   and the sparkle is full white instead of white at 0.4.
3. **The fade in.** Not a Layer: it is a Layer Fade on `Base`, fade in 5 s,
   with `Base` disabled until a Macro enables it. See docs/transitions.md.
   The rig comes up from dark to the look.

Note what the fade is not: a black colour fading to transparent. A black
`color` over an RGB panel reads as off, but over a fixture with a white lamp
and a colour wheel it means "nearest wheel slot to black", which is nonsense.
Off is `dimmer`, and because numbers have alpha, a crossfade toward a Look
Layer or a Scene works on every fixture the same way, including a 3-channel
RGB par through its virtual dimmer. The brief's instinct that "transparency
works for colours" is right; the generalization makes it work for the
parameter that actually turns lights off.

Then the Layer's `opacity` is the fader. Give `Shimmer` a Controller on its
opacity and Chataigne rides it. Link one Controller to the opacity of several
Layers, or to the opacity of the Group holding them, and it is a submaster.
This is the model's best property: Difracta's one Address table, Controllers
and OSC give a playback surface for free.

## 4. Where it bends

Things the model can do, but only if a few pieces are added.

### The everyday static look needs its own Layer kind

Most of a show is "these lights, this colour, this level, this position". A
Visual with a fixed Parameter Schema cannot express it, because the values
wanted depend on which Attributes the Targets have. So there is a third Layer
kind beside Visual and Filter: the **Look Layer**. Its inspector shows one row
per Attribute found across its Targets' Elements, each row either released or
set to a value with an alpha. It is the console's programmer, frozen into a
Layer.

Rows are stored per Target. A row on an Element Target is one value for that
Element and its fanned-down descendants; a row on a Fixture Set Target is one
value for every member, and a member added to the Set later inherits it
without anyone reopening the Layer. That inheritance is why the Set-level row
is real storage and not a convenience over per-Element values: with only
per-Element rows, a par added to `Wash Left` would stay released until
someone noticed. To override one member, the Element is added as its own
Target after the Set and wins by the Target rule ("Override" on the member
in the Set Target's block does exactly that). A table of values per Element
inside one Set Target (a mover's focus position, a hand-painted pixel look)
was declined for good in the slice 3 grill: it would be a second way to say
the same thing, and with a rule Set it would keep rows for members that have
left; that case is one Target per Element. And Look Layers want
**Presets**: a stored, named bundle of Attribute values (`Warm
White`, `Stage Centre`) that many Look Layers reference, so that fixing the
preset fixes every Layer. grandMA3 lives on this; it is the second most
important thing after the stack and belongs in the glossary once the stack is
agreed. Why the Look Layer is not just a static Visual is argued in
docs/visuals-and-links.md.

### Relative values are a blend mode

grandMA3 stores relative phaser values so a circle runs around wherever the
base position is. Here a Figure Visual writes pan and tilt offsets on a Layer
with blend `add`. Absolute figures use `normal`. No new concept.

### Cue-list timing becomes Layer Fades plus smoothing

Theatre wants a GO button and per-cue fade and delay times, often per
Attribute. Refrata is not performed as a cue list: a Scene holds a show's
part, and the hub performs it by showing and hiding Layers. So time enters
here:

- a **Layer Fade** on every Layer (docs/transitions.md, built): enabling
  eases the Layer in over its time and curve, disabling eases it out, using
  the same per-kind blend (numbers and colours crossfade toward the Layer,
  choices switch at half). A Macro that shows the `Spot` position Layer
  moves the movers there over its fade in.
- a **Smooth** Filter, "Position 2 s", "Color 0.5 s", placed at the top of a
  stack: every change to those Attributes below it, from any Layer, eases
  over that time. Declarative fade times instead of per-cue ones. Designed,
  not built.

What this does not give: a delay per Attribute in one cue, or a different fade
time for the same Attribute in cue 12 than in cue 13. Scene to Scene
crossfades were designed and dropped, since Scenes separate shows rather
than cues. Tracking between cues is deliberately absent.

### Filters are value transforms scoped to Targets

Keep Difracta's Filter Layer: it transforms the accumulated values below it,
for its Targets or for everything. Candidates that matter for lighting:
Smooth, Master (multiply dimmer), Tint, Limit (clamp pan or tilt range to keep
a mover off the audience), Invert. A Controller linked to several Layers'
opacity covers the "submaster" case, so Filters stay few.

### The Runtime renders

In Difracta, browsers run the Visuals and the Runtime holds the document. Here
DMX comes out of the Runtime, so the Runtime runs the Visuals, at the Output
rate (40 Hz for Art-Net). Visuals are TypeScript modules stepped with `dt` as
in Difracta, but in Node. Studio needs a live stream of resolved values for
what it shows (a fixture's current colour, a Look Layer's effective row),
subscribed per view rather than for the whole rig.

### Blackout is the frame, not the composition

Blackout sends 0 on every address of every Universe. It is applied to the
encoded frame, after Resolve and Encoding, so it does not depend on the
patch being right: a fixture with the wrong Mode, where `dimmer` names the
wrong channel, still goes dark, since nearly every fixture is dark at all
zeros. The composition is untouched, so Studio keeps showing the look and
releasing Blackout restores it. What all zeros does not do is keep a mover
still: pan and tilt at 0 drive it to its end stops, and back when Blackout
lifts. The dark that keeps positions, and can fade, is Master at 0.
Difracta's "replace output with black" translates to Blackout.

## 5. Where it breaks, or costs

Honest limits, so the choice is made knowingly.

1. **Painting is not composing.** A console lets you select 60 fixtures, dial
   30 different colours and store one cue. Here that look is 30 Look Layers or
   a pixel-mapping Visual. For a music show built from Sets and effects this is
   fine; for a theatre plot of hand-tuned per-fixture states it is verbose.
   Presets and a "capture the current output into Look Layers" command soften
   it; they do not remove it.
2. **Order is explicit, HTP is not the default.** On a console "any fader up
   turns the light on" because dimmers merge highest-takes-precedence. Here an
   opaque Layer above with `dimmer` 0 turns the light off, the way a black
   layer covers a photo. Right for composition, surprising for console
   operators. A Layer's blend `max` gives HTP when wanted.
3. **One Scene at a time.** Consoles run many playbacks over one another.
   Here the equivalent is one Scene whose Layers are the playbacks, faded by
   Controllers. Anyone who wants "song A's colours with song B's movement"
   copies Layers between Scenes. Multiple active Scenes with an order would be
   possible later (a Scene is a stack; stacks stack) but is not needed to
   start.
4. **Choices cannot crossfade.** A gobo or a control function snaps at half
   alpha. Every system has this; the model just makes it explicit.
5. **Colour over non-mixing fixtures is an Encoding heuristic.** `color` on a
   colour-wheel fixture picks the nearest slot; on a CMY fixture inverts; on
   RGBW extracts white. grandMA3 does the same with more data (emitter
   spectra). Good enough, never exact.
6. **Sets are opaque, so a Visual never sees geometry.** A wave "across the
   truss" is a wave across the Target order. Until Sets carry a grid, spatial
   effects are one-dimensional. This is the same limit QLC+ solves with its
   fixture-group grid and grandMA3 with the selection grid; it is a Set
   feature, not a Layer one.

## 6. Questions this leaves for the glossary

- Whether `spread` is a flag on a Target entry or a Visual-level distribution
  setting. Recommended: on the entry, so one Layer can mix a spread Set and a
  single Element.
- Whether Look Layers and Presets go in now or after the stack is agreed.
  Decided: Look Layers are slice 2 with rows per Target; Presets are named
  and detailed later.
- Whether a Group gets an opacity. Declined in the slice 2 grill, then added
  with the Layer Fade on 2026-09-23: a Group's opacity and fade envelope pass
  through to every Layer inside, the same multiplication, so a submaster is a
  Controller on the Group's opacity or on the opacity of the Layers it rides.
- Whether Scenes crossfade. Decided on 2026-09-23: no; a show is performed
  inside one Scene, and docs/transitions.md covers the Layer Fade instead.
