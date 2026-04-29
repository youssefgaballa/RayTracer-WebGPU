import { aabb } from "./BVH/aabb";
import { vec3 } from 'gl-matrix';

export class Sphere {
  // Vec3 of world coordinates of sphere center
  position: Float32Array
  radius: number
  color: Float32Array
  bbox: aabb;

  constructor(center: number[], radius: number, color: number[]) {
    this.position = new Float32Array(center);
    // this.radius = new Float32Array(1);
    // this.radius[0] = radius;
    this.radius = radius;
    this.color = new Float32Array(color);

    const a = vec3.create();
    const b = vec3.create();
    const rvec = new Float32Array([radius, radius, radius])
    vec3.sub(a, this.position as vec3, rvec as vec3);
    vec3.add(a, this.position as vec3, rvec as vec3);
    this.bbox = aabb.fromVec3(
      new Float32Array(a), new Float32Array(b)
    );
  }
}