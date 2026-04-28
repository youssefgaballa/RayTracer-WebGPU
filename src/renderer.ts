import { debug } from "./main";
import { Scene } from "./scene";
import textureShader from "./shaders/TextureShader.wgsl?raw";
import computeShader from "./shaders/computeShader.wgsl?raw";

export class Renderer {
  public isSupported: boolean = true;
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private textureFormat!: GPUTextureFormat;

  private computeShaderModule!: GPUShaderModule;
  private vertexShaderModule!: GPUShaderModule;
  private fragmentShaderModule!: GPUShaderModule;

  private scene!: Scene;
  private colorBuffer!: GPUTexture;
  // private colorBufferView!: GPUTextureView;
  private sampler!: GPUSampler;
  private cameraBuffer!: GPUBuffer;
  private spheresBuffer!: GPUBuffer;

  private computeBindGroupLayout!: GPUBindGroupLayout;
  private computeBindGroup!: GPUBindGroup;
  private textureBindGroupLayout!: GPUBindGroupLayout;
  private textureBindGroup!: GPUBindGroup;

  // Compute pipeline: 
  private computePipeline!: GPUComputePipeline;

  // Render Pipeline:
  private textureRenderPipeline!: GPURenderPipeline;
  private textureView!: GPUTextureView;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public async init() {
    if (!(await this.getGPUDevice())) return;
    this.configureGPUCanvasContext();
    this.loadShaders();
    this.createScene();
    this.configureBuffers();
    this.writeBuffers();
    this.configureBindGroups();
    this.configurePipeline();
  }

  public render() {
    // Create Command Encoder to encode commands to be sent to GPU:
    const commandEncoder: GPUCommandEncoder = this.device.createCommandEncoder({
      label: "Basic Comamnd Encoder",
    });

    // Compute Pass:
    const computePassEncoder: GPUComputePassEncoder = commandEncoder.beginComputePass();
    computePassEncoder.setPipeline(this.computePipeline);
    computePassEncoder.setBindGroup(0, this.computeBindGroup);
    computePassEncoder.dispatchWorkgroups(
      Math.floor((this.canvas.width + 7) / 8), // 100
      Math.floor((this.canvas.height + 7) / 8), // 75
      // Math.floor(this.canvas.width),
      // Math.floor(this.canvas.height),
      1,
    );
    computePassEncoder.end();

    // Texture Render Pass:
    this.textureView = this.context.getCurrentTexture().createView();
    const renderPassEncoder = commandEncoder.beginRenderPass({
      // Render Pass Descriptor
      label: "Basic RenderPass Encoder",
      colorAttachments: [
        {
          view: this.textureView, //context.getCurrentTexture().createView();
          clearValue: { r: 0.5, g: 0.0, b: 0.25, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPassEncoder.setPipeline(this.textureRenderPipeline);
    renderPassEncoder.setBindGroup(0, this.textureBindGroup);
    renderPassEncoder.draw(6, 2, 0, 0);
    renderPassEncoder.end();

    this.device.queue.submit([
      commandEncoder.finish(), // GPUCommandBuffer
    ]);

    requestAnimationFrame(() => this.render());
  }

  private configurePipeline() {
    /*
      Create Compute Pipeline
    */
    const computePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.computeBindGroupLayout],
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: computePipelineLayout,
      compute: {
        module: this.computeShaderModule,
        entryPoint: "main",
      },
    });

    /*
      Create Texture Pipeline
    */
    const texturePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.textureBindGroupLayout], // @group(0)
    });

    this.textureRenderPipeline = this.device.createRenderPipeline({
      layout: texturePipelineLayout,
      vertex: {
        module: this.vertexShaderModule,
        entryPoint: "vs",
      },
      fragment: {
        module: this.fragmentShaderModule,
        entryPoint: "fs",
        targets: [
          { format: this.textureFormat }, // @binding(0) in fragment shader
        ],
      },
    });
  }

  /*
    Creates the bind group and bind group layouts
    for the compute pipeline and the texture (rendering) pipeline
  */
  private configureBindGroups() {
    // Compute Shader Bind Group and Bind Group Layout:
    this.computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, // @binding(0)
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "rgba8unorm",
            viewDimension: "2d",
          },
        },
        {
          binding: 1, // @binding(1)
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform",
          }  
        },
        {
          binding: 2, // @binding(2)
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "read-only-storage",
            hasDynamicOffset: false
          }
        },
      ],
    });

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries: [
        {
          binding: 0, // @binding(0)
          resource: this.colorBuffer,
        },
        {
          binding: 1, // @binding(1)
          resource: this.cameraBuffer,
        },
        {
          binding: 2, // @binding(2)
          resource: this.spheresBuffer,
        },
      ],
    });

    // Texture Bind Group and Bind Group Layout:
    this.textureBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, // @binding(0)
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1, // @binding(1)
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
      ],
    });
    this.textureBindGroup = this.device.createBindGroup({
      layout: this.textureBindGroupLayout,
      entries: [
        {
          binding: 0, // @binding(0)
          resource: this.sampler,
        },
        {
          binding: 1, // @binding(1)
          resource: this.colorBuffer.createView()
        },
      ],
    });
  }


  /*
    Writes to the camera buffer with values
    from the current state of the camera (orientation, position).
    Writes to the spheres buffer with the values from the
    scene's sphere member (array of sphere types).
  */
  private writeBuffers() {
    // Write to Camera Buffer:
    this.device.queue.writeBuffer(this.cameraBuffer, 0,
      new Float32Array([
        this.scene.camera.position[0],
        this.scene.camera.position[1],
        this.scene.camera.position[2],
        0.0,
        this.scene.camera.forwards[0],
        this.scene.camera.forwards[1],
        this.scene.camera.forwards[2],
        0.0,
        this.scene.camera.right[0],
        this.scene.camera.right[1],
        this.scene.camera.right[2],
        0.0,
        this.scene.camera.up[0],
        this.scene.camera.up[1],
        this.scene.camera.up[2],
        this.scene.numSpheres
      ]),
      0, //dataOffset
      this.cameraBuffer.size / 4 // size is number of elements since this is a typed array
    );

    // Write to Spheres Buffer:
    const sphereStructSizeBytes = //32
      4 * 3 +  // position 
      4 +      // radius
      4 * 3 +  // color
      4;       // padding
    const entryLength = 8; 
    // const positionOffset = 0;
    // const radiusOffset = 3 * 4; // 12
    // const colorOffset = 4 * 4; // 16
    // const stride = 4 * 8; // 32
    const sphereData: ArrayBuffer = new ArrayBuffer(
      sphereStructSizeBytes * this.scene.numSpheres
    );
    const sphereDataAsF32: Float32Array = new Float32Array(sphereData);
    // const sphereDataAsU32: Uint32Array = new Uint32Array(sphereData);
    for (let i = 0; i < this.scene.numSpheres; i++) {
      const offset = i * entryLength;
      sphereDataAsF32[offset+ 0] = this.scene.spheres[i].position[0];
      sphereDataAsF32[offset+ 1] = this.scene.spheres[i].position[1];
      sphereDataAsF32[offset + 2] = this.scene.spheres[i].position[2];
      sphereDataAsF32[offset + 3] = this.scene.spheres[i].radius[0];
      sphereDataAsF32[offset + 4] = this.scene.spheres[i].color[0];
      sphereDataAsF32[offset + 5] = this.scene.spheres[i].color[1];
      sphereDataAsF32[offset + 6] = this.scene.spheres[i].color[2];
      sphereDataAsF32[offset + 7] = 0.0;
    }
    this.device.queue.writeBuffer(this.spheresBuffer, 0,
      sphereDataAsF32,
      0,
      sphereDataAsF32.length
    );
    if (debug) {
      console.log("sphereDataAsF32: ", sphereDataAsF32)
      // console.log("cameraBufferAsF32: ", new Float32Array(this.cameraBuffer.getMappedRange()));
    }
  }

  /*
    Creates the scene data and camera data
    that the shaders use.
  */
  private configureBuffers() {
    // Color Buffer: written to by the compute shader
    // read from by the vertex + fragment shaders.
    // cooresponds to @binding(0) in compute Shader,
    // cooresponds to @binding(1) in frament shader
    this.colorBuffer = this.device.createTexture({
      size: {
        width: this.canvas.width, // 800 px
        height: this.canvas.height, // 600 px
      },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING, // storage texture
    });

    // this.colorBufferView = this.colorBuffer.createView();

    // Sampler: used by the fragment shader to sample texture
    // cooresponds to @binding(0) in fragment Shader
    this.sampler = this.device.createSampler({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      maxAnisotropy: 1,
    });

    /*
      Camera Buffer Format:
      [ 
        scene.camera.position, - 3 floats + 1 float padding 
                                --> 4*4 == 16 bytes, offset == 0
        scene.camera.forwards, - 3 floats + 1 float padding 
                                --> 4*4 == 16 bytes, offset == 4*4  == 16
        scene.camera.right   , - 3 floats + 1 float padding 
                                --> 4*4 == 16 bytes, offset == 4*8  == 32
        scene.camera.up      , - 3 floats + 1 float padding 
                                --> 4*4 == 16 bytes, offset == 4*12 == 48
      ]
    */
    // cooresponds to @binding(1) in compute Shader
    this.cameraBuffer = this.device.createBuffer({
        size: 16 * 4, // 16 * 4 ==  64
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

    /*
      Sphere Buffer Format: array of spheres
      ith element buffer:
      {
        scene.spheres[i].position, - 3 floats
                                    --> 4*3 == 12 bytes, offset == 0
        scene.spheres[i].radius  , - 3 floats
                                  --> 4*1 == 4 bytes, offset == 12
        scene.spheres[i].color   , - 3 floats + 1 float padding
                                  --> 4*4 == 16 bytes, offset == 4*4  == 16
      }
    */
    // cooresponds to @binding(2) in compute Shader
    this.spheresBuffer = this.device.createBuffer({
      size: (4 * 8) * this.scene.spheres.length,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  /*
    Initializes the scene.
  */
  private createScene() {
    this.scene = new Scene();
    // this.scene.createRandomSpheres(16);
    this.scene.createTwoSpheres();
    if (debug) {
      console.log(this.scene);
    }
  }

  /*
    Creates the compute shader module,
    vertex shader module, and fragment shader module.
  */
  private loadShaders() {
    this.computeShaderModule = this.device.createShaderModule({
      label: "Compute Shader",
      code: computeShader,
    });
    this.vertexShaderModule = this.device.createShaderModule({
      label: "Vertex Shader",
      code: textureShader,
    });
    this.fragmentShaderModule = this.device.createShaderModule({
      label: "Fragment Shader",
      code: textureShader,
    });
  }

  private configureGPUCanvasContext() {
    this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
    this.textureFormat = navigator.gpu.getPreferredCanvasFormat();
    // this.textureFormat = "bgra8unorm";

    this.context.configure({
      device: this.device,
      format: this.textureFormat,
      alphaMode: "premultiplied",
    });
  }

  private async getGPUDevice(): Promise<boolean> {
    if (!navigator.gpu) {
      this.fallback("WebGPU is not supported on this browser");
      this.isSupported = false;
      return false;
    }
    const adapter: GPUAdapter =
      (await navigator.gpu.requestAdapter()) as GPUAdapter;
    const device = await adapter?.requestDevice();

    if (!device || device == null) {
      this.fallback("WebGPU is not supported on this browser");
      this.isSupported = false;
      return false;
    }

    this.device = device;
    return true;
  }

  private fallback(text: string) {
    const fallback_text: HTMLElement = document.getElementById(
      "fallback",
    ) as HTMLElement;
    fallback_text.textContent = text;
  }
}