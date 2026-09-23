# Agent guidance

Refrata is a layer-based DMX lighting controller: one Runtime holds an
Installation, a web Studio composes it, and a show-control hub such as
Chataigne performs it over OSC. Keep the domain language in `GLOSSARY.md`; do
not introduce near-synonyms.

## Read only what the task needs

- Terms: `GLOSSARY.md`. Read it before naming anything.
- Why the terms are what they are, with grandMA3 and QLC+ explained:
  `docs/`, indexed in `README.md`. These precede the code; where code and doc
  disagree, the doc is the intent and the code is the gap.
- Boundaries and data flow: `docs/ARCHITECTURE.md` once it exists; until
  then Difracta's `docs/ARCHITECTURE.md` describes the shell this repo was
  copied from.
- `research/` is gitignored. Each contributor may use it for their own working
  notes, progress and scratch files; nothing in it is authoritative.

## Rules that keep the codebase cheap to change

- One command per file in `refrata-core/src/commands/`: schema, pure `apply`,
  and its test next to it. Register it with one line in `commands/index.ts`.
  Never add a central switch for a new command.
- Everything a control surface can move is an Address
  (`refrata-core/src/address/`). Add the address; do not add a special case to
  Macros, OSC or the CLI.
- Commands return patches; they never mutate. Performance commands (Blackout,
  Controller values, Scene play and Cues) are `kind: "performance"`:
  replicated, not undoable, not dirtying.
- Element Parameters are reached only through the stack (Layers over
  Targets). Never link a Controller or write an Address straight onto a
  fixture's Parameter; that is a Look Layer row with a Link.
- A Visual lives in `refrata-core/src/visuals/`, one file each, registered
  with one line in `catalog.ts`. It is written against kinds: it sees `dt`,
  its Parameter Values and its Targets as key, index and count, never a
  fixture, a Tag or a Position. Only the Runtime constructs a `VisualPlayer`.
- Channels exist only inside a Mode's Encoding. Nothing above
  `refrata-core/src/rig/` may mention a DMX channel or a byte.
- Tunables (history limits, autosave delay, ports, timeouts, output rate) live
  in `refrata-core/src/settings.ts`. Do not scatter magic numbers.
- Files stay under roughly 300 lines. Split by feature folder, not by technical
  layer. No `utils/`, `helpers/`, `types/` dumping grounds.
- Deltas are per property. Never send a whole Installation after the initial
  snapshot.
- Studio is React with per-path subscriptions (`useDocumentPath`), so a control
  re-renders alone. Tailwind plus shadcn on Base UI (`components.json`, style
  `base-mira`). Add primitives with `npx shadcn@latest add <component>` in
  `refrata-studio/`; never hand-write them. Base UI composes with the `render`
  prop, not `asChild`. Studio is dark only.
- Studio entities: each entity kind has one folder under
  `refrata-studio/src/entities/<kind>/` with its navigator section, its
  inspector and anything else it shows, registered in `entities/index.ts`.
  Inspector building blocks live in `src/inspector/fields/` and are shared by
  every kind.
- Strict TypeScript, ESM, `.ts` import specifiers inside Node packages. Accept
  `unknown` at boundaries and validate with Zod.
- A runtime holds one Installation at a time; open and new replace it.
- Runtime is authoritative and is where Resolve and Encoding run. Studio and
  the CLI are clients of the same `@refrata/client`; neither computes output.
- Everything a person can do in Studio must be doable from the CLI. Studio
  gestures are commands and requests, so a new one is reachable through
  `refrata run` or `refrata documents` at once; give the everyday ones a
  shortcut and check `refrata --help` reads well to an agent.
- Desktop has three preload bridges, each for one kind of page, and none grows
  to serve another's. `window.refrataDesktop` (`bridge-contract.ts`) is for the
  local runtime's Studio only and carries only what needs the operating system,
  such as a file dialog; anything else goes through the runtime as a command or
  request, so the CLI can do it too. `window.refrataLaunch`
  (`launch-contract.ts`) is for the launch page (`refrata-studio/src/launch/`),
  which chooses where Desktop goes and imports no client or app shell.
  `window.refrataMenu` (`menu-contract.ts`) goes to every Studio window, remote
  ones too, so it must give the page no power over Desktop: the page describes
  its menu, main validates it with Zod and draws it, and the page hears which
  item was clicked. Never add to it anything a page from another machine should
  not be able to do.
- A Studio menu item is added to the menu model
  (`refrata-studio/src/menu/menu-model.ts`), never to one renderer: the in-page
  bar and Desktop's native menu both draw that model, and `runMenuCommand` is
  the one place an item's id becomes a command. Its shortcut is handled in
  `keyboard/shortcut-keys.tsx` only; menus show it.
- In `refrata-desktop`, keep what is pure apart from what needs Electron: the
  `electron` module only exists inside the app, so a file with unit tests does
  not import it.
- The runtime's native modules (`serialport`, `usb`) stay outside Desktop's
  runtime bundle and are copied next to it by
  `refrata-desktop/scripts/native-modules.mjs`; a new native dependency of the
  runtime is added to that list, and if npm installs its addon as a package
  per platform (as `usb` does), those packages go in `addonPackagesFor` there
  too, or a package for another architecture ships without it. Keep them
  imported on first use, never at the top of a module, so a runtime whose
  addon will not load still starts.
- Comments and docs describe what the code does now. Planned work belongs in a
  contributor's `research/` notes, not in "later" remarks in source.

## Commands

Node 24. `npm run dev` starts the runtime (4900) and the Studio dev server
(4901); OSC and OSCQuery listen on 9100. `npm run check` runs `npm test`,
`npm run typecheck`, `npm run lint` and `npm run format:check` at once, in
parallel; `npm run build` is separate. While iterating, run only what you
touched (`npx vitest run <file>`, `npm run typecheck -w <package>`); run
`npm run check` and, for a Desktop change, `npm run test:desktop` once, before
reporting. Typecheck is incremental and lint and format are cached, so a second
run costs seconds; the caches live in `node_modules/.cache/` and
`*.tsbuildinfo`, and a stale one is never the cause of a failure that a cold
run does not show. `npm run desktop`
builds and launches Refrata Desktop; `npm run test:desktop` drives the built
app through Playwright and needs a display. `npm run package:desktop`
packages Desktop for the current OS into `refrata-desktop/release/`
(`electron-builder.yml`). The CLI is
`node refrata-cli/bin/refrata.mjs` (or `npx refrata` inside the repo).
