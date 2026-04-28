struct Sphere {
  center: vec3<f32>,
  radius: f32,
  color: vec3<f32>,
  padding: f32
}

struct ObjectData {
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
  sphereCount: f32,
}

struct HitRecord {
  t: f32,
  color: vec3<f32>,
  hit: bool,
}

@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> scene: SceneData;
@group(0) @binding(2) var<storage, read> objects: ObjectData;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {

  let screen_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));
  let screen_pos : vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));

  if (screen_pos.x >= screen_size.x || screen_pos.y >= screen_size.y) {
      return;
  }

  // Centering the coefficients between -0.5 and 0.5
  let horizontal_coefficient: f32 = (f32(screen_pos.x) - f32(screen_size.x) * 0.5) / f32(screen_size.x);
  // let vertical_coefficient: f32 = (f32(screen_pos.y) - f32(screen_size.y) / 2) / f32(screen_size.y);

  // Inverting Y so that top of screen looks "up"
  let vertical_coefficient: f32 = (f32(screen_size.y) * 0.5 - f32(screen_pos.y)) / f32(screen_size.x);

  let forwards: vec3<f32> = scene.cameraForwards;
  let right: vec3<f32> = scene.cameraRight;
  let up: vec3<f32> = scene.cameraUp;

  var myRay: Ray;
  myRay.direction = normalize(forwards + horizontal_coefficient * right + vertical_coefficient * up);
  myRay.origin = scene.cameraPos;

  let pixel_color: vec3<f32> = rayColor(myRay);
  // let pixel_color = vec3<f32>(horizontal_coefficient + 0.5, vertical_coefficient + 0.5, 0.0);
  textureStore(color_buffer, screen_pos, vec4<f32>(pixel_color, 1.0));
}

fn rayColor(ray: Ray) -> vec3<f32> {

  var color: vec3<f32> = vec3(0.0, 0.0, 0.0);

  var nearestHit: f32 = 9999;
  var hitSomething: bool = false;

  var hitRecord: HitRecord;

  for (var i: u32 = 0; i < u32(scene.sphereCount); i++) {
      
      var newHitRecord: HitRecord = hit(ray, objects.spheres[i], 0.001, nearestHit, hitRecord);

      if (newHitRecord.hit) {
          nearestHit = newHitRecord.t;
          hitRecord = newHitRecord;
          hitSomething = true;
      }
  }

  if (hitSomething) {
      color = hitRecord.color;
  }
  return color;
}

fn hit(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, oldHitRecord: HitRecord) -> HitRecord {
  
  let co: vec3<f32> = ray.origin - sphere.center;
  let a: f32 = dot(ray.direction, ray.direction);
  let b: f32 = 2.0 * dot(ray.direction, co);
  let c: f32 = dot(co, co) - sphere.radius * sphere.radius;
  let discriminant: f32 = b * b - 4.0 * a * c;

  var hitRecord: HitRecord;
  hitRecord.color = oldHitRecord.color;

  if (discriminant > 0.0) {

      let t: f32 = (-b - sqrt(discriminant)) / (2 * a);

      if (t > tMin && t < tMax) {
        hitRecord.t = t;
        hitRecord.color = sphere.color;
        hitRecord.hit = true;
        return hitRecord;
      }
  }

  hitRecord.hit = false;
  return hitRecord;
  
}