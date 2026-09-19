# Transitions

How time enters the show between two states. Everything before this note is
about what a Scene _is_; this is about getting from one to the next, and
about a Layer arriving or leaving, without a snap. Terms in
[../GLOSSARY.md](../GLOSSARY.md) section 4.

## 1. What has to be covered

Lighting has four moments where a snap is wrong and a console gives you time:

1. **Scene to Scene.** Verse to chorus, cue 12 to cue 13. Dimmers fade,
   colours blend, movers travel, and a gobo change should happen where nobody
   sees it.
2. **A Layer arriving or leaving.** The shimmer comes in for the bridge and
   goes away after; a Macro enables it, and it should ease in.
3. **Nothing to something.** The song starts: from dark to the first look.
4. **Something to nothing.** The song ends: to dark, gracefully, not Blackout.

A console covers 1, 3 and 4 with cue timing (fade and delay, often per
attribute) and 2 with a fader. Here 3 and 4 are Scene to Scene with a `Dark`
Scene, and 2 is a fader too (Layer opacity from a hub), plus a built-in ease
so a Macro can do it.

## 2. Recommendation

Two mechanisms, one rule.

### Scene Transition: crossfade the two resolved outputs

Playing Scene B while A is active starts a Transition of time `t`. For its
duration the Runtime resolves both stacks and outputs, per Element and
Parameter, a blend of the two with a weight rising from 0 to 1 over `t`:

| Kind    | During the Transition                                  |
| ------- | ------------------------------------------------------ |
| number  | interpolate A to B                                     |
| color   | interpolate A to B                                     |
| choice  | B from the start (see Move in Black for the exception) |
| boolean | B from the start                                       |

At the end A's Visual instances are dropped. B's Visuals start stepping the
moment play is called, so an LFO in B is already breathing while it fades in.

Why resolved outputs and not "B as a Layer over A": they are the same
arithmetic (B at alpha `w` over A) and stating it as a crossfade of two
finished pictures keeps the stack untouched during the fade; no Layer, Group
or Filter needs to know a Transition is happening.

Why time is stored on the incoming Scene: every console attaches the fade to
the cue you are going _to_, because that is the cue you are editing when you
decide how it should arrive. The `play` trigger takes an optional time that
overrides it for one firing, so a hub can say "chorus, in 0.2 s" for a hit.

### Move in Black: changes happen while dark

The rule that replaces most per-attribute timing:

> During a Transition, an Element whose `dimmer` resolves to 0 in A takes all
> its other Parameters from B at the start. An Element whose `dimmer`
> resolves to 0 in B takes them from A until its dimmer has reached 0, then
> from B.

So a mover that is dark in the verse is already in its chorus position when
the chorus fades up. A gobo change on a fixture that fades out happens after
it is out, not during. A colour wheel on a lit fixture still spins in view,
which is the fixture's control-channel job, not the Transition's. Fixtures
whose Encoding gives them a virtual `dimmer` qualify, since the rule reads the
resolved Parameter, not a channel.

grandMA3 has this as MIB (move in black), a per-cue or per-fixture setting
with its own timing; Eos has "mark". Here it is always on, because there is no
case where a change you cannot see should take time.

### Layer Fade: an ease on enable and disable

A Layer carries a fade-in and a fade-out time, default 0. Flipping `enabled`
on ramps an envelope from 0 to 1 over the fade-in; flipping it off ramps it
down over the fade-out, and the Layer keeps running until the envelope
reaches 0. Effective opacity is opacity × envelope. Because a Layer's opacity
is already an alpha weight over what is below, a Look Layer fading in is a
crossfade from the stack below to its values: dimmers rise from what was
there, colours blend, and a Look Layer that only sets `color` leaves
`dimmer` alone throughout.

This makes the Fade Visual from the earlier examples unnecessary: "fade the
base in over 5 s on song start" is the `Base` Look Layer with fade-in 5 s and
a Macro enabling it, or a Transition from a `Dark` Scene. Both read better
than a Visual whose only job is to be transparent black.

Manual fades stay where they were: a Controller on opacity, ridden from the
hub. The Layer Fade is for the button-press case.

### Next and Previous: declined

Two Installation Addresses, `next` and `previous`, walking the Scenes in
navigator order like a theatre cue list with a GO button, were considered
and declined on 2026-09-19. The hub keeps its own place in the set list: a
pad per Scene, each a Macro that plays it.

## 3. What is deliberately not in v1

- **Per-attribute times and delays** ("colour in 1 s, position in 3 s with a
  1 s delay"). Move in Black removes the common reason for them. If a show
  needs them, a Transition gets a small table of times per family (dimmer up,
  dimmer down, colour, position, other), and the single `t` is the default
  for every row. The model does not change; a Scene grows fields.
- **Paths** (ease curves: linear, ease-in-out, snap-at-end) per Transition.
  Linear now; an easing choice on the Scene later.
- **Tracking.** Nothing carries over between Scenes except through the
  Transition's blend, which ends. Scene B is complete on its own.
- **Blackout with a fade.** Blackout snaps; it is the panic button. A graceful
  end is a Transition to a `Dark` Scene or the Master ridden down by the hub.
- **Transitions between Layers inside a Scene** (Resolume's clip
  transitions). A Layer is not swapped for another; it is enabled or disabled
  with a Layer Fade, or its Visual changes and the Visual swap is a cut.

## 4. Edge cases, decided

- **A Transition interrupted by another play.** The Runtime freezes the
  current blended output as a still picture, drops both old stacks' Visuals,
  and starts the new Transition from that still to C. Nothing jumps, and no
  three-way blend is needed.
- **Playing the active Scene again.** No Transition and no restart; Visuals
  keep their time. A `restart` trigger can be added if a show wants Visuals
  re-zeroed on a downbeat.
- **Controllers moving during a Transition.** Both stacks resolve live, so a
  fader on a Layer in B works while B is still fading in.
- **Editing in Studio during a Transition.** Commands apply to the document
  as always; the next frame's resolve picks them up. Nothing to special-case.
- **A Layer disabled while fading in.** The envelope reverses from where it
  is, over the fade-out time scaled by the remaining distance, so a quick
  on-off never overshoots.
- **Fixtures without a `dimmer` at all** (a relay, a fog machine). Never
  "dark", so they snap at the start like any choice.
- **A Set by rule changing membership mid-Transition.** Resolve is per
  frame; a Fixture added to a Set appears in both stacks at once and blends
  like everything else.

## 5. Costs

- **Two resolves during a Transition.** Trivial for hundreds of fixtures at
  40 Hz. The only real cost is memory for two sets of Visual instances.
- **Choices snap at the start when lit.** Every system has this; a lit gobo
  change is visible somewhere. The fixture's "blackout on wheel change"
  control option is the fix when it matters.
- **No per-cue subtlety without the per-family table.** A theatre plot that
  lives on "colour crossfades in 8 while intensity bumps in 1" needs the v2
  table. Named now so nobody designs around its absence.

## 6. Open decisions

1. Transition time on the Scene with a `play` override: recommended, and
   assumed above.
2. Layer Fade as two fields on every Layer, or only on Look and Visual
   Layers: recommended on every Layer, Groups included, because a Group's
   envelope is a submaster fade.
3. Move in Black always on, or a Scene switch: recommended always on; a Scene
   where a dark fixture should visibly travel is hard to imagine.
4. Whether `next` and `previous` wrap: recommended no.
