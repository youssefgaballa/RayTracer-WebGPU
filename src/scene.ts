import { Camera } from "./camera";
import { Sphere } from "./sphere";
import { debug } from "./main";
import  { BVHNodeObject, BVHNode } from "./BVH/bvhnode";
import { Renderer } from "./renderer";

const debug1 = true;
export class Scene {
  spheres: Sphere[];
  numSpheres!: number;
  sphereCount!: number
  camera: Camera;

  sphereIndices!: number[]
  bvhNodes!: BVHNode[];
  bvhNodeObject!: BVHNodeObject;

  // bvhNodesUsed: number = 0;
  // nodes: Node[]
  // nodesUsed: number = 0
  // sphereIndices: number[]

  numSpheresSlider: HTMLButtonElement 
  = document.getElementById("numSpheres") as HTMLButtonElement;
  numSpheresSpan: HTMLButtonElement 
  = document.getElementById("numSpheres-val") as HTMLButtonElement;

  objectControls: HTMLDivElement 
  = document.getElementById("object-controls") as HTMLDivElement;

  sceneRadios: NodeListOf<HTMLInputElement>
  = document.querySelectorAll('input[name="scene"]');
  scene!: number;
  static updatedScene: boolean;
  constructor() {
    this.spheres = new Array(); // empty
    this.camera = new Camera([1.0, 4.0, -20.0]);
    this.sphereIndices = [];
    this.registerInputListeners();
    
    this.buildScene();
    this.createUI();
  }



  public debug() {

    if (debug && debug1) {
      console.log("scene.spheres: ", this.spheres);
      console.log("scene.bvhnodes: ", this.bvhNodes);
      console.log("scene.bvhNodeObject: ", this.bvhNodeObject);
      // console.log("scene: ", this);
    }
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
    this.sphereCount = this.spheres.length;

    this.buildBVH();
    Scene.updatedScene = true;
    // this.debug();
  }

  public createUI() {
    this.spheres.forEach((sphere: Sphere, idx: number) => {
      if (idx >= 12) return;
      if (idx == 0) return;

      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `Sphere ${idx}`;

      details.appendChild(summary);
  
      const ul = document.createElement("ul");
  
      // Map labels to Float32Array indices
      // X --> 0, Y --> 1, Z --> 2
      const map: Record<string, number> = { 'X': 0, 'Y': 1, 'Z': 2 };
  
      const createControl = (label: 'X' | 'Y' | 'Z' | 'Radius' | 'Color', 
        min?: number, max?: number, step?: number) => {
        const li = document.createElement("li");
        li.textContent = `${label}: `;

        if (label === 'Color') { // Setup color picker
          const picker = document.createElement("input");
          picker.type = "color";
          
          // Helper to convert Float32 (0-1) to Hex for the picker
          const toHex = (c: number) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0');
          picker.value = `#${toHex(sphere.color[0])}${toHex(sphere.color[1])}${toHex(sphere.color[2])}`;
          
          picker.addEventListener("input", (e) => {
            const hex = (e.target as HTMLInputElement).value;
            // Update the Float32Array directly
            sphere.color[0] = parseInt(hex.slice(1, 3), 16) / 255;
            sphere.color[1] = parseInt(hex.slice(3, 5), 16) / 255;
            sphere.color[2] = parseInt(hex.slice(5, 7), 16) / 255;
            Renderer.frameCount = 1;
            Scene.updatedScene = true; // Signals update() to re-run writeBuffers and buildBVH
          });
          li.appendChild(picker);
        } else if (label === "Radius") { // Radius
          const radiusSlider = document.createElement("input");
          radiusSlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          radiusSlider.min = min.toString();
          radiusSlider.max = max.toString();
          radiusSlider.step = step.toString();
          radiusSlider.value = sphere.radius.toString();

          const radiusLabel = document.createElement("span");
          radiusLabel.textContent = radiusSlider.value;

          radiusSlider.addEventListener("input", (event: InputEvent) => {
            const newR = parseFloat((event.target as HTMLInputElement).value);
            radiusLabel.textContent = newR.toString();
            sphere.radius = newR;
            Renderer.frameCount = 1;

            Scene.updatedScene = true; 
          });
          li.appendChild(radiusSlider);
          li.appendChild(radiusLabel);
        } else { // X, Y, Z
          // Cooresponds to one of X, Y, Z
          const posSlider = document.createElement("input");
          posSlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          posSlider.min = min.toString();
          posSlider.max = max.toString();
          posSlider.step = step.toString();
          
          
          posSlider.value = sphere.position[map[label]].toString();

          const posLabel = document.createElement("span");
          posLabel.textContent = posSlider.value;

          posSlider.addEventListener("input", (e) => {
            const newPos = parseFloat((e.target as HTMLInputElement).value);
            posLabel.textContent = newPos.toString();

            // this.spheres[idx].position[map[label]] = newPos;
            sphere.position[map[label]] = newPos;            
            Renderer.frameCount = 1;

            Scene.updatedScene = true; 
          });
          li.appendChild(posSlider);
          li.appendChild(posLabel);
        }
        ul.appendChild(li);
      };
  
      // Correctly mapped labels
      createControl("X", -15, 15, 0.1);
      createControl("Y", -15, 15, 0.1);
      createControl("Z", -15, 15, 0.1);
      createControl("Radius", 0.1, 5, 0.1);
      createControl("Color");
  
      details.appendChild(ul);
      this.objectControls.appendChild(details);
     
    })
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
        ],
        0
      ), i++)

    }

  }

  public createScene1() {
    const radius = 0.5
    let i = 0;
    const bigR = 2000
    this.addObject(new Sphere(
      [0.0, -bigR, 0.0], bigR, [0.0, 0.7, 0.3],0
    ), i++) // floor - 0
    .addObject(new Sphere(
      [5.0, 3.0, 0.0], 3, [1.0, 1.0, 0.0],1  //yellow - 1
    ), i++) 
    .addObject(new Sphere(
      [-5.0, 1.9, -12], 1.0, [1.0, 0.2, 0.0],0 //orange - 2
    ), i++)
    .addObject(new Sphere(
      [0.0, 6.3, -11.0], radius, [0.0, 1.0, 0.0],0 // green - 3
    ), i++)
    .addObject(new Sphere(
      [0.0, 2.3, -10.0], radius, [0.0, 0.0, 1.0],0 //blue - 4
    ), i++)
    .addObject(new Sphere(
      [-2.0, 4.3, -10.0], radius, [1.0, 0.0, 1.0],0 // magenta -5
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
    //   console.log("Renderer.toggleBVH",Renderer.toggleBVH )
    
    // }
    this.bvhNodes = [];
    this.bvhNodeObject = new BVHNodeObject(this.spheres, this.sphereIndices, 0, 
      this.spheres.length, 0);
    if (debug){
    }
    this.rebuildBVH();
    
  }

  rebuildBVH() {
    if (Renderer.toggleBVH == 0 || Renderer.toggleBVH == 1) {
      this.bvhNodes = BVHNodeObject.flatten(this.bvhNodeObject );
    } else if (Renderer.toggleBVH == 2) { // stackless BVH
      this.bvhNodes = BVHNodeObject.flattenStackless(this.bvhNodeObject );
    }
  }

}