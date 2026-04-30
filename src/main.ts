import "./style.css";
import { Renderer } from "./renderer.ts";
export const debug = true;
const canvas = document.getElementById("GLCanvas") as HTMLCanvasElement;

const renderer = new Renderer(canvas);

renderer.init()
  .then(() => {
    if (!renderer.isSupported) return;
    renderer.render();
})
