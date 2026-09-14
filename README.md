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

Slice 1 of the build, "light one fixture": the Rig exists end to end.
Universes, one Enttec-compatible USB Output kind over serial (Open DMX and
DMX USB Pro drivers, hardware still to be verified), Fixture Types as JSON
files in `refrata-library/` copied into the Installation on use, Fixtures
with derived Element trees, Patch with overlap refused, Defaults and a held
Highlight, Resolve and Encoding at 40 Hz into one DMX Frame per Universe, a
Resolved Stream to Studio, the Rig View, and the CLI's `library`,
`fixtures`, `patch`, `highlight` and `dmx`. There are no Layers yet, so the
only light is Highlight. The design the rest is built against is in
`GLOSSARY.md` and `docs/`.

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

The OSC tree has one leaf per Controller at `/controller/<id>` and one per
Macro at `/macro/<id>`. Paths carry ids, so a rename never breaks a mapping;
the name is the leaf's description.

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
