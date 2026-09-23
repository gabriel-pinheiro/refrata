# One look, three ways

The same small show built here, in grandMA3 and in QLC+, to make the
difference in thinking concrete. The look: three Atomics with eight RGB Aura
Panels each. All Panels sit at a dim green. Individual Panels shimmer white
now and then. An LFO breathes the Panels' dimmer. The whole thing fades in
over five seconds when the song starts. Facts about the two consoles are from
their manuals; where a console has several ways, the usual one is shown.

## Here

Rig: patch three Atomics in the zoned Mode; the Mode gives each a `Backlight`
Element with eight `Panel` Elements tagged `panel`. Fixture Set `Aura Panels`
by rule: Tag `panel`. Nothing else.

Scene `Verse`, bottom to top:

| Layer     | Kind   | Targets               | What it says                                                              |
| --------- | ------ | --------------------- | ------------------------------------------------------------------------- |
| `Base`    | Look   | `Aura Panels`         | `color` dim green α 1, `dimmer` 0.4 α 1                                   |
| `Breathe` | Visual | `Aura Panels`         | LFO, Slot bound to `dimmer`, anchors 0.2..0.6, blend normal               |
| `Shimmer` | Visual | `Aura Panels`, spread | Shimmer, colour white; writes white with a rising and falling α per Panel |

The fade-in is `Base` with a Layer Fade of 5 s, enabled by a Macro.
Chataigne: a Macro `song-start` enables `Base`; a Controller on `Shimmer`'s
opacity is the fader that brings the shimmer in and out. Change `Base` to blue and the shimmer
still flashes white over blue, because it never said anything about green.

Three Layers, one Set, one rule. Nothing restates anything.

## grandMA3

grandMA3 works in a _programmer_: you select fixtures, dial values, and store
them into objects (cues in a sequence, presets), then play sequences from
_executors_ (faders and buttons). Effects are _phasers_: attribute values that
step through several states over time.

1. **Patch.** Import the Atomic fixture type from the library or a GDTF file
   and patch three. If the type's geometry declares the Panels, each Atomic
   appears with sub-fixtures `1.1` to `1.8`.
2. **Group.** Select `Fixture 1.1 Thru 1.8 + 2.1 Thru 2.8 + 3.1 Thru 3.8`
   and store `Group 1 "Aura Panels"`. A group is a stored selection.
3. **Base look.** Select the group, `At 40` for dimmer, pick green in the
   colour picker. The programmer now holds those values. `Store Cue 1` of
   `Sequence 1`; the sequence's cue fade time (say 5 s) is the fade-in. Clear
   the programmer. Assign the sequence to executor 1: its fader is the
   playback's master, its button is Go.
4. **Shimmer.** There is no shimmer object. Build a phaser on the group's
   colour: step 1 green, step 2 white, with a narrow width for the white step
   and a phase spread across the selection so Panels do not flash together;
   the Random generator (added in 2.x) can vary the timing. Store it in its own
   sequence on executor 2 so it can run over cue 1. Colour merges LTP (latest
   takes precedence), so the phaser takes the colour of those Panels entirely.
   That is why step 1 must itself be green: the base cue's green is not
   showing through, it is replaced. Change the base to blue later and the
   phaser still flashes green to white until you edit the phaser too.
5. **LFO.** Another phaser, on dimmer, two steps at 20 and 60 with
   transition and acceleration set for a sine feel, on executor 3. Dimmer
   merges HTP (highest takes precedence) between executors by default, so
   with cue 1 holding 40 the breathing shows only above 40 unless the
   executor is switched to LTP or the phaser lives inside cue 1.
6. **Fade in.** Cue timing, step 3. No object needed.
7. **Playback.** Executors on the console or on an external OSC/MIDI surface.

Roughly: patch, one group, one cue, two phasers, three executors, and every
effect restating the base value it sits on.

## QLC+

QLC+ works in _functions_: Scenes hold channel values, Chasers and Sequences
step through them, EFX draws movement paths, RGB Matrix paints heads, and a
_Virtual Console_ of buttons and sliders runs them. Channels merge HTP for
intensity and LTP for everything else.

1. **Fixtures.** Fixture Manager, add the Atomic from the library three times
   with universe and address. If the `.qxf` defines heads for the Panels,
   each fixture shows eight heads. Create a Fixture Group `Aura Panels` and
   place the 24 heads on its grid; the grid is what RGB Matrix paints.
2. **Base look.** Function Manager, new Scene, add the three fixtures, enable
   the Aura dimmer and red, green and blue channels of every Panel, set 40 %
   and green with the colour tool (which writes the three channels). Fade in
   5 s on the Scene is the fade-in.
3. **Shimmer.** No shimmer algorithm ships. Options: an RGB Matrix on the
   group running a custom RGB Script (ECMAScript producing frames with random
   white pixels on a green background), or a Chaser stepping between green and
   white Scenes, which flashes uniformly. The matrix paints every head it owns
   every frame, so it owns the look: the green background is drawn by the
   script, not seen through from the Scene. Recent versions add a blend mode
   to RGB Matrix (additive, mask) that lets it combine with running functions,
   which is a partial layer.
4. **LFO.** Recent versions let an EFX drive dimmer along a path; otherwise a
   Sequence of dimmer steps. Intensity merges HTP, so the Scene's 40 % is a
   floor under the LFO, as in grandMA3.
5. **Fade in.** Scene fade-in, step 2; or a Virtual Console slider driving
   the Scene's intensity.
6. **Playback.** Virtual Console: a button per function, a slider as
   submaster, a Cue List widget for ordered playback; external OSC or MIDI
   mapped to widgets through input profiles. Switch from Design to Operate
   mode to run it.

Roughly: three fixtures, one group with a grid, one scene, one script or
chaser, one EFX, a Virtual Console page.

## What the walkthrough shows

- **Restating versus showing through.** Both consoles merge by rule, HTP for
  intensity and LTP for the rest, with no transparency. An effect owns an
  attribute completely, so it must restate the base value it decorates, and
  editing the base does not update the effect. Here the shimmer is white with
  an alpha over whatever is below.
- **Where the effect lives.** grandMA3's phaser and QLC+'s RGB Script are
  both small programs; the phaser is data with few knobs, the script is code
  bound to a pixel grid. A Visual is code with declared Slots and Parameters,
  bound to any Attribute, over any Target, and an agent can write one.
- **HTP as a floor.** The dimmer LFO over a 40 % base shows why the stack is
  explicit here: on a console the base is a floor under the effect by default,
  and making it not so is a setting on the playback. Here order and blend
  mode say it, and `max` is there for whoever wants the floor.
- **Who owns time.** Both consoles put the fade-in on the cue or scene. Here
  it is the Layer Fade of the Layer that arrives, docs/transitions.md, or a
  hub riding a Layer's opacity.
- **Who owns playback.** Both consoles are the surface. Here the surface is
  Chataigne or any OSC hub, and Layer opacity is the fader it holds.
- **Size of the model.** grandMA3 needed group, cue, sequence, executor,
  phaser, step, phase, generator, HTP/LTP and the programmer to build this.
  QLC+ needed scene, fixture group, RGB Matrix, RGB Script, EFX, Virtual
  Console, HTP/LTP. Here: Set, Look Layer, Visual Layer, alpha, blend mode.
