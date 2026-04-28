export class Sphere {
  // Vec3 of world coordinates of sphere center
  position: Float32Array
  radius: Float32Array
  color: Float32Array

  constructor(center: number[], radius: number, color: number[]) {
    this.position = new Float32Array(center);
    this.radius = new Float32Array(1);
    this.radius[0] = radius;
    this.color = new Float32Array(color);
  }
}