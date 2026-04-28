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

  private colorBuffer!: GPUTexture;
  private colorBufferView!: GPUTextureView;
  private sampler!: GPUSampler;

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
    this.configureBuffers();
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
      // Math.floor((this.canvas.width + 7) / 8),
      // Math.floor((this.canvas.height + 7) / 8),
      Math.floor(this.canvas.width),
      Math.floor(this.canvas.height),
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
          { format: this.textureFormat }, // @location(0) in fragment shader
        ],
      },
    });
  }

  private configureBindGroups() {
    // Compute Shader Bind Group and Bind Group Layout:
    this.computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, // @layout(0)
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "rgba8unorm",
            viewDimension: "2d",
          },
        },
      ],
    });

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries: [
        {
          binding: 0, // @layout(0)
          resource: this.colorBufferView,
        },
      ],
    });

    // Texture Bind Group and Bind Group Layout:
    this.textureBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, // @layout(0)
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1, // @layout(1)
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
      ],
    });
    this.textureBindGroup = this.device.createBindGroup({
      layout: this.textureBindGroupLayout,
      entries: [
        {
          binding: 0, // @layout(0)
          resource: this.sampler,
        },
        {
          binding: 1, // @layout(1)
          resource: this.colorBufferView,
        },
      ],
    });
  }

  private configureBuffers() {
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

    this.colorBufferView = this.colorBuffer.createView();

    const samplerDescriptor: GPUSamplerDescriptor = {
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "nearest",
      mipmapFilter: "nearest",
      maxAnisotropy: 1,
    };
    this.sampler = this.device.createSampler(samplerDescriptor);
  }

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