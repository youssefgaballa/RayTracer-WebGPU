import { Camera } from "./camera";
import { Sphere } from "./sphere";
import { debug } from "./main";
import  { BVHNodeObject, BVHNode } from "./BVH/bvhnode";
import { Renderer } from "./renderer";
import  { vec3 } from "gl-matrix";

// export class Node {
//     minCorner: vec3
//     leftChild: number
//     maxCorner: vec3
//     sphereCount: number
// }
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
    this.sphereCount = this.spheres.length;

    this.buildBVH();
    this.newScene = true;
    if (debug && debug1) {
      console.log("scene.bvhnodes: ", this.bvhNodes);
      console.log("scene.spheres: ", this.spheres);

      // console.log("scene: ", this);
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
    ), i++) // floor - 0
    .addObject(new Sphere(
      [5.0, 3.0, 0.0], 3, [1.0, 1.0, 0.0]  //yellow - 1
    ), i++) 
    .addObject(new Sphere(
      [-5.0, 1.9, -12], 1.0, [1.0, 0.2, 0.0] //orange - 2
    ), i++)
    .addObject(new Sphere(
      [0.0, 6.3, -11.0], radius, [0.0, 1.0, 0.0] // green - 3
    ), i++)
    .addObject(new Sphere(
      [0.0, 2.3, -10.0], radius, [0.0, 0.0, 1.0] //blue - 4
    ), i++)
    .addObject(new Sphere(
      [-2.0, 4.3, -10.0], radius, [1.0, 0.0, 1.0] // magenta -5
    ), i++);

  }
  public addObject(obj: Sphere, idx: number) {
    this.spheres.push(obj);
    this.sphereIndices.push(idx);
    return this;
  }
  
  buildBVH() {
    if (debug){
      console.log("sphereIndices",this.sphereIndices )
      console.log("Renderer.toggleBVH",Renderer.toggleBVH )
    }
    this.bvhNodeObject = new BVHNodeObject(this.spheres, this.sphereIndices, 0, 
      this.spheres.length, 0);
    if (debug){
      console.log("bvhNodeobject",this.bvhNodeObject )
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

//   buildBVH01() {
//   this.sphereIndices = new Array(this.spheres.length)
//   for (var i:number = 0; i < this.sphereCount; i += 1) {
//     this.sphereIndices[i] = i;
//   }

//   this.bvhNodes = new Array(2 * this.spheres.length - 1);
//   for (var i:number = 0; i < 2 * this.spheres.length - 1; i += 1) {
//     this.bvhNodes[i] = BVHNode.noArgs();
//   }

//   var root: BVHNode = this.bvhNodes[0];
//   root.leftChild = 0;
//   root.sphereCount = this.spheres.length;
//   root.hasRoot = 1; // Mark the actual root
//   this.nodesUsed = 1

//   this.updateBounds(0);
//   this.subdivide(0);
// }

// updateBounds(nodeIndex: number) {

//   var node: BVHNode = this.bvhNodes[nodeIndex];
//   node.min = new Float32Array([999999, 999999, 999999]);
//   node.max = new Float32Array([-999999, -999999, -999999]);

//   for (var i: number = 0; i < node.sphereCount; i += 1) {
//     const sphere: Sphere = this.spheres[this.sphereIndices[node.leftChild + i]];
//     const axis: vec3 = [sphere.radius, sphere.radius, sphere.radius];

//     var temp: vec3 = [0, 0, 0]
//     vec3.subtract(temp, sphere.position, axis);
//     vec3.min(node.min, node.min, temp);

//     vec3.add(temp, sphere.position, axis);
//     vec3.max(node.max, node.max, temp);
//   }
// }

// subdivide(nodeIndex: number) {

//   var node: BVHNode = this.bvhNodes[nodeIndex];

//   if (node.sphereCount <= 2) {
//     return;
//   }

//   var extent: vec3 = [0, 0, 0];
//   vec3.subtract(extent, node.max, node.min);
//   var axis: number = 0;
//   if (extent[1] > extent[axis]) {
//     axis = 1;
//   }
//   if (extent[2] > extent[axis]) {
//     axis = 2;
//   }

//   const splitPosition: number = node.min[axis] + extent[axis] / 2;

//   var i: number = node.leftChild;
//   var j: number = i + node.sphereCount - 1;

//   while (i <= j) {
//     if (this.spheres[this.sphereIndices[i]].position[axis] < splitPosition) {
//       i += 1;
//     } else {
//       var temp: number = this.sphereIndices[i];
//       this.sphereIndices[i] = this.sphereIndices[j];
//       this.sphereIndices[j] = temp;
//       j -= 1;
//     }
//   }

//   var leftCount: number = i - node.leftChild;
//   if (leftCount == 0 || leftCount == node.sphereCount) {
//       return;
//   }

//   // const leftChildIndex: number = this.bvhNodesUsed++;
//   // const rightChildIndex: number = this.bvhNodesUsed++;
//   const leftChildIndex: number = this.nodesUsed;
//   this.nodesUsed += 1;


//   this.bvhNodes[leftChildIndex].leftChild = node.leftChild;
//   this.bvhNodes[leftChildIndex].sphereCount = leftCount;

//   node.leftChild = leftChildIndex;
//   node.sphereCount = 0;

//   this.updateBounds(leftChildIndex);
//   this.subdivide(leftChildIndex);
// }
}