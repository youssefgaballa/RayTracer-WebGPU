
export class Interval {
  min: number;
  max: number;

  constructor(min: number, max: number) {
    this.min = min;
    this.max = max;
    return this;
  }
  /*
    Creates a (default) Interval where min
    is infinity and max is -infinity
  */
  static noArg() {
    return new Interval(Number.MAX_VALUE, -Number.MAX_VALUE); // (-infinity, +infinity)
  }

  /*
    Creates a new Interval that is expanded to include 
    both a and b intervals.
    The new Interval's min is the minimum of a.min and b.min
    The new Interval's max is the maximum of a.max and b.max
  */
  static fromIntervals(a: Interval, b: Interval) {
    let min = a.min <= b.min ? a.min : b.min;
    let max = a.max >= b.max ? a.max : b.max;

    return new Interval(min, max);
  }
  size(): number {
    return this.max - this.min;
  }

  contains(num: number): boolean {
    return (this.min <= num) && (num <= this.max);
  }

  expand(delta: number) {
    let padding: number = delta/2; 

    this.min = this.min - padding;
    this.max = this.max + padding;
  }
  clamp(num: number): number {
    if (num < this.min) return this.min;
    if (num > this.max) return this.max;
    return num;
}

}