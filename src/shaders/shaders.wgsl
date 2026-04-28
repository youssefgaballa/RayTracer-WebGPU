struct Fragment {
    @builtin(position) Position : vec4<f32>,
    @location(0) Color : vec4<f32>
};

@vertex
fn vs(@location(0) vertex_pos: vec2f, 
  @location(1) vertex_color: vec3f,
  @builtin(vertex_index) v_id: u32) -> Fragment {

    var output : Fragment;
    output.Position = vec4<f32>(vertex_pos, 0.0, 1.0);
    output.Color = vec4<f32>(vertex_color, 1.0);

    return output;
}

@fragment
fn fs(@location(0) Color: vec4<f32>) -> @location(0) vec4<f32> {
    return Color;
}