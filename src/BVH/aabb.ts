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

  /*
    Creates new AABB that is expanded so that
    it encompasses the AABB of box0 and box1.

  */
  static fromAABB(box0: aabb, box1: aabb) {
    const x = Interval.fromIntervals(box0.x, box1.x);
    const y = Interval.fromIntervals(box0.y, box1.y);
    const z = Interval.fromIntervals(box0.z, box1.z);
    return new aabb(x, y, z);
  }

  expand(box: aabb) {
    this.x = Interval.fromIntervals(this.x, box.x);
    this.y = Interval.fromIntervals(this.y, box.y);
    this.z = Interval.fromIntervals(this.z, box.z);
  }

  axisToInterval(num: Number): Interval {
    switch(num) {
      case(1): {
        return this.x;
      } 
      case (2): {
        return this.y
      } 
      case(3): {
        return this.z
      }
      default: {
        return Interval.noArg();
      }
    }

  }

  longestAxisIndex(): number {
    if (this.x.size() > this.y.size()) {
      return this.x.size() > this.z.size() ? 0 : 2;
    } else { // this.x.size() <= this.y.size()
      return this.y.size() > this.z.size() ? 1 : 2;
    }

  }

  

}