
export class Interval {
  min: number;
  max: number;

  constructor(min: number, max: number) {
    this.min = min;
    this.max = max;
  }
  static noArg() {
    return new Interval(Number.MAX_VALUE, -Number.MAX_VALUE); // (-infinity, +infinity)
  }
  static fromInterval(a: Interval, b: Interval) {
    let min = a.min <= b.min ? a.min : b.min;
    let max = a.max >= b.max ? a.max : b.max;

    return new Interval(min, max); // (-infinity, +infinity)
  }

}