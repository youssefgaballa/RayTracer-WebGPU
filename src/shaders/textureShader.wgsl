struct BVHNode {
  min: vec3<f32>,
  containsRoot: f32,
  max: vec3<f32>,
  sphereCount: f32,
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

} // 64 + 64  = 128 bytes

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

@group(0) @binding(0) var screen_sampler : sampler; // used in textureRenderPipeline
@group(0) @binding(1) var color_buffer : texture_2d<f32>; // used in boxPipeline and textureRenderPipeline

@group(0) @binding(1) var<uniform> cameraData: CameraData; // used in boxPipeline
@group(0) @binding(2) var<uniform> renderData : RenderData; // used in boxPipeline
@group(0) @binding(3) var<storage, read> bvh: BVH;// used in boxPipeline
@group(0) @binding(4) var boxDepthTexture: texture_2d<f32>; // used in boxPipeline


struct BoxOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec3<f32>,
    @location(1) world_pos : vec3<f32>, // <--- Add this
}
struct VertexInput {
    @location(0) unit_pos: vec3<f32>,
    @builtin(instance_index) i_idx: u32, // ranges from 0 to bvh.numNodes - 1
}
@vertex
fn vs_box(in: VertexInput) -> BoxOutput {
  let node: BVHNode = bvh.nodes[in.i_idx];
  
  // Transform unit cube corner to world space
  let world_pos = node.min + in.unit_pos * (node.max - node.min);
  // Camera Transformation
  let view_dir = world_pos - cameraData.cameraPos;
  let view_z = dot(view_dir, cameraData.cameraForwards);
  let view_x = dot(view_dir, cameraData.cameraRight);
  let view_y = dot(view_dir, cameraData.cameraUp);

  let aspect = f32(renderData.image_width) / f32(renderData.image_height);
  let near = 0.1;
  let zFar = 3000.0;
  var out: BoxOutput;
  
  /*
    Need the position of the vertex to be in clipspace (same as in compute shader)
    Get clip space position by view Matrix * projection matrix * world position
  */
  out.Position = cameraData.viewProjectionMatrix * vec4<f32>(world_pos, 1.0);
  out.world_pos = world_pos;
  // before going to fragment shader, it is converted to NDC by dividing out.Position.xyz by w.

  // Leaf nodes green, internal nodes red
  // Interpolate based on depth
  let leafColor = vec3<f32>(0.0, 1.0, 0.0);    // Neon Green
  let internalColor = vec3<f32>(1.0, 0.0, 0.0); // Red
  // let maxVisDepth = 20.0;
  let depthNormalized = clamp(f32(node.depth) / f32(bvh.maxDepth), 0.0, 1.0);
  out.Color = mix(
    internalColor, 
    leafColor,
    depthNormalized
  );
  if (renderData.hideRootBVHBox == 1 
    && (node.containsRoot == 1)) { 
    // dont show root node
    out.Position = vec4<f32>(0.0, 0.0, 2.0, 1.0);
  }
  return out;
}

@fragment
fn fs_box(
  in: BoxOutput, 
  ) -> @location(0) vec4<f32> {
  if (renderData.depthTestBVH == 1) {
    // Step 2: Load the sphere hit distance 't' from your compute texture
    // textureLoad uses integer coordinates vec2<i32>
    
    let tex_coords = vec2<i32>(in.Position.xy);
    let sphere_t = textureLoad(boxDepthTexture, tex_coords, 0).r;

    // if (sphere_t > 5000.0) {
    //     return vec4<f32>(1.0, 1.0, 1.0, 1.0); 
    // }
    if (sphere_t < 0.0) {
        return vec4<f32>(1.0, 1.0, 1.0, 1.0); 
    }
    // Step 3: Calculate how far THIS box fragment is from the camera
    // We use the world_pos (you'll need to add this to your BoxOutput struct)
    let box_t = distance(cameraData.cameraPos, in.world_pos);
    if (sphere_t < 1000.0 && box_t > sphere_t + 0.1) {
      // return vec4<f32>(1.0, 1.0, 1.0, 1.0); 
      discard;
    }

    // Step 4: Occlusion Test
    // If the box is further away than the sphere, don't draw it.
    // We add a tiny epsilon (0.01) to prevent "z-fighting" on the sphere surface.
    if (box_t > sphere_t + 0.01) {
      discard;
    }
    return vec4<f32>(in.Color, 1.0);
  } else {
    return vec4<f32>(in.Color, 1.0);

  }
  

}
struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) TexCoord : vec2<f32>,
}
@vertex
fn vs(@builtin(vertex_index) VertexIndex: u32,
  @builtin(instance_index) InstanceIndex: u32) -> VertexOutput {
 
  var positions = array<vec2<f32>, 6>(
    vec2<f32>( 1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(-1.0,  1.0)
  );

  var texCoords = array<vec2<f32>, 6>(
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 0.0)
  );

  var output: VertexOutput;
  output.Position = vec4<f32>(positions[VertexIndex], 0.0, 1.0);
  output.TexCoord = texCoords[VertexIndex];
  return output;
}

@fragment
fn fs(@location(0) TexCoord : vec2<f32>) -> @location(0) vec4<f32> {
  return textureSample(color_buffer, screen_sampler, TexCoord);
}