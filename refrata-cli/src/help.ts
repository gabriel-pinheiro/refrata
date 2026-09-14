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

  Read       health, library, fixtures, sets, scenes, layers <scene>,
             controllers, macros, osc, get [path|Address], addresses,
             commands, describe <command> (its payload fields; --json for
             the schema), dmx <universe> (the 512 bytes going out, runs
             grouped as <Nx value>), master.

  Rig        fixtures add <typeKey> <modeKey> [--name] [--universe]
             [--address] [--unpatched]  copies the type in and patches at
             the next free address.  patch <fixture> <universe> <address>.
             highlight <fixture>[/<element>] [--on|--off]  lights it at its
             Highlight values (${String(settings.cli.highlightHoldMs / 1000)} s unless held). Elements are
             <fixtureId>/<key>, listed by "fixtures".

  Compose    scenes add <name>  a Scene; the first one starts playing.
             layers add <scene> <name> [--target <t>]...  a Look Layer at
             the top of the Scene's stack. A Target <t> is a Fixture (its
             root), <fixture>/<key> (one Element) or set:<set>.
             look <layer> set <target> <attribute> <value>  sets a row
             (dimmer 0.4, color '[0,1,0,1]', shutter closed); <target> "all"
             is the All Targets row every Target takes unless it has its
             own. look <layer> release <target> <attribute> lets it go.
             sets add <name> <ref>...  a Fixture Set of Elements, in order.
             play <scene> cuts the Outputs to it; master <0..1> scales every
             dimmer; blackout on|off forces them to 0. play and blackout are
             show control (never undone); the rest is authoring.

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
             play Verse
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
