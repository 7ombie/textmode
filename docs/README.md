The Textmode Module
===================

This project extends the `HTMLCanvasElement` to support old school, bitmapped,
text-based rendering, optimized for high defintion displays, with a simple,
low-level, 8-bit JavaScript API.

The implementation is fully functional (free of known bugs), though it is new,
and has not been tested in the wild to any extent.

**IMPORTANT**: The implementation is fully compliant with web standards and
mature proposals (and not relient on any controversial proposals). However,
there is no special support for less advanced browsers, and as such, the
library is unlikely to work in anything besides the various Chromea for
years to come.

Note: Currently FireFox and Safari fail (at the first hurdle), as neither
browser is able to import values from JSON files.

The licensing is open source (and viral). Refer to the *Copying & Licensing*
section (at very end of this readme) for more information.


The Textmode API
----------------

The Textmode API is small and simple. The implementation relies on private
attributes to hide all of its (WebGL2) internals from the user.

Note: It is possible to access the guts of the implementation, should you
ever need to (see *The Program Attribute* later in this readme).

### The Entrypoint

The API entrypoint is an ES6 module named `element.js`, which exports the
*textmode class*.

Assuming that the `textmode` directory (from the project root directory) has
been copied to the same directory the importing module, the textmode class
could then be imported like this:

``` js
import Textmode from "./textmode/element.js"
```

If you inspect the textmode class in DevTools, it has the following type:

``` js
class HTMLTextmodeElement extends HTMLCanvasElement
```

While the name of the textmode class is proper for a custom HTML element, as
the default export of its module, the class can be directly imported using
any name we like. The convention here is to simply use `Textmode`.

The textmode class can be invoked to instantiate a *textmode element*. Each
textmode element can have any number of columns and rows (optionally passed
to the constructor):

``` js
const textmode = new Textmode(16, 2); // columns, rows
```

Note: Both arguments are optional, defaulting to `80` and `25` respectively.

Note: The rationale for the defaults is beyond the scope of this readme.

Naturally, a textmode element must be appended to the DOM to be visible:

``` js
document.body.append(textmode);
```

At this stage, the textmode will be empty (black).

# Textmode Elements

When the *textmode module* (`element.js`) is first imported, it registers a
custom canvas element named `text-mode`. Thereafter, textmode elements can be
defined in HTML, using the following syntax:

``` html
<canvas is=text-mode></canvas>
```

Textmode elements can also be created using the DOM API:

``` js
document.createElement("canvas", {is: "text-mode"});
```

In principle, you could ignore the actual textmode class entirely, and just
use the DOM API, though you would still need to trigger the textmode module
to register the custom element:

``` js
import _ from "./textmode/element.js"
```

While custom elements can be created in multiple ways, directly invoking the
constructor has the advantage of allowing you to initialize an element with
the desired number of columns and rows.

Note: It is always possible to modify the dimensions of a textmode element
after it has been instantiated by *resetting* it. See the section named
*Textmode Reset* below.

Note: Textmode elements *are* canvas elements, so they have the entire API
that a regular canvas element would have, as well as the textmode API.

### The Byte Arrays

Each textmode instance has three associated arrays of bytes, one for the
state of the character cells, another for the font, and a third for the
palette. All three arrays use the `Uint8Array` type.

While most programs will use the default font and palette, all three arrays
can be mutated, as required, then uploaded to the GPU, so that their new
state will be rendered (by the shader) during the next render call.

To make it easy to upload the arrays, they are wrapped by a `Texture` class
that provides an `upload` method. The method takes no arguments, and simply
copies the bytes (from the `Uint8Array`) to the GPU (as a texture).

The module (`element.js`) only exports the `Textmode` class, but that class
uses instances of the `Texture` class for three of its attributes.

Each textmode instance has `state`, `font` and `palette` attributes, which
each reference the corresponding `Texture` instance, with the `Uint8Array`
bound to the `array` attribute of the texture. For example:

``` js
textmode.state.array[0] = 0x24;  // set the first cell's ordinal to a dollar
textmode.state.array[1] = 0x0F;  // set the corresponding ink color to white
textmode.state.upload();         // upload the above mutations to the GPU
textmode.render();               // make a render call to see the effect
```

The `textmode.font.array` and `textmode.palette.array` can be mutated in the
exact the same way, and uploaded to the GPU by calling `textmode.font.upload`
or `textmode.palette.upload`, respectively.

Note: The API does not add any sugar. The goal is to provide a low-level API
that can be easily abstracted as required.

### The Cell State

The state array (`textmode.state.array`) is divided into blocks of four bytes,
with each block of bytes representing a character cell. The first (leftmost)
byte is known as the *ordinal*, and indicates which glyph to use, while the
remaining three bytes are palette indices, which are named (left to right)
*ink*, *paper* and *tint*. These three bytes determine the colors of the cell.

The pixels within the glyph are rendered in the ink color, while the pixels
in the background are rendered using a weighted mixture of the paper and tint
colors. The weight is controlled by the *tint fader* (described below).

### The Default Palette

The palette array (`textmode.palette.array`) contains 768 bytes, which define
256 colors, formatted in (24-bit) RGB.

By default, the textmode uses [the Aurora Palette][1] (from LoSpec), which
is stored in `aurora.json` as an array of decimal bytes (numbers between `0`
and `255`).

### The Tint Fader

The tint fader can be used to generate some useful effects by gradually mixing
the tint color of each cell with its paper color. This makes it relatively
simple to smoothly animate any number of fully synchronized cursors
(without mutating the palette), for example.

Each textmode instance has an attribute named `fader`, which is a `Number`
between `0` and `1`. It can be reassigned directly or by passing an (optional)
argument to the `render` method when making a render call:

``` js
textmode.render(.5);
```

The shader generates all of the background colors by mixing the paper and tint
colors for each cell, using the builtin `mix` function, and passing the value
of the `fader` attribute as the weight.

A `fader` value of `0` implies no tint (all paper), while a value of `1`
implies maximum tint (no paper).

### Cursor Animation

The textmode uses all zero bytes to clear the screen. The null ordinal is
rendered as an empty cell (by default), and the palette index `0` is black
(by default). As such, cells default to a state where both the paper and tint
colors are the same (black), which prevents the tint fader from affecting the
background color of the cell (the fader just mixes black into black (even if
the ink is set to contrast with the paper)).

When changing the background color of a cell, you will normally set both the
paper and tint bytes to the new color. Then, to render one or more cursors,
you update the tint byte of any cell that contains a cursor to the color
of that cursor. You can then animate the apparent opacity of all of the
currently active cursors with the tint fader.

Note: The textmode uses RGB color. There is no direct support for opacity.

Whenever a cursor leaves a cell, you simply set the tint color of the cell
to match the paper again.

Note: In practice, background colors do not change very often, except during
operations like scrolling, character insertions and deletions etc (when cells
get block-copied to a different location on screen), but in those cases, the
colors are preserved anyway.

Note: Somewhat counter-intuitively, GPU performance would be harmed more by
logic that checked and conditionally mixed colors for only those cells that
currently contain a cursor than it is harmed by unconditionally (but always,
consistently) mixing the colors for every cell.

### The Default Font

The font array (`textmode.font.array`) contains a bitmapped, 16x32px font,
stored as an array of 16,384 bytes, divided into 256 blocks of 64 bytes.

Each block of 64 bytes encodes 32 rows of 16 pixels (one bit per pixel).

The bits for the individual pixels are stored from left to right, with the
rows stored from top to bottom (following the standard convention for
bitmapped fonts).

By default, the textmode uses the awesome (and practical) [Terminus Font][2].
A copy of the font is stored in `terminus.json` as an array of decimal bytes
(analogous to `aurora.json`).

**IMPORTANT**: Currently, the included font just copies the first 256 glyphs
from the 16x32 stroke of the Terminus Font. The upper 128 characters, and some
of the control characters will be remapped and replaced with new glyphs (that
reuse Terminus glyphs from higher codepoints). The end result will be a more
tradtional Higher ASCII character set (like PETSCII). Furthermore, some of
the ASCII glyphs (like tilde) will also be replaced with better-looking
alternatives (that are provided by Terminus).

*The default form of any glyph (and even its mapping) may change soon*.


Display Attributes
------------------

As well as the textmode attributes that have been described above (`state`,
`font`, `palette` and `fader`), textmode elements also have a set of four
numeric attributes that come in handy when describing a textmode canvas:

+ `rows`: The number of rows.
+ `columns`: The number of columns.
+ `cells`: The number of cells (`rows * columns`).
+ `bytes`: The number of bytes in the state array (`cells * 4`).


Textmode Reset
--------------

To permit resetting and resizing textmode elements after their instantiation,
elements have a `reset` method with the following type:

    columns=80, rows=25 -> undefined

This is the same signature as the constructor, and the arguments have the
same semantics.

Resetting a textmode element causes a new, empty `Uint8Array` to be created
with the required number of bytes (`columns * rows * 4`), and then assigned
to `textmode.state.array`.

Note: If you need the data in the state array to persist across a reset, you
need to create a reference to it, adapt it to fit the new dimensions, then
copy the data to the new state array after the reset.

The corresponding values (`columns`, `rows`, `cells` and `bytes`) will reflect
the new dimensions. Related properties, inherited from the `HTMLCanvasElement`
class (like `width` and `height`) will also reflect the changes.

The `fader` and the `font` and `palette` textures are completely unaffected,
and the shader program has internal uniforms for the width and height that
are updated (without requiring the shader to be reinitialized), making a
reset relatively light (though new textmode elements are not expensive
(once the textmode module has loaded) either).

You can also cause a reset by assigning to the `columns` or `rows` attributes,
which has the same effect as invoking `reset` with the corresponding value and
the unspecified value defaulting to its current value. For example, these
two lines are equivalent:

``` js
textmode.reset(textmode.columns, textmode.rows + 1)
textmode.rows++;
```

Note: It is possible to copy the data from the state array, before swapping it
for one with the required length, then to copy each line (or as much of it as
will fit) back to the new state array, but this is beyond the scope of the
"simple, low-level" textmode API, and not especially useful in practice,
so it must be done manually, as and where required.


The Program Attribute
---------------------

The implementation uses private attributes to hide the internals (all of the
WebGL2 API stuff) from the user. The author is content with this arrangement.
However, there is always that one obscure edgecase, so a hook into the guts
of the implementation has been left open.

The *program attribute* (`textmode.program`) references the `WebGLProgram`
instance that is running the shader program on the GPU. On its own, it is
not especially useful, but textmode elements are canvas elements, so you
can also access the `WebGLRenderingContext` in the usual way:

``` js

const gl = textmode.getContext("webgl2");
```

From here, assuming that you know the WebGL2 API and have read through the
`element.js` and `frag.glsl` source, you will be able to figure out how to
access the project internals. For example:

``` js
const fontLocation = gl.getUniformLocation(textmode.program, "font");
```


Copying & Licensing
-------------------

The various licenses that this project uses are much larger than the project
itself. For that reason, this readme includes links to the licenses, and this
general declaration (instead of notices at the top of each source file).

The code (`element.js`, `frag.glsl` and `vert.glsl`) is published under the
terms of [the GPL License][3] (version 3 or later).

This readme (and any documentation added to the `docs` directory over time)
uses the [GNU Free Documentation License][8] (version 1.3 or later).

The font and palette are not original to this project.

The [Terminus Font][2] uses the [SIL Open Font License, Version 1.1][4]
(which is fully open, though also viral).

The [Aurora Palette][1] was developed as part of a toolkit for GrafX2. The
palette was shared with the [LoSpec Community][5] by user [DawnBringer][6].
I read online that palettes are not a form of intellectual property, so no
license could apply to one. In any case, the creator wanted to share the
palette, and it seems to be fairly popular and widely used.

The author would also like to mention their appreciation for the invaluable
tips and guidance they took from the [*WebGL2 Fundamentals* website][1].

**COPYRIGHT C YOUNGER (7OMBIE) 2023**


[1]: https://lospec.com/palette-list/aurora
[2]: https://terminus-font.sourceforge.net
[3]: https://www.gnu.org/licenses/gpl-3.0.txt
[4]: https://scripts.sil.org/cms/scripts/page.php?item_id=OFL_web
[5]: https://lospec.com
[6]: https://pixeljoint.com/p/23821.htm
[7]: https://webgl2fundamentals.org
[8]: https://www.gnu.org/licenses/fdl-1.3.en.html
