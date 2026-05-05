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
  bvhNodeObject!: BVHNodeObject | undefined;
  static bvhMaxDepth: number = 0;
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

  skyColorInput: HTMLInputElement 
  = document.getElementById("skyColorInput") as HTMLInputElement;
  skyColorReset: HTMLInputElement 
  = document.getElementById("reset-skyColor") as HTMLInputElement;
  skyColor!: Float32Array;
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
  }


  updateScene() {
    this.spheres.forEach((sphere) => {
      sphere.updatebbox();
    })
    this.buildBVH();
    this.debug();
  }

  public debug() {

    if (debug && debug1) {
      console.log("scene.spheres: ", this.spheres);
      console.log("scene.bvhnodes: ", this.bvhNodes);
      console.log("scene.bvhNodeObject: ", this.bvhNodeObject);
      console.log("Scene.bvhMaxDepth: ", Scene.bvhMaxDepth);

      // console.log("scene: ", this);
    }
  }

  public buildScene() {
    this.spheres = [];
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

    const defaultSkyColor = '#80b3ff';
    this.skyColorReset.addEventListener("click", (e) => {
      this.skyColorInput.value=defaultSkyColor;
      const skyColorHex = this.skyColorInput.value;
      this.skyColor = new Float32Array([
        parseInt(skyColorHex.slice(1, 3), 16) / 255,
        parseInt(skyColorHex.slice(3, 5), 16) / 255,
        parseInt(skyColorHex.slice(5, 7), 16) / 255
      ]);
      Renderer.frameCount = 1;
      Scene.updatedScene = true;
    });
    this.skyColorInput.value=defaultSkyColor;
    this.skyColorInput.addEventListener("input", (e) => {
      const hex = (e.target as HTMLInputElement).value;
      // Update the Float32Array directly
      this.skyColor = new Float32Array([
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
      ])

      Renderer.frameCount = 1;
      Scene.updatedScene = true; // Signals update() to re-run writeBuffers and buildBVH
    });
    const skyColorHex = this.skyColorInput.value;
    this.skyColor = new Float32Array([
      parseInt(skyColorHex.slice(1, 3), 16) / 255,
      parseInt(skyColorHex.slice(3, 5), 16) / 255,
      parseInt(skyColorHex.slice(5, 7), 16) / 255
    ])
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
        0, 
        1.0,
        0.0,
        1.0 // index of refraction
      ), i++)

    }
    this.createUI();

  }

  public createScene1() {
    const radius = 0.5
    let i = 0;
    const bigR = 2000
    this.addObject(new Sphere(
      [0.0, -bigR, 0.0], bigR, [0.0, 0.7, 0.3],// floor - 0
      0, // matte
      1.0, 
      0.0,
      1.0 // index of refraction
    ), i++) 
    .addObject(new Sphere(
      [5.0, 3.0, 0.0], 3, [1.0, 1.0, 0.0],//1: yellow
      1 ,// metallic
       0.0,
       1.0,
       1.0 // index of refraction
    ), i++) 
    .addObject(new Sphere(
      [-5.0, 1.9, -12], 1.0, [1.0, 0.2, 0.0],//2: orange
      1, // metallic
      0.2,
      0.5,
      1.0 // index of refraction
    ), i++)
    .addObject(new Sphere(
      [0.0, 6.3, -11.0], radius, [0.0, 1.0, 0.0],//3:  green
      0, // refractive
      1.0,
      0.0,
      1.0  // index of refraction
    ), i++)
    .addObject(new Sphere(
      [0.0, 2.3, -10.0], radius, [0.0, 0.0, 1.0],// 4: blue
      0, // matte
      1.0,
      0.0,
      1.0 // index of refraction
    ), i++)
    .addObject(new Sphere(
      [-2.0, 4.3, -10.0], radius, [1.0, 0.0, 1.0],// 5: magenta
      0, // matte
      1.0,
      0.0,
      1.0 // index of refraction 
    ), i++)
    .addObject(new Sphere(
      [-2.0, 4.3, 0.0], 3, [1.0, 1.0, 0.0],// 6: yellow
      2, // refractive
      0.0,
      1.0,
      1.0 // index of refraction  
    ), i++);
    this.createUI();

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
    this.bvhNodeObject =  {} as BVHNodeObject;

    this.bvhNodeObject = new BVHNodeObject(this.spheres, this.sphereIndices, 0, 
    this.spheres.length, 0);
 
    this.rebuildBVH();
    
  }

  rebuildBVH() {
    if (Renderer.toggleBVH == 0 || Renderer.toggleBVH == 1) { // regular BVH
      this.bvhNodes = BVHNodeObject.flatten(this.bvhNodeObject! );
    } else if (Renderer.toggleBVH == 2) { // stackless BVH
      this.bvhNodes = BVHNodeObject.flattenStackless(this.bvhNodeObject! );
    }
  }

  
  private wgslColorToHex(color: number)  {
    return Math.round(Math.max(0, Math.min(1.0, color)) * 255).toString(16).padStart(2, '0')
  }

  public createUI() {
    this.objectControls.innerHTML = ``;
    const h3 =  document.createElement("h3");
    h3.textContent = "Object Controls: ";
    this.objectControls.appendChild(h3);
    this.spheres.forEach((sphere: Sphere, idx: number) => {
      if (idx >= 12) return;
      if (idx == 0) return;

      const sphereDetails = document.createElement("details");
      const sphereSummary = document.createElement("summary");
      sphereSummary.textContent = `Sphere ${idx}`;

      sphereDetails.appendChild(sphereSummary);
  
      const ul = document.createElement("ul");
  
      // Map labels to Float32Array indices
      // X --> 0, Y --> 1, Z --> 2
      const map: Record<string, number> = { 'X': 0, 'Y': 1, 'Z': 2 };
  
      const createControls = () => {
        createControl("X", -15, 15, 0.1);
        createControl("Y", -15, 15, 0.1);
        createControl("Z", -15, 15, 0.1);
        createControl("Radius", 0.1, 5, 0.1);
        createControl("Color");
        createControl("Material");
        createControl("Fuzziness", 0.0, 1.0, 0.01);
        createControl("Reflectance", 0.0, 1.0, 0.01);
        createControl("Refractance", 0.0, 1.0, 0.01);

        createControl("Reset");
      }
      const createControl = (label: 'X' | 'Y' | 'Z' | 'Radius' | 'Color' | 'Material' 
        | 'Fuzziness' | 'Reflectance'
        | 'Refractance'| 'Reset', 
        min?: number, max?: number, step?: number) => {
        const li = document.createElement("li");
        li.textContent = `${label}: `;

        if (label == 'Reset') {
          const resetButton = document.createElement("button");
          resetButton.textContent = "Reset";
          resetButton.addEventListener("click", () => {
            // Reset properties
            sphere.position.set(sphere.initialProperties.position);
            sphere.radius = sphere.initialProperties.radius;
            sphere.color.set(sphere.initialProperties.color); 
            sphere.material = sphere.initialProperties.material;
            sphere.fuzziness = sphere.initialProperties.fuzziness;

            // update bbox
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
            
            // Re-sync the the ui for this sphere
            ul.innerHTML = '';
            createControls();
          });
          li.appendChild(resetButton);
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
        } else if (label === 'Color') { // Setup color picker
          const colorPicker = document.createElement("input");
          colorPicker.type = "color";
          
          // convert wgsl color Float32Array (each has element values from 0.0 to 1.0) to hexadecmial
          colorPicker.value = 
          `#${this.wgslColorToHex(sphere.color[0])}${this.wgslColorToHex(sphere.color[1])}${this.wgslColorToHex(sphere.color[2])}`;

          colorPicker.addEventListener("input", (e) => {
            const hex = (e.target as HTMLInputElement).value;
            sphere.color[0] = parseInt(hex.slice(1, 3), 16) / 255;
            sphere.color[1] = parseInt(hex.slice(3, 5), 16) / 255;
            sphere.color[2] = parseInt(hex.slice(5, 7), 16) / 255;
            Renderer.frameCount = 1;
            Scene.updatedScene = true; // causese writeBuffersto run
          });
          li.appendChild(colorPicker);
        } else if (label === "Material") {
          const select = document.createElement("select");
          const materials = ["Matte", "Metallic", "Dielectric", "Emissive"];
          materials.forEach((name, value) => {
            const option = document.createElement("option");
            option.value = value.toString();
            option.textContent = name;
            if (sphere.material === value) option.selected = true;
            select.appendChild(option);
          });

          select.addEventListener("change", (e) => {
            sphere.material = parseInt((e.target as HTMLSelectElement).value);
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
          });
          li.appendChild(select);
        } else if (label === "Fuzziness") {
          const roughnessSlider = document.createElement("input");
          roughnessSlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          roughnessSlider.min = min.toString();
          roughnessSlider.max = max.toString();
          roughnessSlider.step = step.toString();
          roughnessSlider.value = sphere.fuzziness.toString();

          const roughnessLabel = document.createElement("span");
          roughnessLabel.textContent = roughnessSlider.value;

          roughnessSlider.addEventListener("input", (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            roughnessLabel.textContent = val.toString();
            sphere.fuzziness = val;
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
          });
          li.appendChild(roughnessSlider);
          li.appendChild(roughnessLabel);
        } else if (label === "Reflectance") {
          const reflectivitySlider = document.createElement("input");
          reflectivitySlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          reflectivitySlider.min = min.toString();
          reflectivitySlider.max = max.toString();
          reflectivitySlider.step = step.toString();
          reflectivitySlider.value = sphere.reflectivity.toString();

          const reflectivityLabel = document.createElement("span");
          reflectivityLabel.textContent = reflectivitySlider.value;

          reflectivitySlider.addEventListener("input", (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            reflectivityLabel.textContent = val.toString();
            sphere.reflectivity = val;
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
          });
          li.appendChild(reflectivitySlider);
          li.appendChild(reflectivityLabel);
        } else if (label === "Refractance") {
          const refractivitySlider = document.createElement("input");
          refractivitySlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          refractivitySlider.min = min.toString();
          refractivitySlider.max = max.toString();
          refractivitySlider.step = step.toString();
          refractivitySlider.value = sphere.refractivity.toString();

          const refractivityLabel = document.createElement("span");
          refractivityLabel.textContent = refractivitySlider.value;

          refractivitySlider.addEventListener("input", (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            refractivityLabel.textContent = val.toString();
            sphere.refractivity = val;
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
          });
          li.appendChild(refractivitySlider);
          li.appendChild(refractivityLabel);
        
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

            sphere.position[map[label]] = newPos;            
            Renderer.frameCount = 1;

            Scene.updatedScene = true; 
          });
          li.appendChild(posSlider);
          li.appendChild(posLabel);
        }
        ul.appendChild(li);
      };
  
      createControls();

  
      sphereDetails.appendChild(ul);
      this.objectControls.appendChild(sphereDetails);
     
    })
  }

}