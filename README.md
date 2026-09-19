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

Slice 3 of the build, "parts and rules", on top of slice 2's composition.
Tags on Elements: declared by Modes, every Element key, the Fixture Type's
key on the root, and a person's own on Fixtures and Elements, normalised as
typed and renamed everywhere at once. Fixture Sets by rule: an ordered list
of Rules, each all of its Tags, matched at the first Element down the tree
where every Tag has been met, resolved live so a newly tagged Fixture joins
and takes what a Look Layer says about the Set; "Convert to list" freezes
one. "Override" on a Set Target's member adds that Element as a Target after
the Set. Spread expansion of a Target (a Set to its members, an Element to
its children) as Rig logic, shown by the CLI, with no Studio control until
Visuals. The CLI gained `tags`, `tag`, `untag`, `sets add --rule`, `sets
rules`, `sets convert` and `layers spread`.

Slice 2, "one Look", underneath: Scenes as ordered stacks of Layers, Look
Layers with rows per Target under "All Targets" rows every Target takes
unless its own overrides, Contributions (alpha stored, read as 1 for now),
the five Blend Modes, Resolve bottom to top from Defaults with fan-down and
the Target rule, Master and Blackout after Resolve, Scene play as a cut,
Layer Addresses linkable to Controllers, the OSC tree carrying Scenes,
Master and Layer leaves, one ordered selection across the Rig View and the
navigator with Targets outlined and a picker to fill Layers and Sets, a DMX
Tester holding raw channels over the show, a watched library with a reload
of the Installation's Fixture Type copies, and the CLI's `scenes`, `play`,
`layers`, `look`, `sets`, `master`, `blackout` and `tester`. Slice 1's Rig
(Universes, Enttec-compatible and uDMX USB Outputs, Fixture Types from
`refrata-library/`, Patch, Highlight, Encoding at 40 Hz, the Resolved
Stream) is unchanged underneath. Not yet: Transitions, Layer Fade, Visuals.
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

The OSC tree has one leaf per Controller at `/controller/<id>`, one per
Macro at `/macro/<id>`, one per Scene at `/scene/<id>/play`, the grand
master at `/installation/master`, and every Layer's `opacity`, `enabled`
and Look Layer rows under `/layer/<id>/row/…` (a Target's or the All
Targets `…/<attribute>/value`). Paths carry ids, so a rename never breaks
a mapping; the name is the leaf's description.

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
