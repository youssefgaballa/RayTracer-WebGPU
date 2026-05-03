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
  hitAnything: bool,
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
  enableScattering: u32
}

struct BVHNode {
  min: vec3<f32>,
  containsRoot: f32,
  max: vec3<f32>,
  sphereCount: f32,
  leftChild: f32,
  rightChild: f32,  
  objectIndex: f32, 
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

  if (canvas_pos.x >= canvas_size.x || canvas_pos.y >= canvas_size.y) {return;}
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

    // let pixelColor: vec3<f32> = rayColor1(myRay);
    // outputColor = pixelColor;

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
    // resultHitRecord = rayColor(myRay,  &seed);
    let pixelColor: vec3<f32> = rayColor1(myRay);
    outputColor = pixelColor;

    // outputColor = resultHitRecord.color;
    if (renderData.hasGammaCorrection == 1) {
      outputColor = sqrt(outputColor);
    }
  }
  textureStore(color_buffer, canvas_pos, vec4<f32>(outputColor, 1.0));
  textureStore(depthBuffer, canvas_pos, vec4<f32>(10000, 0.0, 0.0, 0.0));
  // if (resultHitRecord.hitAnything == true) {
  //   textureStore(color_buffer, canvas_pos, vec4<f32>(outputColor, 1.0));
  //   textureStore(depthBuffer, canvas_pos, vec4<f32>(resultHitRecord.t, 0.0, 0.0, 0.0));
  // } else {
  //   textureStore(color_buffer, canvas_pos, vec4<f32>(outputColor, 1.0));
  //   textureStore(depthBuffer, canvas_pos, vec4<f32>(10000, 0.0, 0.0, 0.0));

  // }
}
fn rayColor1(ray: Ray) -> vec3<f32> {

  var color: vec3<f32> = vec3(0.0, 0.0, 0.0);

  var nearestHit: f32 = 9999;
  var hitSomething: bool = false;

  var renderState: HitRecord;

  var node: BVHNode = bvh.nodes[0];
  var stack: array<BVHNode, 15>;
  var stackLocation: u32 = 0;

  for (var step = 0; step < 500; step++) {

    var sphereCount: u32 = u32(node.sphereCount);
    var contents: u32 = u32(node.leftChild);

    if (sphereCount == 0) {
      var child1: BVHNode = bvh.nodes[contents];
      var child2: BVHNode = bvh.nodes[contents + 1];

      var distance1: f32 = hit_aabb1(ray, child1);
      var distance2: f32 = hit_aabb1(ray, child2);
      if (distance1 > distance2) {
        var tempDist: f32 = distance1;
        distance1 = distance2;
        distance2 = tempDist;

        var tempChild: BVHNode = child1;
        child1 = child2;
        child2 = tempChild;
      }

      if (distance1 > nearestHit) {
        if (stackLocation == 0) {
            break;
        } else {
            stackLocation -= 1;
            node = stack[stackLocation];
        }
      } else {
        node = child1;
        if (distance2 < nearestHit) {
            stack[stackLocation] = child2;
            stackLocation += 1;
        }
      }
    } else {
      for (var i: u32 = 0; i < sphereCount; i++) {
  
        var newRenderState: HitRecord = hit_sphere(
          ray, 
          // objects.spheres[u32(sphereLookup.sphereIndices[i + contents])], 
          objects.spheres[i+contents],
          0.001, nearestHit, renderState
        );

        if (newRenderState.hitAnything) {
          nearestHit = newRenderState.t;
          renderState = newRenderState;
          hitSomething = true;
        }
      }

      if (stackLocation == 0) {
        break;
      } else {
        stackLocation -= 1;
        node = stack[stackLocation];
      }
    }
  }

  if (hitSomething) {
    color = renderState.color;
  }
  return color;
}
fn hit_aabb1(ray: Ray, node: BVHNode) -> f32 {
  var inverseDir: vec3<f32> = vec3(1.0) / ray.direction;
  var t1: vec3<f32> = (node.min - ray.origin) * inverseDir;
  var t2: vec3<f32> = (node.max - ray.origin) * inverseDir;
  var tMin: vec3<f32> = min(t1, t2);
  var tMax: vec3<f32> = max(t1, t2);

  var t_min: f32 = max(max(tMin.x, tMin.y), tMin.z);
  var t_max: f32 = min(min(tMax.x, tMax.y), tMax.z);
  if (t_max < 0.0 || t_min > t_max) {
        return 1e20; // Return a value much larger than any possible hit
    }
    
    // If t_near < 0, we are inside the box, so the distance is 0
    return max(t_min, 0.0);  
  // if (t_min > t_max || t_max < 0) {
  //   return 99999;
  // }
  // else {
  //   return t_min;
  // }
}
fn hit_sphere(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, oldRenderState: HitRecord) -> HitRecord {
    
  let co: vec3<f32> = ray.origin - sphere.position;
  let a: f32 = dot(ray.direction, ray.direction);
  let b: f32 = 2.0 * dot(ray.direction, co);
  let c: f32 = dot(co, co) - sphere.radius * sphere.radius;
  let discriminant: f32 = b * b - 4.0 * a * c;

  var renderState: HitRecord;
  renderState.color = oldRenderState.color;

  if (discriminant > 0.0) {

    let t: f32 = (-b - sqrt(discriminant)) / (2 * a);

    if (t > tMin && t < tMax) {
      renderState.t = t;
      renderState.color = sphere.color;
      renderState.hitAnything = true;
      return renderState;
    }
  }

  renderState.hitAnything = false;
  return renderState;
    
}

fn rayColor(ray: Ray, seed: ptr<function, u32>) -> HitRecord {
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  var resultingColor = vec3<f32>(0.0);
  var nearestHit: f32 = 9999;

  var currentRay: Ray = ray;
  let maxDepth: u32 = 30;
  var resultHitRecord: HitRecord;
  resultHitRecord.hitAnything = false;
  var firstHitCaptured = false;
  for (var depth: u32 = 0; depth < maxDepth; depth++) {
    var hitRecord: HitRecord;
    var nearestHit = 10000.0;
    var hitSomething = false;

    if (renderData.useBVH == 0){
      var nextIdx: u32 = 0;
      for (var i: u32 = 0; i < objects.sphereCount; i++) {
        // if (hit(currentRay, objects.spheres[i], 0.001, nearestHit, &hitRecord)) {
        //   nearestHit = hitRecord.t;
        //   hitSomething = true;
        //   hitRecord.hitAnything = true;
        // }
        let sphere = objects.spheres[nextIdx];
        if (hit(currentRay, sphere, 0.001, nearestHit, &hitRecord)) {
          nearestHit = hitRecord.t;
          hitSomething = true;
          // Change the path based on a hit to break branch prediction
          nextIdx = (nextIdx + 1) % objects.sphereCount;
        } else {
          nextIdx = (nextIdx + 1) % objects.sphereCount;
        }
        // Force a "memory barrier" effect by using a variable the compiler can't optimize
        if (nearestHit < -1.0) { break; }

      }
    } else if (renderData.useBVH == 1) {
      // if (hit_bvh(currentRay, 0.001, nearestHit, &hitRecord)) {
      if (hitBVH(currentRay, &hitRecord)) {

        nearestHit = hitRecord.t;
        hitSomething = true;
        // hitRecord.hitAnything = true;
      }
    }

    if (hitSomething) {
      var scatterDirection: vec3<f32>;
      if (!firstHitCaptured) {
        resultHitRecord.t = hitRecord.t;
        resultHitRecord.hitAnything = true;
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

    if (node.objectIndex != -1.0) { 
      var tempHit: HitRecord;
      if (hit(ray, objects.spheres[u32(node.objectIndex)], ray_t_min, tClosest, &tempHit)) {
          tClosest = tempHit.t;
          *outHitRecord = tempHit;
          hitAnything = true;
      }
    } else {
      // Push children. 
      // If you want a cheap optimization without extra AABB math:
      // Push Right then Left. This ensures Left is processed first.
      stack[stackPtr] = u32(node.rightChild);
      stackPtr++;
      stack[stackPtr] = u32(node.leftChild);
      stackPtr++;
    }
   
  }
  return hitAnything;
}
fn hitBVH(ray: Ray, outHitRecord: ptr<function, HitRecord>) -> bool { // 0.001, 10000
  (*outHitRecord).hitAnything = false;
  // t represents distance to nearest object hit so far. initialized to +infinity
  var closestT: f32 = 3.0e+38; 
  var stack: array<u32, 32>; // Max depth of 32 is enough for 2^32 objects
  var stackPtr: i32 = 0;
  stack[0] = 0; // Start at root node
  let invD = 1.0 / ray.direction; // only 1 division calculation

  var bvhHitRecord: HitRecord;
  bvhHitRecord.hitAnything = false;
  var leafHitRecord: HitRecord;
  leafHitRecord.hitAnything = false;
  leafHitRecord.t = closestT; // represents the nearest ray-sphere intersection hit
var nodesTouched = 0u;
  while (stackPtr >= 0) {
    nodesTouched++;
  // for (var stackPtr: i32 = 0; stackPtr >= 0; stackPtr--) {
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
      let sphereIdx = u32(node.objectIndex);
      if (hit(ray, objects.spheres[sphereIdx], 0.001, closestT, &leafHitRecord)) { 
        //if ray intersects sphere and intersection point is closer than t, then push onto stack
        // (*outHitRecord).hitAnything = true;
        // (*outHitRecord).t = leafHitRecord.t;
        // (*outHitRecord).color = leafHitRecord.color;
        // (*outHitRecord).color = vec3f(0.0,0.0,0.0);
        (*outHitRecord) = leafHitRecord;
        closestT = leafHitRecord.t;
      }
    }
  }  
  (*outHitRecord).color = vec3(f32(nodesTouched) / 10.0, 0.0, 0.0);

  return (*outHitRecord).hitAnything;
}
fn hitAABB(ray: Ray, invD: vec3<f32>, node_min: vec3<f32>, node_max: vec3<f32>,
  closestT: f32, outHitRecord: ptr<function, HitRecord> ) -> bool {
  // (*outHitRecord).hitAnything = false;
  var tmin = -1e30; // -infinity
  var tmax =  1e30; // +infinity

  for (var i = 0; i < 3; i++) { // 0 <--> x-axis, 1 <--> y-axis, 2 <--> z-axis
    let t0 = (node_min[i] - ray.origin[i]) * invD[i];
    let t1 = (node_max[i] - ray.origin[i]) * invD[i];

    var tlow  = min(t0, t1);
    var thigh = max(t0, t1);

    tmin = max(tmin, tlow);
    tmax = min(tmax, thigh);
  }
  if (tmax >= tmin && tmax > 0.0) {
    if (tmin < closestT) {
      (*outHitRecord).hitAnything = true;
      (*outHitRecord).t = tmin;
      return true;
    }
    
  } 
  return false;
}
// fn hitAABB_fast(ray: Ray, invD: vec3<f32>, node_min: vec3<f32>, node_max: vec3<f32>) -> f32 {
//     let t0 = (node_min - ray.origin) * invD;
//     let t1 = (node_max - ray.origin) * invD;
//     let t_min_v = min(t0, t1);
//     let t_max_v = max(t0, t1);
    
//     let t_near = max(max(t_min_v.x, t_min_v.y), t_min_v.z);
//     let t_far  = min(min(t_max_v.x, t_max_v.y), t_max_v.z);

//     if (t_far >= t_near && t_far > 0.0) {
//         return t_near;
//     }
//     return 1e30; // Return infinity for a miss
// }
fn hit_aabb(ray: Ray, invD: vec3<f32>, node_min: vec3<f32>, node_max: vec3<f32>,
  ray_t_min: f32, ray_t_max: f32, outHitRecord: ptr<function, HitRecord>
  ) -> bool {
  // t0 is the intersection vector of the ray with the node's min axis
  let t0 = (node_min - ray.origin) * invD;
  // t1 is the intersection vector of the ray with the node's min axis
  let t1 = (node_max - ray.origin) * invD;
  // each component represents the intersection of the ray on the box along a certain axis
  
  let tClose = min(t0, t1);
  let tFar = max(t0, t1);
  
  // let t_start = max(ray_t_min, max(t_near.x, max(t_near.y, t_near.z)));
  // let t_end = min(ray_t_max, min(t_far.x, min(t_far.y, t_far.z)));
  
  // return t_start <= t_end;
  let t_enter = max(max(tClose.x, tClose.y), tClose.z);
  let t_exit = min(min(tFar.x, tFar.y), tFar.z);
  if (t_exit >= max(t_enter, ray_t_min) && t_enter <= ray_t_max) {
    outHitRecord.t = t_enter;
    return true;
  }
  return false;
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
    (*outHitRecord).hitAnything = true;
    return true;
    }
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
    //   if (node.objectIndex >= 0.0) {
    //     // Leaf Node: Check the actual sphere
    //     let sphere_idx = u32(node.objectIndex);
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
    // if (node.objectIndex != -1) { 
    //   if (hit(ray, objects.spheres[u32(node.objectIndex)], ray_t_min, tMin, &tempHitRecord)) {
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