The Textmode Module
===================

This project implements a old school, bitmapped, text-based renderer (for
modern displays), with a simple, low-level, 8-bit JavaScript API.

The code is fully functional (and free of known bugs), but the project needs
documentation, and testing in anything other than Chrome.


The Textmode API
----------------

The API entrypoint is an ES6 module named `api.js` that wraps a WebGL2 shader,
and exports a single class named `Textmode` (which is the default export).

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

Each textmode instance has an associated canvas, which must be appended to
the DOM to be visible, and a render call must be made to run the shader:

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

Each `Textmode` instance has `text`, `font` and `palette` attributes. Each
of these attributes references the corresponding `Texture` instance, with
its data (the `Uint8Array`) referenced by an attribute of the `Texture`
instance, named `data`. For example:

``` js
textmode.text.data[0] = 0x24;   // set the first cell's ordinal to a dollar
textmode.text.data[1] = 0x0F;   // set the corresponding ink color to white
textmode.text.upload();         // upload the above mutations to the GPU
textmode.render();              // make a render call to see the effect
```

The `textmode.font.data` and `textmode.palette.data` arrays can be mutated (in
exactly the same way as `textmode.text.data` above), then uploaded by calling
the respective method (`textmode.font.upload` or `textmode.palette.upload`).

Note: The API does not add any sugar as the user can best determine the most
appropriate abstractions for their specific needs.


### The Cell State

The text array (`textmode.text.data`) contains four bytes for each character
cell (`rows * columns * 4`). The first (leftmost) byte of the block is known
as the *ordinal*, and indicates which glyph to render. The remaining three
bytes are palette indices, which are named (left to right) *ink*, *paper*
and *tint*. These three bytes determine the colors of the cell.

The pixels within the glyph are rendered in the ink color, while the pixels
in the background are rendered using a weighted mixture of the paper and tint
colors. The weight is controlled by the *blend slider* (which is described
later in this document).


### The Default Palette

The palette array (`textmode.palette.data`) contains 768 bytes, which define
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

Note: The main thread is notoriously unreliable when it comes to handling user
input with low-latency. Nonetheless, the shader is logically simple and memory
efficient, making it very fast.


### The Default Font

The font array (`textmode.font.data`) contains a bitmapped, 16x32 font,
stored as an array of 16,384 bytes, divided into 256 blocks of 64 bytes.
Each block of 64 bytes encodes 32 rows of 16 pixels (one bit per pixel).

The bits for the individual pixels are stored from left to right, with the
rows stored from top to bottom.

The default font is currently just a copy of the first 256 characters from
the 16x32 stroke of [the Terminus Font][2].

IMPORTANT: The glyphs (and the character mapping generally) for the upper 128
characters will be replaced with a more tradtional Higher ASCII character set
(think PETSCII) soon, reusing Terminus glyphs from higher codepoints. Further,
some of the ASCII glyphs (like tilde) will likely be replaced with Terminus
alternatives (for example, opting to use their midline tilde over the one
they use by default, which is rendered raised, like a caret character).
Do not depend on the exact shape of any glyph until further notice.


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
