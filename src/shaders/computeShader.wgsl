struct Sphere { // 48 bytes
  position: vec3<f32>,
  radius: f32,
  color: vec3<f32>,
  material: f32,
  fuzz: f32,
  reflectivity: f32,
  refractivity: f32,
  padding1: f32,
} // byte aligned to 16 bytes

struct Triangle { // 16*4 = 64 bytes
    v0: vec3f,
    reflectivity: f32,

    v1: vec3f,
    refractivity: f32,

    v2: vec3f,
    material: f32,

    color: vec3f,
    p0: f32,
    
    normal: vec3f,    // Precomputed normal
    p1: f32,
}; // byte aligned to 16 bytes

struct SpheresData { // 16 + sizeof(spheres) bytes
  skyColor: vec3<f32>,
  sphereCount: u32,
  spheres: array<Sphere>,
}
struct TriangleData { // 16 + sizeof(spheres) bytes
  sphereCount: u32,
  p0: f32,
  p1: f32,
  p2: f32,
  triangles: array<Triangle>,
}


struct Ray {
  direction: vec3<f32>,
  origin: vec3<f32>,
}

struct CameraData {// 64 + 64 + 64  = 128 bytes
  cameraPos: vec3<f32>,
  padding0: f32,
  cameraForwards: vec3<f32>,
  padding1: f32,
  cameraRight: vec3<f32>,
  padding2: f32,
  cameraUp: vec3<f32>,
  padding3: f32,

  viewProjectionMatrix: mat4x4<f32>,

  inverseViewProjectionMatrix: mat4x4<f32>
} 
struct HitRecord {
  color: vec3<f32>,
  hitAnything: bool,
  position: vec3<f32>,
  t: f32,

  normal: vec3<f32>,
  material: f32,
  fuzz: f32,
  reflectivity: f32,

  refractivity: f32
}


struct BVHNode { //12 * 4 = 48 bytes.
  min: vec3<f32>,
  leftChild: f32,

  max: vec3<f32>,
  skipLink: f32,
  
  containsRoot: f32,
  rightChild: f32,  
  // numChildren f32,
  objectIndex: f32, 
  depth: f32,
}  //  aligned to 16 bytes = sizeof(vec3f)

struct BVH { // 16 + sizeof(nodes) bytes
  numNodes: f32,
  maxDepth: f32,
  // 8 bytes padding
  p1: f32,
  p2: f32,
  nodes: array<BVHNode>, // aligned to 16 bytes
}

struct RenderData { // 4*11 = 44 bytes
  image_width: u32,
  image_height: u32,
  frameCount: u32,
  temporalAccumulation: u32,
  diffuseType: u32,
  hasGammaCorrection: u32,
  showBVHBoxes: u32,
  hideRootBVHBox: u32,
  depthTestBVH: u32,
  useBVH: u32,
  numRayBounces: u32,
  enableCheckerBoard: u32
}

@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> cameraData: CameraData;
@group(0) @binding(2) var<storage, read> spheresData: SpheresData;
@group(0) @binding(3) var<storage, read> trianglesData: TriangleData;
@group(0) @binding(4) var<uniform> renderData: RenderData;
@group(0) @binding(5) var<storage, read_write> accumulation_buffer: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> bvh: BVH;
@group(0) @binding(7) var depthBuffer: texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
  let canvas_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));  // canvas_size == [800, 400]
  let aspect_ratio: f32 = f32(canvas_size.x) / f32(canvas_size.y);  

  let canvas_pos: vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

  if (canvas_pos.x >= canvas_size.x || canvas_pos.y >= canvas_size.y) {return;}
  var uv: vec2<f32> = (vec2f(GlobalInvocationID.xy) + 0.5) / vec2<f32>(canvas_size) ;
  var seed: u32 = GlobalInvocationID.x + GlobalInvocationID.y * u32(renderData.image_width)
  + (renderData.frameCount * 131071u);
  let pixel_index = GlobalInvocationID.y * renderData.image_width + GlobalInvocationID.x;
  var ndc: vec2<f32> = (uv * 2.0) - 1.0;
  ndc.y = -ndc.y; // Range(ndc.y) = [1.0, -1.0] <-- flipped because texture coords are automatically mirrored

  /*
    Box shader converts camera position from world coordinates
    to ndc in vertex shader.
    Need to convert from ndc to world coordinates so that it is synchronized with the
    box shader
  */
  var screen_pos = vec4<f32>(ndc.x, ndc.y, 0.0, 1.0); // Near plane
  var world_target = cameraData.inverseViewProjectionMatrix * screen_pos;
  var world_pos = world_target.xyz / world_target.w;
  var myRay: Ray;
  myRay.origin = cameraData.cameraPos;
  myRay.direction = normalize(world_pos - myRay.origin);

  var outputColor: vec3<f32>;
  var resultHitRecord: HitRecord;
  if (renderData.temporalAccumulation == 1u) {
    let jitter = vec2<f32>(random_float(&seed), random_float(&seed)) - 0.5;
    uv = (vec2f(GlobalInvocationID.xy) + 0.5 + jitter) / vec2f(canvas_size);
    ndc= (uv * 2.0) - 1.0;
    ndc.y = -ndc.y;
    screen_pos = vec4<f32>(ndc.x, ndc.y, 0.0, 1.0); // Near plane
    world_target = cameraData.inverseViewProjectionMatrix * screen_pos;
    world_pos = world_target.xyz / world_target.w;
    myRay.direction = normalize(world_pos - myRay.origin);

    resultHitRecord = rayColor(myRay, &seed);
    outputColor = resultHitRecord.color;

    let pixel_index = GlobalInvocationID.y * renderData.image_width + GlobalInvocationID.x;
    if (renderData.frameCount == 1u) {
      // First frame: store the color
      outputColor = resultHitRecord.color;
    } else {
      // Subsequent frames: Blend with previous data
      let old_color = accumulation_buffer[pixel_index].rgb;
      
      /*
        Weighed Average
        When frameCount is 1, output color is weighed completely
        towards old_color which on that frame is just the buffer
        from frame 0. 
      */
      let weight = 1.0 / f32(renderData.frameCount);
      outputColor = mix(old_color, resultHitRecord.color, weight);
    }
    accumulation_buffer[pixel_index] = vec4<f32>(outputColor, 1.0);

    if (renderData.hasGammaCorrection == 1) {
      outputColor = sqrt(outputColor);
    }
  } else {
    resultHitRecord = rayColor(myRay,  &seed);
    // write to accumulation_buffer to prevent stale data from appearing
    // for the first frame when the accumulation buffer is turned on
    accumulation_buffer[pixel_index] = vec4<f32>(outputColor, 1.0);

    outputColor = resultHitRecord.color;
    if (renderData.hasGammaCorrection == 1) {
      outputColor = sqrt(outputColor);
    }
  }
  // textureStore(color_buffer, canvas_pos, vec4<f32>(outputColor, 1.0));
  // textureStore(depthBuffer, canvas_pos, vec4<f32>(10000, 0.0, 0.0, 0.0));

  /* 
    Stores the outputColor from the rayTracer in the color buffer that will be rendered to the screen in
    the fragment shader fs (in textureShader.wgsl).
  */
  textureStore(color_buffer, canvas_pos, vec4<f32>(outputColor, 1.0));

   /* 
    Stores the depth value the ray tracer calculates for the first ray (before scattering),
    which is represented by resultHitRecord.t, in the depth buffer. This is needed for using a depth
    test on the BVH boxes so that the part of the wireframe box behind a sphere is not visible 
    (only if depthTestBVH == 1). 
    If the ray misses a sphere, the depth value of 10000 is used which should be farther than the far plane
  */
  // textureStore(depthBuffer, canvas_pos, vec4<f32>(resultHitRecord.t, 0.0, 0.0, 0.0));
  if (resultHitRecord.hitAnything == true) {
    textureStore(depthBuffer, canvas_pos, vec4<f32>(resultHitRecord.t, 0.0, 0.0, 0.0));
  } else {
    textureStore(depthBuffer, canvas_pos, vec4<f32>(10000, 0.0, 0.0, 0.0));

  }
  
}

fn rayColor(ray: Ray, seed: ptr<function, u32>) -> HitRecord {
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  var resultingColor = vec3<f32>(0.0);
  var nearestHit: f32 = 9999;

  var currentRay: Ray = ray;
  let maxDepth: u32 = 2;
  var resultHitRecord: HitRecord;
  resultHitRecord.hitAnything = false;
  var firstHitCaptured = false;
  for (var depth: u32 = 0; depth < renderData.numRayBounces; depth++) {
    var hitRecord: HitRecord;
    var nearestHit = 10000.0;

    if (renderData.useBVH == 0){ // looping through each object
      var nextIdx: u32 = 0;
      if (hit_triangle(currentRay, trianglesData.triangles[0], 0.001, nearestHit, &hitRecord)) {nearestHit = hitRecord.t;}
      if (hit_triangle(currentRay, trianglesData.triangles[1], 0.001, nearestHit, &hitRecord)) {nearestHit = hitRecord.t;}
      for (var i: u32 = 0; i < spheresData.sphereCount; i++) {
        if (hit(currentRay, spheresData.spheres[i], 0.001, nearestHit, &hitRecord)) {
          nearestHit = hitRecord.t;
        }
      }
    } else if (renderData.useBVH == 1) { // BVH traversal with stack -- slower
      if (hitBVH(currentRay, &hitRecord)) {

        nearestHit = hitRecord.t;
      }
      
    } 
    
     // interpolated between white and skycolor based on currentRay.direction.y
    let t = 0.5 * (currentRay.direction.y + 1.0);
    let skyColor = (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * spheresData.skyColor;
    if (hitRecord.hitAnything == true) {
      if (!firstHitCaptured) { 
        // used to record the t value for the hit on the actual sphere
        // needed for depth testing the boxes so that visually we cant see lines behind the sphere
        resultHitRecord.t = hitRecord.t;
        firstHitCaptured = true;
      }
      var scatterDirection: vec3<f32>;

      if (hitRecord.material == 0) {  // matte
        
        if (renderData.diffuseType == 0) {// simple diffuse - matte
          scatterDirection = random_on_hemisphere(hitRecord.normal, seed);
        } else {// lambertian - matte
          scatterDirection = hitRecord.normal + random_unit_vector(seed);
        }
        throughput *= hitRecord.color * 0.5;

      } else if (hitRecord.material == 1) { // metallic
        // reflectDir: currentRay.direction  - dot(currentRay.direction, hitRecord.normal) * hitRecord.normal;
        let diffuseDir = normalize(hitRecord.normal + random_unit_vector(seed));
        let reflectDir = normalize(reflect(currentRay.direction, hitRecord.normal) 
        + hitRecord.fuzz * random_on_hemisphere(hitRecord.normal, seed));
        // scatterDirection = reflect(normalize(currentRay.direction), normalize(hitRecord.normal))
        //   + hitRecord.fuzz * random_on_hemisphere(hitRecord.normal, seed);
       scatterDirection = mix(diffuseDir, reflectDir, hitRecord.reflectivity);
        // throughput *=  ((1.0 - t) * vec3(1.0, 1.0, 1.0) + t * skyColor);
        // let color = ((1.0 - t) * vec3(1.0, 1.0, 1.0) + t * skyColor);
        // throughput *= color * mix(0.5, 1.0, hitRecord.reflectivity);
        throughput *= skyColor * mix(0.0, 1.0, hitRecord.reflectivity)
        + hitRecord.color * mix(1.0, 0.0, hitRecord.reflectivity);

      } else if (hitRecord.material == 2) { // refractive material
        /* 
          if dot(currentRay.direction, hitRecord.normal) < 0.0
          then the ray is opposite to the normal, which means it is
          going into the sphere, so the ray is outward.
          Otherwise the ray is inside the sphere
        */
        let isEnteringMaterial: bool =  dot(currentRay.direction, hitRecord.normal) < 0.0;
        
        let normal = select(
          hitRecord.normal,
          -hitRecord.normal,        
          isEnteringMaterial
        );

        let airReflectivity = 1.0; // Note: the index of refraction of air is 1.0

        /*
          Assuming theta is the angle between the normal and incoming light, and theta' is
          angle between -normal and outgoing light across boundary:
          If the ray is in air, the fraction of the index of refaction of light
          going from the air to the sphere is airReflectivity / hitRecord.refractivity.
          
          So snell's law is 
          sin(theta') = (airReflectivity / hitRecord.refractivity) * sin(theta)
        
          Otherwise, the roles of theta and theta' is reversed (same for fraction)
          Snell's law is 
          sin(theta) = (hitRecord.refractivity / airReflectivity) * sin(theta')
        */
        let ri: f32 = select(
          airReflectivity / hitRecord.refractivity, 
          hitRecord.refractivity / airReflectivity,  
          isEnteringMaterial
        );
        let c = min(dot(-currentRay.direction, hitRecord.normal), 1.0);
        let s = sqrt(1.0 -  c * c);
        let cannotRefract: bool = ri * s > 1.0;
        var direction: vec3<f32>;
        
        if (cannotRefract || reflectance(c, ri) > random_float(seed)) {
          let diffuseDir = normalize(hitRecord.normal + random_unit_vector(seed));
          let reflectDir = normalize(reflect(currentRay.direction, hitRecord.normal) 
            + hitRecord.fuzz * random_on_hemisphere(hitRecord.normal, seed));
        
          scatterDirection = mix(diffuseDir, reflectDir, hitRecord.reflectivity);

          // scatterDirection = reflect(
          //   currentRay.direction,
          //   hitRecord.normal,
          // );
          // scatterDirection = reflect(currentRay.direction,  normal);
          
          throughput *= skyColor * mix(0.0, 1.0, hitRecord.reflectivity)
           + hitRecord.color * mix(1.0, 0.0, hitRecord.reflectivity);
          // throughput *= vec3f(1.0,1.0,1.0);
          // throughput *= 0.1 * hitRecord.color;
        } else {
          scatterDirection = refract(
            currentRay.direction,
             hitRecord.normal,
            ri
          );
          // throughput *= 0.5*hitRecord.color;
          // throughput *= skyColor * mix(0.0, 1.0, hitRecord.reflectivity)
          //   + hitRecord.color * mix(1.0, 0.0, hitRecord.refractivity);
          throughput *= vec3f(1.0,1.0,1.0);

        }
        
      }
      currentRay.origin = hitRecord.position; // + (hitRecord.normal * 0.001);
      currentRay.direction = normalize(scatterDirection);
    } else {
      
      resultingColor = throughput * skyColor;
      break;
    }
    resultHitRecord.hitAnything = hitRecord.hitAnything;
    if (max(throughput.r, max(throughput.g, throughput.b)) < 0.001) {
      break;
    }

  }
  resultHitRecord.color = resultingColor;

  return resultHitRecord;
}
fn reflectance(c: f32, ref_idx: f32) -> f32 {
    // Schlick's approximation for reflectance.
    var r0 = (1.0 - ref_idx) / (1.0 + ref_idx);
    r0 = r0 * r0;
    return r0 + (1.0 - r0) * pow((1.0 - c), 5.0);
}
fn hit(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, 
  outHitRecord: ptr<function, HitRecord>) -> bool  {
  let co: vec3<f32> = ray.origin - sphere.position;
  let a: f32 = dot(ray.direction, ray.direction);
  let b: f32 = 2.0 * dot(ray.direction, co);
  let c: f32 = dot(co, co) - sphere.radius * sphere.radius;
  let discriminant: f32 = b * b - 4.0 * a * c;

  if (discriminant > 0.0) {

    let t: f32 = (-b - sqrt(discriminant)) / (2 * a);

    if (t > tMin && t < tMax) {
      (*outHitRecord).t = t;
      (*outHitRecord).position = ray.origin + t * ray.direction;
      (*outHitRecord).normal = normalize(((*outHitRecord).position - sphere.position));
      (*outHitRecord).color = sphere.color;
      (*outHitRecord).material = sphere.material;
      (*outHitRecord).fuzz = sphere.fuzz;
      (*outHitRecord).reflectivity = sphere.reflectivity;
      (*outHitRecord).refractivity = sphere.refractivity;

      (*outHitRecord).hitAnything = true;
      return true;
    }
  }
  // (*outHitRecord).t = 3.0e+38; // close to infinity on miss
  return false;
}
fn hit_triangle(ray: Ray, tri: Triangle, t_min: f32, t_max: f32, outHitRecord: ptr<function, HitRecord>) -> bool {
    // var rec: HitRecord;
    // rec.hitAnything = false;

    let edge1 = tri.v1 - tri.v0;
    let edge2 = tri.v2 - tri.v0;
    let h = cross(ray.direction, edge2);
    let a = dot(edge1, h);

    if (a > -0.000001 && a < 0.000001) { return false; } // Ray is parallel

    let f = 1.0 / a;
    let s = ray.origin - tri.v0;
    let u = f * dot(s, h);

    if (u < 0.0 || u > 1.0) { return false; }

    let q = cross(s, edge1);
    let v = f * dot(ray.direction, q);

    if (v < 0.0 || u + v > 1.0) { return false; }

    let t = f * dot(edge2, q);

    if (t > t_min && t < t_max) {
        (*outHitRecord).t = t;
        (*outHitRecord).position = ray.origin + t * ray.direction;
        (*outHitRecord).normal = tri.normal;
        (*outHitRecord).material = tri.material;
        (*outHitRecord).reflectivity = tri.reflectivity;
        (*outHitRecord).refractivity = tri.refractivity;

        (*outHitRecord).hitAnything = true;

        // 
        if (renderData.enableCheckerBoard == 1) {
          let scale = 1.0; // Size of checks
          let checker = (floor((*outHitRecord).position.x * scale) + floor((*outHitRecord).position.z * scale)) % 2.0;
          var color = vec3<f32>(0.0);
          if (abs(checker) < 0.001) {
            (*outHitRecord).color  = vec3<f32>(1.0); // White
          } else {
            (*outHitRecord).color  = vec3<f32>(0.0); // Black
          }
        } else {
          (*outHitRecord).color = tri.color;
        }
       
        return true;
    }
    return false;
}

fn hitBVH(ray: Ray, outHitRecord: ptr<function, HitRecord>) -> bool { // 0.001, 10000
  (*outHitRecord).hitAnything = false;
  // t represents distance to nearest object hit so far. initialized to +infinity
  var closestT: f32 = 3.0e+38; 
  var stack: array<u32, 32>; // Max depth of 32 is enough for 2^32 scene objects
  var stackPtr: i32 = 0;
  stack[0] = 0; // Start at root 
  let invD = 1.0 / ray.direction; // only 1 division calculation

  var bvhHitRecord: HitRecord;
  bvhHitRecord.hitAnything = false;
  var leafHitRecord: HitRecord;
  leafHitRecord.hitAnything = false;
  leafHitRecord.t = closestT; // represents the nearest ray-sphere intersection hit
  var nodesTouched = 0u;
  while (stackPtr >= 0) {
    nodesTouched++;
    let nodeIdx: u32 = stack[stackPtr];
    let node: BVHNode = bvh.nodes[nodeIdx];
    stackPtr--;
    
    if (!hitAABB(ray, invD, node.min, node.max, closestT, &bvhHitRecord)) {
      continue; 
    } 
    if (bvhHitRecord.t > closestT) {
      continue;
    }
    // if (node.objectIndex < -0.0001) { // internal node
    if (node.objectIndex == -1.0) { // internal node
      let left_node = bvh.nodes[u32(node.leftChild)];
      let right_node = bvh.nodes[u32(node.rightChild)];
      var leftHitRecord: HitRecord;
      var rightHitRecord: HitRecord;
      hitAABB(ray, invD, left_node.min, left_node.max, closestT, &leftHitRecord);
      hitAABB(ray, invD, right_node.min, right_node.max, closestT, &rightHitRecord);
      // Push the one that is further away first, so the closer one is popped first
      if (leftHitRecord.t < rightHitRecord.t){
        if (rightHitRecord.t < closestT) { 
          stackPtr++; stack[stackPtr] = u32(node.rightChild); 
        }
        if (leftHitRecord.t < closestT) { 
          stackPtr++; stack[stackPtr] = u32(node.leftChild); 
        }
      } else {
        if (rightHitRecord.t < closestT) { 
          stackPtr++; stack[stackPtr] = u32(node.rightChild); 
        }
        if (leftHitRecord.t < closestT) { 
          stackPtr++; stack[stackPtr] = u32(node.leftChild); 
        }
      }
      // hitAABB(ray, invD, node.min, node.max, &bvhHitRecord);
      // stackPtr++;
      // stack[stackPtr] = u32(node.rightChild);
      // stackPtr++;
      // stack[stackPtr] = u32(node.leftChild);
      if (stackPtr > 30) { break; }
    } else { // leaf node
      let index = u32(node.objectIndex);
      if (index == 0 || index == 1 ) {
        if (hit_triangle(ray, trianglesData.triangles[index], 0.001, closestT, &leafHitRecord)) {
          (*outHitRecord) = leafHitRecord;
          closestT = leafHitRecord.t;

        }
      } else {
        if (hit(ray, spheresData.spheres[index-2], 0.001, closestT, &leafHitRecord)) { 
        //if ray intersects spherex
        (*outHitRecord) = leafHitRecord;
        closestT = leafHitRecord.t;
      }
      }
      
    }
  }  
  // (*outHitRecord).color = vec3(f32(nodesTouched) / 10.0, 0.0, 0.0);

  return (*outHitRecord).hitAnything;
}
fn hitAABB(ray: Ray, invD: vec3<f32>, node_min: vec3<f32>, node_max: vec3<f32>,
      closestT: f32, outHitRecord: ptr<function, HitRecord> ) -> bool {
    let t0 = (node_min - ray.origin) * invD;
    let t1 = (node_max - ray.origin) * invD;
    
    let t_min_v = min(t0, t1);
    let t_max_v = max(t0, t1);
    
    let t_min = max(max(t_min_v.x, t_min_v.y), t_min_v.z);
    let t_max = min(min(t_max_v.x, t_max_v.y), t_max_v.z);
    
    let hit_t = max(t_min, 0.0);
    
    if (t_max >= t_min && t_max > 0.0 
      && hit_t < closestT) {
      (*outHitRecord).hitAnything = true;
      (*outHitRecord).t = hit_t;
      return true;
    }
    return false;
}
fn hitBVHStackless(ray: Ray, outHitRecord: ptr<function, HitRecord>) -> bool {
  var i: u32 = 0u;
  let nodeCount: u32 = arrayLength(&bvh.nodes);
  let invD = 1.0 / ray.direction;

  var closestT: f32 = 3.0e+38; 

  var bvhHitRecord: HitRecord;
  var leafHitRecord: HitRecord;
  var hitAnything = false;

  // clear previous  data
  (*outHitRecord).hitAnything = false;

  while (i < nodeCount) {
    let node = bvh.nodes[i];
    
    // 1. Check AABB intersection
    if (hitAABB(ray, invD, node.min, node.max, closestT, &bvhHitRecord)) {
      
      // HIT: Check if it's a leaf
      if (node.objectIndex >= 0.0) {
        let sphereIdx = u32(node.objectIndex);
        
        if (hit(ray, spheresData.spheres[sphereIdx], 0.001, closestT, &leafHitRecord)) { 
          (*outHitRecord) = leafHitRecord;
          // (*outHitRecord).hitAnything = true;
          // (*outHitRecord).t = leafHitRecord.t;
          // (*outHitRecord).position = leafHitRecord.position;
          // (*outHitRecord).normal = leafHitRecord.normal;
          closestT = leafHitRecord.t;
          hitAnything = true;
        }
        
        i++; 
      } else {
        // Internal Node: Step into the next sequential node (leftChild)
        i++; 
      }
    } else {
      // jump to the skipLink if ray misses
      i = u32(node.skipLink);
      
      // skipLink is broken (0), prevent infinite loop
      if (i == 0u && nodeCount > 0u) { break; }
    }

    // prevent infinite loop
    if (i > 1000u) { break; }
  }
  
  return hitAnything;
}


fn pcg_hash(input: u32) -> u32 {
    var state = input * 747796405u + 2891336453u;
    var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

// Returns a random float in [0.0, 1.0)
fn random_float(seed: ptr<function, u32>) -> f32 {
    *seed = pcg_hash(*seed);
    // Divide by 2^32 - 1
    return f32(*seed) / 4294967295.0;
}

// Returns a random float in [min, max)
fn random_range(min: f32, max: f32, seed: ptr<function, u32>) -> f32 {
    return min + (max - min) * random_float(seed);
}

// Replicating your C++ random(min, max) function
fn random_vec3(min: f32, max: f32, seed: ptr<function, u32>) -> vec3<f32> {
    return vec3<f32>(
        random_range(min, max, seed),
        random_range(min, max, seed),
        random_range(min, max, seed)
    );
}
fn length_squared(v: vec3<f32>) -> f32 {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

fn random_unit_vector(seed: ptr<function, u32>) -> vec3<f32> {
    // use a loop with a limit to prevent GPU threads from being blocked
    for (var i = 0; i < 100; i++) {
        let p = random_vec3(-1.0, 1.0, seed);
        let lensq = length_squared(p);
        
        // Check if point is inside the unit sphere but not at the exact center
        if (lensq > 1e-24 && lensq <= 1.0) {
            return p / sqrt(lensq);
        }
    }
    return vec3<f32>(0.0, 1.0, 0.0); // Fallback
}


fn random_on_hemisphere(normal: vec3<f32>, seed: ptr<function, u32>) -> vec3<f32> {
    let on_unit_sphere = random_unit_vector(seed);
    if (dot(on_unit_sphere, normal) > 0.0) {
        return on_unit_sphere;
    } else {
        return -on_unit_sphere;
    }
}

