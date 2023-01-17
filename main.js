import TextmodeCanvasElement from "/textmode/element.js"

const random = () => Math.floor(Math.random() * 256);
const encode = character => character.charCodeAt();

const message = " [8-bit, High-Definition, Bitmapped, Textmode] ";
const textmode = new TextmodeCanvasElement(message.length, 1);

document.body.append(textmode);

console.log("textmode element ->", document.querySelector("canvas"));

Array.from(message).forEach(function(character, index) {

    const [ordinal, ink, paper, tint] = [encode(character), 15, 0, random()];

    textmode.state.array.set([ordinal, ink, paper, tint], index * 4);
});

textmode.state.upload();
textmode.render(.4);
