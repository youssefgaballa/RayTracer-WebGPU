import "./style.css";
import { Renderer } from "./renderer.ts";

const canvas = document.getElementById("GLCanvas") as HTMLCanvasElement;

const render = new Renderer(canvas);
render.init();