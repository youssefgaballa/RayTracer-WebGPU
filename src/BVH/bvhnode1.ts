import { Sphere } from "../sphere";
import { aabb } from "./aabb";

export class BVHNode {
    bbox: aabb;
    leftChild?: (BVHNode | null) = null;
    rightChild?: (BVHNode | null)  = null;
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
          this.leftChild = new BVHNode(objects, objectIndices, start, mid);
          this.rightChild = new BVHNode(objects, objectIndices, mid, end);
          this.bbox = aabb.fromAABB(this.leftChild.bbox, this.rightChild.bbox);
      }
    }
/*
 * Converts the tree structure into a flat array for the GPU.
 */
// static flatten(root: BVHNode): BVHNodeData[] {
//   const flatNodes: BVHNodeData[] = [];

//   const traverse = (node: BVHNode): number => {
//       const myIndex = flatNodes.length;

//       // Create the node. We use -1 as placeholders.
//       const data = new BVHNodeData(
//           new Float32Array([node.bbox.x.min, node.bbox.y.min, node.bbox.z.min]),
//           -1, // leftChild placeholder
//           new Float32Array([node.bbox.x.max, node.bbox.y.max, node.bbox.z.max]),
//           node.sphereIndex
//       );
      
//       flatNodes.push(data);

//       if (node.sphereIndex === -1) {
//           // Internal Node: Recurse and assign the resulting array indices
//           data.leftChild = traverse(node.leftChild!);
//       } else {
//           // Leaf Node: You can store the objectIdx in leftChild 
//           // and use a flag (like -1 in rightChild) to tell the GPU to stop
//           data.leftChild = node.sphereIndex;
//       }

//       return myIndex;
//   };

//   traverse(root);
//   return flatNodes;
// }
}

