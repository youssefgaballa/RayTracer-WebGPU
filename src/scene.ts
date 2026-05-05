import { Camera } from "./camera";
import { Sphere } from "./sphere";
import { debug } from "./main";
import  { BVHNodeObject, BVHNode } from "./BVH/bvhnode";
import { Renderer } from "./renderer";
import  { Triangle } from "./triangle";

const debug1 = true;
export class Scene {
  spheres: Sphere[];
  triangles: Triangle[];
  numSpheres!: number;
  sphereCount!: number
  camera: Camera;

  objectIndeces!: number[]
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
    this.triangles = new Array(); // empty

    this.camera = new Camera([1.0, 5.0, -18.0]);
    this.objectIndeces = [];
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
      console.log("scene.triangles: ", this.triangles);

      console.log("scene.bvhnodes: ", this.bvhNodes);
      console.log("scene.bvhNodeObject: ", this.bvhNodeObject);
      console.log("Scene.bvhMaxDepth: ", Scene.bvhMaxDepth);

      // console.log("scene: ", this);
    }
  }

  public buildScene() {
    this.spheres = [];
    this.triangles = [];
    this.objectIndeces = [];
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
    this.skyColorReset.addEventListener("click", () => {
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
    this.skyColorInput.addEventListener("input", (event: InputEvent) => {
      const hex = (event.target as HTMLInputElement).value;
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
  private getRandomInt(min: number, max: number): number {
    
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getRandomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
  public createRandomSpheres(num: number) {
    let i = 2;
    this.addFloor();
    for (let j = 0; j < num; j++) {
      this.addSphere(new Sphere(
        [
          this.getRandomFloat(-10, 10), // Range: [-10.0, 10.0)
          this.getRandomFloat(2.0, 10), // Range: [2.0, 10.0)
          this.getRandomFloat(-10, 10), // Range: [-10.0, 10.0)
        ], 
        this.getRandomFloat(0.1, 2.0), // Range: [0.1, 2.0)
        [ 
          this.getRandomFloat(0.0, 1.0), 
          this.getRandomFloat(0.0, 1.0),
          this.getRandomFloat(0.0, 1.0),
        ],
        this.getRandomInt(0,2), // material
        this.getRandomFloat(0.0, 1.0), //fuzziness
        this.getRandomFloat(0.0, 1.0), //reflectivity
       this.getRandomFloat(0.1, 3.0), // index of refraction
       this.getRandomFloat(0.0, 10.0)
      ), i++)

    }
    this.createUI();

  }

  public createScene1() {
    const radius = 0.5
    let i = 2;
    // const bigR = 2000
    this.addFloor()
    // .addObject(new Sphere(
    //   [0.0, -bigR, 0.0], bigR, [0.0, 0.7, 0.3],// floor - 0
    //   0, // matte
    //   1.0, 
    //   0.0,
    //   1.0 // index of refraction
    // ), i++) 
    .addSphere(new Sphere(
      [5.0, 3.0, 0.0], 3, [1.0, 1.0, 0.0],//2: yellow
      1 ,// metallic
       0.0,
       1.0,// index of refraction
       1.0,
       0.0
    ), i++) 
    .addSphere(new Sphere(
      [-5.0, 1.9, -12], 1.0, [1.0, 0.2, 0.0],//3: orange
      1, // metallic
      0.2,
      0.5,
      1.0,
      0.0
    ), i++)
    .addSphere(new Sphere(
      [-2.0, 4.3, 0.0], 3, [1.0, 1.0, 0.0],// 4: yellow
      2, // refractive
      0.0,
      1.0,
      1.0,
      0.0
    ), i++)
    .addSphere(new Sphere(
      [18.0, 3.0, -11.0], 3, [0.0, 1.0, 0.0],//5:  green
      3, // Emissive
      1.0,
      0.0,
      1.0,
      1.0
    ), i++)
    .addSphere(new Sphere(
      [0.0, 6.3, -11.0], radius, [0.0, 1.0, 0.0],//6:  green
      0, // refractive
      1.0,
      0.0,
      1.0,
      0.0
    ), i++)
    .addSphere(new Sphere(
      [12.0, 3.0, -10.0], 3.0, [0.0, 0.0, 1.0],// 7: blue
      0, // matte
      1.0,
      0.0,
      1.0,
      0.0
    ), i++)
    .addSphere(new Sphere(
      [-2.0, 4.3, -10.0], radius, [1.0, 0.0, 1.0],// 8: magenta
      0, // matte
      1.0,
      0.0,
      1.0 ,
      0.0
    ), i++)
;
    this.createUI();
    this.debug()
  }

  public addFloor() {
    const halfW = 200;
    const p1 = [-halfW, 0, -halfW];
    const p2 = [ halfW, 0, -halfW];
    const p3 = [ halfW, 0,  halfW];
    const p4 = [-halfW, 0,  halfW];
    this
    .addTriangle(new Triangle(p1, p3, p2,    [0.2, 0.8, 0.2], 0, 0, 0, 1), 0
    )
    .addTriangle(new Triangle(p3, p1, p4, [0.2, 0.8, 0.2], 0, 0, 0, 1), 1);
    return this;
  }
  public addSphere(obj: Sphere, idx: number) {
    this.spheres.push(obj);
    this.objectIndeces.push(idx);
    return this;
  }
  public addTriangle(obj: Triangle, idx: number) {
    this.triangles.push(obj);
    this.objectIndeces.push(idx);
    return this;
  }
  buildBVH() {
    // if (debug){
    //   console.log("sphereIndices",this.sphereIndices )
    //   console.log("Renderer.toggleBVH",Renderer.toggleBVH )
    
    // }
    this.bvhNodes = [];
    this.bvhNodeObject =  {} as BVHNodeObject;
    const objects = [...this.triangles, ...this.spheres];
    console.log("objects", objects);
    this.bvhNodeObject = new BVHNodeObject(objects as (Sphere | Triangle)[], this.objectIndeces, 
    0, objects.length, 0);
    // console.log("bvhNodeObject1", this.bvhNodeObject);

    // this.bvhNodeObject = new BVHNodeObject(this.spheres as Sphere[], this.objectIndeces, 
    // 0, this.spheres.length, 0);

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
    this.triangles.forEach((obj: Triangle, idx: number) => {
      const triDetails = document.createElement("details");
      const triSummary = document.createElement("summary");
      if (idx == 0) {
        triSummary.textContent = `Quad ${idx}`;

      } else if (idx == 1) {
        return;
      }
      triDetails.appendChild(triSummary);
      
      const ul = document.createElement("ul");
      const createControls = () => {

        createControl("Width", 0.1, 1000, 0.1);
        createControl("Color");
        createControl("Checkerboard");

        createControl("Reset");
      }

      const createControl = (label: 'Width' | 'Color' | 'Checkerboard' | 'Reset', 
        min?: number, max?: number, step?: number) => {

        const li = document.createElement("li");
        li.textContent = `${label}`
        if (label == 'Reset') {
          const resetButton = document.createElement("button");
          resetButton.textContent = "Reset";
          resetButton.addEventListener("click", () => {
            // Reset properties
            obj.color.set(obj.initialProperties.color); 
            obj.material = obj.initialProperties.material;
            obj.reflectivity = obj.initialProperties.reflectivity;
            obj.normal = obj.initialProperties.normal;
            obj.refractivity = obj.initialProperties.refractivity;
            obj.fuzziness = obj.initialProperties.fuzziness;
            obj.increaseWidth(obj.initialProperties.width);

            // update bbox
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
            
            // Re-sync the the ui
            ul.innerHTML = '';
            createControls();
          });
          li.appendChild(resetButton);
          
        } else if (label == 'Width'){
          const widthSlider = document.createElement("input");

          widthSlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          widthSlider.min = min.toString();
          widthSlider.max = max.toString();
          widthSlider.step = step.toString();
          widthSlider.value = obj.width.toString();

          const widthLabel = document.createElement("span");
          widthLabel.textContent = widthSlider.value;

          widthSlider.addEventListener("input", (event: InputEvent) => {
            const newWidth = parseFloat((event.target as HTMLInputElement).value);
            widthLabel.textContent = newWidth.toString();
            obj.increaseWidth(newWidth);
            this.triangles[1].increaseWidth(newWidth)
            Renderer.frameCount = 1;

            Scene.updatedScene = true; 
          });
          li.appendChild(widthSlider);
          li.appendChild(widthLabel);
        } else if (label == 'Color') {
            const colorPicker = document.createElement("input");
            colorPicker.type = "color";
            
            // convert wgsl color Float32Array (each has element values from 0.0 to 1.0) to hexadecmial
            colorPicker.value = 
            `#${this.wgslColorToHex(obj.color[0])}${this.wgslColorToHex(obj.color[1])}${this.wgslColorToHex(obj.color[2])}`;
  
            colorPicker.addEventListener("input", (e) => {
              const hex = (e.target as HTMLInputElement).value;
              const newColor = [parseInt(hex.slice(1, 3), 16) / 255,
                parseInt(hex.slice(3, 5), 16) / 255,parseInt(hex.slice(5, 7), 16) / 255
              ]
              obj.color[0] = newColor[0];
              this.triangles[1].color[0] = newColor[0];
              obj.color[1] = newColor[1];
              this.triangles[1].color[1] = newColor[1];

              obj.color[2] = newColor[2];
              this.triangles[1].color[2] = newColor[2];

              Renderer.frameCount = 1;
              Scene.updatedScene = true; // causese writeBuffersto run
            });
            li.appendChild(colorPicker);
          
        } else if (label == 'Checkerboard') {
          li.textContent = '';
          const toggleCheckerBoard = document.createElement("button");
          toggleCheckerBoard.textContent = "Toggle Checkerboard"
          toggleCheckerBoard.classList.add("toggle-btn")
          toggleCheckerBoard.classList.add("active")

          toggleCheckerBoard.addEventListener("click", () => {
            toggleCheckerBoard.classList.toggle("active");
            Renderer.isCheckerBoard = 
            toggleCheckerBoard.classList.contains("active") ? 1 : 0;
            Renderer.frameCount = 1;
            console.log("Renderer.isCheckerBoard", Renderer.isCheckerBoard)

            Scene.updatedScene = true; 
          });
          const br = document.createElement("br");
          li.appendChild(toggleCheckerBoard);

          li.appendChild(br);
          Renderer.isCheckerBoard = 
          toggleCheckerBoard.classList.contains("active") ? 1 : 0;

    }
    ul.appendChild(li);
  }
      createControls();
      triDetails.appendChild(ul);
      this.objectControls.appendChild(triDetails);
  });
    this.spheres.forEach((obj: Sphere, idx: number) => {
      if (idx >= 12) return;
      // if (idx == 0) return;
      if (!(obj instanceof Sphere)) return
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
        createControl("Refractance", 0.1, 3.0, 0.01);
        createControl("EmissionStrength", 0.0, 10.0, 0.01);

        createControl("Reset");
      }
    

      const createControl = (label: 'X' | 'Y' | 'Z' | 'Radius' | 'Color' | 'Material' 
        | 'Fuzziness' | 'Reflectance'| 'Refractance'| 'EmissionStrength' | 'Reset', 
        min?: number, max?: number, step?: number) => {
        const li = document.createElement("li");
        li.textContent = `${label}: `;

        if (label == 'Reset') {
          const resetButton = document.createElement("button");
          resetButton.textContent = "Reset";
          resetButton.addEventListener("click", () => {
            // Reset properties
            obj.position.set(obj.initialProperties.position);
            obj.radius = obj.initialProperties.radius;
            obj.color.set(obj.initialProperties.color); 
            obj.material = obj.initialProperties.material;
            obj.fuzziness = obj.initialProperties.fuzziness;
            obj.reflectivity = obj.initialProperties.reflectivity;
            obj.refractivity = obj.initialProperties.refractivity;

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
          radiusSlider.value = obj.radius.toString();

          const radiusLabel = document.createElement("span");
          radiusLabel.textContent = radiusSlider.value;

          radiusSlider.addEventListener("input", (event: InputEvent) => {
            const newR = parseFloat((event.target as HTMLInputElement).value);
            radiusLabel.textContent = newR.toString();
            obj.radius = newR;
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
          `#${this.wgslColorToHex(obj.color[0])}${this.wgslColorToHex(obj.color[1])}${this.wgslColorToHex(obj.color[2])}`;

          colorPicker.addEventListener("input", (e) => {
            const hex = (e.target as HTMLInputElement).value;
            obj.color[0] = parseInt(hex.slice(1, 3), 16) / 255;
            obj.color[1] = parseInt(hex.slice(3, 5), 16) / 255;
            obj.color[2] = parseInt(hex.slice(5, 7), 16) / 255;
            Renderer.frameCount = 1;
            Scene.updatedScene = true; // causese writeBuffersto run
          });
          li.appendChild(colorPicker);
        } else if (label === "Material") {
          const select = document.createElement("select");
          const materials = ["Matte", "Metallic", "Reflective", "Emissive"];
          materials.forEach((name, value) => {
            const option = document.createElement("option");
            option.value = value.toString();
            option.textContent = name;
            if (obj.material === value) option.selected = true;
            select.appendChild(option);
          });

          select.addEventListener("change", (e) => {
            obj.material = parseInt((e.target as HTMLSelectElement).value);
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
          roughnessSlider.value = obj.fuzziness.toString();

          const roughnessLabel = document.createElement("span");
          roughnessLabel.textContent = roughnessSlider.value;

          roughnessSlider.addEventListener("input", (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            roughnessLabel.textContent = val.toString();
            obj.fuzziness = val;
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
          reflectivitySlider.value = obj.reflectivity.toString();

          const reflectivityLabel = document.createElement("span");
          reflectivityLabel.textContent = reflectivitySlider.value;

          reflectivitySlider.addEventListener("input", (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            reflectivityLabel.textContent = val.toString();
            obj.reflectivity = val;
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
          refractivitySlider.value = obj.refractivity.toString();

          const refractivityLabel = document.createElement("span");
          refractivityLabel.textContent = refractivitySlider.value;

          refractivitySlider.addEventListener("input", (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            refractivityLabel.textContent = val.toString();
            obj.refractivity = val;
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
          });
          li.appendChild(refractivitySlider);
          li.appendChild(refractivityLabel);
        } else if (label === "EmissionStrength") {
          const emissionSlider = document.createElement("input");
          emissionSlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          emissionSlider.min = min.toString();
          emissionSlider.max = max.toString();
          emissionSlider.step = step.toString();
          emissionSlider.value = obj.emissionStrength.toString();

          const emissionLabel = document.createElement("span");
          emissionLabel.textContent = emissionSlider.value;

          emissionSlider.addEventListener("input", (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            emissionLabel.textContent = val.toString();
            obj.emissionStrength = val;
            Renderer.frameCount = 1;
            Scene.updatedScene = true;
          });
          li.appendChild(emissionSlider);
          li.appendChild(emissionLabel);
        
        } else { // X, Y, Z
          // Cooresponds to one of X, Y, Z
          const posSlider = document.createElement("input");
          posSlider.type = "range";
          if (min == undefined || max == undefined || step == undefined) return;
          posSlider.min = min.toString();
          posSlider.max = max.toString();
          posSlider.step = step.toString();
          
          
          posSlider.value = obj.position[map[label]].toString();

          const posLabel = document.createElement("span");
          posLabel.textContent = posSlider.value;

          posSlider.addEventListener("input", (e) => {
            const newPos = parseFloat((e.target as HTMLInputElement).value);
            posLabel.textContent = newPos.toString();

            obj.position[map[label]] = newPos;            
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