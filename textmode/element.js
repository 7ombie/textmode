import font from "./terminus.json" assert {type: "json"}
import palette from "./aurora.json" assert {type: "json"}

const sources = {
    vert: new URL("vert.glsl", import.meta.url),
    frag: new URL("frag.glsl", import.meta.url),
};

const shaders = {
    vert: await fetch(sources.vert).then(response => response.text()),
    frag: await fetch(sources.frag).then(response => response.text()),
};

const createShader = function(GPU, type, source) {

    const shader = GPU.createShader(type);

    GPU.shaderSource(shader, source.trim());
    GPU.compileShader(shader);

    return shader;
};

const createProgram = function(GPU, vertexShader, fragmentShader) {

    const program = GPU.createProgram();

    GPU.attachShader(program, vertexShader);
    GPU.attachShader(program, fragmentShader);
    GPU.linkProgram(program);

    return program;
};

class Texture {

    static index = 0;

    #context; #convert; #sampler2D; #format; #GPUformat; #index; #GPUindex;

    constructor(GPU, program, name, data, convert=false) {

        const location = GPU.getUniformLocation(program, name);

        this.pitch = convert ? 3 : 4;
        this.array = new Uint8Array(data);

        this.#context = GPU;
        this.#sampler2D = GPU.createTexture();

        this.#format = convert ? GPU.RGB : GPU.RGBA_INTEGER;
        this.#GPUformat = convert ? GPU.RGB8 : GPU.RGBA8UI;

        this.#index = Texture.index++;
        this.#GPUindex = GPU.TEXTURE0 + this.#index;

        this.upload();

        GPU.texParameteri(GPU.TEXTURE_2D, GPU.TEXTURE_MIN_FILTER, GPU.NEAREST);
        GPU.texParameteri(GPU.TEXTURE_2D, GPU.TEXTURE_MAG_FILTER, GPU.NEAREST);
        GPU.uniform1i(location, this.#index);
    }

    get width() { return this.array.length / this.pitch }

    upload() {

        const GPU = this.#context;

        GPU.activeTexture(this.#GPUindex);
        GPU.bindTexture(GPU.TEXTURE_2D, this.#sampler2D);
        GPU.texImage2D(
            GPU.TEXTURE_2D, 0, this.#GPUformat, this.width, 1, 0,
            this.#format, GPU.UNSIGNED_BYTE, this.array
        );
    }
}

export default class HTMLTextmodeElement extends HTMLCanvasElement {

    #columns; #rows; #fader; #locations = Object.create(null);

    constructor(columns=80, rows=25) {

        super(); const GPU = this.getContext("webgl2");

        this.width = (this.#columns = columns) * 16;
        this.height = (this.#rows = rows) * 32;

        this.style.imageRendering = "pixelated";

        GPU.viewport(0, 0, GPU.drawingBufferWidth, GPU.drawingBufferHeight);

        const vert = createShader(GPU, GPU.VERTEX_SHADER, shaders.vert);
        const frag = createShader(GPU, GPU.FRAGMENT_SHADER, shaders.frag);
        const program = this.program = createProgram(GPU, vert, frag);

        GPU.useProgram(program);

        const vertexArray = GPU.createVertexArray();
        const vertexLocation = GPU.getAttribLocation(program, "vertices");
        const vertexData = new Float32Array([
            -1,-1,    +1,+1,    -1,+1,
            -1,-1,    +1,+1,    +1,-1,
        ]);

        GPU.bindBuffer(GPU.ARRAY_BUFFER, GPU.createBuffer());
        GPU.bufferData(GPU.ARRAY_BUFFER, vertexData, GPU.STATIC_DRAW);

        GPU.bindVertexArray(vertexArray);
        GPU.enableVertexAttribArray(vertexLocation);
        GPU.vertexAttribPointer(vertexLocation, 2, GPU.FLOAT, false, 0, 0);

        this.state = new Texture(GPU, program, "state", this.bytes);
        this.font = new Texture(GPU, program, "font", font);
        this.palette = new Texture(GPU, program, "palette", palette, true);

        this.#fader = 0;
        this.#locations.fader = GPU.getUniformLocation(program, "fader");
        this.#locations.columns = GPU.getUniformLocation(program, "columns");
        this.#locations.height = GPU.getUniformLocation(program, "height");

        GPU.uniform1f(this.#locations.fader, 0);
        GPU.uniform1ui(this.#locations.columns, columns);
        GPU.uniform1ui(this.#locations.height, this.height);

        this.render();
    }

    get rows() { return this.#rows }

    set rows(rows) { this.reset(this.#columns, rows) }

    get columns() { return this.#columns }

    set columns(columns) { this.reset(columns, this.#rows)}

    get cells() { return this.#rows * this.#columns }

    get bytes() { return this.#rows * this.#columns * 4 }

    get fader() { return this.#fader }

    set fader(fader) {

        const GPU = this.getContext("webgl2");

        this.#fader = fader;

        GPU.uniform1f(this.#locations.fader, fader);
    }

    render(fader=null) {

        const GPU = this.getContext("webgl2");

        if (fader !== null) this.fader = fader;

        GPU.drawArrays(GPU.TRIANGLES, 0, 6);
    }

    reset(columns=null, rows=null) {

        const GPU = this.getContext("webgl2");

        if (columns !== null) this.width = (this.#columns = columns) * 16;
        if (rows !== null) this.height = (this.#rows = rows) * 32;

        this.state.array = new Uint8Array(columns * rows * 4);

        GPU.viewport(0, 0, GPU.drawingBufferWidth, GPU.drawingBufferHeight);
        GPU.uniform1ui(this.#locations.height, this.height);
        GPU.uniform1ui(this.#locations.columns, columns);

        this.state.upload();
        this.render();
    }

} customElements.define("text-mode", HTMLTextmodeElement, {extends: "canvas"});
