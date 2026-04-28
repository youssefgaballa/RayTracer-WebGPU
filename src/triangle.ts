
export class Triangle {
  buffer: GPUBuffer;
  vertexBufferLayout: GPUVertexBufferLayout;

  constructor(device: GPUDevice) {
    const vertices: Float32Array = new Float32Array([
      0.0, 0.5, 1.0, 0.0, 0.0,
      -0.5, -0.5, 0.0, 1.0, 0.0,
      0.5, -0.5, 0.0, 0.0, 1.0,
    ]);
    this.buffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    //Buffer has been created, now load in the vertices
    new Float32Array(this.buffer.getMappedRange()).set(vertices);
    this.buffer.unmap();
    this.vertexBufferLayout = {
      arrayStride: 4 * (3 + 2),
      attributes: [
        {
          shaderLocation: 0,
          format: "float32x2",
          offset: 0,
        },
        {
          shaderLocation: 1,
          format: "float32x3",
          offset: 8,
        },
      ],
    };

  }

}