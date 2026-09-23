# Fixture Type sources

Where Fixture Types come from and how each source maps onto the Mode model
(Channel Layout, Element tree, Parameters, Encoding). Checked against the
format docs on 2026-09-13. See [../GLOSSARY.md](../GLOSSARY.md) for the terms.

## Open Fixture Library (bundled, primary)

Open-source JSON library with importers and exporters for QLC+, GDTF and
others. Recommended as the bundled snapshot because it is open, large, and
already carries the two things this model needs most: physical units and
multi-part structure.

| OFL concept                                         | Becomes                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| fixture, manufacturer                               | Fixture Type                                                                    |
| mode                                                | Mode                                                                            |
| channel, `fineChannelAliases`                       | one Channel of one, two or three bytes                                          |
| capability type (`Intensity`, `Pan`, ...)           | the Attribute of a Parameter; `angleStart`/`speedStart` give the unit and range |
| `ColorIntensity` with a colour                      | one emitter of the `color` Parameter's Encoding                                 |
| `WheelSlot`, `ColorPreset`, `Effect`, `Maintenance` | options of a choice Parameter with byte ranges                                  |
| `ShutterStrobe`                                     | `shutter` choice plus `strobe` number on one Channel, with precedence           |
| `switchChannels`                                    | conditional Encoding selected by the switching Parameter                        |
| matrix `pixelKeys` / `pixelCount`                   | leaf Elements under one intermediate Element per matrix                         |
| `templateChannels` stamped per pixel                | the leaf Elements' Parameters and Channels                                      |
| `pixelGroups`                                       | Tags on the pixel Elements (`odd`, `top`, and the group's own name)             |
| mode with colour emitters and no intensity          | an added virtual `dimmer` Parameter multiplying the emitters                    |

OFL has no explicit tree beyond "matrix pixels versus the rest", so an importer
produces at most two levels: root plus pixels. Deeper trees (Strobe sections
next to Backlight panels) need GDTF or hand authoring.

## GDTF (import)

The General Device Type Format, maintained by MA Lighting, Robe and Vectorworks.
Manufacturers publish official files on GDTF Share. Richer than OFL, harder to
read.

| GDTF concept                            | Becomes                                                     |
| --------------------------------------- | ----------------------------------------------------------- |
| FixtureType                             | Fixture Type                                                |
| DMXMode                                 | Mode                                                        |
| DMXChannel with Offset bytes            | Channel                                                     |
| DMXChannel with Offset `None` (virtual) | a Parameter with no Channel                                 |
| Relation type Multiply                  | multiply-by Encoding (virtual dimmer)                       |
| LogicalChannel                          | one Parameter on the Channel's Element                      |
| ChannelFunction, PhysicalFrom/To        | the Parameter's range and unit, or a choice option's range  |
| ChannelSet                              | choice options (gobo names, colour names)                   |
| ModeMaster                              | conditional Encoding                                        |
| Attribute, Feature, FeatureGroup        | Attribute and its family field, via a mapping table         |
| Geometry names                          | Tags on the corresponding Elements                          |
| ActivationGroup                         | deferred activation pairs                                   |
| Geometry tree                           | the Element tree, keeping only geometries that own channels |
| GeometryReference with Breaks           | repeated child Elements (pixels)                            |
| Emitter, ColorSpace                     | colour Encoding data, when present                          |

## QLC+ `.qxf` (import)

QLC+'s own XML definitions. Useful for rigs migrating from QLC+.

| QLC+ concept                  | Becomes                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| FixtureDef                    | Fixture Type                                                 |
| Mode                          | Mode                                                         |
| Channel with Group and Preset | Channel; the preset picks the Attribute                      |
| Capability ranges             | choice options or number ranges                              |
| Pan/Tilt fine presets         | folded into the two-byte Channel                             |
| Head                          | a leaf Element; channels outside every head stay on the root |

## Hand-authored

A Fixture Type file in the project's own format, written by hand or produced by
a future Fixture Type Editor in Studio. This is the canonical form every
importer targets, so the format is the Mode model written down: Channel Layout,
Element tree, Parameters, Encoding rules built from the primitives.

The format is JSON, validated with Zod, with a `formatVersion` from day one
like the Installation file; the files live in a `refrata-library/` folder the
Runtime loads at startup. The shape is in
[fixture-type-format.md](fixture-type-format.md): a flat wire-ordered Channel
Layout where each Channel names its Element, an Element tree with Tags, and
Parameters that state only default, highlight and Encoding, the rest coming
from the Attribute vocabulary in core.

## Bundled generics

Like both references, the library ships generic types for the fixtures that
have no brand, hand-written: `generic/dimmer-1ch`, `generic/rgb-3ch`
(virtual dimmer), `generic/rgb-7ch` (three unused channels, a master dimmer,
then red, green and blue), `generic/rgbw-4ch` (white subtracted from red,
green and blue), `generic/atomic-like-panel`, a zoned LED strobe with eight
RGB backlight panels and eight white strobe sections in `3ch` and `32ch`
Modes, and `generic/moving-head`, an LED wash mover with pan, tilt, a master
dimmer, a strobe channel and red, green, blue and white, in an `8ch` Mode
with one byte for pan and for tilt and a `10ch` Mode with two.
`RGBA`, `RGBAW` and a generic pixel bar with the pixel count as a Mode choice
stay planned.
