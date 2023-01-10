import paletteArray from "./aurora.json" assert {type: "json"}
import fontArray from "./terminus.json" assert {type: "json"}

const sources = {
    vert: new URL("vert.glsl", import.meta.url),
    frag: new URL("frag.glsl", import.meta.url),
};

const shaders = {
    vert: await fetch(sources.vert).then(response => response.text()),
    frag: await fetch(sources.frag).then(response => response.text()),
};

const createShader = function(type, source, GL2) {

    const shader = GL2.createShader(type);

    GL2.shaderSource(shader, source.trim());
    GL2.compileShader(shader);

    return shader;
};

const createProgram = function(vertexShader, fragmentShader, GL2) {

    const program = GL2.createProgram();

    GL2.attachShader(program, vertexShader);
    GL2.attachShader(program, fragmentShader);
    GL2.linkProgram(program);

    return program;
};

class Texture {

    static index = 0;

    constructor(textmode, name, data, convert=false) {

        const GL2 = this.GL2 = textmode.GL2;
        const location = GL2.getUniformLocation(textmode.program, name);

        this.data = new Uint8Array(data);

        this.blocksize = this.data.length / (convert ? 3 : 4);
        this.sampler2D = GL2.createTexture();

        this.format = convert ? GL2.RGB : GL2.RGBA_INTEGER;
        this.internalFormat = convert ? GL2.RGB8 : GL2.RGBA8UI;

        this.index = Texture.index++;
        this.internalIndex = GL2.TEXTURE0 + this.index;

        this.upload();

        GL2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
        GL2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
        GL2.uniform1i(location, this.index);
    }

    upload() {

        this.GL2.activeTexture(this.internalIndex);
        this.GL2.bindTexture(this.GL2.TEXTURE_2D, this.sampler2D);
        this.GL2.texImage2D(
            this.GL2.TEXTURE_2D, 0,
            this.internalFormat, this.blocksize, 1, 0,
            this.format, this.GL2.UNSIGNED_BYTE, this.data
        );
    }
}

export default class Textmode {

    static #vertices = new Float32Array([
        -1, -1,    +1, +1,    -1, +1,
        -1, -1,    +1, +1,    +1, -1,
    ]);

    constructor(rows=25, columns=80) {

        this.blend = 0;
        this.rowCount = rows;
        this.columnCount = columns;
        this.cellCount = rows * columns;
        this.byteCount = this.cellCount * 4;
        this.canvas = document.createElement("canvas");
        this.canvas.style.imageRendering = "pixelated";
        this.width = this.canvas.width = columns * 16;
        this.height = this.canvas.height = rows * 32;

        const GL2 = this.GL2 = this.canvas.getContext("webgl2");

        const interpolee = `height = ${this.height}u, columns = ${columns}u`;
        const fragSource = shaders.frag.replace("...", interpolee);
        const vertShader = createShader(GL2.VERTEX_SHADER, shaders.vert, GL2);
        const fragShader = createShader(GL2.FRAGMENT_SHADER, fragSource, GL2);

        this.program = createProgram(vertShader, fragShader, GL2);
        this.uniform = GL2.getUniformLocation(this.program, "BLEND");

        GL2.viewport(0, 0, this.width, this.height);
        GL2.useProgram(this.program);

        const vertexArray = GL2.createVertexArray();
        const vertexLocation = GL2.getAttribLocation(this.program, "vertices");

        GL2.bindBuffer(GL2.ARRAY_BUFFER, GL2.createBuffer());
        GL2.bufferData(GL2.ARRAY_BUFFER, Textmode.#vertices, GL2.STATIC_DRAW);

        GL2.bindVertexArray(vertexArray);
        GL2.enableVertexAttribArray(vertexLocation);
        GL2.vertexAttribPointer(vertexLocation, 2, GL2.FLOAT, false, 0, 0);

        this.text = new Texture(this, "TEXT", this.byteCount);
        this.font = new Texture(this, "FONT", fontArray);
        this.palette = new Texture(this, "PALETTE", paletteArray, true);
    }

    render(blend=null) {

        this.GL2.uniform1f(this.uniform, this.blend = blend ?? this.blend);
        this.GL2.drawArrays(this.GL2.TRIANGLES, 0, 6);
    }
}
