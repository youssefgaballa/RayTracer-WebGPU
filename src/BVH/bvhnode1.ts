import { Sphere } from "../sphere";
import { aabb } from "./aabb";

export class BVHNode1 {
    bbox: aabb;
    left?: BVHNode1;
    right?: BVHNode1;
    sphereIndex: number = -1; // -1 indicates an internal node

    constructor(objects: Sphere[], objectIndices: number[], start: number, end: number, axis: number = 0) {
        let objectSpan = end - start;

        if (objectSpan === 1) {
            this.sphereIndex = objectIndices[start];
            this.bbox = objects[this.sphereIndex].bbox;
        } else {
            // Sort objects along the current axis to find a split point
            const comparator = (aIdx: number, bIdx: number) => {
                const a = objects[aIdx].bbox;
                const b = objects[bIdx].bbox;
                const valA = [a.x.min, a.y.min, a.z.min][axis];
                const valB = [b.x.min, b.y.min, b.z.min][axis];
                return valA - valB;
            };

            objectIndices.slice(start, end).sort(comparator).forEach((val, i) => {
                objectIndices[start + i] = val;
            });

            let mid = start + Math.floor(objectSpan / 2);
            this.left = new BVHNode1(objects, objectIndices, start, mid, (axis + 1) % 3);
            this.right = new BVHNode1(objects, objectIndices, mid, end, (axis + 1) % 3);
            this.bbox = aabb.fromAABB(this.left.bbox, this.right.bbox);
        }
    }
}

export function flattenBVH(root: BVHNode1) {
    const flatNodes: { min: number[], max: number[], leftChild: number, objectIndex: number }[] = [];
    function fill(curr: BVHNode1, index: number) {
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
