import "./style.css";
import { Renderer } from "./renderer.ts";

const canvas = document.getElementById("GLCanvas") as HTMLCanvasElement;

const renderer = new Renderer(canvas);
await renderer.init();
if (renderer.isSupported === true) {
  renderer.render();
}
