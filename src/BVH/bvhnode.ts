import { Sphere } from "../sphere";
import { aabb } from "./aabb";

class BVHNodeData {
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

export class BVHNode {
    bbox: aabb;
    left?: (BVHNode | null) = null;
    right?: (BVHNode | null)  = null;
    sphereIndex: number = -1; // -1 indicates an internal node
    numChildren: number = 0;

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
          this.left = new BVHNode(objects, objectIndices, start, mid);
          this.right = new BVHNode(objects, objectIndices, mid, end);
          this.bbox = aabb.fromAABB(this.left.bbox, this.right.bbox);
          this.numChildren += 2;
      }
    }

    // static boxCompare(obj1: Sphere, obj2: Sphere, axisIndex: number): boolean {
    //   let obj1AxisInterval: Interval = obj1.bbox.axisToInterval(axisIndex);
    //   let obj2AxisInterval: Interval = obj2.bbox.axisToInterval(axisIndex);
    //   return obj1AxisInterval.min < obj2AxisInterval.min;
    // }

    // static boxCompare_X(obj1: Sphere, obj2: Sphere) {
    //   return this.boxCompare(obj1, obj2, 0);
    // }
    // static boxCompare_Y(obj1: Sphere, obj2: Sphere) {
    //   return this.boxCompare(obj1, obj2, 1);
    // }
    // static boxCompare_Z(obj1: Sphere, obj2: Sphere) {
    //   return this.boxCompare(obj1, obj2, 2);
    // }
}

export function flattenBVH(root: BVHNode) {
    const flatNodes: { min: number[], max: number[], leftChild: number, objectIndex: number }[] = [];
    function fill(curr: BVHNode, index: number) {
        flatNodes[index] = {
            min: [curr.bbox.x.min, curr.bbox.y.min, curr.bbox.z.min],
            max: [curr.bbox.x.max, curr.bbox.y.max, curr.bbox.z.max],
            leftChild: 0,
            objectIndex: curr.sphereIndex
        };
        if (curr.sphereIndex === -1) {
            const childrenStartIdx = flatNodes.length;
            flatNodes.push({} as any, {} as any); // Reserve slots for L and R children
            flatNodes[index].leftChild = childrenStartIdx;
            fill(curr.left!, childrenStartIdx);
            fill(curr.right!, childrenStartIdx + 1);
        }
    }
    flatNodes.push({} as any);
    fill(root, 0);
    return flatNodes;
}
