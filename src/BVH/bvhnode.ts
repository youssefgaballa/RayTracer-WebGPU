export class BVHNodeData {
  min: Float32Array
  leftChild: number
  max: Float32Array
  objectIdx: number
  constructor(min: Float32Array, leftChild: number, max: Float32Array, objIdx: number) {
    this.min = min;
    this.leftChild = leftChild;
    this.max = max;
    this.objectIdx = objIdx;
  }


}