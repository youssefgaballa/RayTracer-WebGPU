export class Renderer {
  private device!: GPUDevice
  private context!: GPUCanvasContext
  private presentationFormat!: GPUTextureFormat
  private vertexShader!: GPUShaderModule
  private fragmentShader!: GPUShaderModule
  private pipeline!: GPURenderPipeline
  private renderPassDescriptor!: GPURenderPassDescriptor

  constructor(canvas: HTMLCanvasElement) {
  }

  public async init() {
    if (!this.checkCompatibility()) return;


    
  }

  private checkCompatibility(): boolean {
    const output_label: HTMLElement = document.getElementById(
      "compatibility-label",
    ) as HTMLElement;

    if (navigator.gpu) {
      output_label.innerText = "WebGPU is supported on this browser";
      return false;
    } else {
      output_label.innerText = "WebGPU is not supported on this browser";
      return true;
    }
  }
}