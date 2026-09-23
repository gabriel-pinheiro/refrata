# Transitions

How time enters the show. Everything before this note is about what a Scene
_is_; this is about a Layer arriving or leaving without a snap. Terms in
[../GLOSSARY.md](../GLOSSARY.md) section 4.

## 1. How Refrata is performed

Scenes separate the very different parts of a show: one artist on a festival
stage, one game of a game show. Nothing crosses from one to the next, and a
Scene is never changed mid-song. A show is performed inside one Scene, which
holds many Layers and Groups; the hub performs it by showing and hiding
Layers with Macros and by moving Controllers. Movers ballyhooing go to a
spot because the `Spot` Look Layer with a pan and tilt per mover is shown;
the colour theme changes because a colour Layer is shown, or a Controller
linked to many colour rows moves.

So the moment that needs time is a Layer arriving or leaving. Scene to Scene
crossfades, Move in Black and a cue-list Next and Previous were designed
here on 2026-09-19 and removed on 2026-09-23, because no show plays a Scene
as a cue.

## 2. Layer Fade

Every Layer, Groups included, carries a fade in and a fade out. Each is a
time, 0 to 30 s, default 0, and a curve, default Linear. Flipping the Layer's
effective `enabled` on ramps an envelope from 0 to 1 over the fade in;
flipping it off ramps it down over the fade out while the Layer stays in the
stack and its Visual keeps stepping. A Layer's weight in Resolve is its
opacity times its envelope, times the same of every Group above it. Because
a Layer's weight is an alpha over what is below, a Look Layer fading in is a
crossfade from the stack below to its values: dimmers rise from what was
there, colours blend, movers travel from wherever they were, and a Look
Layer that only sets `color` leaves `dimmer` alone throughout.

**Curves.** Linear, Ease in, Ease out, Ease in out and Bounce, with the CSS
meaning, so "ease in" is a slow start whichever way the fade goes. Bounce
reaches the target and falls back a few times, smaller each, without passing
it, so a mover arrives at the spot and pulls back toward where it came from.
Elastic is out: it overshoots, and alpha cannot pass 1.

**Choices and booleans** switch where the weight crosses one half, since they
cannot crossfade: a gobo Layer fading in over 4 s changes gobo at 2 s. A
choice of switch point (start, midpoint, end) is deferred until a show asks.

**When a fade starts.** Only when a Layer's effective `enabled`, authored or
driven by a Controller, flips while its Scene is the active one. Playing a
Scene, the playing one included, opening a document, starting the Runtime
and adding a Layer land every Layer on its final value. Undo flips `enabled`
like anything else and fades; it only shows when the edited Scene is the
playing one, which the status strip already warns about.

**Sampled at the flip.** The direction's time and curve are read when the
flip is seen, Controllers included. A fader ridden on the fade time during a
fade changes the next fade, not this one; re-timing live would stretch or
jump a running fade under a moving fader.

**Reversal.** A flip mid-fade restarts from the current envelope, along the
other direction's curve, over the other direction's time scaled by the
distance left: a Layer disabled at 0.4 of a 5 s fade in, fade out 2 s, is out
in 0.8 s. A quick on-off never overshoots.

**Groups.** Toggling a Group uses the Group's own times: its envelope goes
down over its fade out and the children's `enabled` never flips, so their
own times play no part, and a child with a longer fade out is cut off with
the Group. A Group's opacity, added with the fade, is the same
multiplication ridden by hand: a submaster over everything inside.

**Pass-through, not isolate.** A Group's opacity and envelope multiply into
each child's weight; the Group is not composited as its own picture first.
Two consequences, both accepted. A child with `add` or `multiply` still
blends against what lies below the Group, which is what a Figure adding a
pan offset to a base position outside the Group needs, and why Photoshop
defaults groups to pass-through. And a Group holding stacked children fades
oddly: at 50 % with B over A both at 100 %, the output is base 25 %, A 25 %,
B 50 %, so A, hidden at full, shows through as the Group fades. An "isolate"
toggle per Group can come later if a show needs a true submaster of a
Group's look.

**Addresses.** `layer/<id>/fade/in/time`, `layer/<id>/fade/in/curve`,
`layer/<id>/fade/out/time` and `layer/<id>/fade/out/curve`, on every Layer.
A time is a number a Controller can drive, mapped over 0 to 30 s; a curve is
a choice. A Macro sets them like any Address, so "show this one in 2 s" is a
Macro with two actions, set the time then enable; no per-firing time on the
enable action.

**Studio and CLI.** The Layer inspector gets a Fade section with the four
rows, collapsed by default, and the Layer section starts collapsed too. The
`refrata layers` listing shows `fade in 2 s ease-in-out, out 1 s` on a Layer
that has one, and `refrata layers fade <layer> in|out <seconds> [--curve]`
sets it. Nothing shows a fade in progress: the envelope is Runtime state and
is not streamed.

**Where it runs.** The envelopes live beside the Visual instances in the
Runtime's output loop, stepped with `dt` every frame and handed to Resolve,
which is otherwise a pure function of the Document. Studio and the CLI never
compute one.

## 3. The peer swap, and what to do about it

The commonest pattern is a Group of alternatives, `Spot A`, `Spot B`,
`Fan Out`, each a Look Layer with a position per mover, and one Macro per
alternative that hides every child and shows one. Layer Fade covers the
arrival and the departure of one Layer, but swapping two peers with it dips
through the stack below: with equal linear times, hiding A while showing B
puts the mover a quarter of the way back toward the base at the midpoint.
Accepted, because it is avoidable: fade B in first and cut A once it is
covered, which a hub can sequence, or keep the alternatives at different
heights so the one that shows is always the one on top.

## 4. Deliberately not built

- **Per-row fade times** ("colour in 1 s, position in 3 s"). Split the Layer
  in two instead; a Smooth Filter per Attribute is the designed answer.
- **A switch point for choices**, start, midpoint or end. Midpoint is what
  alpha gives; the others need a second, stepped envelope handed to Resolve.
- **A per-firing time on the enable action.** Two Macro actions do it.
- **Isolate on a Group.** See pass-through above.
- **Smooth Filter.** A Filter Layer listing Attributes and a time, easing the
  resolved value below it from wherever it is to wherever the stack now says,
  whatever caused the change. Per Attribute and per Target by nature; per
  Layer by stack order, since only what is below it is eased, and anything
  below it, a running Visual included, is damped. Designed in
  docs/layers-model.md, not built.
- **Scene crossfades.** Playing Scene B while A is active, blending the two
  resolved outputs over a time, with Move in Black and a cue-list Next and
  Previous. Designed and removed; Scenes are not cues here.

## 5. Selector Group: one child at a time (idea, not designed)

A Selector Group would name the peer-swap pattern of section 3. It is a
Group kind that shows one child at a time:

- one Address `active` that takes a child's name, or nothing for none, so a
  hub drives it from one OSC leaf with an enum instead of one Macro per child;
- one crossfade time on the Group; switching children crossfades child A's
  output straight into child B's over that time, then drops A, so a swap
  never passes through the base;
- setting `active` to nothing fades the active child out with the same time.

Cost: a new Group kind, and an overlap with Layer Fade that a grill has to
resolve (does a child's own Layer Fade apply inside a Selector, or does the
Group's time replace it). Kept here so the pattern has a home when Layer Fade
alone proves not enough.
