import { Camera } from "./camera";
import { Sphere } from "./sphere";
import { debug } from "./main";
import  { BVHNodeObject, BVHNode } from "./BVH/bvhnode";
import { Renderer } from "./renderer";

const debug1 = true;
export class Scene {
  spheres: Sphere[];
  camera: Camera;
  bvhNodes!: BVHNode[];
  sphereIndices!: number[]
  numSpheres!: number;
  numSpheresSlider: HTMLButtonElement 
  = document.getElementById("numSpheres") as HTMLButtonElement;
  numSpheresSpan: HTMLButtonElement 
  = document.getElementById("numSpheres-val") as HTMLButtonElement;

  sceneRadios: NodeListOf<HTMLInputElement>
  = document.querySelectorAll('input[name="scene"]');
  scene!: number;
  newScene: boolean = false;
  constructor() {
    this.spheres = new Array(); // empty
    this.camera = new Camera([1.0, 4.0, -20.0]);
    this.sphereIndices = [];
    this.registerInputListeners();
    
    this.buildScene();
  }

  public buildScene() {
    this.spheres = [];       // Clear existing spheres
    this.sphereIndices = [];
    this.bvhNodes = [];
    if (this.scene === 1){
      this.createScene1();
    } else if (this.scene === 2) {
      this.createRandomSpheres(this.numSpheres);
    }
    this.buildBVH();
    this.newScene = true;
    if (debug && debug1) {
      console.log("scene: ", this);
    }
  }

  public registerInputListeners() {
    this.sceneRadios.forEach(radio => {
      radio.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        if (target && target.checked) {
          console.log(target.value);
          this.scene = parseInt(target.value);
          Renderer.frameCount = 0;
          this.buildScene();
        }
      });
    });
    this.scene = parseInt((document.querySelector('input[name="scene"]:checked') as HTMLInputElement).value);

    this.numSpheres = parseInt(this.numSpheresSlider.value);

    this.numSpheresSlider.addEventListener('input', (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target) {
        this.numSpheres = parseInt(target.value);
        this.numSpheresSpan.textContent = target.value;
        Renderer.frameCount = 0;
        this.buildScene();

      }
    });
    this.numSpheresSlider.value = this.numSpheres.toString();
    this.numSpheresSpan.textContent = this.numSpheres.toString();
    
  }

  public createRandomSpheres(num: number) {

    let i = 0;
    for (let j = 0; j < num; j++) {
      this.addObject(new Sphere(
        [
          -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
          0.0 + 10.0 * Math.random(), // Range: [0.0, 10.0)
          -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
        ], 
        0.1 + 0.9 * Math.random(), 
        [ // Range: [0.3, 0.1)
          0.3 + 0.7 * Math.random(), 
          0.3 + 0.7 * Math.random(),
          0.3 + 0.7 * Math.random(),
        ]
      ), i++)
     

    }

  }

  public createScene1() {
    const radius = 0.5
    let i = 0;
    const bigR = 2000
    this.addObject(new Sphere(
      [0.0, -bigR, 0.0], bigR, [0.0, 0.7, 0.3]
    ), i++) // floor
    .addObject(new Sphere(
      [5.0, 3.0, 0.0], 3, [1.0, 1.0, 0.0]  //yellow
    ), i++) 
    .addObject(new Sphere(
      [-5.0, 1.9, -12], 1.0, [1.0, 0.2, 0.0] //orange
    ), i++)
    .addObject(new Sphere(
      [0.0, 6.3, -11.0], radius, [0.0, 1.0, 0.0] // green
    ), i++)
    .addObject(new Sphere(
      [0.0, 2.3, -10.0], radius, [0.0, 0.0, 1.0] //blue
    ), i++)
    .addObject(new Sphere(
      [-2.0, 4.3, -10.0], radius, [1.0, 0.0, 1.0] // magenta
    ), i++);

  }
  public addObject(obj: Sphere, idx: number) {
    this.spheres.push(obj);
    this.sphereIndices.push(idx);
    return this;
  }
  
  buildBVH() {
    // if (debug){
    //   console.log("sphereIndices",this.sphereIndices )
    // }
    let bvhNodeObject: BVHNodeObject = new BVHNodeObject(this.spheres, this.sphereIndices, 0, 
      this.spheres.length, 0);
    if (debug){
      console.log("bvhNodeobject",bvhNodeObject )
    }
    this.bvhNodes = BVHNodeObject.flatten(bvhNodeObject);
  }
}