import paletteArray from "./aurora.json" assert {type: "json"};
import fontArray from "./terminus.json" assert {type: "json"};

const sources = {
    vert: new URL("vert.glsl", import.meta.url),
    frag: new URL("frag.glsl", import.meta.url),
};

const shaders = {
    vert: await fetch(sources.vert).then(response => response.text()),
    frag: await fetch(sources.frag).then(response => response.text()),
};

const createShader = function(type, source, context) {

    const GL2 = context;
    const shader = GL2.createShader(type);

    GL2.shaderSource(shader, source.trim());
    GL2.compileShader(shader);

    if (GL2.getShaderParameter(shader, GL2.COMPILE_STATUS)) return shader;

    console.error("COMPILER FAILED:", GL2.getShaderInfoLog(shader));
    GL2.deleteShader(shader);
};

const createProgram = function(vertexShader, fragmentShader, context) {

    const GL2 = context;
    const program = GL2.createProgram();

    GL2.attachShader(program, vertexShader);
    GL2.attachShader(program, fragmentShader);
    GL2.linkProgram(program);

    if (GL2.getProgramParameter(program, GL2.LINK_STATUS)) return program;

    console.error("LINKER FAILED:", GL2.getProgramInfoLog(program));
    GL2.deleteProgram(program);
};

class Texture {

    static index = 0;

    constructor(name, data, textmode, convert=false) {

        const GL2 = this.context = textmode.context;
        const locations = textmode.locations;

        this.data = new Uint8Array(data);
        this.length = this.data.length / (convert ? 3 : 4);
        this.sampler = GL2.createTexture();

        this.format = convert ? GL2.RGB : GL2.RGBA_INTEGER;
        this.internalFormat = convert ? GL2.RGB8 : GL2.RGBA8UI;

        this.index = Texture.index++;
        this.internalIndex = GL2.TEXTURE0 + this.index;

        locations[name] = GL2.getUniformLocation(textmode.program, name);

        this.upload();

        GL2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MIN_FILTER, GL2.NEAREST);
        GL2.texParameteri(GL2.TEXTURE_2D, GL2.TEXTURE_MAG_FILTER, GL2.NEAREST);
        GL2.uniform1i(locations[name], this.index);
    }

    upload() {

        const GL2 = this.context;

        GL2.activeTexture(this.internalIndex);
        GL2.bindTexture(GL2.TEXTURE_2D, this.sampler);
        GL2.texImage2D(
            GL2.TEXTURE_2D, 0, this.internalFormat,
            this.length, 1, 0, this.format,
            GL2.UNSIGNED_BYTE, this.data
        );
    }
}

export default class Textmode {

    static #vertices = new Float32Array([
        -1, -1,    +1, +1,    -1, +1,
        -1, -1,    +1, +1,    +1, -1,
    ]);

    constructor(rows=25, columns=80) {

        [this.blend, this.rows, this.columns] = [0, rows, columns];

        const locations = this.locations = Object.create(null);
        const canvas = this.canvas = document.createElement("canvas");
        const GL2 = this.context = canvas.getContext("webgl2");

        [canvas.width, canvas.height] = [columns * 16, rows * 32];

        canvas.style.imageRendering = "pixelated";

        GL2.viewport(0, 0, canvas.width, canvas.height);

        const interpolee = `height = ${canvas.height}u, columns = ${columns}u`;
        const fragSource = shaders.frag.replace("...", interpolee);
        const vertShader = createShader(GL2.VERTEX_SHADER, shaders.vert, GL2);
        const fragShader = createShader(GL2.FRAGMENT_SHADER, fragSource, GL2);

        this.program = createProgram(vertShader, fragShader, GL2);

        GL2.useProgram(this.program);

        locations.BLEND = GL2.getUniformLocation(this.program, "BLEND");

        const VAO = GL2.createVertexArray();

        locations.vertices = GL2.getAttribLocation(this.program, "vertices");

        GL2.bindBuffer(GL2.ARRAY_BUFFER, GL2.createBuffer());
        GL2.bufferData(GL2.ARRAY_BUFFER, Textmode.#vertices, GL2.STATIC_DRAW);

        GL2.bindVertexArray(VAO);
        GL2.enableVertexAttribArray(locations.vertices);
        GL2.vertexAttribPointer(locations.vertices, 2, GL2.FLOAT, false, 0, 0);

        this.text = new Texture("TEXT", columns * rows * 4, this);
        this.font = new Texture("FONT", fontArray, this);
        this.palette = new Texture("PALETTE", paletteArray, this, true);
    }

    render(blend=null) {

        const GL2 = this.context;

        GL2.uniform1f(this.locations.BLEND, this.blend = blend ?? this.blend);
        GL2.drawArrays(GL2.TRIANGLES, 0, 6);
    }
}
