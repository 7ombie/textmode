#version 300 es

precision highp int;
precision highp float;
precision highp sampler2D;
precision highp usampler2D;

uniform uint columns;
uniform uint height;
uniform float fader;

uniform usampler2D state;
uniform usampler2D font;
uniform sampler2D palette;

out vec4 pixel;

const uint byteSize = 8u, texelSize = 32u;
const uint cellWidth = 16u, cellHeight = 32u, cellLength = 512u;

vec4 color(uint index) { return texelFetch(palette, ivec2(index, 0), 0); }

void main() {

    uint x = uint(gl_FragCoord.x);
    uint y = height - uint(gl_FragCoord.y);

    uint cellIndex = (y / cellHeight) * columns + (x / cellWidth);
    uvec4 cell = texelFetch(state, ivec2(cellIndex, 0), 0);

    uint localIndex = (y % cellHeight) * cellWidth + (x % cellWidth);
    uint globalIndex = cell[0] * cellLength + localIndex;
    uvec4 texel = texelFetch(font, ivec2(globalIndex / texelSize, 0), 0);

    uint texelIndex = globalIndex % texelSize;
    uint component = texel[texelIndex / byteSize];
    uint position = 7u - texelIndex % byteSize;
    bool ink = bool(component / uint(pow(2.0, float(position))) % 2u);

    pixel = ink ? color(cell[1]) : mix(color(cell[2]), color(cell[3]), fader);
}
