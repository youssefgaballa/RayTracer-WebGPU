import "./style.css";
import { Renderer } from "./renderer.ts";

const canvas = document.getElementById("GLCanvas") as HTMLCanvasElement;

const renderer = new Renderer(canvas);

renderer.init()
  .then(() => {
    if (!renderer.isSupported) return;
    renderer.render();
})
