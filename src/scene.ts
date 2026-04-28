import { Camera } from "./camera";
import { Sphere } from "./sphere";

export class Scene {
  spheres: Sphere[];
  numSpheres: number;
  camera: Camera;

  constructor() {
    this.spheres = new Array(); // empty
    this.numSpheres = this.spheres.length;
    this.camera = new Camera([0.0, 0.0, -20.0]);
  }

  public createRandomSpheres(num: number) {
    this.spheres.length = num;
    this.numSpheres = num;
    for (let i = 0; i < this.spheres.length; i++) {
      // const center: number[] = [
      //   -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
      //   -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
      //   -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
      // ];
      const center: number[] = [
        3.0 + 7.0 * Math.random(),
        -5.0 + 10.0 * Math.random(),
        0.0
    ];
      const radius: number // Range: [0.1, 2.0)
        = 0.1 + 1.9 * Math.random(); 

      const color: number[] = [ // Range: [0.3, 0.1)
        0.3 + 0.7 * Math.random(), 
        0.3 + 0.7 * Math.random(),
        0.3 + 0.7 * Math.random(),
      ];

      this.spheres[i] = new Sphere(center, radius, color);
    }
  }

  public createTwoSpheres() {
  //   this.spheres = [
  //     // Camera is at [0,0,-1] looking at +Z. 
  //     // Put a sphere at [0,0,5] (6 units in front)
  //     new Sphere([0.0, 0.0, 5.0], 1.0, [1.0, 0.0, 0.0]),
  //     // Put one slightly to the side
  //     new Sphere([2.0, 0.0, 8.0], 1.5, [0.0, 1.0, 0.0])
  // ];
  const radius = 0.5
    this.spheres.length = 2;
    this.spheres[0] = new Sphere(
      [-1.0, -1.0, 0.0], radius, [1.0, 0.0, 0.0]
    );
    this.spheres[1] = new Sphere(
      [1.0, 1.0, 0.0], radius, [0.0, 1.0, 0.0]
    );
    this.spheres[2] = new Sphere(
      [5.0, 0.1, 0.0], radius, [0.0, 1.0, 0.0]
    );
    this.numSpheres = this.spheres.length;

  }

}
