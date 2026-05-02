struct BVHNode {
  min: vec3<f32>,
  //padding
  p0: f32,
  max: vec3<f32>,
  p1: f32,
  left_child: f32, 
  object_index: f32, 
  depth: f32,
  p2: f32,
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
struct RenderData { // 32 bytes
  image_width: u32,
  image_height: u32,
  frameCount: u32,
  temporalAccumulation: u32,
  diffuseType: u32,
  hasGammaCorrection: u32,
  showBVHBoxes: u32
}

@group(0) @binding(0) var screen_sampler : sampler; 
@group(0) @binding(1) var color_buffer : texture_2d<f32>;

@group(0) @binding(1) var<uniform> cameraData: CameraData;
@group(0) @binding(2) var<uniform> renderData : RenderData;
@group(0) @binding(3) var<storage, read> bvh: BVH;


struct BoxOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec3<f32>,
}
struct VertexInput {
    @location(0) unit_pos: vec3<f32>,
    @builtin(instance_index) i_idx: u32, // ranges from 0 to bvh.numNodes - 1
}
@vertex
fn vs_box(in: VertexInput) -> BoxOutput {
    let node: BVHNode = bvh.nodes[in.i_idx];
    // let node: BVHNode = bvh.nodes[0];
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
    
    // Clipping & Projection
    // We manually clip vertices behind the near plane to prevent infinite lines
    // if (view_z < near) {
    //   // Force the vertex to a coordinate that the GPU will clip (outside -1 to 1)
    //   // out.Position = vec4<f32>(0.0, 0.0, 2.0, 1.0); 
    //   out.Position = vec4<f32>(cameraData.cameraPos, 1.0); 

    // } else {
    //   // Standard pinhole projection
    //   out.Position = vec4<f32>(
    //       view_x / (view_z * aspect), 
    //       view_y / view_z, 
    //       0.0, 
    //       1.0
    //   );
    // }
    /*
      Need the position of the vertex to be in clipspace (same as in compute shader)
      Get clip space position by view Matrix * projection matrix * world position
    */
    out.Position = cameraData.viewProjectionMatrix * vec4<f32>(world_pos, 1.0);
    // before going to fragment shader, it is converted to NDC by dividing out.Position.xyz by w.
    
    // Leaf nodes green, internal nodes red
    // Interpolate based on depth
    let leafColor = vec3<f32>(0.0, 1.0, 0.0);    // Neon Green
    let internalColor = vec3<f32>(1.0, 0.0, 0.0); // Red
    let maxVisDepth = 20.0;
    // let depthNormalized = clamp(f32(node.depth) / f32(bvh.maxDepth), 0.0, 1.0);
    // let a = f32(node.depth) * 0.1;
    let depthNormalized = clamp(f32(node.depth) / f32(bvh.maxDepth), 0.0, 1.0);
    out.Color = mix(
      leafColor, 
      internalColor,
      depthNormalized
    );
    return out;
    //  let node = bvh.nodes[in.i_idx];
    
    // // 1. Get the current vertex world position
    // let world_pos = node.min + in.vertex * (node.max - node.min);
    
    // // 2. Project into View Space
    // let view_dir = world_pos - cameraData.cameraPos;
    // var v = vec3<f32>(
    //     dot(view_dir, cameraData.cameraRight),
    //     dot(view_dir, cameraData.cameraUp),
    //     dot(view_dir, cameraData.cameraForwards)
    // );

    // let near = 0.1;
    // var out: BoxOutput;

    // // --- NEW CLIPPING LOGIC ---
    // if (v.z < near) {
    //     // Find the "partner" vertex for this line to find the direction.
    //     // This is a trick: for a unit cube, we can find the center and 
    //     // push this vertex toward the center until it hits the near plane.
    //     let center_world = (node.min + node.max) * 0.5;
    //     let center_dir = center_world - cameraData.cameraPos;
    //     let v_center = vec3<f32>(
    //         dot(center_dir, cameraData.cameraRight),
    //         dot(center_dir, cameraData.cameraUp),
    //         dot(center_dir, cameraData.cameraForwards)
    //     );

    //     // If even the center is behind us, cull the vertex completely
    //     if (v_center.z < near) {
    //         out.Position = vec4<f32>(0.0, 0.0, 2.0, 1.0); 
    //         return out;
    //     }

    //     // Interpolate the vertex position to exactly the near plane
    //     let t = (near - v.z) / (v_center.z - v.z);
    //     v = mix(v, v_center, t);
    // }
    // // --- END CLIPPING LOGIC ---

    // let aspect = f32(renderData.image_width) / f32(renderData.image_height);
    
    // // 3. Final Projection
    // out.Position = vec4<f32>(
    //     v.x / (v.z * aspect), 
    //     v.y / v.z, 
    //     0.0, // Z-buffer depth
    //     1.0
    // );

    // // Color logic remains the same
    // let depthNormalized = clamp(node.depth / bvh.maxDepth, 0.0, 1.0);
    // out.Color = mix(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), depthNormalized);

    // return out;
}

@fragment
fn fs_box(in: BoxOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(in.Color, 1.0);
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