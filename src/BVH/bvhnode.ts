import { Scene } from "../scene";
import { Sphere } from "../sphere";
import  { Triangle } from "../triangle";
import { aabb } from "./aabb";
export class BVHNode {
  // min: Float32Array
  // leftChild: number
  // max: Float32Array
  // rightChild: number
  // objectIdx: number
  // depth: number = 0;
  leftChild: number
  rightChild: number
  objectIdx: number

  depth: number = 0
  skipLink: number = -1
  sphereCount: number
  hasRoot: number

  min: Float32Array
  max: Float32Array

  constructor(min: Float32Array, leftChild: number, max: Float32Array, rightChild: number, 
    objIdx: number, hasRoot: number, sphereCount: number, depth: number
  ) {
    this.min = min;
    this.leftChild = leftChild;
    this.max = max;
    this.rightChild = rightChild
    this.objectIdx = objIdx;
    this.hasRoot = hasRoot;
    this.sphereCount = sphereCount;
    this.depth = depth;
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
      0,
      0,
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
  sphereIndices: number[] = [];

  /*
  Builds the Bounding Volume Hierarchy.
  */
  constructor(objects: (Sphere | Triangle)[], objectIndices: number[], 
    start: number, end: number, recursionDepth: number) {
     
      this.recursionDepth = recursionDepth;
      const objectSpan = end - start;
      this.bbox = aabb.noArg();
      
      if (objectSpan <= 0) return;
  
      // Build the initial bounding box for this node
      for (let i = start; i < end; i++) {
        this.bbox.expand(objects[objectIndices[i]].bbox);
      }
 
      if (objectSpan === 1) {
        this.sphereIndices = [objectIndices[start]];
        this.sphereIndex = objectIndices[start]; 
        return;
      }
      // SAH
      let bestAxis = -1;
      let bestSplitIndex = -1;
      let minCost = Number.POSITIVE_INFINITY;
  
      // Loop through all 3 axes to find the cheapest split
      for (let axis = 0; axis < 3; axis++) {
        
        /*
          Sorts the objectIndices in order of their bounding box's center
        */
        const testSegment = objectIndices.slice(start, end).sort((a, b) => {
          return objects[a].bbox.center()[axis] - objects[b].bbox.center()[axis];
        });
  
        // test to find the minimum Surface Area Heuristic cost
        for (let i = 1; i < objectSpan; i++) {
          const leftBox = aabb.noArg();
          const rightBox = aabb.noArg();
          
          // Build boxes for the two potential children
          for (let j = 0; j < i; j++) leftBox.expand(objects[testSegment[j]].bbox);
          for (let j = i; j < objectSpan; j++) rightBox.expand(objects[testSegment[j]].bbox);
  
          // Cost = Area(Left) * Objects(Left) + Area(Right) * Objects(Right)
          const cost = leftBox.surfaceArea() * i + rightBox.surfaceArea() * (objectSpan - i);
  
          if (cost < minCost) {
            minCost = cost;
            bestAxis = axis;
            bestSplitIndex = start + i;
          }
        }
      }
  
      // default bbox if a good split isnt found
      if (bestAxis === -1) {
        bestAxis = this.bbox.longestAxisIndex();
        bestSplitIndex = start + Math.floor(objectSpan / 2);
      }
  
      const finalSortedSegment = objectIndices.slice(start, end).sort((a, b) => {
        return objects[a].bbox.center()[bestAxis] - objects[b].bbox.center()[bestAxis];
      });
  
      for (let i = 0; i < objectSpan; i++) {
        objectIndices[start + i] = finalSortedSegment[i];
      }
  
      this.leftChild = new BVHNodeObject(objects, objectIndices, start, bestSplitIndex, recursionDepth + 1);
      this.rightChild = new BVHNodeObject(objects, objectIndices, bestSplitIndex, end, recursionDepth + 1);
      
      // Ensure parent box tightly fits the final children
      this.bbox = aabb.fromAABB(this.leftChild.bbox, this.rightChild.bbox);
  }

  /*
    Needed to set a int representing whether the node contains the primitive
    object for the root. Allows hiding the root bounding box since
    that bounding box is often the
  */
  static markPathToSphereZero(node: BVHNodeObject | null): boolean {
    if (!node) return false;

    // Base case: This is the leaf node containing sphere 0
    if (node.sphereIndices.includes(0)) {
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
    function traverse(node: BVHNodeObject) {
      const currentIndex = flatNodes.length;
  
      // A node is a leaf if it has no children
      const isLeaf = node.leftChild === null && node.rightChild === null;
  
      const flatNode = new BVHNode(
        new Float32Array([node.bbox.x.min, node.bbox.y.min, node.bbox.z.min]),
        -1,
        new Float32Array([node.bbox.x.max, node.bbox.y.max, node.bbox.z.max]),
        -1, // objectIdx. -1 is default
        isLeaf ? node.sphereIndices[0] : -1, // Store the first sphere index if leaf
        0, // hasRoot
        0, // sphereCount
        node.recursionDepth // depth
      );
      Scene.bvhMaxDepth = Math.max(Scene.bvhMaxDepth,  node.recursionDepth);
  
      flatNodes.push(flatNode);
  
      if (!isLeaf) {
        // Internal Node logic
        flatNode.leftChild = currentIndex + 1;
        traverse(node.leftChild!);
        
        flatNode.rightChild = flatNodes.length;
        traverse(node.rightChild!);
      }
      
      flatNode.hasRoot = node.containsSphereZero ? 1 : 0;
    }
  
    traverse(root);
    return flatNodes;
  }



}

