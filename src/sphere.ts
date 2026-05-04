import { aabb } from "./BVH/aabb";
import { vec3 } from 'gl-matrix';
import { debug } from "./main";
const debug1 = false;
// const materialType = {
//   matte: 0,
//   metallic: 1,
//   dielectric: 2,
//   emissive: 3
// }

export class Sphere {
  // Vec3 of world coordinates of sphere center
  position: Float32Array
  radius: number
  color: Float32Array
  bbox: aabb;
  material: number;

  constructor(center: number[], radius: number, color: number[], material: number) {
    this.position = new Float32Array(center);
    this.radius = radius;
    this.color = new Float32Array(color);
    this.material = material;
    const a = vec3.create();
    const b = vec3.create();
    const rvec = new Float32Array([radius, radius, radius])
    vec3.sub(a, this.position as vec3, rvec as vec3);
    vec3.add(b, this.position as vec3, rvec as vec3);
    if (debug && debug1) {
      console.log("-------")
      console.log("this", this)
      console.log("rvec", rvec);
      console.log("a", a);
      console.log("b", b);
    }
    this.bbox = aabb.fromVec3(
      new Float32Array(a), new Float32Array(b)
    );
  }
}