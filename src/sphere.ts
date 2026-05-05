import { aabb } from "./BVH/aabb";
import { vec3 } from 'gl-matrix';
import { debug } from "./main";
const debug1 = false;
// materialTypes:
//   matte: 0,
//   metallic: 1,
//   refractive: 2,    
//   emissive: 3


export class Sphere {
  // Vec3 of world coordinates of sphere center
  position: Float32Array
  radius: number
  color: Float32Array
  bbox!: aabb;
  material: number;
  fuzziness: number;
  reflectivity: number;
  refractivity: number; // aka, index of refraction
  emissionStrength: number;


  initialProperties: {
    position: Float32Array;
    radius: number;
    color: Float32Array;
    bbox: aabb;
    material: number;
    fuzziness: number;
    reflectivity: number;
    refractivity: number;
    emissionStrength: number;

  };

  constructor(position: number[], radius: number, color: number[], material: number,
     fuzziness: number, reflectivity: number, refractivity: number,  emissionStrength: number
    ) {
    this.position = new Float32Array(position);
    this.radius = radius;
    this.color = new Float32Array(color);
    this.material = material;
    this.fuzziness = fuzziness;
    this.reflectivity = reflectivity
    this.refractivity = refractivity;
    this.emissionStrength = emissionStrength;
    this.updatebbox();
    this.initialProperties = {
      position: new Float32Array(this.position),
      radius: this.radius,
      color: new Float32Array(this.color),
      bbox: this.bbox,
      material: this.material,
      fuzziness: this.fuzziness,
      reflectivity: this.reflectivity,
      refractivity: this.refractivity,
      emissionStrength: this.emissionStrength
    }
  }

  public updatebbox() {
    const a = vec3.create();
    const b = vec3.create();
    const rvec = new Float32Array([this.radius, this.radius, this.radius])
    vec3.sub(a, this.position as vec3, rvec as vec3);
    vec3.add(b, this.position as vec3, rvec as vec3);
    if (debug && debug1) {
      console.log("-------")
      console.log("this", this)
      console.log("rvec", rvec);
      console.log("a", a);
      console.log("b", b);
    }
    this.bbox = aabb.fromVec3f(
      new Float32Array(a), new Float32Array(b)
    );
  }
}