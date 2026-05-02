struct Sphere { // 16 bytes
  position: vec3<f32>,
  radius: f32,
  color: vec3<f32>,
  padding: f32
} // byte aligned to 16 bytes

struct ObjectData { // 16 + sizeof(spheres)bytes
  sphereCount: u32,
  // 12 bytes padding
  p0: u32,
  p1: u32,
  p2: u32,
  spheres: array<Sphere>,
}

struct Ray {
  direction: vec3<f32>,
  origin: vec3<f32>,
}

struct CameraData {
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

} // 64 + 64 + 64  = 128 bytes
struct HitRecord {
  t: f32,
  color: vec3<f32>,
  hitAnything: u32,
  position: vec3<f32>,
  normal: vec3<f32>,
}

struct RenderData { // 32
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
}

struct BVHNode {
  min: vec3<f32>,
  containsRoot: f32,
  max: vec3<f32>,
  p1: f32,
  left_child: f32,
  right_child: f32,  
  object_index: f32, 
  depth: f32,
}  // 12 * 4 = 48 bytes. aligned to 16 bytes = sizeof(vec3f)
struct BVH {
  numNodes: f32,
  maxDepth: f32,
  // 8 bytes padding
  p1: f32,
  p2: f32,
  
  nodes: array<BVHNode>, // aligned to 16 bytes
}

@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> cameraData: CameraData;
@group(0) @binding(2) var<storage, read> objects: ObjectData;
@group(0) @binding(3) var<uniform> renderData: RenderData;
@group(0) @binding(4) var<storage, read_write> accumulation_buffer: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> bvh: BVH;
@group(0) @binding(6) var depthBuffer: texture_storage_2d<r32float, write>;


@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {

  let canvas_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));  // canvas_size == [800, 400]
  let aspect_ratio: f32 = f32(canvas_size.x) / f32(canvas_size.y);  

  let canvas_pos: vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

  if (canvas_pos.x >= canvas_size.x || canvas_pos.y >= canvas_size.y) {
      return;
  }
  var uv: vec2<f32> = (vec2f(GlobalInvocationID.xy) + 0.5) / vec2<f32>(canvas_size) ;
  var seed: u32 = GlobalInvocationID.x + GlobalInvocationID.y * u32(renderData.image_width)
  + (renderData.frameCount * 131071u);
  let pixel_index = GlobalInvocationID.y * renderData.image_width + GlobalInvocationID.x;

  
  var ndc: vec2<f32> = (uv * 2.0) - 1.0;
  ndc.y = -ndc.y; // Range(ndc.y) = [1.0, -1.0] <-- flipped because texture coords are automatically mirrored

  /*
    box shader converts from world coordinates to ndc in vertex shader
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
    // let new_sample_color: vec3<f32> = rayColor(myRay, &seed);
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
    // outputColor = rayColor(myRay,  &seed);
    resultHitRecord = rayColor(myRay,  &seed);
    outputColor = resultHitRecord.color;
    if (renderData.hasGammaCorrection == 1) {
      outputColor = sqrt(outputColor);
    }
  }
  if (resultHitRecord.hitAnything == 1) {
    textureStore(color_buffer, canvas_pos, vec4<f32>(outputColor, 1.0));
    textureStore(depthBuffer, canvas_pos, vec4<f32>(resultHitRecord.t, 0.0, 0.0, 0.0));
  } else {
    textureStore(color_buffer, canvas_pos, vec4<f32>(outputColor, 1.0));
    textureStore(depthBuffer, canvas_pos, vec4<f32>(10000, 0.0, 0.0, 0.0));

  }
}

fn rayColor(ray: Ray, seed: ptr<function, u32>) -> HitRecord {
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  var resultingColor = vec3<f32>(0.0);
  var nearestHit: f32 = 9999;

  var currentRay: Ray = ray;
  let maxDepth: u32 = 30;
  var resultHitRecord: HitRecord;
  resultHitRecord.hitAnything = 0;
  var firstHitCaptured = false;
  for (var depth: u32 = 0; depth < maxDepth; depth++) {
    var hitRecord: HitRecord;
    var nearestHit = 10000.0;
    var hitSomething = false;

    if (renderData.useBVH == 0){
      for (var i: u32 = 0; i < objects.sphereCount; i++) {
        if (hit(currentRay, objects.spheres[i], 0.001, nearestHit, &hitRecord)) {
          nearestHit = hitRecord.t;
          hitSomething = true;
          hitRecord.hitAnything = 1;
        } 
      }
    } else if (renderData.useBVH == 1) {
      if (hit_bvh(currentRay, 0.001, nearestHit, &hitRecord)) {
        nearestHit = hitRecord.t;
        hitSomething = true;
        hitRecord.hitAnything = 1;
      }
    }
    // if (hit_bvh(currentRay, 0.001, nearestHit, &hitRecord)) {
    //     nearestHit = hitRecord.t;
    //     hitSomething = true;
    //     hitRecord.hitAnything = 1;
    //   }
    // for (var i: u32 = 0; i < objects.sphereCount; i++) {
    //     if (hit(currentRay, objects.spheres[i], 0.001, nearestHit, &hitRecord)) {
    //       nearestHit = hitRecord.t;
    //       hitSomething = true;
    //       hitRecord.hitAnything = 1;
    //     } 
    //   }
    if (hitSomething) {
      var scatterDirection: vec3<f32>;
      if (!firstHitCaptured) {
        resultHitRecord.t = hitRecord.t;
        resultHitRecord.hitAnything = 1;
        // resultHitRecord.position = hitRecord.position;
        // resultHitRecord.normal = hitRecord.normal;
        firstHitCaptured = true;
      }
      if (renderData.diffuseType == 0) { // simple diffuse
        scatterDirection = random_on_hemisphere(hitRecord.normal, seed);
      } else if (renderData.diffuseType == 1) { // lambertian
        scatterDirection = hitRecord.normal + random_unit_vector(seed);
      }
      currentRay.origin = hitRecord.position; // + (hitRecord.normal * 0.001);
      currentRay.direction = normalize(scatterDirection);
      throughput *= hitRecord.color * 0.5;
    } else {
      let t = 0.5 * (currentRay.direction.y + 1.0);
      let skyColor = (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
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

fn hit(ray: Ray, sphere: Sphere, 
  tMin: f32, tMax: f32, 
  outHitRecord: ptr<function, HitRecord>
  ) -> bool  {
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
        return true;
      }
  }
  return false;
}
fn hit_bvh(ray: Ray, ray_t_min: f32, ray_t_max: f32, outHitRecord: ptr<function, HitRecord>) -> bool {
  var stack: array<u32, 128>; // Max depth of 32 is enough for 2^32 objects
  var stackPtr: u32 = 0u;
  stack[stackPtr] = 0u; // Start at root node
  stackPtr++;
  
  var tClosest = ray_t_max;
  var hitAnything = false;
  let invD = 1.0 / ray.direction;

  while (stackPtr > 0u) {
    stackPtr--;
    let node_idx = stack[stackPtr];
    let node = bvh.nodes[node_idx];
    
    let d = hit_aabb_dist(ray, invD, node.min, node.max, ray_t_min, tClosest);
    if (d >= 1e30) { continue; }

    if (node.object_index != -1.0) { 
      var tempHit: HitRecord;
      if (hit(ray, objects.spheres[u32(node.object_index)], ray_t_min, tClosest, &tempHit)) {
          tClosest = tempHit.t;
          *outHitRecord = tempHit;
          hitAnything = true;
      }
    } else {
      // Push children. 
      // If you want a cheap optimization without extra AABB math:
      // Push Right then Left. This ensures Left is processed first.
      stack[stackPtr] = u32(node.right_child);
      stackPtr++;
      stack[stackPtr] = u32(node.left_child);
      stackPtr++;
    }
   
  }
  return hitAnything;
}
fn hit_aabb_dist(ray: Ray, invD: vec3<f32>, n_min: vec3<f32>, n_max: vec3<f32>, t_min: f32, t_max: f32) -> f32 {
    let t0 = (n_min - ray.origin) * invD;
    let t1 = (n_max - ray.origin) * invD;
    let t_near = min(t0, t1);
    let t_far = max(t0, t1);
    
    let t_enter = max(max(t_near.x, t_near.y), t_near.z);
    let t_exit = min(min(t_far.x, t_far.y), t_far.z);
    
    if (t_exit >= max(t_enter, t_min) && t_enter <= t_max) {
        return t_enter;
    }
    return 1e30; // "Infinity"
}
fn hit_aabb(ray: Ray, invD: vec3<f32>, node_min: vec3<f32>, node_max: vec3<f32>,
  ray_t_min: f32, ray_t_max: f32, outHitRecord: ptr<function, HitRecord>
  ) -> bool {
  // t0 is the intersection vector of the ray with the node's min axis
  let t0 = (node_min - ray.origin) * invD;
  // t1 is the intersection vector of the ray with the node's min axis
  let t1 = (node_max - ray.origin) * invD;
  // each component represents the intersection of the ray on the box along a certain axis
  
  let t_near = min(t0, t1);
  let t_far = max(t0, t1);
  
  // let t_start = max(ray_t_min, max(t_near.x, max(t_near.y, t_near.z)));
  // let t_end = min(ray_t_max, min(t_far.x, min(t_far.y, t_far.z)));
  
  // return t_start <= t_end;
  let t_enter = max(max(t_near.x, t_near.y), t_near.z);
  let t_exit = min(min(t_far.x, t_far.y), t_far.z);
  if (t_exit >= max(t_enter, ray_t_min) && t_enter <= ray_t_max) {
    outHitRecord.t = t_enter;
    return true;
  }
  return false;
}
// fn hit_aabb(ray: Ray, b_min: vec3<f32>, b_max: vec3<f32>, t_min: f32, t_max: f32) -> bool {
//     let invD = 1.0 / ray.direction;
//     let t0 = (b_min - ray.origin) * invD;
//     let t1 = (b_max - ray.origin) * invD;
    
//     let t_near = min(t0, t1);
//     let t_far = max(t0, t1);
    
//     let t_start = max(t_min, max(t_near.x, max(t_near.y, t_near.z)));
//     let t_end = min(t_max, min(t_far.x, min(t_far.y, t_far.z)));
    
//     return t_start <= t_end;
// }
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

 // let leftChild = u32(node.left_child);
    // let rightChild = u32(node.right_child);
    // var tempHitRecord: HitRecord;
    // if (!hit_aabb(ray, invD, node.min, node.max, ray_t_min, tMin, &tempHitRecord)) {
    //   continue;
    // }
    // if (hit_aabb(ray, node.min, node.max, ray_t_min, tMin)) {
    //   if (node.object_index >= 0.0) {
    //     // Leaf Node: Check the actual sphere
    //     let sphere_idx = u32(node.object_index);
    //     var temp_rec: HitRecord;
    //     if (hit(ray, objects.spheres[sphere_idx], ray_t_min, tMin, &temp_rec)) {
    //         hit_anything = true;
    //         tMin = temp_rec.t;
    //         *outHit = temp_rec;
    //     }
    //   } else {
    //     // Internal Node: Push children to stack
    //     stack[stackPtr] = u32(node.left_child);
    //     stackPtr++;
    //     stack[stackPtr] = u32(node.left_child) + 1u;
    //     stackPtr++;
    //   }
    // }
    // 2. If it's a leaf node (left_child == -1 or similar logic)
    // In your structure, leaf nodes usually have a valid objectIdx
    // if (node.object_index != -1) { 
    //   if (hit(ray, objects.spheres[u32(node.object_index)], ray_t_min, tMin, &tempHitRecord)) {
    //     tMin = tempHitRecord.t;
    //     *outHitRecord = tempHitRecord;
    //     hitAnything = true;
    //   }
    // } else {
      // 3. It's an internal node, add children to the stack
      // Optimization: Add the child likely to be hit last first (so closer one is processed first)
      // stack[stackPtr] = u32(node.left_child) + 1u; // Right child
      // stackPtr++;
      // stack[stackPtr] = u32(node.left_child);      // Left child
      // stackPtr++;
      // hit_aabb(ray, invD, bvh.nodes[leftChild].min, bvh.nodes[leftChild].max, ray_t_min, tMin, &tempHitRecord);
      // let leftChildDistance = tempHitRecord.t;
      // hit_aabb(ray, invD, bvh.nodes[rightChild].min, bvh.nodes[rightChild].max,  ray_t_min, tMin, &tempHitRecord);
      // let rightChildDistance = tempHitRecord.t;

      // if (leftChildDistance < rightChildDistance) {
      //   // stack[stackPtr] = rightChild; // Push right
      //   // stackPtr++;
      //   // stack[stackPtr] = leftChild;      // Push left (pops first)
      //   // stackPtr++;
      //   if (rightChildDistance < 1e30) {
      //     stack[stackPtr] = rightChild;
      //     stackPtr++;
      //   }
      //   if (leftChildDistance < 1e30) {
      //     stack[stackPtr] = leftChild;
      //     stackPtr++;
      //   }
      // } else {
      //   // stack[stackPtr] = leftChild;
      //   // stackPtr++;
      //   // stack[stackPtr] = rightChild;
      //   // stackPtr++;
      //   if (leftChildDistance < 1e30) {
      //     stack[stackPtr] = leftChild;
      //     stackPtr++;
      //   }
      //   if (rightChildDistance < 1e30) {
      //     stack[stackPtr] = rightChild;
      //     stackPtr++;
      //   }
      // }
    // }