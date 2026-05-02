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
  sphereIndices: number[] = [];

  /*
  Builds the Bounding Volume Hierarchy.
  */
  constructor(objects: Sphere[], objectIndices: number[], 
    start: number, end: number, recursionDepth: number) {
      this.recursionDepth = recursionDepth;
    const objectSpan = end - start;
    this.bbox = aabb.noArg();
    
    // 1. Guard against empty ranges
    if (objectSpan <= 0) return;

    // 2. Build the initial bounding box for this node
    for (let i = start; i < end; i++) {
      this.bbox.expand(objects[objectIndices[i]].bbox);
    }

    // 3. LEAF THRESHOLD: Stop if we have few enough objects
    // if (objectSpan <= 4) {
    //   this.sphereIndices = objectIndices.slice(start, end);
    //   return;
    // }
    if (objectSpan === 1) {
      this.sphereIndices = [objectIndices[start]];
      // For backward compatibility with your flatten logic:
      this.sphereIndex = objectIndices[start]; 
      return;
    }
    // 4. SAH SPLITTING LOGIC
    let bestAxis = -1;
    let bestSplitIndex = -1;
    let minCost = Number.POSITIVE_INFINITY;

    // Evaluate all 3 axes to find the cheapest split
    for (let axis = 0; axis < 3; axis++) {
      // Sort a TEMPORARY segment so we don't scramble the main buffer yet
      const testSegment = objectIndices.slice(start, end).sort((a, b) => {
        return objects[a].bbox.center()[axis] - objects[b].bbox.center()[axis];
      });

      // Test split positions to find the minimum Surface Area Heuristic cost
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

    // 5. Fallback if SAH fails to find a good split
    if (bestAxis === -1) {
      bestAxis = this.bbox.longestAxisIndex();
      bestSplitIndex = start + Math.floor(objectSpan / 2);
    }

    // 6. Apply the BEST sort to the actual buffer before recursing
    const finalSortedSegment = objectIndices.slice(start, end).sort((a, b) => {
      return objects[a].bbox.center()[bestAxis] - objects[b].bbox.center()[bestAxis];
    });

    for (let i = 0; i < objectSpan; i++) {
      objectIndices[start + i] = finalSortedSegment[i];
    }

    // 7. Recurse
    this.leftChild = new BVHNodeObject(objects, objectIndices, start, bestSplitIndex, recursionDepth + 1);
    this.rightChild = new BVHNodeObject(objects, objectIndices, bestSplitIndex, end, recursionDepth + 1);
    
    // Ensure parent box tightly fits the final children
    this.bbox = aabb.fromAABB(this.leftChild.bbox, this.rightChild.bbox);
  


  //     this.recursionDepth = recursionDepth;
  //   const objectSpan = end - start;
  //   this.bbox = aabb.noArg();
    
  //   for (let i = start; i < end; i++) {
  //     this.bbox.expand(objects[objectIndices[i]].bbox);
  //   }

  //   // LEAF THRESHOLD: If 4 or fewer spheres, stop and make a leaf.
  //   // GPUs are faster at looping through 4 spheres than traversing more nodes.
  //   if (objectSpan <= 4) {
  //     this.sphereIndices = objectIndices.slice(start, end);
  //     return;
  //   }

  //   // SAH SPLITTING LOGIC
  //   let bestAxis = -1;
  //   let bestSplit = -1;
  //   if (bestSplit <= start || bestSplit >= end) {
  //     bestSplit = start + Math.floor(objectSpan / 2); // Fallback to middle split
  // }
  //   let minCost = Number.POSITIVE_INFINITY;

  //   // Evaluate all 3 axes to find the cheapest split
  //   for (let axis = 0; axis < 3; axis++) {
  //     // const segment = objectIndices.slice(start, end).sort((a, b) => {
  //     //   return objects[a].bbox.center()[axis] - objects[b].bbox.center()[axis];
  //     // });
  //     const finalSortedSegment = objectIndices.slice(start, end).sort((a, b) => {
  //       return objects[a].bbox.center()[bestAxis] - objects[b].bbox.center()[bestAxis];
  //   });
    
  //   // Copy back into the main buffer
  //   for (let i = 0; i < objectSpan; i++) {
  //       objectIndices[start + i] = finalSortedSegment[i];
  //   }
  //     // Test possible split positions (bins)
  //     for (let i = 1; i < objectSpan; i++) {
  //       const leftBox = aabb.noArg();
  //       const rightBox = aabb.noArg();
        
  //       for (let j = 0; j < i; j++) leftBox.expand(objects[finalSortedSegment[j]].bbox);
  //       for (let j = i; j < objectSpan; j++) rightBox.expand(objects[finalSortedSegment[j]].bbox);

  //       // SAH formula: Cost = Area(L)*Count(L) + Area(R)*Count(R)
  //       const cost = leftBox.surfaceArea() * i + rightBox.surfaceArea() * (objectSpan - i);

  //       if (cost < minCost) {
  //         minCost = cost;
  //         bestAxis = axis;
  //         bestSplit = start + i;
  //       }
  //     }
  //   }

  //   // Perform the actual best split
  //   objectIndices.slice(start, end).sort((a, b) => {
  //     return objects[a].bbox.center()[bestAxis] - objects[b].bbox.center()[bestAxis];
  //   });

  //   this.leftChild = new BVHNodeObject(objects, objectIndices, start, bestSplit, recursionDepth + 1);
  //   this.rightChild = new BVHNodeObject(objects, objectIndices, bestSplit, end, recursionDepth + 1);
  //   this.bbox = aabb.fromAABB(this.leftChild.bbox, this.rightChild.bbox);
  



    // this.recursionDepth = recursionDepth;
    // let objectSpan = end - start;
    // this.bbox = aabb.noArg();
    // for (let i: number = start; i < end; i++) {
    //   const objIdx = objectIndices[i];
    //   this.bbox.expand(objects[objIdx].bbox);
    //   // this.bbox.expand(objects[i].bbox);
    // }
    // let axis: number = this.bbox.longestAxisIndex();
    // // const axis = Math.floor(Math.random() * 3); // get random axis among [0, 1, 2]

    // if (objectSpan === 1) {

    //   this.sphereIndex = objectIndices[start]; // or  objectIndices[end]
    //   this.bbox = objects[this.sphereIndex].bbox;
    // } else {

    //   // const comparator = (box1Index: number, box2Index: number) => {
    //   //   // Compare bbox of two spheres along the axis variable
    //   //   const box1Interval = objects[box1Index].bbox.axisToInterval(axis);
    //   //   const box2Interval = objects[box2Index].bbox.axisToInterval(axis);
    //   //   // return a.min - b.min;
    //   //   if (box1Interval.min > box2Interval.min) {
    //   //     return 1;
    //   //   } else if (box1Interval.min < box2Interval.min) {
    //   //     return -1;
    //   //   }
    //   //   return 0; // unlikely with floating points
    //   // };

    //   // // Sort only the relevant segment of the index array
    //   // const segment = objectIndices.slice(start, end).sort(comparator);
    //   // for (let i = 0; i < objectSpan; i++) {
    //   //     objectIndices[start + i] = segment[i];
    //   // }
    //   const segment = objectIndices.slice(start, end).sort((a, b) => {
    //     return objects[a].bbox.center()[axis] - objects[b].bbox.center()[axis];
    //   });
    //   for (let i = 0; i < objectSpan; i++) objectIndices[start + i] = segment[i];
      
    //   let mid = start + Math.floor(objectSpan / 2);
      
    //   this.leftChild = new BVHNodeObject(objects, objectIndices, start, mid, recursionDepth + 1);
    //   this.rightChild = new BVHNodeObject(objects, objectIndices, mid, end, recursionDepth + 1);
      
    //   // Re-calculate the parent bounding box based on children
    //   this.bbox = aabb.fromAABB(this.leftChild.bbox, this.rightChild.bbox);
    // }
  }

  static markPathToSphereZero(node: BVHNodeObject | null): boolean {
    if (!node) return false;

    // Base case: This is the leaf node containing sphere 0
    // if (node.sphereIndex === 0) {
    //   node.containsSphereZero = true;
    //   return true;
    // }
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
  // static flatten(root: BVHNodeObject): BVHNode[] {
  //   this.markPathToSphereZero(root);
    // const flatNodes: BVHNode[] = [];
    // const queue: BVHNodeObject[] = [];
    // queue.push(root);
    // let head = 0;
    // while (head < queue.length) {
    //   const node = queue[head];
    //   // const node = queue.pop();
    //   // if (node == null) continue;
    //   const data = new BVHNode(
    //     new Float32Array([node.bbox.x.min, node.bbox.y.min, node.bbox.z.min]),
    //     -1,  // leftChild placeholder index
    //     new Float32Array([node.bbox.x.max, node.bbox.y.max, node.bbox.z.max]),
    //     -1,  // rightChild placeholder index
    //     -1,   // objectIdx placeholder
    //     node.containsSphereZero ? 1 : 0
    //   );
    //   if (node.sphereIndex === -1 
    //     && node.leftChild != null && node.rightChild != null) {
    //     // Internal Node

    //     data.leftChild = queue.length; 
    //     data.rightChild = queue.length + 1;   //  rightChild == leftChild + 1
    //     queue.push(node.leftChild);
    //     queue.push(node.rightChild);
    //   } else {
    //     // Leaf Node
    //     data.objectIdx = node.sphereIndex;
    //   }
    //   data.depth = node.recursionDepth;
    //   flatNodes.push(data);
    //   head++;
    // }
    // return flatNodes;
    

  //   const flatNodes: BVHNode[] = [];

  //   function traverse(node: BVHNodeObject) {
  //     const currentIndex = flatNodes.length;
      
  //     const flatNode = new BVHNode(
  //       new Float32Array([node.bbox.x.min, node.bbox.y.min, node.bbox.z.min]),
  //       -1,
  //       new Float32Array([node.bbox.x.max, node.bbox.y.max, node.bbox.z.max]),
  //       -1,
  //       node.sphereIndex,
  //       0
  //     );
  //     flatNodes.push(flatNode);

  //     if (node.sphereIndex === -1) {
  //       // Internal Node: Left child is ALWAYS the next one in the array
  //       flatNode.leftChild = currentIndex + 1;
  //       traverse(node.leftChild!);
        
  //       // Right child is wherever the left branch finished
  //       flatNode.rightChild = flatNodes.length;
  //       traverse(node.rightChild!);
  //     }
  //     flatNode.hasRoot = node.containsSphereZero ? 1 : 0;
  //   }

  //   traverse(root);
  //   return flatNodes;
  // }

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
        -1,
        isLeaf ? node.sphereIndices[0] : -1, // Store the first sphere index if leaf
        0
      );
  
      // OPTIONAL: Use the 'depth' field to store how many spheres are in this leaf
      // This allows the GPU to loop through multiple spheres (e.g., 1-4)
      if (isLeaf) {
        flatNode.depth = node.sphereIndices.length; 
      }
  
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

