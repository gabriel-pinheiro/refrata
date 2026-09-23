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
Catalog (LFO, Shimmer, Chase, Rainbow, Static Number, Static Color, Figure)
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
Tester holding raw channels over the show, a Universe View of one Universe's
addresses with what is patched over each and the bytes going out, a watched library with a reload
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

## Install

Refrata Desktop is on the repository's
[Releases](https://github.com/gabriel-pinheiro/refrata/releases) page. The
packages are not signed, so each operating system asks once before it runs
one.

**Linux**: `Refrata-<version>-x86_64.AppImage`, or
`Refrata-<version>-arm64.AppImage` for a 64-bit ARM computer. Make it
executable and run it:

```sh
chmod +x Refrata-*-x86_64.AppImage
./Refrata-*-x86_64.AppImage
```

An AppImage mounts itself with FUSE 2; Ubuntu 24.04 and later lack it until
`sudo apt install libfuse2t64` (`libfuse2` on older releases). Where the
kernel keeps Chromium's sandbox from running (Ubuntu 23.10 and later), the
AppImage starts without it by itself.

To open a USB DMX widget without root, install the udev rules in
[`refrata-desktop/linux/99-refrata.rules`](refrata-desktop/linux/99-refrata.rules)
(Enttec DMX USB Pro and its FTDI clones, `0403:6001`; uDMX, `16c0:05dc`) and
add yourself to the `dialout` and `plugdev` groups, then log out and in again.
An AppImage cannot install anything outside itself, but it carries the rules
file: `./Refrata-*-x86_64.AppImage --appimage-extract resources/99-refrata.rules`
puts it at `squashfs-root/resources/99-refrata.rules`.

```sh
sudo cp 99-refrata.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
sudo usermod -aG dialout,plugdev "$USER"
```

**macOS**: `Refrata-<version>-arm64.dmg` for Apple silicon,
`Refrata-<version>-x64.dmg` for an Intel Mac. Drag Refrata to Applications.
macOS refuses an unsigned app the first time: right-click it and choose Open,
or, where macOS no longer offers that (macOS 15 and later), allow it under
System Settings ▸ Privacy & Security ▸ Open Anyway. If macOS says the app is
damaged, clear the quarantine it put on the download:
`xattr -cr /Applications/Refrata.app`.

**Windows**: `Refrata-Setup-<version>.exe` installs Refrata for your user, in
a folder you choose, without asking for an administrator. SmartScreen stops an
unsigned installer: More info ▸ Run anyway.

Desktop keeps what it remembers (where Studio came from last time, the
runtimes connected to before, Start Without Studio Window) in its user data
folder: `~/.config/Refrata` on Linux, `~/Library/Application Support/Refrata`
on macOS, `%APPDATA%\Refrata` on Windows. A Desktop run from a checkout uses
the same folder. Help ▸ Show Runtime Log shows where the runtime's log is.

## Run locally

Node 24.

```sh
npm install
npm run dev
```

`npm run dev` starts the runtime on port 4900 and Studio on 4901. The runtime
holds `research/dev.refrata`, created on first run;
`REFRATA_FILE=<path> npm run dev` holds another file. Open Studio at
http://localhost:4901/.

## Desktop

```sh
npm run desktop                     # the launch page first, then whatever was chosen last time
npm run desktop -- show.refrata     # opens that file on this computer
npm run desktop -- --no-studio      # the runtime on this computer, with nothing on screen
```

Refrata Desktop is the Electron application (`refrata-desktop`). Its launch
page asks once where Studio should come from, and later launches resume that
choice. File ▸ Connect to... in the menu bar opens the page again over what is
running, and nothing stops until another target is chosen there. Studio's File
and Edit menus are in the native menu bar, and the window title names the
Installation and its file, or the runtime it is open in.

- **Run on this computer** starts a runtime of Desktop's own on port 4900 with
  `--documents free`, shows its Studio in a window, and opens and saves
  Installations with the operating system's file dialogs. Its Outputs are
  driven from this computer. Opening a `.refrata` file always does this.
- **Connect to a Runtime** shows the Studio of a runtime that is already
  running, such as a mini-PC's next to the DMX interfaces: pick it from the list of
  runtimes found on the network, or type `host`, `host:port` or a URL when the
  network hides them. Runtimes connected to before stay listed. The
  Installation and its Outputs stay on that machine, so there are no file
  dialogs and closing the window asks nothing.

A venue's mini-PC runs Desktop as an appliance next to the DMX interfaces,
reached from a laptop whose Desktop connects to it. Two checkboxes under
File ▸ Startup set that up, and both apply from the next start:

| Setting                     | Flag                         | What it does                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start Without Studio Window | `--no-studio` for one launch | Local mode starts the runtime and shows nothing. The runtime listens on every interface, is announced on the network and drives its Outputs as always. Starting Refrata again while it runs shows Studio; closing that window leaves the runtime running, and File ▸ Quit quits. In remote mode the flag is ignored.                                                                     |
| Start at Login              |                              | The operating system starts Desktop at login: a login item on macOS and Windows, `~/.config/autostart/refrata-desktop.desktop` on Linux. From an AppImage that entry starts the AppImage file, so keep it where it is or turn the setting off and on again after moving it. The checkbox shows what the operating system has, so it is right after the entry was removed by other means. |

Leaving the runtime on this computer (quitting, closing Studio, choosing another
target under Connect to...) asks about unsaved changes first, and then warns
when Outputs are delivering from it, since they stop with the runtime: "2
Outputs are delivering DMX from this computer. Quitting stops them." It only
warns. Stopped by SIGTERM or the end of the OS session with no window open,
Desktop asks nothing and stops the runtime cleanly, unsaved changes autosaved.

If the runtime crashes or the OS kills it, Desktop starts it again with the
Installation that was open; the autosave brings unsaved changes back, the new
runtime opens the Installation's Outputs again, and Studio and the CLI
reconnect by themselves. An Installation that was never saved has no autosave
to come back from. Three restarts within a minute and Desktop stops trying and
says where `runtime.log` is.

The script builds Studio and Desktop, then launches the build; stop
`npm run dev` first, since both want port 4900, or move Desktop with
`REFRATA_PORT` (or connect Desktop to the dev runtime instead of running one).
To work on Studio inside Desktop with hot reload, keep `npm run dev` running and
start `npm run desktop -- --studio-url http://127.0.0.1:4901/studio/`: Desktop
forks no runtime and treats that dev server as this computer's Studio. The build
carries the runtime's native modules (`serialport`, `usb`) and the Fixture
Library next to the bundled runtime, so the USB DMX widgets work as they do from
a checkout; `REFRATA_LIBRARY_DIR` points Desktop at a Fixture Library of your
own. The runtime's log is under Help ▸ Show Runtime Log. On a Linux that
restricts unprivileged user namespaces (Ubuntu 23.10 and later) the script
explains how to give Electron its sandbox helper, or to run this development
build with `-- --no-sandbox`.

`npm run package:desktop` builds Studio and Desktop and packages them for the
operating system it runs on, into `refrata-desktop/release/`: both AppImages
on Linux, both dmgs on macOS, the installer on Windows
(`refrata-desktop/electron-builder.yml`). The packages carry package.json's
version unless given one: `npm run package:desktop -- -c.extraMetadata.version=1.2.3`.
`.github/workflows/release.yml` does this on each OS for every push to `main`
and every tag `v*`, and a tag becomes a GitHub Release with the packages
attached.

## Production

```sh
npm run build
node refrata-runtime/bin/refrata-runtime.mjs <file.refrata>
```

The runtime serves the built Studio at `/studio/` (the root redirects there),
a `/health` JSON endpoint, the open Installation as a file at `/document` and
the live WebSocket at `/live`. It holds the file given on the command line or in
`REFRATA_FILE`, creating it when it does not exist, and refuses to start without
one. Autosaves land next to the file and are recovered on the next open.

Started like this the runtime is **pinned**: clients save and revert its
Installation but cannot create, open or close one, nor save it to another path.
`--documents free` lifts that for clients on the runtime's own machine, and
makes the file optional; clients elsewhere on the network stay pinned.

In both modes any client can download a copy of the Installation
(`refrata documents download`, Studio's File menu, or `GET /document`) and
replace its content from a file of their own
(`refrata documents replace <file>`, or `PUT /document`). The replaced
Installation has unsaved changes until someone saves, and reverting brings the
saved one back.

Flags and their environment variables (`refrata-runtime/src/config.ts`):

| Flag                  | Variable                 | Default               |
| --------------------- | ------------------------ | --------------------- |
| `--host <address>`    | `REFRATA_HOST`           | `0.0.0.0`             |
| `--port <number>`     | `REFRATA_PORT`           | `4900`                |
| `<file.refrata>`      | `REFRATA_FILE`           | required when pinned  |
| `--documents <mode>`  |                          | `pinned`              |
| `--osc-port <number>` | `REFRATA_OSC_PORT`       | `9100`                |
| `--no-osc`            | `REFRATA_NO_OSC=1`       | OSC on                |
| `--no-discovery`      | `REFRATA_NO_DISCOVERY=1` | announced             |
|                       | `REFRATA_STUDIO_DIST`    | `refrata-studio/dist` |
|                       | `REFRATA_LIBRARY_DIR`    | `refrata-library`     |

File paths in requests are absolute paths on the runtime's machine; the CLI
resolves a relative one against the shell's directory first.

The runtime announces itself on the local network with Zeroconf as
`_refrata._tcp`, named "Refrata on <hostname>", with its version and the open
Installation's name. `refrata runtimes` lists the ones that answer, with the
address to pass to `--url`; `--no-discovery` keeps a runtime out of the list,
and one bound to a loopback `--host` (`127.0.0.1`, `::1`, `localhost`) is never
announced, as nothing on the network could reach it.

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
npm run check   # npm test, npm run typecheck, npm run lint, npm run format:check, in parallel
npm run build
```

Typecheck is incremental (`*.tsbuildinfo`) and lint and format are cached
(`node_modules/.cache/`), so a second run costs seconds.

`npm run test:desktop` launches the built Desktop through Playwright and needs
a display; run `npm run build` first. To keep its windows off your screen, or
without a screen, run it under Xvfb:
`env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 xvfb-run -a npm run test:desktop`.
With `WAYLAND_DISPLAY` set Electron would open its windows on the real Wayland
session; the suite drops it by itself inside `xvfb-run`, and the long form says
the same by hand. The suite never opens a DMX widget: its Outputs name a
widget no computer has, and where a test needs Outputs that are delivering it
sets `REFRATA_TEST_DELIVERING_OUTPUTS` to their number, which only a Desktop
run from a checkout reads.

The same suite drives a packaged Desktop when `REFRATA_DESKTOP_EXECUTABLE`
names its executable, such as the AppImage `npm run package:desktop` wrote:
`REFRATA_DESKTOP_EXECUTABLE=$PWD/refrata-desktop/release/Refrata-0.1.0-x86_64.AppImage xvfb-run -a npm run test:desktop`.
The test that needs delivering Outputs is skipped there, since a package
ignores that variable. CI (`.github/workflows/ci.yml`) runs every check above
on each push and pull request, and the release workflow runs the suite against
the x86_64 AppImage it packaged.
