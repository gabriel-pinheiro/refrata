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

  Read       health, library, fixtures, controllers, macros, osc,
             get [path|Address], addresses, commands, describe <command>
             (its payload fields; --json for the schema), dmx <universe>
             (the 512 bytes going out, runs grouped as <Nx value>).

  Rig        fixtures add <typeKey> <modeKey> [--name] [--universe]
             [--address] [--unpatched]  copies the type in and patches at
             the next free address.  patch <fixture> <universe> <address>.
             highlight <fixture>[/<element>] [--on|--off]  lights it at its
             Highlight values (${String(settings.cli.highlightHoldMs / 1000)} s unless held). Elements are
             <fixtureId>/<key>, listed by "fixtures".

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
             installation/blackout            element/<fixture>/<key>/highlight
             ("addresses" lists them all)

  Values     true/false, numbers, choice values as text, colours as
             [r,g,b,a] with each component from 0 to 1.

  Recipe     fixtures add generic/rgb-3ch 3ch --name Par
             highlight Par
             dmx "Universe 1"
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
