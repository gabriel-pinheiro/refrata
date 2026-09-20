# Refrata

Refrata is a layer-based DMX lighting controller for live performance: one
runtime holds an Installation, a browser Studio composes it as Scenes of
Layers over fixtures, and a show-control hub such as Chataigne performs it
over OSC. Fixtures are trees of Elements with typed Parameters, and DMX
channels disappear the moment a fixture is patched. Everything a control
surface can move is an Address, everything that changes the Installation is a
command, and the runtime is the one source of truth.

It shares its shell with [Difracta](https://github.com/gabriel-pinheiro/difracta),
a projection-mapping engine built the same way.

## Status

After slice 5 the Catalog grew by eight Visuals: Strobe, Shutter and Pump
for electronic music, Meter, Counter, Timer, Reveal and Roulette for game
show stages. A Visual may now name the Blend Mode a new Layer of it starts
with; Shutter and Pump ask for Multiply.

Slice 5 of the build, "the hub": the OSC door carries Controllers and Macros
only, as Difracta's does, a Macro takes any Address from Studio's picker
(Scene play, Layer Addresses, Cues), and "Make a Macro" on a Scene or a Cue
makes the one a hub's pad needs.

Slice 4, "Visuals", underneath: Visual Layers running a Visual from the
Catalog (LFO, Shimmer, Chase, Rainbow, Static Number, Static Color, Circle)
over their Targets, stepped by the Runtime at Output rate; Slots bound to
Attributes with a range; Visual Parameters as linkable Addresses; Cues; the
Spread switch per Target. The CLI gained `visuals`, `layers add --visual`,
`layers visual`, `layers param`, `layers bind`, `cue` and `macros add`.

Slice 3, "parts and rules", underneath, on top of slice 2's composition.
Tags on Elements: declared by Modes, every Element key, the Fixture Type's
key on the root, and a person's own on Fixtures and Elements, normalised as
typed and renamed everywhere at once. Fixture Sets by rule: an ordered list
of Rules, each all of its Tags, matched at the first Element down the tree
where every Tag has been met, resolved live so a newly tagged Fixture joins
and takes what a Look Layer says about the Set; "Convert to list" freezes
one. "Override" on a Set Target's member adds that Element as a Target after
the Set. Spread expansion of a Target (a Set to its members, an Element to
its children) as Rig logic, shown by the CLI. The CLI gained `tags`, `tag`,
`untag`, `sets add --rule`, `sets rules`, `sets convert` and `layers
spread`.

Slice 2, "one Look", underneath: Scenes as ordered stacks of Layers, Look
Layers with rows per Target under "All Targets" rows every Target takes
unless its own overrides, Contributions (alpha stored, read as 1 for now),
the five Blend Modes, Resolve bottom to top from Defaults with fan-down and
the Target rule, Master and Blackout after Resolve, Scene play as a cut,
Layer Addresses linkable to Controllers, one ordered selection across the Rig View and the
navigator with Targets outlined and a picker to fill Layers and Sets, a DMX
Tester holding raw channels over the show, a watched library with a reload
of the Installation's Fixture Type copies, and the CLI's `scenes`, `play`,
`layers`, `look`, `sets`, `master`, `blackout` and `tester`. Slice 1's Rig
(Universes, Enttec-compatible and uDMX USB Outputs, Fixture Types from
`refrata-library/`, Patch, Highlight, Encoding at 40 Hz, the Resolved
Stream) is unchanged underneath. Not yet: Transitions, Layer Fade, Filters.
The design the rest is built against is in `GLOSSARY.md` and `docs/`.

## Read the design

- [GLOSSARY.md](GLOSSARY.md), the canonical terms: wire, library, Rig,
  composition.
- [docs/rig-model.md](docs/rig-model.md), why the Rig terms are what they
  are, with grandMA3 and QLC+ explained for someone who knows neither.
- [docs/layers-model.md](docs/layers-model.md), the stack of Layers stated
  precisely and pressure-tested.
- [docs/visuals-and-links.md](docs/visuals-and-links.md), Visuals against
  kinds, Slots and Slot Bindings, the stack versus the link graph, the Look
  Layer.
- [docs/moving-heads-and-geometry.md](docs/moving-heads-and-geometry.md), a
  mover walked through the model, and the road to positions.
- [docs/transitions.md](docs/transitions.md), Scene crossfades, Move in
  Black and Layer Fade, designed and deferred.
- [docs/comparison-walkthrough.md](docs/comparison-walkthrough.md), one look
  built here, in grandMA3 and in QLC+.
- [docs/fixture-sources.md](docs/fixture-sources.md), how Open Fixture
  Library, GDTF and QLC+ definitions map onto Modes.
- [docs/fixture-type-format.md](docs/fixture-type-format.md), the JSON shape
  of a hand-authored Fixture Type and the Encoding primitives.
- [docs/rig-view.md](docs/rig-view.md), the schematic front view of the rig
  in Studio, Positions and Shape Templates.

## Run locally

Node 24.

```sh
npm install
npm run dev
```

`npm run dev` starts the runtime on port 4900 and Studio on 4901. Open Studio
at http://localhost:4901/.

## Production

```sh
npm run build
node refrata-runtime/bin/refrata-runtime.mjs <file.refrata>
```

The runtime serves the built Studio at `/studio/` (the root redirects there),
a `/health` JSON endpoint and the live WebSocket at `/live`. It opens the file
given on the command line, at most one, and holds one Installation at a time.
Autosaves land next to the file and are recovered on the next open.

Flags and their environment variables (`refrata-runtime/src/config.ts`):

| Flag                   | Variable               | Default               |
| ---------------------- | ---------------------- | --------------------- |
| `--host <address>`     | `REFRATA_HOST`         | `0.0.0.0`             |
| `--port <number>`      | `REFRATA_PORT`         | `4900`                |
| `--projects-dir <dir>` | `REFRATA_PROJECTS_DIR` | `~/Refrata`           |
| `--osc-port <number>`  | `REFRATA_OSC_PORT`     | `9100`                |
| `--no-osc`             | `REFRATA_NO_OSC=1`     | OSC on                |
|                        | `REFRATA_STUDIO_DIST`  | `refrata-studio/dist` |

## Show control

The runtime speaks OSC over UDP and OSCQuery over HTTP and WebSocket on one
port, 9100 by default, and announces itself with Zeroconf as `_oscjson._tcp`
and `_osc._udp` under the name "Refrata on <hostname>", so a hub such as
Chataigne finds it and reconnects to it whatever Installation is open.

The OSC tree is what Difracta's is: one leaf per Controller at
`/controller/<id>` and one per Macro at `/macro/<id>`, and the door refuses
every other path. A fader reaches a value through a Controller linked to it
(a Layer's opacity, a Look Layer row, a Visual Parameter, Master); a button
reaches anything else through a Macro (Scene play, a Cue, Blackout, a
Layer's `enabled`), and a held pad is two Macros, one at press and one at
release. "Make a Macro" on a Scene's or a Cue button's menu, or `refrata
macros add "Play Chorus" --trigger scene/Chorus/play`, makes the Macro a pad
needs. Paths carry ids, so a rename never breaks a mapping; the name, with
its Group, is the leaf's description. Controller values stream back to the
clients that asked to LISTEN.

## Working from a shell

```sh
node refrata-cli/bin/refrata.mjs --help
```

The CLI is a client of the same runtime as Studio. Every Studio gesture is a
command or a request, so `refrata run <command>` and `refrata documents`
reach all of them.

## Quality

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```
