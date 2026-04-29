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

@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> scene: SceneData;
@group(0) @binding(2) var<storage, read> objects: ObjectData;
var<private> uv: vec2<f32>;
var<private> seed: vec2<f32>;
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
   
  uv = (vec2f(GlobalInvocationID.xy) + 0.5) / vec2<f32>(canvas_size) ;
  seed = vec2<f32>(f32(GlobalInvocationID.x), f32(GlobalInvocationID.y));
  // Range( uv.x ) = [0.000625, 0.999375], texel_width == 0.000625
  // Range( uv.y ) = [0.000833333333, 0.999166667] , texel_height == 0.000833333333
  // Note: 1 - 0.000625 == 0.999375
  // 1 - 0.000833333333 == 0.999166667

  var ndc: vec2<f32> = (uv * 2.0) - 1.0;
  ndc.y = -ndc.y;
  ndc.x *= aspect_ratio;
  // Range(ndc.x) = [-1.33, 1.33]
  // Range(ndc.y) = [1.0, -1.0] // flipped because texture coords are automatically mirrored

  // let screen_pos: vec2<f32> = vec2<f32>(
  //   ndc.x * 0.5 * f32(canvas_size[0]),
  //   ndc.y * 0.5 * f32(canvas_size[1])
  // );


  var myRay: Ray;
  myRay.origin = scene.cameraPos;
  myRay.direction = normalize(scene.cameraForwards
   + ndc.x * scene.cameraRight 
   + ndc.y * scene.cameraUp);

  let pixel_color: vec3<f32> = rayColor(myRay, ndc.y);
  textureStore(color_buffer, canvas_pos, vec4<f32>(pixel_color, 1.0));
}

fn rayColor1(ray: Ray, lerp: f32) -> vec3<f32> {

  var resultColor: vec3<f32> = vec3(1.0, 1.0, 1.0);

  var nearestHit: f32 = 9999;
  var hitSomething: bool = false;

  var hitRecord: HitRecord;
  for (var i: u32 = 0; i < objects.sphereCount; i++) {
    if (hit(ray, objects.spheres[i], 0.001, nearestHit, &hitRecord)) {
      nearestHit = hitRecord.t;
      hitRecord = hitRecord;
      hitSomething = true;
      resultColor = hitRecord.color;
    }
  }

  if (!hitSomething) {
    resultColor = mix( vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.0, 0.0, 0.2), lerp);
  }
  return resultColor;

}


fn rayColor(ray: Ray, lerp: f32) -> vec3<f32> {
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  var final_color = vec3<f32>(0.0);
  var nearestHit: f32 = 9999;

  var cur_ray: Ray = ray;
  let max_depth: u32 = 30;
  // var hitSomething: bool = false;

  for (var depth: u32 = 0; depth < max_depth; depth++) {
    var hitRecord: HitRecord;
    var nearestHit = 9999.0;
    var hitSomething = false;

    for (var i: u32 = 0; i < objects.sphereCount; i++) {
      if (hit(cur_ray, objects.spheres[i], 0.001, nearestHit, &hitRecord)) {
        nearestHit = hitRecord.t;
        hitSomething = true;
      } 
    }
    if (hitSomething) {
      // Target = HitPoint + Normal + RandomUnitVector
      // let newDirection = hitRecord.position + hitRecord.normal + random_unit_vector();
      // resultColor = resultColor * hitRecord.color;
      let scatterDirection = random_on_hemisphere(hitRecord.normal);
      cur_ray.origin = hitRecord.position;
      cur_ray.direction = normalize(scatterDirection - hitRecord.position);
      // temp_ray.direction = normalize(reflect(temp_ray.direction, hitRecord.normal));
      throughput *= hitRecord.color * 0.5;
    } else {
      let unit_dir = normalize(cur_ray.direction);
      let t = 0.5 * (unit_dir.y + 1.0);
      let sky_color = (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
      final_color = throughput * sky_color;
      break;
    }
    if (max(throughput.r, max(throughput.g, throughput.b)) < 0.001) {
            break;
    }

  }

  // if (!hitSomething) {
  //   resultColor = mix( vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.0, 0.0, 0.2), lerp);
  // }
  return final_color;

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

fn hash(uv: vec2<f32>) -> f32 {
    // Corrected to use WGSL vec2<f32> and fract()
    return fract(sin(dot(uv, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}
// Helper to get a random float and update the seed
fn rand() -> f32 {
    // Uses the private global 'seed' variable
    let r = hash(seed);
    // Update seed for the next call in the loop
    seed.x += 1.0;
    seed.y += r; 
    return r;
}
fn random_unit_vector() -> vec3<f32> {
    while (true) {
        let p = vec3<f32>(
            rand() * 2.0 - 1.0,
            rand() * 2.0 - 1.0,
            rand() * 2.0 - 1.0
        );
        let lensq = dot(p, p);
        // Use a small epsilon to avoid division by zero
        // if (lensq > 1e-5 && lensq <= 1.0) {
        if (lensq > 0.0001 && lensq <= 1.0) {
            return p / sqrt(lensq); // Normalizing manually
        }
    }
    return vec3<f32>(0.0); // Fallback
}
fn random_on_hemisphere(normal: vec3<f32>) -> vec3<f32> {
    let on_unit_sphere = random_unit_vector();
    if (dot(on_unit_sphere, normal) > 0.0) {
        return on_unit_sphere;
    } else {
        return -on_unit_sphere;
    }
}