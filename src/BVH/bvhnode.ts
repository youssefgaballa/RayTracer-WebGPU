import { Sphere } from "../sphere";
import { aabb } from "./aabb";
export class BVHNode {
  // min: Float32Array
  // leftChild: number
  // max: Float32Array
  // rightChild: number
  // objectIdx: number
  // depth: number = 0;
  leftChild: number
  hasRoot: number
  rightChild: number
  depth: number = 0
  objectIdx: number
  min: Float32Array
  max: Float32Array

  constructor(min: Float32Array, leftChild: number, max: Float32Array, rightChild: number, 
    objIdx: number, hasRoot: number
  ) {
    this.min = min;
    this.leftChild = leftChild;
    this.max = max;
    this.rightChild = rightChild
    this.objectIdx = objIdx;
    this.hasRoot = hasRoot;

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
      -1,
      0
    );

  }


}
export class BVHNodeObject {
  bbox: aabb;
  leftChild?: (BVHNodeObject | null) = null;
  rightChild?: (BVHNodeObject | null)  = null;
  sphereIndex: number = -1; // -1 indicates an internal node
  recursionDepth: number = -1;
  containsSphereZero: boolean = false;
  /*
  Builds the Bounding Volume Hierarchy.
  */
  constructor(objects: Sphere[], objectIndices: number[], 
    start: number, end: number, recursionDepth: number) {
    this.recursionDepth = recursionDepth;
    let objectSpan = end - start;
    this.bbox = aabb.noArg();
    for (let i: number = start; i < end; i++) {
      const objIdx = objectIndices[i];
      this.bbox.expand(objects[objIdx].bbox);
      // this.bbox.expand(objects[i].bbox);
    }
    let axis: number = this.bbox.longestAxisIndex();
    // const axis = Math.floor(Math.random() * 3); // get random axis among [0, 1, 2]

    if (objectSpan === 1) {
      this.sphereIndex = objectIndices[start]; // or  objectIndices[end]
      this.bbox = objects[this.sphereIndex].bbox;
    } else {

      const comparator = (box1Index: number, box2Index: number) => {
        // Compare bbox of two spheres along the axis variable
        const box1Interval = objects[box1Index].bbox.axisToInterval(axis);
        const box2Interval = objects[box2Index].bbox.axisToInterval(axis);
        // return a.min - b.min;
        if (box1Interval.min > box2Interval.min) {
          return 1;
        } else if (box1Interval.min < box2Interval.min) {
          return -1;
        }
        return 0; // unlikely with floating points
      };

      // Sort only the relevant segment of the index array
      const segment = objectIndices.slice(start, end).sort(comparator);
      for (let i = 0; i < objectSpan; i++) {
          objectIndices[start + i] = segment[i];
      }

      let mid = start + Math.floor(objectSpan / 2);
      
      this.leftChild = new BVHNodeObject(objects, objectIndices, start, mid, recursionDepth + 1);
      this.rightChild = new BVHNodeObject(objects, objectIndices, mid, end, recursionDepth + 1);
      
      // Re-calculate the parent bounding box based on children
      this.bbox = aabb.fromAABB(this.leftChild.bbox, this.rightChild.bbox);
    }
  }

  static markPathToSphereZero(node: BVHNodeObject | null): boolean {
    if (!node) return false;

    // Base case: This is the leaf node containing sphere 0
    if (node.sphereIndex === 0) {
      node.containsSphereZero = true;
      return true;
    }
    let leftChildHasRoot = false;
    let rightChildHasRoot = false;

    // Recursive case: Check children
    if (node.leftChild != null) {
      leftChildHasRoot = this.markPathToSphereZero(node.leftChild);
    }
    if (node.rightChild != null) {
      rightChildHasRoot = this.markPathToSphereZero(node.rightChild);

    }

    // If either child has it, this node "contains" it
    if (leftChildHasRoot || rightChildHasRoot) {
      node.containsSphereZero = true;
      return true;
    }

    return false;
  }

  /*
  * Converts the tree structure into a flat array that the GPU can read
  */
  static flatten(root: BVHNodeObject): BVHNode[] {
    this.markPathToSphereZero(root);
    const flatNodes: BVHNode[] = [];
    const queue: BVHNodeObject[] = [];
    queue.push(root);

    let head = 0;
    while (head < queue.length) {
      const node = queue[head];
      // const node = queue.pop();
      // if (node == null) continue;
      
      const data = new BVHNode(
        new Float32Array([node.bbox.x.min, node.bbox.y.min, node.bbox.z.min]),
        -1,  // leftChild placeholder index
        new Float32Array([node.bbox.x.max, node.bbox.y.max, node.bbox.z.max]),
        -1,  // rightChild placeholder index
        -1,   // objectIdx placeholder
        node.containsSphereZero ? 1 : 0
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
        data.objectIdx = node.sphereIndex;
      }
      data.depth = node.recursionDepth;
      flatNodes.push(data);
      head++;
    }

    return flatNodes;
  }




}

