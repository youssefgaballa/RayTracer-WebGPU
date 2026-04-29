import { Camera } from "./camera";
import { Sphere } from "./sphere";

export class Scene {
  spheres: Sphere[];
  numSpheres: number;
  camera: Camera;

  constructor() {
    this.spheres = new Array(); // empty
    this.numSpheres = this.spheres.length;
    this.camera = new Camera([1.0, 2.0, -20.0]);
  }

  public createRandomSpheres(num: number) {
    this.spheres.length = num;
    this.numSpheres = num;
    for (let i = 0; i < this.spheres.length; i++) {
      const center: number[] = [
        -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
        -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
        -10.0 + 20.0 * Math.random(), // Range: [-10.0, 10.0)
      ];

      const radius: number // Range: [0.1, 1.0)
        = 0.1 + 0.9 * Math.random(); 

      const color: number[] = [ // Range: [0.3, 0.1)
        0.3 + 0.7 * Math.random(), 
        0.3 + 0.7 * Math.random(),
        0.3 + 0.7 * Math.random(),
      ];

      this.spheres[i] = new Sphere(center, radius, color);
    }
  }

  public createTwoSpheres() {
  const radius = 0.5
    this.spheres.length = 2;

    this.spheres[0] = new Sphere(
      [0.0, -2000.0, 0.0], 2000.0, [0.0, 0.7, 0.3]
    );
    this.spheres[1] = new Sphere(
      [1.0, 1.0, 0.0], radius, [0.0, 1.0, 0.0]
    );
    this.spheres[2] = new Sphere(
      [0.0, 8.3, -11.0], radius, [0.0, 1.0, 0.0]
    );
    this.spheres[3] = new Sphere(
      [-5.0, 0.5, -10], radius, [1.0, 1.0, 0.0]
    );
    this.numSpheres = this.spheres.length;

  }

}
