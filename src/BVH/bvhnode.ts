import { vec3 } from "gl-matrix"

export class BVHNode {
  minCorner: vec3
  leftChild: number
  maxCorner: vec3
  sphereCount: number
  
  constructor(min: vec3, left: number, max: vec3, sphereCount: number) {
    this.minCorner = min;
    this.leftChild = left;
    this.maxCorner = max;
    this.sphereCount = sphereCount;
  }

  static noArgs() {
    return new BVHNode(vec3.fromValues(Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY), -1,
      vec3.fromValues(Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), 0);
  }
}