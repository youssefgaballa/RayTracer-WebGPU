struct Sphere { // 16 bytes
  position: vec3<f32>,
  radius: f32,
  color: vec3<f32>,
  padding: f32
}

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

struct SceneData {
  cameraPos: vec3<f32>,
  padding0: f32,
  cameraForwards: vec3<f32>,
  padding1: f32,
  cameraRight: vec3<f32>,
  padding2: f32,
  cameraUp: vec3<f32>,
  padding3: f32,
}

struct HitRecord {
  t: f32,
  color: vec3<f32>,
  position: vec3<f32>,
  normal: vec3<f32>,
}

struct RenderData {
    image_width: u32,
    image_height: u32,
    frame_iteration: u32,
    isAA: u32,
};

@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> scene: SceneData;
@group(0) @binding(2) var<storage, read> objects: ObjectData;
@group(0) @binding(3) var<uniform> renderData: RenderData;
@group(0) @binding(4) var<storage, read_write> accumulation_buffer: array<vec4<f32>>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {

  let canvas_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));
  // canvas_size == [800, 400]
  let aspect_ratio: f32 = f32(canvas_size.x) / f32(canvas_size.y); //

  let canvas_pos: vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));
  // Range( canvas_pos.x ) = [0, 799]
  // Range( canvas_pos.y ) = [0, 599]
  if (canvas_pos.x >= canvas_size.x || canvas_pos.y >= canvas_size.y) {
      return;
  }
  var uv: vec2<f32> = (vec2f(GlobalInvocationID.xy) + 0.5) / vec2<f32>(canvas_size) ;
  var seed: u32 = GlobalInvocationID.x + GlobalInvocationID.y * u32(renderData.image_width)
  + (renderData.frame_iteration * 131071u);
  let pixel_index = GlobalInvocationID.y * renderData.image_width + GlobalInvocationID.x;
  // Range( uv.x ) = [0.000625, 0.999375], texel_width == 0.000625
  // Range( uv.y ) = [0.000833333333, 0.999166667] , texel_height == 0.000833333333
  // Note: 1 - 0.000625 == 0.999375, 1 - 0.000833333333 == 0.9991666674
  
  var ndc: vec2<f32> = (uv * 2.0) - 1.0;
  ndc.y = -ndc.y;
  ndc.x *= aspect_ratio;
  // Range(ndc.x) = [-1.33, 1.33]
  // Range(ndc.y) = [1.0, -1.0] // flipped because texture coords are automatically mirrored

  var myRay: Ray;
  myRay.origin = scene.cameraPos;
  myRay.direction = normalize(scene.cameraForwards
  + ndc.x * scene.cameraRight 
  + ndc.y * scene.cameraUp);

  if (renderData.isAA == 1u) {
    let jitter = vec2<f32>(random_float(&seed), random_float(&seed)) - 0.5;
    uv = (vec2f(GlobalInvocationID.xy) + 0.5 * jitter) / vec2f(canvas_size);
    // 5. Calculate Ray (NDC space)
    ndc = (uv * 2.0) - 1.0;
    ndc.y = -ndc.y; // Flip Y for screen space
    ndc.x *= aspect_ratio;

    myRay.direction = normalize(
        scene.cameraForwards + 
        ndc.x * scene.cameraRight + 
        ndc.y * scene.cameraUp
    );
    // 6. Trace the Ray
    let new_sample_color: vec3<f32> = rayColor(myRay, ndc.y, &seed);

    let pixel_index = GlobalInvocationID.y * renderData.image_width + GlobalInvocationID.x;
    var accumulated_color: vec3<f32>;
    // 2. Accumulation Magic
    if (renderData.frame_iteration == 1u) {
        // First frame: Just store the color
        accumulated_color = new_sample_color;
        // accumulation_buffer[pixel_index] = vec4<f32>(new_sample_color, 1.0);
    } else {
        // Subsequent frames: Blend with previous data
        let old_color = accumulation_buffer[pixel_index].rgb;
        
        // Exponential moving average or Weighted average
        // Using weighted average for true path tracing:
        let weight = 1.0 / f32(renderData.frame_iteration);
        accumulated_color = mix(old_color, new_sample_color, weight);
        // accumulation_buffer[pixel_index] = vec4<f32>(accumulated_rgb, 1.0);
    }
    accumulation_buffer[pixel_index] = vec4<f32>(accumulated_color, 1.0);
    // 3. Write to the display texture (the rgba8unorm one)
    // You'll need a separate binding for the display texture or 
    // a second pass to copy the buffer to the texture.
    let display_color = pow(accumulated_color, vec3<f32>(1.0 / 2.2));
    textureStore(color_buffer, canvas_pos, vec4<f32>(display_color, 1.0));
  } else {


    let pixel_color: vec3<f32> = rayColor(myRay, ndc.y, &seed);
    textureStore(color_buffer, canvas_pos, vec4<f32>(pixel_color, 1.0));
  }
  
}


fn rayColor(ray: Ray, lerp: f32, seed: ptr<function, u32>) -> vec3<f32> {
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  var resultingColor = vec3<f32>(0.0);
  var nearestHit: f32 = 9999;

  var currentRay: Ray = ray;
  let maxDepth: u32 = 30;

  for (var depth: u32 = 0; depth < maxDepth; depth++) {
    var hitRecord: HitRecord;
    var nearestHit = 9999.0;
    var hitSomething = false;

    for (var i: u32 = 0; i < objects.sphereCount; i++) {
      if (hit(currentRay, objects.spheres[i], 0.001, nearestHit, &hitRecord)) {
        nearestHit = hitRecord.t;
        hitSomething = true;
      } 
    }
    if (hitSomething) {
      let scatterDirection = random_on_hemisphere(hitRecord.normal, seed);
      currentRay.origin = hitRecord.position; // + (hitRecord.normal * 0.001);
      currentRay.direction = normalize(scatterDirection);
      throughput *= hitRecord.color * 0.5;
    } else {
      let t = 0.5 * (currentRay.direction.y + 1.0);
      let skyColor = (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
      resultingColor = throughput * skyColor;
      break;
    }
    if (max(throughput.r, max(throughput.g, throughput.b)) < 0.001) {
      break;
    }

  }

  return resultingColor;
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

// 2. Replicate random_unit_vector
fn random_unit_vector(seed: ptr<function, u32>) -> vec3<f32> {
    // We use a loop with a limit to prevent GPU hangs
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

// 3. Replicate random_on_hemisphere
fn random_on_hemisphere(normal: vec3<f32>, seed: ptr<function, u32>) -> vec3<f32> {
    let on_unit_sphere = random_unit_vector(seed);
    if (dot(on_unit_sphere, normal) > 0.0) {
        return on_unit_sphere;
    } else {
        return -on_unit_sphere;
    }
}