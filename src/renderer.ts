import shader from "./shaders/shaders.wgsl?raw";

export class Renderer {
  public isSupported: boolean = true;
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private textureFormat!: GPUTextureFormat;

  private bindGroupLayout!: GPUBindGroupLayout;
  private bindGroup!: GPUBindGroup;
  private vertexShaderModule!: GPUShaderModule;
  private fragmentShaderModule!: GPUShaderModule;

  private renderPipeline!: GPURenderPipeline;
  private commandEncoder!: GPUCommandEncoder
  private textureView!: GPUTextureView;
  private renderPassEncoder!: GPURenderPassEncoder;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public async init() {
    if (!(await this.getGPUDevice())) return;
    this.configureGPUCanvasContext();
    this.loadShaders();
    this.configureBindGroups();
    this.configurePipeline();
  }

  public render() {
    this.configureRenderPass();
    
    this.renderPassEncoder.setPipeline(this.renderPipeline);
    this.renderPassEncoder.setBindGroup(0, this.bindGroup);
    this.renderPassEncoder.draw(3, 1, 0, 0);

    this.renderPassEncoder.end();

    this.device.queue.submit([this.commandEncoder.finish()]);
  }

  private configureRenderPass() {
    //command encoder: records draw commands for submission
    this.commandEncoder = this.device.createCommandEncoder();

    //texture view: image view to the color buffer in this case
    this.textureView = this.context.getCurrentTexture().createView();
    
    //renderpass: holds draw commands, allocated from command encoder
    this.renderPassEncoder = this.commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.textureView,
          clearValue: { r: 0.5, g: 0.0, b: 0.25, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

  }

  private configurePipeline() {
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.vertexShaderModule,
        entryPoint: "vs",
      },
      fragment: {
        module: this.fragmentShaderModule,
        entryPoint: "fs",
        targets: [{ format: this.textureFormat }],
      },
    });
  }

  private configureBindGroups() {
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [],
    });
  }

  private loadShaders() {
    this.vertexShaderModule = this.device.createShaderModule({
      code: shader,
    });
    this.fragmentShaderModule = this.device.createShaderModule({
      label: "Fragment Shader",
      code: shader,
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