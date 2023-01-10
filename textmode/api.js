import palette from "./aurora.json" assert {type: "json"}
import font from "./terminus.json" assert {type: "json"}

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

    #private = Object.create(null);

    constructor(GL2, program, name, data, convert=false) {

        const location = GL2.getUniformLocation(program, name);

        this.#private.GL2 = GL2;

        this.array = new Uint8Array(data);

        this.#private.blocksize = this.array.length / (convert ? 3 : 4);
        this.#private.sampler2D = GL2.createTexture();

        this.#private.format = convert ? GL2.RGB : GL2.RGBA_INTEGER;
        this.#private.internalFormat = convert ? GL2.RGB8 : GL2.RGBA8UI;

        this.#private.index = Texture.index++;
        this.#private.internalIndex = GL2.TEXTURE0 + this.#private.index;

        this.upload();

        GL2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
        GL2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
        GL2.uniform1i(location, this.#private.index);
    }

    upload() {

        const GL2 = this.#private.GL2;

        GL2.activeTexture(this.#private.internalIndex);
        GL2.bindTexture(GL2.TEXTURE_2D, this.#private.sampler2D);
        GL2.texImage2D(
            GL2.TEXTURE_2D, 0,
            this.#private.internalFormat, this.#private.blocksize, 1, 0,
            this.#private.format, GL2.UNSIGNED_BYTE, this.array
        );
    }
}

export default class Textmode {

    static #vertices = new Float32Array([
        -1, -1,    +1, +1,    -1, +1,
        -1, -1,    +1, +1,    +1, -1,
    ]);

    #private = Object.create(null);

    constructor(rows=25, columns=80) {

        this.rowCount = rows;
        this.columnCount = columns;
        this.cellCount = rows * columns;
        this.byteCount = this.cellCount * 4;
        this.canvas = document.createElement("canvas");
        this.canvas.style.imageRendering = "pixelated";

        const width = this.canvas.width = columns * 16;
        const height = this.canvas.height = rows * 32;

        const GL2 = this.#private.GL2 = this.canvas.getContext("webgl2");

        const interpolee = `height = ${height}u, columns = ${columns}u`;
        const fragSource = shaders.frag.replace("...", interpolee);
        const vertShader = createShader(GL2.VERTEX_SHADER, shaders.vert, GL2);
        const fragShader = createShader(GL2.FRAGMENT_SHADER, fragSource, GL2);
        const GL2program = createProgram(vertShader, fragShader, GL2);

        GL2.viewport(0, 0, width, height);
        GL2.useProgram(GL2program);

        const vertexArray = GL2.createVertexArray();
        const vertexLocation = GL2.getAttribLocation(GL2program, "vertices");

        GL2.bindBuffer(GL2.ARRAY_BUFFER, GL2.createBuffer());
        GL2.bufferData(GL2.ARRAY_BUFFER, Textmode.#vertices, GL2.STATIC_DRAW);

        GL2.bindVertexArray(vertexArray);
        GL2.enableVertexAttribArray(vertexLocation);
        GL2.vertexAttribPointer(vertexLocation, 2, GL2.FLOAT, false, 0, 0);

        const context = [GL2, GL2program];

        this.state = new Texture(...context, "STATE", this.byteCount);
        this.font = new Texture(...context, "FONT", font);
        this.palette = new Texture(...context, "PALETTE", palette, true);

        this.#private.blend = 0;
        this.#private.uniform = GL2.getUniformLocation(GL2program, "BLEND");

        Object.freeze(this);
    }

    get blend() { return this.#private.blend }
    set blend(value) { this.#private.blend = value }

    render(blend=null) {

        const GL2 = this.#private.GL2;

        GL2.uniform1f(this.#private.uniform, this.blend = blend ?? this.blend);
        GL2.drawArrays(GL2.TRIANGLES, 0, 6);
    }
}
