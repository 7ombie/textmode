import Textmode from "./textmode/api.js"

const textmode = new Textmode(10, 20);

document.body.append(textmode.canvas);

textmode.palette.array[0] = 200;
textmode.palette.upload();

textmode.state.array[0] = 62;
textmode.state.array[1] = 16;
textmode.state.array[3] = 10;
textmode.state.upload();
textmode.render(.5);

console.log(textmode);
