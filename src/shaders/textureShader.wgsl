struct BVHNode {
    min: vec3<f32>,
    left_child: u32, 
    max: vec3<f32>,
    object_index: u32, 
}
struct BVH {
    nodes: array<BVHNode>,
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
}
struct RenderData { // 32
    image_width: u32,
    image_height: u32,
    frame_iteration: u32,
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

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) TexCoord : vec2<f32>,
}
struct BoxOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec3<f32>,
}
struct VertexInput {
    @location(0) unit_pos: vec3<f32>,
    @builtin(instance_index) i_idx: u32,
}
@vertex
fn vs_box(in: VertexInput) -> BoxOutput {
    let node = bvh.nodes[in.i_idx];
    
    // 1. Transform unit cube corner to world space
    let world_pos = node.min + in.unit_pos * (node.max - node.min);

    // 2. Camera Transformation
    let view_dir = world_pos - cameraData.cameraPos;
    let view_z = dot(view_dir, cameraData.cameraForwards);
    let view_x = dot(view_dir, cameraData.cameraRight);
    let view_y = dot(view_dir, cameraData.cameraUp);

    let aspect = f32(renderData.image_width) / f32(renderData.image_height);
    let near = 0.1;

    var out: BoxOutput;
    
    // 3. Clipping & Projection
    // We manually clip vertices behind the near plane to prevent infinite lines
    if (view_z < near) {
        // Force the vertex to a coordinate that the GPU will clip (outside -1 to 1)
        out.Position = vec4<f32>(0.0, 0.0, 2.0, 1.0); 
    } else {
        // Standard pinhole projection
        out.Position = vec4<f32>(
            view_x / (view_z * aspect), 
            view_y / view_z, 
            0.0, 
            1.0
        );
    }

    // Leaf nodes green, internal nodes red
    if (node.object_index != 0xFFFFFFFFu) {
        out.Color = vec3<f32>(0.0, 1.0, 0.0);
    } else {
        out.Color = vec3<f32>(1.0, 0.0, 0.0);
    }
    return out;
}

// @vertex
// fn vs_box(@builtin(vertex_index) v_idx: u32, @builtin(instance_index) i_idx: u32) -> BoxOutput {
//   let node = bvh.nodes[i_idx];
//   let far = 1000.0;
//   let near = 0.1;
  
//   // Mapping 24 vertices to 12 lines
//   let indices = array<u32, 24>(
//       0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7
//   );

//   let corner = indices[v_idx];
//   let unit_pos = vec3<f32>(f32(corner & 1u), f32((corner & 2u) >> 1u), f32((corner & 4u) >> 2u));
//   let world_pos = node.min + unit_pos * (node.max - node.min);

//   // Manual projection using your camera vectors
//   let view_dir = world_pos - cameraData.cameraPos;
//   // let z = dot(view_dir, cameraData.cameraForwards);
//   // let x = dot(view_dir, cameraData.cameraRight);
//   // let y = dot(view_dir, cameraData.cameraUp);
//   // let depth = (far / (far - near)) - ((far * near) / (far - near)) / z;
//   let view_z = dot(view_dir, cameraData.cameraForwards);
//   let view_x = dot(view_dir, cameraData.cameraRight);
//   let view_y = dot(view_dir, cameraData.cameraUp);
//   var out: BoxOutput;

//   let near_plane = 0.1;
//   let aspect = f32(renderData.image_width) / f32(renderData.image_height);
//   let fov_scale = 0.5; // Adjust based on your raytracer's FOV
//   // Simple pinhole projection: divide by Z to get perspective
//   // out.Position = vec4<f32>(x / (z * aspect), y / z, 0.5, 1.0);
//   if (view_z < near_plane) {
//         // Position it "behind" the camera view so the GPU clips the line
//         out.Position = vec4<f32>(0.0, 0.0, -1.0, 1.0); 
//     } else {
//         out.Position = vec4<f32>(
//             view_x / (view_z * aspect * fov_scale), 
//             view_y / (view_z * fov_scale), 
//             0.0, // We'll handle depth properly in the next step
//             1.0
//         );
//     }
//   // Green for leaves (have objects), Red for internal nodes
//   if (node.object_index != 0xFFFFFFFFu) {
//       out.Color = vec3<f32>(0.0, 1.0, 0.0);
//   } else {
//       out.Color = vec3<f32>(1.0, 0.0, 0.0);
//   }
//   return out;
// }

@fragment
fn fs_box(in: BoxOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(in.Color, 1.0);
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