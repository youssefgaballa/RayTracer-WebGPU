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
      console.log("scene built:")
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
    this.addObject(new Sphere(
      [0.0, -2000.0, 0.0], 2000.0, [0.0, 0.7, 0.3]
    ), i++)
    .addObject(new Sphere(
      [5.0, 3.0, 0.0], 3, [1.0, 1.0, 0.0]
    ), i++)
    .addObject(new Sphere(
      [-4.0, 1.9, -10], 2, [1.0, 0.2, 0.0]
    ), i++)
    .addObject(new Sphere(
      [0.0, 8.3, -11.0], radius, [0.0, 1.0, 0.0]
    ), i++);

  }
  public addObject(obj: Sphere, idx: number) {
    this.spheres.push(obj);
    this.sphereIndices.push(idx);
    return this;
  }
  
  buildBVH() {
    let bvhNodeObject: BVHNodeObject = new BVHNodeObject(this.spheres, this.sphereIndices, 0, this.spheres.length);
    this.bvhNodes = BVHNodeObject.flatten(bvhNodeObject);
  }

//   buildBVH() {

//     this.sphereIndices = new Array(this.spheres.length)
//     this.bvhNodes = new Array(2 * this.spheres.length - 1);

//     for (let i: number = 0; i < this.spheres.length; i += 1) {
//         this.sphereIndices[i] = i; // initialize to [0, 1, ... this.spheres.length - 1]
//     }

//     for (let i: number = 0; i < this.bvhNodes.length; i++) {
//         this.bvhNodes[i] = BVHNode.noArgs();
//     }

//     let root: BVHNode = this.bvhNodes[0];
//     root.leftChild = 1;
//     this.numBvhNodes++;

//     this.updateBounds(0);
//     this.subdivide(0);
// }

// updateBounds(nodeIndex: number) {

//   let node: BVHNode = this.bvhNodes[nodeIndex];
//   let newbox: aabb = aabb.noArg();
//   for (let i: number = 0; i < node.sphereCount; i += 1) {
//       const sphere: Sphere = this.spheres[this.sphereIndices[node.leftChild + i]];
//       newbox.expand(sphere.bbox);
//   }
// }

// subdivide(nodeIndex: number) {

//     let node: BVHNode = this.nodes[nodeIndex];

//     if (node.sphereCount == 1) {
//         return;
//     }

//     let extent: vec3 = [0, 0, 0];
//     vec3.subtract(extent, node.maxCorner, node.minCorner);
//     let axis: number = 0;
//     if (extent[1] > extent[axis]) {
//         axis = 1;
//     }
//     if (extent[2] > extent[axis]) {
//         axis = 2;
//     }

//     const splitPosition: number = node.minCorner[axis] + extent[axis] / 2;

//     let i: number = node.leftChild;
//     let j: number = i + node.sphereCount - 1;

//     while (i <= j) {
//         if (this.spheres[this.sphereIndices[i]].position[axis] < splitPosition) {
//             i += 1;
//         }
//         else {
//             let temp: number = this.sphereIndices[i];
//             this.sphereIndices[i] = this.sphereIndices[j];
//             this.sphereIndices[j] = temp;
//             j -= 1;
//         }
//     }

//     let leftCount: number = i - node.leftChild;
//     if (leftCount == 0 || leftCount == node.sphereCount) {
//         return;
//     }

//     const leftChildIndex: number = this.nodesUsed;
//     this.nodesUsed += 1;
//     const rightChildIndex: number = this.nodesUsed;
//     this.nodesUsed += 1;

//     this.nodes[leftChildIndex].leftChild = node.leftChild;
//     this.nodes[leftChildIndex].sphereCount = leftCount;

//     this.nodes[rightChildIndex].leftChild = i;
//     this.nodes[rightChildIndex].sphereCount = node.sphereCount - leftCount;

//     node.leftChild = leftChildIndex;
//     node.sphereCount = 0;

//     this.updateBounds(leftChildIndex);
//     this.updateBounds(rightChildIndex);
//     this.subdivide(leftChildIndex);
//     this.subdivide(rightChildIndex);
//   }
}

