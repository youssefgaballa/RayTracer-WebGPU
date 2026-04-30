import { Sphere } from "../sphere";
import { aabb } from "./aabb";
export class BVHNode {
  min: Float32Array
  leftChild: number
  max: Float32Array
  rightChild: number
  objectIdx: number

  constructor(min: Float32Array, leftChild: number, max: Float32Array, rightChild: number, objIdx: number) {
    this.min = min;
    this.leftChild = leftChild;
    this.max = max;
    this.rightChild = rightChild
    this.objectIdx = objIdx;
  }

  static noArgs() {
    return new BVHNode(
      new Float32Array([
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY]),
      -1,
      new Float32Array([
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY]),
      -1,
      -1
    );

  }


}
export class BVHNodeObject {
    bbox: aabb;
    leftChild?: (BVHNodeObject | null) = null;
    rightChild?: (BVHNodeObject | null)  = null;
    sphereIndex: number = -1; // -1 indicates an internal node

    /*
    Builds the Bounding Volume Hierarchy.
    */
    constructor(objects: Sphere[], objectIndices: number[], start: number, end: number) {
      let objectSpan = end - start;
      this.bbox = aabb.noArg();
      for (let i: number = start; i < end; i++) {
        this.bbox.expand(objects[i].bbox);
      }
      let axis: number = this.bbox.longestAxisIndex();// get random axis among [0, 1, 2]
      // const axis = Math.floor(Math.random() * 3); 

      if (objectSpan === 1) {
          this.sphereIndex = objectIndices[start];
          this.bbox = objects[this.sphereIndex].bbox;
      } else {
          const comparator = (aIdx: number, bIdx: number) => {
            const a = objects[aIdx].bbox.axisToInterval(axis);
            const b = objects[bIdx].bbox.axisToInterval(axis);
            return a.min - b.min;
          };

          objectIndices.slice(start, end).sort(comparator).forEach((val, i) => {
              objectIndices[start + i] = val;
          });

          let mid = start + Math.floor(objectSpan / 2);
          this.leftChild = new BVHNodeObject(objects, objectIndices, start, mid);
          this.rightChild = new BVHNodeObject(objects, objectIndices, mid, end);
          // this.bbox = aabb.fromAABB(this.leftChild.bbox, this.rightChild.bbox);
      }
    }

  /*
  * Converts the tree structure into a flat array that the GPU can read
  */
  static flatten(root: BVHNodeObject): BVHNode[] {
    const flatNodes: BVHNode[] = [];
    const queue: BVHNodeObject[] = [root];
    

    let head = 0;
    while (head < queue.length) {
      const node = queue[head];
      
      const data = new BVHNode(
          new Float32Array([node.bbox.x.min, node.bbox.y.min, node.bbox.z.min]),
          -1, // leftChild placeholder index
          new Float32Array([node.bbox.x.max, node.bbox.y.max, node.bbox.z.max]),
          -1,  // rightChild placeholder index
          -1
      );

      if (node.sphereIndex === -1 
        && node.leftChild != null && node.rightChild != null) {
          // Internal Node

          data.leftChild = queue.length; 
          data.rightChild = queue.length + 1;   //  rightChild == leftChild + 1
          queue.push(node.leftChild);
          queue.push(node.rightChild);
      } else {
          // Leaf Node
          data.leftChild = node.sphereIndex;
          data.objectIdx = node.sphereIndex;
      }

      flatNodes.push(data);
      head++;
    }

    return flatNodes;
}


}

