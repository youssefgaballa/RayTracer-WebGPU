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

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {

  let canvas_size: vec2<i32> = vec2<i32>(textureDimensions(color_buffer));
  let aspect_ratio: f32 = f32(canvas_size.x) / f32(canvas_size.y); //
  // canvas_size == [800, 400]
  let canvas_pos: vec2<i32> = vec2<i32>(i32(GlobalInvocationID.x), i32(GlobalInvocationID.y));
  // Range( canvas_pos.x ) = [0, 799]
  // Range( canvas_pos.y ) = [0, 599]
  if (canvas_pos.x >= canvas_size.x || canvas_pos.y >= canvas_size.y) {
      return;
  }
   
  let uv: vec2<f32> = (vec2f(GlobalInvocationID.xy) + 0.5) / vec2<f32>(canvas_size) ;
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

  let forwards: vec3<f32> = scene.cameraForwards;
  let right: vec3<f32> = scene.cameraRight;
  let up: vec3<f32> = scene.cameraUp;

  var myRay: Ray;
  myRay.direction = normalize(forwards + ndc.x * right + ndc.y * up);
  myRay.origin = scene.cameraPos;

  let pixel_color: vec3<f32> = rayColor(myRay, ndc.y);
  textureStore(color_buffer, canvas_pos, vec4<f32>(pixel_color, 1.0));
}

fn rayColor(ray: Ray, lerp: f32) -> vec3<f32> {

  var resultColor: vec3<f32> = vec3(1.0, 1.0, 1.0);

  var nearestHit: f32 = 9999;
  var hitSomething: bool = false;

  var hitRecord: HitRecord;
  for (var i: u32 = 0; i < objects.sphereCount; i++) {
    if (hit(ray, objects.spheres[i], 0.001, nearestHit, &hitRecord)) {
      nearestHit = hitRecord.t;
      hitRecord = hitRecord;
      hitSomething = true;
    }
  }

  if (hitSomething) {
    resultColor = hitRecord.color;
  } else {
    resultColor = mix( vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.0, 0.0, 0.2), lerp);
  }
  return resultColor;

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