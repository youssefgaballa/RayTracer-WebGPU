import { Interval } from "./interval";

export class aabb {
  x: Interval;
  y: Interval;
  z: Interval;
  constructor(x: Interval, y: Interval, z: Interval) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static noArg() {
    return new aabb(Interval.noArg(), Interval.noArg(), Interval.noArg());
  }

  static fromVec3(a: Float32Array, b: Float32Array) {
    const x = (a[0] <= b[0]) ?
      new Interval(a[0], b[0]) : new Interval(b[0], a[0]);
    const y = (a[1] <= b[1]) ?
      new Interval(a[1], b[1]) : new Interval(b[1], a[1]);
    const z = (a[2] <= b[2]) ?
      new Interval(a[2], b[2]) : new Interval(b[2], a[2]);
    return new aabb(x, y, z);
  }
  static fromAABB(box0: aabb, box1: aabb) {
    const x = Interval.fromInterval(box0.x, box1.x);
    const y = Interval.fromInterval(box0.y, box1.y);
    const z = Interval.fromInterval(box0.z, box1.z);
    return new aabb(x, y, z);
  }

}