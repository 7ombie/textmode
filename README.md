The Textmode Module
===================

This project implements an old school, bitmapped, text-based renderer (for
modern displays), with a simple, low-level, 8-bit JavaScript API.

The implementation is clean, fast and fully functional (and free of known
bugs), though it is new, and has not been tested in the wild to any extent.

**IMPORTANT**: The implementation is compliant with web standards and mature
proposals (and not relient on any controversial proposals). However, there is
no special support for less advanced browsers, and as such, the library is
unlikely to work outside of anything Chromium-based for years to come.

Note: Currently FireFox and Safari fail (at the first hurdle), as neither
browser is able to import values from JSON files.

**IMPORTANT**: The character set and font are currently unstable. This readme
contains a section named *The Default Font* (towards the end of the document)
that provides more information.

The licensing is open source (and viral). Refer to the *Copying & Licensing*
section (at very end of this readme) for more information.


The Textmode API
----------------

The (entire) Textmode API is small and simple (using private attributes to
hide all of the WebGL2 internals). It is be described and fully documented
below.

The API entrypoint is an ES6 module named `api.js` that wraps a WebGL2 shader,
and exports a single class named `Textmode` (which is the default export):

``` js
import Textmode from "./textmode/api.js"
```

The `Textmode` class can be instantiated to create *textmode instances*, each
with any number of rows and columns (passed as arguments to the constructor):

``` js
const textmode = new Textmode(2, 16); // rows, columns
```

Note: Both arguments are optional, defaulting to `25` and `80` respectively.
The rationale for these defaults is beyond the scope of this introducton.


### Render Calls

Each textmode instance has an associated canvas element bound to its `canvas`
property. The canvas must be appended to the DOM to be visible, and a render
call must be made to apply the shader to the canvas frame buffer:

``` js
document.body.append(textmode.canvas);
textmode.render();
```

At this stage, the textmode canvas will be empty (black).


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

The module (`api.js`) only exports the `Textmode` class, but the `Textmode`
class uses instances of the `Texture` class for three of its attributes.

Each textmode instance has `state`, `font` and `palette` attributes, which
each reference the corresponding `Texture` instance, with the `Uint8Array`
bound to the `array` attribute of the texture. For example:

``` js
textmode.state.array[0] = 0x24;  // set the first cell's ordinal to a dollar
textmode.state.array[1] = 0x0F;  // set the corresponding ink color to white
textmode.state.update();         // upload the above mutations to the GPU
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
colors. The weight is controlled by the *blend slider* (which is described
later in this document).


### The Default Palette

The palette array (`textmode.palette.array`) contains 768 bytes, which define
256 colors, formatted in (24-bit) RGB.

By default, the textmode uses [the Aurora Palette][1] (from LoSpec), which
is stored in `aurora.json` as an array of decimal bytes (numbers between `0`
and `255`).


### The Blend Slider

The renderer supports native cursors, which can be gradually mixed into the
background color, making it simple to to smoothly animate any number of
fully synchronized cursors (without modifying the palette).

Each `Textmode` instance has an attribute named `blend`, which is a `Number`
between `0` and `1`. It can be modified directly or by passing an (optional)
argument to the `render` method when making a render call:

``` js
textmode.render(.5);
```

The shader will generate the background color of each cell by blending the
paper and tint colors using the builtin `mix` function, passing the value
of the `blend` attribute as the weight.

A `blend` value of `0` implies no tint (all paper), while a value of `1`
implies maximum tint (no paper).


### Cursor Animation

The convention is to use all zero bytes to clear the screen (the null ordinal
is rendered as an empty cell (by default), and the palette index `0` is black
(by default). As such, cells default to a state where both the paper and tint
colors are the same (black), which prevents the blend slider from affecting
the background color of the cell (the slider only mixes black with black),
even if the ink is set to contrast with the paper.

When changing the background color of a cell, both the paper and tint will
normally be set to the new color.

To render one or more cursors, update the tint byte of any cell containing a
cursor to the color of that cursor, then animate the apparent opacity of the
cursor using the blend slider.

Note: The textmode uses RGB color. There is no direct support for opacity.

Whenever a cursor leaves a cell, set the tint color of the cell to match the
paper again.

Note: In practice, background colors do not change that often, except during
operations like scrolling, character insertions and deletions etc (when cells
get block-copied to a different location on screen), but in those cases, the
colors are preserved anyway.

Note: Somewhat counter-intuitively, GPU performance would be harmed more by
logic that checked and conditionally blended colors for only those cells that
currently contain a cursor than it is effected by unconditionally (but always,
consistently) blending every cell (even when `blend` is exactly `0` or `1`).


### The Default Font

The font array (`textmode.font.array`) contains a bitmapped, 16x32 font,
stored as an array of 16,384 bytes, divided into 256 blocks of 64 bytes.
Each block of 64 bytes encodes 32 rows of 16 pixels (one bit per pixel).

The bits for the individual pixels are stored from left to right, with the
rows stored from top to bottom.

A copy of the font is stored in `terminus.json` as an array of decimal bytes
(like `aurora.json`).

**IMPORTANT**: Currently, the included font just copies the first 256 glyphs
from the 16x32 stroke of [the Terminus Font][2]. The upper 128 characters, and
some of the control characters will be remapped, and replaced with new glyphs
(reusing Terminus glyphs from higher codepoints) where appropriate. The end
result will be a more tradtional Higher ASCII character set (like PETSCII),
Furthermore, some of the ASCII glyphs (like tilde) will likely be replaced
soon, with better-looking (official, Terminus) alternatives. *Please, do
not rely on the specific default form of any glyph for now*.

Display Attributes
------------------

As well as the textmode attributes that have been described above (`canvas`,
`state`, `font`, `palette` and `blend`), textmode instances also have a
set of four readonly attributes (each an integer `Number`) that are
useful when describing the textmode display:

+ `rowCount`: The number of rows.
+ `columnCount`: The number of columns.
+ `cellCount`: The number of cells (`rowCount * columnCount`).
+ `byteCount`: The number of bytes in the state array (`cellCount * 4`).

Textmode instances are frozen during construction. The only mutable property
they have is `blend`. Objects that are bound to textmode instances (like the
three `Texture` instances) are regular, mutable objects.

Textmode instances do have other internal properties, but they are all kept
private. `Texture` instances also have a number of internal properties, but
only the `array` property (and `upload` method) are public.


Copying & Licensing
-------------------

The licenses this project uses are much larger than the project itself. For
that reason, links to the licenses, and general declarations in this README
(instead of at the top of each source file) will have to suffice for now.
Please open an issue, if any of this is a problem at all.

The code (`api.js`, `frag.glsl` and `vert.glsl`) is available to you under
the terms of [the GPLv3 License][3] (or any later version you may prefer).

The font and palette are not original to this project.

The [Terminus Font][2] uses the [SIL Open Font License, Version 1.1][4],
which is permissive, though also viral.

The [Aurora Palette][1] was developed as part of a toolkit for GrafX2. The
palette was shared with the [LoSpec Community][5] by user [DawnBringer][6].
I read online that palettes are not a form of intellectual property, so no
license could apply to one. In any case, the creator wanted to share the
palette, and it seems to be fairly popular and widely used.

**COPYRIGHT C YOUNGER (7OMBIE) 2023**


[1]: https://lospec.com/palette-list/aurora
[2]: https://terminus-font.sourceforge.net
[3]: https://www.gnu.org/licenses/gpl-3.0.txt
[4]: https://scripts.sil.org/cms/scripts/page.php?item_id=OFL_web
[5]: https://lospec.com
[6]: https://pixeljoint.com/p/23821.htm
