import { vec3 } from "gl-matrix";
import { aabb } from "./BVH/aabb";
import { BVHNode } from "./BVH/bvhnode";
import { Camera } from "./camera";
import { Sphere } from "./sphere";

export class Scene {
  spheres: Sphere[];
  camera: Camera;
  nodes!: BVHNode[]
  nodesUsed: number = 0
  sphereIndices!: number[]
  // bbox: aabb;
  constructor() {
    this.spheres = new Array(); // empty
    this.camera = new Camera([1.0, 4.0, -20.0]);
    this.
      // this.bbox = aabb.noArg();
    buildBVH();
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

    this.spheres.push(new Sphere(
      [0.0, -2000.0, 0.0], 2000.0, [0.0, 0.7, 0.3]
    ));
    this.spheres.push(new Sphere(
      [5.0, 3.0, 0.0], 3, [1.0, 1.0, 0.0]
    ));
    this.spheres.push(new Sphere(
      [-4.0, 1.9, -10], 2, [1.0, 0.2, 0.0]
    ));
    this.spheres.push(new Sphere(
      [0.0, 8.3, -11.0], radius, [0.0, 1.0, 0.0]
    ));
    // this.spheres.push(new Sphere(
    //   [0.0, 0.5, 5.0], radius, [0.0, 1.0, 1.0]
    // ));
    

  }
  // public addObject(obj: Sphere) {
  //   this.spheres.push(obj);
  //   this.bbox = aabb.fromAABB(this.bbox, obj.bbox);
  // }
  buildBVH() {

    this.sphereIndices = new Array(this.spheres.length)
    for (var i:number = 0; i < this.spheres.length; i += 1) {
        this.sphereIndices[i] = i;
    }

    this.nodes = new Array(2 * this.spheres.length - 1);
    for (var i:number = 0; i < 2 * this.spheres.length - 1; i += 1) {
        this.nodes[i] = BVHNode.noArgs();
    }

    var root: BVHNode = this.nodes[0];
    root.leftChild = 0;
    root.sphereCount = this.spheres.length;
    this.nodesUsed += 1

    this.updateBounds(0);
    this.subdivide(0);
}

updateBounds(nodeIndex: number) {

    var node: BVHNode = this.nodes[nodeIndex];
    node.minCorner = [999999, 999999, 999999];
    node.maxCorner = [-999999, -999999, -999999];

    for (var i: number = 0; i < node.sphereCount; i += 1) {
        const sphere: Sphere = this.spheres[this.sphereIndices[node.leftChild + i]];
        const axis: vec3 = [sphere.radius, sphere.radius, sphere.radius];

        var temp: vec3 = [0, 0, 0]
        vec3.subtract(temp, sphere.position, axis);
        vec3.min(node.minCorner, node.minCorner, temp);

        vec3.add(temp, sphere.position, axis);
        vec3.max(node.maxCorner, node.maxCorner, temp);
    }
}

subdivide(nodeIndex: number) {

    var node: BVHNode = this.nodes[nodeIndex];

    if (node.sphereCount <= 2) {
        return;
    }

    var extent: vec3 = [0, 0, 0];
    vec3.subtract(extent, node.maxCorner, node.minCorner);
    var axis: number = 0;
    if (extent[1] > extent[axis]) {
        axis = 1;
    }
    if (extent[2] > extent[axis]) {
        axis = 2;
    }

    const splitPosition: number = node.minCorner[axis] + extent[axis] / 2;

    var i: number = node.leftChild;
    var j: number = i + node.sphereCount - 1;

    while (i <= j) {
        if (this.spheres[this.sphereIndices[i]].position[axis] < splitPosition) {
            i += 1;
        }
        else {
            var temp: number = this.sphereIndices[i];
            this.sphereIndices[i] = this.sphereIndices[j];
            this.sphereIndices[j] = temp;
            j -= 1;
        }
    }

    var leftCount: number = i - node.leftChild;
    if (leftCount == 0 || leftCount == node.sphereCount) {
        return;
    }

    const leftChildIndex: number = this.nodesUsed;
    this.nodesUsed += 1;
    const rightChildIndex: number = this.nodesUsed;
    this.nodesUsed += 1;

    this.nodes[leftChildIndex].leftChild = node.leftChild;
    this.nodes[leftChildIndex].sphereCount = leftCount;

    this.nodes[rightChildIndex].leftChild = i;
    this.nodes[rightChildIndex].sphereCount = node.sphereCount - leftCount;

    node.leftChild = leftChildIndex;
    node.sphereCount = 0;

    this.updateBounds(leftChildIndex);
    this.updateBounds(rightChildIndex);
    this.subdivide(leftChildIndex);
    this.subdivide(rightChildIndex);
  }
}

