# The Fixture Type file

The project's own format for a Fixture Type: the Mode model written down as
JSON, validated with Zod, hand-written today and produced by importers from
slice 7 on. Terms are in [../GLOSSARY.md](../GLOSSARY.md) section 2; where a
type comes from is in [fixture-sources.md](fixture-sources.md). This note is
the shape of the file and the reasons for it.

## Where files live

`refrata-library/<manufacturer>/<model>.json`, loaded by the Runtime at startup,
read again whenever a file under the folder changes, and listed by `refrata
library`. A file is identified by its `key` (`generic/rgb-3ch`,
`generic/atomic-like-panel`). When a Fixture uses a type, the type is copied
into the Installation under that key and dropped again when the last Fixture
using it goes, so an Installation opens the same on another machine. Editing a library
file never changes an Installation by itself: Studio and `refrata library`
say which copies differ, and a reload (`refrata fixtures reload`, or the
buttons on a Fixture and on the Installation) takes the new file as one undo
step.

## The shape

```json
{
  "kind": "refrata-fixture-type",
  "formatVersion": 1,
  "key": "generic/rgb-3ch",
  "manufacturer": "Generic",
  "model": "RGB 3ch",
  "modes": {
    "3ch": {
      "name": "3ch",
      "channels": [
        { "key": "red", "element": "root" },
        { "key": "green", "element": "root" },
        { "key": "blue", "element": "root" }
      ],
      "shape": { "template": "single" },
      "elements": {
        "root": {
          "name": "RGB",
          "parameters": {
            "dimmer": {
              "default": 0,
              "highlight": 1,
              "encode": { "multiply": ["red", "green", "blue"] }
            },
            "color": {
              "default": [0, 0, 0, 1],
              "highlight": [1, 1, 1, 1],
              "encode": { "color": ["red", "green", "blue"] }
            }
          }
        }
      }
    }
  }
}
```

Field by field:

- `kind` and `formatVersion` are the same guard the Installation file has, so
  a file from another version fails loudly instead of loading wrong.
- `modes` is keyed by Mode key; a Mode has a `name`, its Channel Layout, its
  Shape Template, and its Element tree with Parameters.
- `channels` is one flat list in wire order, and its length is the Footprint.
  Each Channel has a `key` unique within the Mode, the `element` it belongs to
  and an optional `bytes` (1, 2 or 3; 1 when absent). A Channel names its
  Element rather than an Element listing its Channels, so the wire order is
  read from one place and never reconstructed from a tree walk.
- `shape` names a Shape Template and what it binds: `{ "template": "single" }`,
  `{ "template": "bar", "tag": "pixel", "count": 8 }`,
  `{ "template": "grid", "tag": "pixel", "cols": 8, "rows": 4 }` or
  `{ "template": "strobe-backlight", "sections": 8, "panels": 8 }`, the last
  binding the Tags `section` and `panel`.
- `elements` is keyed by Element key; the root is always `root`. An Element has
  a `name`, an ordered `children` list of keys, `tags`, and `parameters` keyed
  by Attribute key.
- A Parameter states only what this device changes: `default`, `highlight`,
  `encode`, and optional overrides of the Attribute's range and unit. Kind,
  unit and range otherwise come from the Attribute vocabulary, which is a
  TypeScript table in core, not a JSON file, because Encoding switches on it
  and importers map onto it in code.
- `notes` on the type or a Mode is free text for what the Encoding cannot say,
  such as "verify against the unit".

## Encoding primitives

Slice 1 has the three the bundled types need:

| Primitive  | Reads                                | Writes                                                                                                                                              |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scale`    | a number Parameter                   | one Channel, the Parameter's range spread across the Channel's bytes                                                                                |
| `color`    | a color Parameter                    | the listed Channels in order red, green, blue and optionally white; white is the minimum of the three and is subtracted from them; alpha is ignored |
| `multiply` | a number Parameter without a Channel | scales the bytes of the listed Channels, the virtual dimmer                                                                                         |

Precedence (shutter and strobe on one byte) and conditional (gobo angle or
rotation chosen by a mode) are designed in the glossary and wait for a type
that needs them.

## A multi-Element excerpt

The Atomic-like Panel's `32ch` Mode, from the LL960S chart until verified on
the unit: channels 1 to 24 are red, green and blue per RGB panel 1 to 8, channels
25 to 32 are white sections 1 to 8. No master dimmer and no strobe channel, so
the Mode has no `strobe` Parameter and strobing is a Visual's job.

```json
{
  "32ch": {
    "name": "32ch",
    "notes": "Chart from the LL960S manual; verify against the unit.",
    "channels": [
      { "key": "panel-1-red", "element": "panel-1" },
      { "key": "panel-1-green", "element": "panel-1" },
      { "key": "panel-1-blue", "element": "panel-1" },
      { "key": "section-1-white", "element": "section-1" }
    ],
    "shape": { "template": "strobe-backlight", "sections": 8, "panels": 8 },
    "elements": {
      "root": {
        "name": "Atomic-like Panel",
        "children": ["backlight", "strobe"]
      },
      "backlight": { "name": "Backlight", "children": ["panel-1"] },
      "strobe": { "name": "Strobe", "children": ["section-1"] },
      "panel-1": {
        "name": "Panel 1",
        "tags": ["panel", "odd"],
        "parameters": {
          "dimmer": {
            "default": 0,
            "highlight": 1,
            "encode": {
              "multiply": ["panel-1-red", "panel-1-green", "panel-1-blue"]
            }
          },
          "color": {
            "default": [0, 0, 0, 1],
            "highlight": [1, 1, 1, 1],
            "encode": {
              "color": ["panel-1-red", "panel-1-green", "panel-1-blue"]
            }
          }
        }
      },
      "section-1": {
        "name": "Section 1",
        "tags": ["section", "odd"],
        "parameters": {
          "dimmer": {
            "default": 0,
            "highlight": 1,
            "encode": { "scale": "section-1-white" }
          }
        }
      }
    }
  }
}
```

Panels 2 to 8 and Sections 2 to 8 repeat the pattern; the full file lists all
32 Channels and 18 Elements.
