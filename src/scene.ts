import { Camera } from "./camera";
import { Sphere } from "./sphere";
import { debug } from "./main";
import  { BVHNodeObject, BVHNode } from "./BVH/bvhnode";

const debug1 = true;
export class Scene {
  spheres: Sphere[];
  camera: Camera;
  bvhNodes!: BVHNode[];
  sphereIndices!: number[]

  constructor() {
    this.spheres = new Array(); // empty
    this.camera = new Camera([1.0, 4.0, -20.0]);
    this.sphereIndices = [];
    this.createScene1()
    this.buildBVH();
    if (debug && debug1) {
      console.log("scene: ", this);
    }
  }

  public createRandomSpheres(num: number) {
    this.spheres.length = num;
    for (let i = 0; i < this.spheres.length; i++) {
      const center: number[] = [
        -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
        -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
        -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
      ];

      const radius: number // Range: [0.1, 1.0)
        = 0.1 + 0.9 * Math.random(); 

      const color: number[] = [ // Range: [0.3, 0.1)
        0.3 + 0.7 * Math.random(), 
        0.3 + 0.7 * Math.random(),
        0.3 + 0.7 * Math.random(),
      ];

      this.spheres[i] = new Sphere(center, radius, color);
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