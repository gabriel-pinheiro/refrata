import { settings } from "@refrata/core";

/**
 * The guide printed after the command list: enough for an agent at a shell
 * to connect, read the Installation, change it and know what came back.
 */
export const SHELL_GUIDE = `
Working from a shell

  Connect    The runtime serves its live socket at ws://<host>:${String(settings.runtime.port)}${settings.runtime.livePath}.
             --url takes that, http://<host>:${String(settings.runtime.port)} or <host>:${String(settings.runtime.port)};
             REFRATA_URL sets the default. REFRATA_ACTOR names the owner of
             this shell's undo history (default: user@host).

  Read       health, library, fixtures, tags, sets, scenes, layers <scene>,
             visuals [id] (the Catalog, or one Visual of it),
             controllers, macros, osc, get [path|Address], addresses,
             commands, describe <command> (its payload fields; --json for
             the schema), dmx <universe> (the 512 bytes going out, runs
             grouped as <Nx value>), master.

  Rig        fixtures add <typeKey> <modeKey> [--name] [--universe]
             [--address] [--unpatched]  copies the type in and patches at
             the next free address.  patch <fixture> <universe> <address>.
             fixtures reload [type|fixture]  takes the library's current
             file for a held type, or every held type, as one undo step;
             "library" marks copies that differ.
             highlight <fixture>[/<element>] [--on|--off]  lights it at its
             Highlight values (${String(settings.cli.highlightHoldMs / 1000)} s unless held). Elements are
             <fixtureId>/<key>, listed by "fixtures".
             tester <universe> <address> <byte...>  holds raw channels at
             those bytes for ${String(settings.cli.testerHoldMs / 1000)} s (--hold <s>; 0 keeps them until the
             runtime's ${String(settings.tester.timeoutMs / 1000)} s timeout) to learn what a device does before
             it has a Fixture Type; tester release lets go. Never saved;
             Blackout wins.

  Tags       tag <fixture>[/<key>] <tag...>  adds a person's Tags to a
             Fixture (its root Element) or to one Element; untag removes
             them; tags lists every Tag with its count; tags rename <old>
             <new> rewrites Fixtures, Elements and Rules in one undo step.
             Tags are lowercase with dashes ("Truss Left" is written
             truss-left). Declared Tags are locked: an Element's key, its
             Mode's Tags (panel, odd, bottom) and, on a root, the Fixture
             Type key. "fixtures" prints them per Element, a person's
             after a +.

  Compose    scenes add <name>  a Scene; the first one starts playing.
             layers add <scene> <name> [--target <t>]...  a Look Layer at
             the top of the Scene's stack. A Target <t> is a Fixture (its
             root), <fixture>/<key> (one Element) or set:<set>.
             look <layer> set <target> <attribute> <value>  sets a row
             (dimmer 0.4, color '[0,1,0,1]', shutter closed); <target> "all"
             is the All Targets row every Target takes unless it has its
             own. look <layer> release <target> <attribute> lets it go.
             sets add <name> <ref>...  a Fixture Set of Elements, in order.
             sets add <name> --rule panel,odd --rule wall  a Set by rule,
             resolved live: a Rule is all of its Tags, and its member is
             the first Element down each Fixture's tree where every Tag
             has been met on it or above it (truss-left alone gives tagged
             roots; panel,truss-left their Panels; --rule "" every
             Fixture). The Set is its Rules' union, Rule by Rule, in
             navigator order within a Rule; a member under another member
             is dropped. sets rules <set> add|set|move|remove edits Rules
             by number; sets convert <set> freezes it into a list.
             layers spread <layer> <target> on|off  spreads a Target (a Set
             into its members, an Element into its children); "layers"
             prints the expansion. A Look Layer ignores it.
             play <scene> cuts the Outputs to it; master <0..1> scales every
             dimmer; blackout on|off forces them to 0. play and blackout are
             show control (never undone); the rest is authoring.

  Visuals    layers add <scene> <name> --visual <id> [--target <t>]...  a
             Visual Layer running one Visual of the Catalog (lfo, shimmer,
             chase, strobe, shutter, pump, rainbow, static-number,
             static-color, circle, meter, counter, timer, reveal, roulette)
             over its Targets, with the Visual's default Parameters,
             bindings and Blend Mode (shutter and pump start on multiply).
             A Visual sees its Targets in order, a Set in the Set's order;
             a Target arrives not spread, and "layers" warns when a Chase
             or a Rainbow has one Target: spread it to step through it.
             layers param <layer> <name> <value>  sets a Visual Parameter
             (rate 2, order bounce, color '[1,1,1,1]'); rates are in Hz.
             layers bind <layer> <slot> <attribute|none> [--from x --to y]
             binds a Slot to an Attribute; --from and --to are what a
             number Slot's 0 and 1 become in the Attribute's units (they
             calibrate to the fixtures and are not Addresses). Shimmer and
             Chase have a color and a level Slot, either or both bound.
             layers visual <layer> <id>  changes the Visual; Parameters
             and bindings start over.
             cue <layer> <key>  fires a Cue (chase: step, restart; shimmer:
             fire; counter: add, remove, reset; reveal: reveal, hide;
             "visuals <id>" lists the rest). Show control, never undone;
             a Layer outside the playing Scene has no running Visual and
             drops it. Playing the playing Scene again restarts every
             Visual in it.

  Hub        osc  lists what a hub such as Chataigne sees: one leaf per
             Controller and one per Macro, nothing else. A fader is a
             Controller linked to a value (link); a button is a Macro.
             macros add <name> --trigger scene/Chorus/play  makes the Macro
             a pad needs; --trigger layer/Chase/cue/step fires a Cue. A held
             pad is two Macros, one at press and one at release.

  Write      run <command> [json]  any command; ids come back in "created".
             edit <Address> <value>  authoring change, undoable.
             set <Address> <value>   show control, never undone.
             trigger <Address...>    a Macro's run.
             link, unlink, undo, redo.

  Save       Authoring (run, edit, link, undo) changes the open Installation
             in memory; "documents save" writes it, and "health" says
             "unsaved changes" until then. set and trigger are never saved.

  Order      A create lands first in its Group. Pass "after": <sibling
             id|name> to place it below that sibling, or null for first;
             entity.move, controller.move and macro.move rearrange.

  Names      Wherever an Address or a payload field takes an entity id, its
             name works too: controller/Energy/value, '{"macroId":"Hit"}'.
             Names match ignoring case and must be unique in their table; an
             id always wins over a name. Replies and listings carry ids.

  Addresses  controller/<id|name>/value       macro/<id|name>/run
             installation/blackout            installation/master
             scene/<id|name>/play             element/<fixture>/<key>/highlight
             layer/<id|name>/opacity          layer/<id|name>/enabled
             layer/<id|name>/row/<target|all>/<attribute>
             layer/<id|name>/param/<name>     layer/<id|name>/cue/<key>
             (a row's <target> is written as in "look"; "addresses" lists
             them all; link, edit and set take any of them)

  Values     true/false, numbers, choice values as text, colours as
             [r,g,b,a] with each component from 0 to 1.

  Recipe     fixtures add generic/rgb-3ch 3ch --name Par
             highlight Par
             scenes add Verse
             layers add Verse Base --target Par
             look Base set Par dimmer 0.4
             look Base set Par color '[0,1,0,1]'
             tag Par wall
             sets add Wall --rule wall
             layers add Verse Wash --target set:Wall
             layers add Verse Breathe --visual lfo --target set:Wall
             layers bind Breathe value dimmer --from 0.2 --to 0.6
             layers param Breathe rate 0.25
             play Verse
             cue Breathe sync
             dmx "Universe 1"
             run controller.create '{"kind":"number","name":"Fader",
                 "addresses":["layer/Base/row/Par/dimmer"]}'
             run controller.create '{"kind":"number","name":"Energy"}'
             set controller/Energy/value 0.5
             run macro.create '{"name":"Hit"}'
             run macro.actions.add '{"macroId":"Hit","actions":[
                 {"kind":"toggle","address":"installation/blackout"}]}'
             trigger macro/Hit/run

  --json     Every command prints one JSON value; a create's reply has
             created: [{table, id}]. Errors are one JSON object on stderr,
             {"error", "issues"?}, with exit code 1.
`;
