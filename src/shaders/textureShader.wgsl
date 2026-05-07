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

@group(0) @binding(0) var screen_sampler : sampler; // used in textureRenderPipeline
@group(0) @binding(1) var color_buffer : texture_2d<f32>; // used in boxPipeline and textureRenderPipeline

@group(0) @binding(2) var<uniform> cameraData: CameraData; // used in boxPipeline
@group(0) @binding(3) var<uniform> renderData : RenderData; // used in boxPipeline
@group(0) @binding(4) var<storage, read> bvh: BVH;// used in boxPipeline
@group(0) @binding(5) var boxDepthTexture: texture_2d<f32>; // used in boxPipeline


struct BoxOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec3<f32>,
    @location(1) worldPosition : vec3<f32>, // <--- Add this
}
struct VertexInput {
    @location(0) unit_pos: vec3<f32>,
    @builtin(instance_index) i_idx: u32, // ranges from 0 to bvh.numNodes - 1
}
@vertex
fn vs_box(in: VertexInput) -> BoxOutput {
  let node: BVHNode = bvh.nodes[in.i_idx];
  
  // Transform unit cube corner to world space
  let worldPosition = node.min + in.unit_pos * (node.max - node.min);
  // Camera Transformation
  let view_dir = worldPosition - cameraData.cameraPos;
  let view_z = dot(view_dir, cameraData.cameraForwards);
  let view_x = dot(view_dir, cameraData.cameraRight);
  let view_y = dot(view_dir, cameraData.cameraUp);

  let aspect = f32(renderData.image_width) / f32(renderData.image_height);
  let near = 0.1;
  let zFar = 3000.0;
  var out: BoxOutput;
  
  /*
    Need the position of the vertex to be in clipspace (same as in compute shader)
    Get clip space position by  projection matrix * view Matrix * world position
  */
  out.Position = cameraData.viewProjectionMatrix * vec4<f32>(worldPosition, 1.0);
  out.worldPosition = worldPosition;
  // before going to fragment shader, it is converted to NDC by dividing out.Position.xyz by w.

  // Leaf nodes green, internal nodes red
  // Interpolate based on depth so that deeper bounding boxes are closer to grren
  // BVH goes from red at root, to orange to green
  let leafColor = vec3<f32>(0.0, 1.0, 0.0);    // Neon Green
  let internalColor = vec3<f32>(1.0, 0.0, 0.0); // Red
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
    // sphere hit depth (boxDepthTexture) is written by compute texture
    // textureLoad uses integer coordinates vec2<i32>
    let tex_coords = vec2<i32>(floor(in.Position.xy));
    let boxDepth = textureLoad(boxDepthTexture, tex_coords, 0).r;

    if (boxDepth < 0.0) {
        return vec4<f32>(1.0, 1.0, 1.0, 1.0); 
    }
    
    
    // boxDepth is distance from the camera's world position to the box's world position
    let boxDistance = distance(cameraData.cameraPos, in.worldPosition);
    if (boxDepth < 1000.0 && boxDistance > boxDepth) {
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