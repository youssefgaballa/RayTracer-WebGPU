import { vec3 } from "gl-matrix";
import { clamp } from "./util";

export class Camera {
  position: Float32Array;
  /* Spherical coordinate system:
     is same as en.wikipedia.org/wiki/Spherical_coordinate_system except: 
     WebGPU uses a left handed coordinate system with y-axis pointing up
     and the wikipedia page uses right handed system with z-axis up.
     So we swap the roles of the y axis and z-axis in the right handed system.
     So the calculation of y in this.forwards is the calculation of z in a 
     right handed coordinate system, and vice versa
  */
  // Polar Angle (theta): betweeen the y-axis and polar axis
  polarAngle: number;
  // Azimuthal Angle (phi): between x-axis and projection of the polar axis on x-z plane 
  azimuthalAngle: number;
  
  forwards!: Float32Array;
  right!: Float32Array;
  up!: Float32Array;
  fov: number;

  constructor(position: number[], fov: number = 75) {
    this.position = new Float32Array(position);
    // looking at +Z
    this.polarAngle = clamp(Math.PI / 2, Number.EPSILON, Math.PI - Number.EPSILON); 
    this.azimuthalAngle = clamp(Math.PI / 2, Number.EPSILON, Math.PI - Number.EPSILON);
    this.fov = fov;
    this.recalculate_vectors();
  }

  recalculate_vectors() {

    this.forwards = new Float32Array([
      Math.sin(this.polarAngle) * Math.cos(this.azimuthalAngle) , // x
      Math.cos(this.polarAngle),                                  // y
      Math.sin(this.polarAngle) * Math.sin(this.azimuthalAngle) , // z
    ]);

    const fov_radians = (this.fov * Math.PI) / 180.0;
    // const fov_factor = Math.tan(fov_radians / 2.0);

    this.right = new Float32Array([0.0, 0.0, 0.0]);
    vec3.cross(this.right, [0.0, 1.0, 0.0], this.forwards);
    vec3.normalize(this.right, this.right); 
    // vec3.scale(this.right, this.right, fov_factor);

    this.up = new Float32Array([0.0, 0.0, 0.0]);
    vec3.cross(this.up, this.forwards, this.right);
    vec3.normalize(this.up, this.up);
    // vec3.scale(this.up, this.up, fov_factor);
  }
}
