import Textmode from "./textmode/api.js"

const textmode = new Textmode(10, 20);

document.body.append(textmode.canvas);

textmode.palette.data[0] = 35;
textmode.palette.upload();

textmode.text.data[0] = 62;
textmode.text.data[1] = 16;
textmode.text.data[3] = 10;
textmode.text.upload();

textmode.render(.5);
