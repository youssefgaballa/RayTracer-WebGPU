
import { vec3 } from "gl-matrix";
import  { aabb } from "./BVH/aabb";

// materialTypes:
//   matte: 0,
//   metallic: 1,
//   refractive: 2,    
//   emissive: 3

export class Triangle {
  v0: Float32Array;
  color: Float32Array;
  v1: Float32Array;
  material: number;
  v2: Float32Array;
  reflectivity: number;
  width!: number;
  normal: Float32Array;
  refractivity: number;

  fuzziness: number;
 
  bbox!: aabb;
  
 
  initialProperties: {
    v0: Float32Array;
    color: Float32Array;
    v1: Float32Array;
    material: number;
    v2: Float32Array;
    reflectivity: number;

    normal: Float32Array;
    refractivity: number;

    fuzziness: number;
    bbox: aabb;
    width: number;
  };
  constructor(
    v0: number[], v1: number[], v2: number[], 
    color: number[], material: number, 
    fuzziness: number, reflectivity: number, refractivity: number
  ) {
    this.v0 = new Float32Array(v0);
    this.v1 = new Float32Array(v1);
    this.v2 = new Float32Array(v2);
    
    this.color = new Float32Array(color);
    this.material = material;
    this.fuzziness = fuzziness;
    this.reflectivity = reflectivity;
    this.refractivity = refractivity;

    this.normal = new Float32Array(3);
    

    this.calculateNormal();
    this.updatebbox();
    this.calculateWidth();
    this.initialProperties = {
      v0: new Float32Array(this.v0),
      color: new Float32Array(this.color),
      v1:  new Float32Array(this.v1),
      material: this.material,
      v2: new Float32Array(this.v2),
      reflectivity: this.reflectivity,
    
      normal: new Float32Array(this.normal),
      refractivity: this.refractivity,
    
      fuzziness: this.fuzziness,
     
      bbox: this.bbox,
      width: this.width
    };
  }

  private calculateWidth() { // assuming 2 triangles where abs(tri.v2 - tri.v1) are equal
    let vec = vec3.create();
    vec3.sub(vec, this.v2, this.v1);
    this.width =  vec3.length(vec);
  }

  public increaseWidth(newWidth: number) {
    // edge from v1 to v2 and edge from v0 to v2 have length equal to old width

    if (this.width < 0.000001) return;

    let scale = newWidth / this.width;

    // Scale the side vectors by the new width
    vec3.scale(this.v0, this.v0, scale);
    vec3.scale(this.v1, this.v1, scale);
    vec3.scale(this.v2, this.v2, scale);

    this.width = newWidth;
    this.updatebbox();
    this.calculateNormal();
  }

  private calculateNormal() {
    const edge1 = vec3.sub(vec3.create(), this.v1, this.v0);
    const edge2 = vec3.sub(vec3.create(), this.v2, this.v0);
    vec3.cross(this.normal, edge1, edge2);
    vec3.normalize(this.normal, this.normal);
  }

  public updatebbox() {
    this.bbox = aabb.fromVec3f(this.v0, this.v1);

    this.bbox.expand(aabb.fromVec3f(this.v2, this.v2));
  }
}