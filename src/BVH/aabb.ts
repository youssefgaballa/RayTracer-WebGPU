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

  /*
    Equivalent to fromAABB but for vectors.
    Each axis's interval is expanded to encompas the interval for both
    vec1 and vec2 along that axis.
  */
  static fromVec3f(vec1: Float32Array, vec2: Float32Array) {
    const x = (vec1[0] <= vec2[0]) ?
      new Interval(vec1[0], vec2[0]) : new Interval(vec2[0], vec1[0]);
    const y = (vec1[1] <= vec2[1]) ?
      new Interval(vec1[1], vec2[1]) : new Interval(vec2[1], vec1[1]);
    const z = (vec1[2] <= vec2[2]) ?
      new Interval(vec1[2], vec2[2]) : new Interval(vec2[2], vec1[2]);
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

  /*
    Returns the axis
    that is longest.
    0 if x-axis.
    1 if y-axis
    2 if z-axis
  */
  longestAxisIndex(): number {
    if (this.x.size() > this.y.size()) {
      return this.x.size() > this.z.size() ? 0 : 2;
    } else { // this.x.size() <= this.y.size()
      return this.y.size() > this.z.size() ? 1 : 2;
    }

  }

  /*
    Returns a vector pointing to the center of the aabb box
  */
  center() {
    return new Float32Array([0.5 * this.x.size(),0.5 * this.y.size(),0.5 * this.z.size()])
  }
  /*
    Calculates the surface area of the bounding box
    Needed for SAH in creating bounding box.
  */
  surfaceArea(): number {
    // Calculate the length of each side
    const width = this.x.size();
    const height = this.y.size();
    const depth = this.z.size();

    // return 0 if any of the sizes are negative
    if (width < 0 || height < 0 || depth < 0) return 0;

    return 2 * (width * height + height * depth + depth * width);
}

}