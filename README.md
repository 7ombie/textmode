The Paragon Textmode Module
===========================

This project implements a old school, bitmapped, text-based renderer (for
modern displays), with a simple, low-level, 8-bit JavaScript API.

The code is fully functional (and free of known bugs), but the project needs
documentation, and testing in anything other than Chrome.


The Textmode API
----------------

The API entrypoint is an ES6 module named `api.js` that wraps a WebGL2 shader,
and exports a single class named `Textmode`.

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

While most programs will use default font and palette, all three arrays can
be mutated, as required, then uploaded to the GPU so their new state will be
rendered (by the shader) during the next render call:

To make it easy to upload the arrays, they are wrapped by a `Texture` class
that provides an `upload` method, which takes no args, and simply copies the
bytes (from the `Uint8Array`) to the GPU (as a texture it can access).

Textmode instances have three attributes, named `text`, `font` and `palette`,
which reference the three corresponding `Texture` instances. Their data is
stored in a `Uint8Array` attribute, named `data`. For example:

``` js
textmode.text.data[0] = 0x24;   // set the first cell's ordinal to a dollar
textmode.text.data[1] = 0x0F;   // set the corresponding ink color to white
textmode.text.upload();         // upload the above mutations to the GPU
textmode.render();              // and finally, make a render call
```

The `textmode.font.data` and `textmode.palette.data` arrays can be mutated in
exactly the same way, then uploaded by calling `textmode.font.upload` or
`textmode.palette.upload` respectively.

Note: The API does not add any sugar as the user can best determine the most
appropriate abstractions for their specific needs.

The layout of the bytes within each of the three arrays is described below.


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


### The Palette

The palette array (`textmode.palette.data`) contains 768 bytes, which define
256 colors, in the 24-bit RGB format.

The three palette indices that describe each cell are indices into the
palette array. This limits the number of on-sceen colors to 256, but
permits any 256 colors to be used.

By default, the textmode uses [the Aurora Palette (from LoSpec)][1], which
is stored in `aurora.json` as an array of decimal bytes (numbers between `0`
and `255`).


### The Blend Slider

The renderer supports native cursors, which can be gradually mixed into the
background color, making it simple to to smoothly animate any number of
fully synchronized cursors (without modifying the palette).

Each `Textmode` instance has an attribute named `blend`, which is a `Number`
between `0` and `1`. It can be modified directly or by passing an (optional)
argument to the `render` method when making a render call.

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

When changing the background color of a cell, both the paper and tint should
be set to the new color. To render one or more cursors, update the tint byte
of any cell containing a cursor to the color of the cursor, then animate the
apparent opacity of the cursor using the blend slider.

Note: The textmode uses RGB color. There is no direct support for opacity.

Whenever a cursor leaves a cell, set the tint color of the cell to match the
paper again.

Note: In practice, background colors do not change that often, except during
operations like scrolling, character insertions and deletions etc (when cells
get block-copied to a different location on screen), but in those cases, the
colors are preserved anyway.

Note: Somewhat counter-intuitively, GPU performance would be harmed more by
selectively blending colors for those cells that contain cursors than it is
by consistently blending every cell.

Note: The shader is very fast.


### The Font & Glyphs

The font array (`textmode.font.data`) contains a 16x32x1px bitmapped font,
stored as an array of 16,384 bytes, divided into 256 blocks of 64 bytes.
Each block of 64 bytes encodes 32 rows of 16 pixels (one bit per pixel).

The bits for the individual pixels are stored from left to right, with the
rows stored from top to bottom.

The default font is a currently just a copy of the first 256 characters from
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
which is viral.

The [Aurora Palette][1] was developed as part of a toolkit for GrafX2. The
palette was shared with the [LoSpec Community][5] by user [DawnBringer][6].
As far as I understand, palettes are not considered intellectual property,
so there are no legal issues.

**COPYRIGHT C YOUNGER (7OMBIE) 2023**


[1]: https://lospec.com/palette-list/aurora
[2]: https://terminus-font.sourceforge.net
[3]: https://www.gnu.org/licenses/gpl-3.0.txt
[4]: https://scripts.sil.org/cms/scripts/page.php?item_id=OFL_web
[5]: https://lospec.com
[6]: https://pixeljoint.com/p/23821.htm
