import { debug } from "./main";
import { Scene } from "./scene";
import textureShader from "./shaders/textureShader.wgsl?raw";
import computeShader from "./shaders/computeShader.wgsl?raw";
import type { Sphere } from "./sphere";
import type { Triangle } from "./triangle";

export class Renderer {
  public isSupported: boolean = true;
  public static canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private textureFormat!: GPUTextureFormat;

  private computeShaderModule!: GPUShaderModule;
  private vertexShaderModule!: GPUShaderModule;
  private fragmentShaderModule!: GPUShaderModule;

  /* Actual Data that is fed into Buffers and Textures */
  private scene!: Scene;
  private sphereDataLength!: number;
  private sphereData!: ArrayBuffer
  private triangleDataLength!: number;
  private triangleData!: ArrayBuffer;
  private renderData!: Uint32Array;
  private cameraData!: Float32Array; // 16 elements (including padding)
  private bvhNodeData!: Float32Array;
  public static frameCount = 1;
  public static isCheckerBoard: number;
  /*
  Needed so that movement speed is independent of frame rate
  */
  static deltaT: number = 1;
  static lastFrame: number;
  /* Set when user clicks respective button. see registerEventListeners(). */
  private temporalAccumulation = 0;
  private toggleTemporalAccumulationBtn: HTMLButtonElement 
  = document.getElementById("temporalAccumulation-btn") as HTMLButtonElement;

  private accumulateFrames = 0;
  private toggleAccumulateFramesBtn: HTMLButtonElement 
  = document.getElementById("accumulateFrames-btn") as HTMLButtonElement;

  /*
  DiffuseTypes:
  simpleDiffuse: 0,
  lambertian: 1
  */
  private diffuseType!: number;
  private toggleDiffuseTypeBtn: HTMLSelectElement 
    = document.getElementById("diffuseType") as HTMLSelectElement;

  private hasGammaCorrection = 1;
  private toggleHasGammaCorrectionBtn: HTMLButtonElement 
    = document.getElementById("hasGammaCorrection-btn") as HTMLButtonElement;

  private numRayBounces!: number;
  private numRayBouncesSlider: HTMLInputElement 
    = document.getElementById("bounces") as HTMLInputElement;
    private numRayBouncesSpan: HTMLSpanElement 
    = document.getElementById("bounces-val") as HTMLSpanElement;
  /*

  */
  static toggleBVH = 0;
  private toggleBVHBtn: HTMLButtonElement 
    = document.getElementById("toggleBVH-btn") as HTMLButtonElement;


  private showBVHBoxes = 0;
  private toggleShowBVHBoxesBtn: HTMLButtonElement 
    = document.getElementById("showBVHBoxes-btn") as HTMLButtonElement;

  private hideRootBVHBox = 0;
  private toggleHideRootBVHBoxBtn: HTMLButtonElement 
    = document.getElementById("hideRootBVHBox-btn") as HTMLButtonElement;

  private depthTestBVH = 0;
  private toggleDepthTestBVHBtn: HTMLButtonElement 
    = document.getElementById("depthBVH-btn") as HTMLButtonElement;

  /* Buffers, Samplers, and Textures */
  private renderDataBuffer!: GPUBuffer;
  private colorBuffer!: GPUTexture;
  private sampler!: GPUSampler;
  private cameraBuffer!: GPUBuffer;
  private spheresBuffer!: GPUBuffer;
  private trianglesBuffer!: GPUBuffer;
  private accumulationBuffer!: GPUBuffer;
  private bvhNodesBuffer!: GPUBuffer;
  private boxVertexBuffer!: GPUBuffer;
  private boxIndexBuffer!: GPUBuffer;
  private boxDepthTexture!: GPUTexture;

  private depthTexture!: GPUTexture;

  /* Bind Groups and Bind Group Layouts */
  private updateBindGroups: boolean = false;
  private computeBindGroupLayout!: GPUBindGroupLayout;
  private computeBindGroup!: GPUBindGroup;
  private textureBindGroupLayout!: GPUBindGroupLayout;
  private textureBindGroup!: GPUBindGroup;
  private boxBindGroupLayout!: GPUBindGroupLayout;
  private boxBindGroup!: GPUBindGroup;

  // Compute pipeline: 
  private computePipeline!: GPUComputePipeline;

  // Render Pipeline:
  private textureRenderPipeline!: GPURenderPipeline;
  private textureView!: GPUTextureView;

  // Box Pipeline:
  private boxPipeline!: GPURenderPipeline;

  private frameTimeSpan: HTMLElement = document.getElementById("frame-time") as HTMLElement;
  private fpsSpan: HTMLElement = document.getElementById("fps") as HTMLElement;


  constructor(canvas: HTMLCanvasElement) {
    Renderer.canvas = canvas;
  }

  public async init() {
    if (!(await this.getGPUDevice())) return;
    this.configureGPUCanvasContext();
    this.loadShaders();
    this.registerEventListeners();
    this.createScene();
    this.configureBuffers();
    this.writeBuffers(true);
    this.createDepthTexture();
    this.configureBindGroups();
    this.configurePipeline();
    // console.log(this.bvhNodeData, this.bvhNodeData.byteLength, this.bvhNodeData.length)

  }

  public registerEventListeners() {
    // early return if the buttons arent in the document (shouldnt happen)
    if (this.toggleTemporalAccumulationBtn == null
      || this.toggleAccumulateFramesBtn == null
      || this.toggleDiffuseTypeBtn == null
      || this.toggleHasGammaCorrectionBtn == null
      || this.numRayBouncesSlider == null
      || this.toggleBVHBtn == null
      || this.toggleShowBVHBoxesBtn == null
      || this.toggleHideRootBVHBoxBtn == null
      || this.toggleDepthTestBVHBtn == null
    ) {
      return;
    } 
    // Initialize the default values
    this.temporalAccumulation = 
      this.toggleTemporalAccumulationBtn.classList.contains("active") ? 1 : 0;

    this.accumulateFrames = 
    this.toggleAccumulateFramesBtn.classList.contains("active") ? 1 : 0;

    this.diffuseType = parseInt(this.toggleDiffuseTypeBtn.value);

    this.hasGammaCorrection 
    = this.toggleHasGammaCorrectionBtn.classList.contains("active") ? 1 : 0;

    this.numRayBounces = parseInt(this.numRayBouncesSlider.value);
    this.numRayBouncesSpan.textContent =  this.numRayBounces.toString();

    this.numRayBouncesSlider.addEventListener('input', (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target) {
        this.numRayBounces = parseInt(target.value);
        this.numRayBouncesSpan.textContent = target.value;
        Renderer.frameCount = 1;
        // console.log(this.numRayBounces);
      }
    });
  
    this.showBVHBoxes 
    = this.toggleShowBVHBoxesBtn.classList.contains("active") ? 1 : 0;
    

    this.hideRootBVHBox 
    = this.toggleHideRootBVHBoxBtn.classList.contains("active") ? 1 : 0;

    this.depthTestBVH 
    = this.toggleDepthTestBVHBtn.classList.contains("active") ? 1 : 0;

    // Register event listeners
    this.toggleTemporalAccumulationBtn.addEventListener('click', (event: MouseEvent) => {
      if (event.detail === 0) return; 
      this.toggleTemporalAccumulationBtn?.classList.toggle('active');
      this.temporalAccumulation = this.temporalAccumulation == 0 ? 1: 0;
      Renderer.frameCount = 1;
    });
    this.toggleAccumulateFramesBtn.addEventListener('click', (event: MouseEvent) => {
      if (event.detail === 0) return; 

      this.toggleAccumulateFramesBtn?.classList.toggle('active');
      this.accumulateFrames = this.accumulateFrames == 0 ? 1: 0;
      Renderer.frameCount = 1;
    });
    this.toggleDiffuseTypeBtn.addEventListener('change', (event: Event) => {
      // console.log('Selected value:', event.target.value);

      const target = event.target as HTMLSelectElement;
      this.diffuseType = parseInt(target.value);
      Renderer.frameCount = 1;
    });
    this.toggleHasGammaCorrectionBtn.addEventListener('click', (event: MouseEvent) => {
      if (event.detail === 0) return; 
      this.toggleHasGammaCorrectionBtn?.classList.toggle('active');
      this.hasGammaCorrection = this.hasGammaCorrection == 0 ? 1: 0;
      // this.frameCount = 0;
    });


    this.toggleBVHBtn.addEventListener('click', (event: MouseEvent) => {
      if (event.detail === 0) return; 

      this.toggleBVHBtn?.classList.toggle('active');
      Renderer.toggleBVH 
        = this.toggleBVHBtn.classList.contains("active") ? 1 :0;
        0;
        if (this.toggleBVHBtn.classList.contains("active")) {
          this.scene.rebuildBVH();
          if (debug) console.log(this.scene.bvhNodes);
        }
      // this.toggleBVH = this.toggleBVH == 0 ? 1: 0;
    });
  
    this.toggleShowBVHBoxesBtn.addEventListener('click', (event: MouseEvent) => {
      if (event.detail === 0) return; 

      this.toggleShowBVHBoxesBtn?.classList.toggle('active');
      this.showBVHBoxes = this.showBVHBoxes == 0 ? 1: 0;
    });

    this.toggleHideRootBVHBoxBtn.addEventListener('click', (event: MouseEvent) => {
      if (event.detail === 0) return; 

      this.toggleHideRootBVHBoxBtn?.classList.toggle('active');
      this.hideRootBVHBox = this.hideRootBVHBox == 0 ? 1: 0;
    });

    this.toggleDepthTestBVHBtn.addEventListener('click', (event: MouseEvent) => {
      if (event.detail === 0) return; 

      this.toggleDepthTestBVHBtn?.classList.toggle('active');
      this.depthTestBVH = this.depthTestBVH == 0 ? 1: 0;
      // this.frameCount = 0;
    });
    
  }
  public update() {
    Renderer.deltaT = performance.now() - Renderer.lastFrame;
    Renderer.lastFrame = performance.now();

    Renderer.frameCount++;
    this.writeRenderDataBuffer();
    if (this.scene.camera.updatedCamera == true) {
      this.scene.camera.update();
      this.writeCameraBuffer(false);
      if (this.accumulateFrames == 0){
        Renderer.frameCount = 1;
      }
    }

    if (Scene.updatedScene ==  true) {
      this.scene.updateScene();
      this.writeSpheresBuffer(false);
      this.writeTrianglesBuffer(false);

      this.writeBVHNodesBuffer();
      this.configureBindGroups();
      Scene.updatedScene = false;
      if (this.accumulateFrames == 0){
        Renderer.frameCount = 1;
      }
    }

    
  }

  public render() {
    this.update();
    let start: number = performance.now();
    
    // Create Command Encoder to encode commands to be sent to GPU:
    const commandEncoder: GPUCommandEncoder = this.device.createCommandEncoder({
      label: "Basic Comamnd Encoder",
    });
  
    // Compute Pass:
    const computePassEncoder: GPUComputePassEncoder = commandEncoder.beginComputePass();
    computePassEncoder.setPipeline(this.computePipeline);
    computePassEncoder.setBindGroup(0, this.computeBindGroup);
    computePassEncoder.dispatchWorkgroups(
      Math.floor((Renderer.canvas.width + 7) / 8), // 100
      Math.floor((Renderer.canvas.height + 7) / 8), // 75
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
    //   depthStencilAttachment: {
    //     view: this.depthTexture.createView(),
    //     depthClearValue: 1.0, // 1.0 is the "farthest" possible distance
    //     depthLoadOp: 'clear',
    //     depthStoreOp: 'store',
    // },
    });
    renderPassEncoder.setPipeline(this.textureRenderPipeline);
    renderPassEncoder.setBindGroup(0, this.textureBindGroup);
    renderPassEncoder.draw(6, 2, 0, 0);


    /*
      If we want to show BVH Boxes, run the box pipeline
    */
    if (this.showBVHBoxes) {
      renderPassEncoder.setPipeline(this.boxPipeline);
      // Reuse the compute bind group because it contains the BVH buffer
      renderPassEncoder.setBindGroup(0, this.boxBindGroup); 
      renderPassEncoder.setVertexBuffer(0, this.boxVertexBuffer);
      renderPassEncoder.setIndexBuffer(this.boxIndexBuffer, "uint16");
      // 24 vertices per box * number of nodes
      renderPassEncoder.drawIndexed(24, this.scene.bvhNodes.length); 
    }
    renderPassEncoder.end();

    this.device.queue.submit([
      commandEncoder.finish(), // GPUCommandBuffer
    ]);
    this.device.queue.onSubmittedWorkDone().then(
      () => {
          let end: number = performance.now();
        if (this.frameTimeSpan) {
          this.frameTimeSpan.innerText = (end - start).toFixed(2).toString();
        }
        if (this.fpsSpan) {
          this.fpsSpan.innerText = (1.0 / ((end - start) * 0.0001)).toFixed(2).toString();
        }
        
      }
  );
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
      label: 'computePipeline',
      layout: computePipelineLayout,
      compute: {
        module: this.computeShaderModule,
        entryPoint: "main",
      },
    });

  //   const depthStencilState: GPUDepthStencilState = {
  //     format: 'depth24plus',
  //     depthWriteEnabled: true,
  //     depthCompare: 'equal', // Only draw if the new pixel is "less" (closer) than the old one
  // };
    /*
      Create Texture Pipeline
    */
    const texturePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.textureBindGroupLayout], // @group(0)
    });

    this.textureRenderPipeline = this.device.createRenderPipeline({
      label: 'textureRenderPipeline',
      layout: texturePipelineLayout,
      // depthStencil: depthStencilState,

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

    /*
      Create Box Pipeline
    */
    const boxPipelineLayout = this.device.createPipelineLayout({
    bindGroupLayouts: [this.boxBindGroupLayout], // @group(0)
    });
    this.boxPipeline = this.device.createRenderPipeline({
      label: 'boxPipeline',
      layout: boxPipelineLayout,
      // depthStencil: depthStencilState,
      vertex: {
        module: this.vertexShaderModule, // Use the module containing vs_box
        entryPoint: "vs_box",
        buffers: [{
          arrayStride: 12, // 3 floats * 4 bytes
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }]
        }]
      },
      fragment: {
        module: this.fragmentShaderModule,
        entryPoint: "fs_box",
        targets: [{ format: this.textureFormat }],
      },
      primitive: {
        topology: "line-list", // draw lines
        // cullMode: 'none', 
      },
    });
  }
  private createDepthTexture() {
    if (this.depthTexture) this.depthTexture.destroy();

    this.depthTexture = this.device.createTexture({
        size: [Renderer.canvas.width, Renderer.canvas.height],
        format: 'depth24plus', // Standard high-quality depth format
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
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
          binding: 0, // @binding(0) - colorBuffer
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "rgba8unorm",
            viewDimension: "2d",
          },
        },
        {
          binding: 1, // @binding(1) - cameraBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform",
          }  
        },
        {
          binding: 2, // @binding(2) - spheresBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "read-only-storage",
            hasDynamicOffset: false
          }
        },
        {
          binding: 3, // @binding(3) - triangleDataBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "read-only-storage",
            hasDynamicOffset: false
          }
        },
        {
          binding: 4, // @binding(4) - renderDataBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform"
          }
        },
        {
          binding: 5, // @binding(5) - accumulationBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" } 
        },
        {
          binding: 6,// @binding(6) - bvhNodesBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
              type: "read-only-storage",
              hasDynamicOffset: false
          }
        },
        {
          binding: 7,// @binding(7) - boxDepthTexture
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "r32float",
            viewDimension: "2d",
          },

        },
      ],
    });

    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries: [
        {
          binding: 0, // @binding(0)
          resource: this.colorBuffer.createView(),
        },
        {
          binding: 1, // @binding(1)
          resource: {buffer: this.cameraBuffer},
        },
        {
          binding: 2, // @binding(2)
          resource: {buffer: this.spheresBuffer},
        },
        {
          binding: 3, // @binding(3)
          resource: {buffer: this.trianglesBuffer},
        },
        {
          binding: 4, // @binding(4)
          resource: {
              buffer: this.renderDataBuffer 
          }
        },
        {
          binding: 5, // @binding(5)
          resource: {
              buffer: this.accumulationBuffer 
          }
        },
        {
          binding: 6, // @binding(6)
          resource: {
            buffer: this.bvhNodesBuffer,
          }
        },
        {
          binding: 7,// @binding(7)
          resource: this.boxDepthTexture.createView(),
        },
      ],
    });

    // Texture Bind Group and Bind Group Layout:
    this.textureBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, // @binding(0) - screen_sampler
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1, // @binding(1) - colorBuffer
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

    this.boxBindGroupLayout = this.device.createBindGroupLayout({
      label: 'boxBindGroupLayout',
      entries: [
        {
          binding: 0, // @binding(0)
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 2, // @binding(2) - cameraBuffer
          visibility: GPUShaderStage.VERTEX  | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform",
          }  
        },
        {
          binding: 3, // @binding(3) - renderData
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        },
        {
          binding: 4,// @binding(4) - bvh
          visibility: GPUShaderStage.VERTEX,
          buffer: {
              type: "read-only-storage",
              hasDynamicOffset: false
          }
        },
        {
          binding: 5, // @binding(5) - boxDepthTexture
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: 'unfilterable-float', 
            viewDimension: '2d',
          },
        },
      ],
    });
    this.boxBindGroup = this.device.createBindGroup({
      label: 'boxBindGroup',
      layout: this.boxBindGroupLayout,
      entries: [
        {
          binding: 0, // @binding(0)
          resource: this.sampler,
        },
        {
          binding: 2, // @binding(2)
          resource: {buffer: this.cameraBuffer},
        },
        {
          binding: 3, // @binding(3)
          resource: {
              buffer: this.renderDataBuffer 
          }
        },
        {
          binding:4,// @binding(4)
          resource: {
              buffer: this.bvhNodesBuffer,
          }
        },
        {
          binding: 5, // @binding(5) - boxDepthTexture
          resource: this.boxDepthTexture.createView()
        },
      ],
    });
    this.updateBindGroups = false;
  }

  private writeRenderDataBuffer() {
    this.renderData = new Uint32Array([
      Renderer.canvas.width, Renderer.canvas.height, Renderer.frameCount, this.temporalAccumulation, 
      this.diffuseType, this.hasGammaCorrection, this.showBVHBoxes, 
      this.hideRootBVHBox, this.depthTestBVH, Renderer.toggleBVH, this.numRayBounces,
      Renderer.isCheckerBoard
    ]);
    this.device.queue.writeBuffer(this.renderDataBuffer, 0, this.renderData);
  }

  /*
  Writes to the camera buffer with values
  from the current state of the camera (orientation, position).
  */
  private writeCameraBuffer(isInit: boolean) {
    // Write to Camera Buffer:
    /*
      Format of CameraData struct:
      cameraPos: vec3<f32>,       - 4 * 3  = 12 bytes
      padding0: f32,              - 4 bytes
      cameraForwards: vec3<f32>,  - 4 * 3  = 12 bytes
      padding1: f32,              - 4 bytes
      cameraRight: vec3<f32>,     - 4 * 3  = 12 bytes
      padding2: f32,              - 4 bytes
      cameraUp: vec3<f32>,        - 4 * 3  = 12 bytes
      padding3: f32,              - 4 bytes
      viewProjectionMatrix        - mat4x4<f32> - 64 bytes
      inverseViewProjectionMatrix - mat4x4<f32> - 64 bytes

      size of CameraData        -   128 bytes
    */
   if (isInit == true) {
    this.cameraData = new Float32Array(48);

   }

    this.cameraData.set(this.scene.camera.position, 0);   
    this.cameraData[3] = 0.0;
    this.cameraData.set(this.scene.camera.forwards, 4);   
    this.cameraData[7] = 0.0;
    this.cameraData.set(this.scene.camera.right, 8);      
    this.cameraData[11] = 0.0;
    this.cameraData.set(this.scene.camera.up, 12);        
    this.cameraData[15] = 0.0;

    // Inverse View-Projection (Indices 16-31)
    this.cameraData.set(this.scene.camera.viewProjectionMatrix, 16);

    // Inverse View-Projection (Indices 32-63)
    if (this.scene.camera.inverseViewProjectionMatrix) {
      this.cameraData.set(this.scene.camera.inverseViewProjectionMatrix, 32);
    }
    this.device.queue.writeBuffer(this.cameraBuffer, 0,
      this.cameraData,

    );

  }

  private writeSpheresBuffer(isInit: boolean) {
    // Write to Spheres Buffer:
    const sphereStructSizeBytes = //48
      4 * 3 +  // position 
      4 +      // radius
      4 * 3 +  // color
      4     + // material
      4     +  // roughness
      12;        //padding
    const entryLength = sphereStructSizeBytes / 4; 

    this.sphereDataLength = 4*4 + sphereStructSizeBytes * this.scene.spheres.length;
    if (isInit == true) {
      this.sphereData = new ArrayBuffer(
        this.sphereDataLength
      );
    }
    
    // need to recreate the spheres buffer if new ones are added or removed (like in scene 2)
    if (this.sphereData.byteLength !== this.sphereDataLength) {
      this.sphereData = new ArrayBuffer(this.sphereDataLength);
      // Recreate this.spheresBuffer - delete old one and create one with new size
      this.spheresBuffer.destroy();
      this.spheresBuffer = this.device.createBuffer({
          size: this.sphereDataLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.updateBindGroups = true;// signals update() to call configureBindGroups
    }
    const sphereDataAsF32: Float32Array = new Float32Array(this.sphereData);
    const sphereDataAsU32: Uint32Array = new Uint32Array(this.sphereData);
    const numSpheres: Uint32Array = new Uint32Array(1);
    sphereDataAsF32[0] = this.scene.skyColor[0];
    sphereDataAsF32[1] = this.scene.skyColor[1];
    sphereDataAsF32[2] = this.scene.skyColor[2];

    numSpheres[0] = this.scene.spheres.length;
    sphereDataAsU32[3] = numSpheres[0];
    for (let i = 0; i < this.scene.spheres.length; i++) {
      const offset = 4 + i * entryLength;
      const sphere = this.scene.spheres[i] as Sphere;
      sphereDataAsF32[offset + 0] = sphere.position[0];
      sphereDataAsF32[offset + 1] = sphere.position[1];
      sphereDataAsF32[offset + 2] = sphere.position[2];
      sphereDataAsF32[offset + 3] = sphere.radius;

      sphereDataAsF32[offset + 4] = sphere.color[0];
      sphereDataAsF32[offset + 5] = sphere.color[1];
      sphereDataAsF32[offset + 6] = sphere.color[2];
      sphereDataAsF32[offset + 7] = sphere.material;

      sphereDataAsF32[offset + 8] = sphere.fuzziness;
      sphereDataAsF32[offset + 9] = sphere.reflectivity;
      sphereDataAsF32[offset + 10] = sphere.refractivity;


    }

    this.device.queue.writeBuffer(this.spheresBuffer, 0,
      this.sphereData,
      0,
      this.sphereData.byteLength
    );
  }

  private writeTrianglesBuffer(isInit: boolean) {
    const triangleStructBytes = // 80
      16 +
      16 +
      16 +
      16 +
      16;
    const entryLength = triangleStructBytes / 4; //20
    this.triangleDataLength = 4*4 + triangleStructBytes * this.scene.triangles.length;
    if (isInit == true) {
      this.triangleData = new ArrayBuffer(
        this.triangleDataLength
      );
    }
    const triangleDataAsF32: Float32Array = new Float32Array(this.triangleData );
    const triangleDataAsU32: Uint32Array = new Uint32Array(this.triangleData );
    const numTriangles: Uint32Array = new Uint32Array(1);
    numTriangles[0] = this.scene.triangles.length;
    triangleDataAsU32[0] = numTriangles[0];
    for (let i = 0; i < this.scene.triangles.length; i++) {
      const offset = 4 + i * entryLength;
      const triangle = this.scene.triangles[i] as Triangle;
      triangleDataAsF32[offset + 0] = triangle.v0[0];
      triangleDataAsF32[offset + 1] = triangle.v0[1];
      triangleDataAsF32[offset + 2] = triangle.v0[2];
      triangleDataAsF32[offset + 3] = triangle.reflectivity;

      triangleDataAsF32[offset + 4] = triangle.v1[0];
      triangleDataAsF32[offset + 5] = triangle.v1[1];
      triangleDataAsF32[offset + 6] = triangle.v1[2];
      triangleDataAsF32[offset + 7] = triangle.refractivity;


      triangleDataAsF32[offset + 8] = triangle.v2[0];
      triangleDataAsF32[offset + 9] = triangle.v2[1];
      triangleDataAsF32[offset + 10] = triangle.v2[2];
      triangleDataAsF32[offset + 11] = triangle.material;


      triangleDataAsF32[offset + 12] = triangle.color[0];
      triangleDataAsF32[offset + 13] = triangle.color[1];
      triangleDataAsF32[offset + 14] = triangle.color[2];
      triangleDataAsF32[offset + 15] = 0.0;


      triangleDataAsF32[offset + 16] = triangle.normal[0];
      triangleDataAsF32[offset + 17] = triangle.normal[1];
      triangleDataAsF32[offset + 18] = triangle.normal[2];
      triangleDataAsF32[offset + 19] = 0.0;

    }
   
    this.device.queue.writeBuffer(this.trianglesBuffer, 0,
      this.triangleData,
      0,
      this.triangleData.byteLength
    );
  }

  private writeBVHNodesBuffer() {
    /*
      Format of bvhNodeBuffer:
      // numNodes: u32 - 4 bytes
      // padding - 28 bytes
      // nodes: array<BVHNode>, 
      - each BVHNode:
      min: vec3<f32>,     - 12 bytes
      left_child: u32,    - 4 bytes
      max: vec3<f32>,     - 12 bytes
      object_index: u32,  - 4 bytes
      depth: u32          - 4 bytes
      - BVHNode is byte aligned to 12 * 4 = 48 bytes
    */
    // we'll leave out the right child since it is not needed. I can recompute it as leftChild + 1.
    // takes up an extra 16 bytes if I leave it in,
    // since the BVHNode is byte aligned to 16 bytes
    const bvhNodesEntryLength = 12; 
    const bvhNodesArrayOffsetBytes = 16; 
    const bvhNodesArrayOffset = bvhNodesArrayOffsetBytes / 4; // 4
    const bvhNodesBufferNumElements = bvhNodesArrayOffset 
      + bvhNodesEntryLength*this.scene.bvhNodes.length;
    this.bvhNodeData 
    = new Float32Array(bvhNodesBufferNumElements);
    this.bvhNodeData [0] = this.scene.bvhNodes.length; // numNodes
    this.bvhNodeData [1] = Scene.bvhMaxDepth; // maxDepth
    for (let i = 2; i < bvhNodesArrayOffset; i++) { //padding
      this.bvhNodeData [i] = 0.0;
    }
    for (let i = 0; i < this.scene.bvhNodes.length; i++) {
      const offset = bvhNodesArrayOffset + bvhNodesEntryLength*i; 
      this.bvhNodeData[offset + 0] = this.scene.bvhNodes[i].min[0];
      this.bvhNodeData[offset + 1] = this.scene.bvhNodes[i].min[1];
      this.bvhNodeData[offset + 2] = this.scene.bvhNodes[i].min[2];
      this.bvhNodeData[offset + 3] = this.scene.bvhNodes[i].leftChild;
      this.bvhNodeData[offset + 4] = this.scene.bvhNodes[i].max[0];
      this.bvhNodeData[offset + 5] = this.scene.bvhNodes[i].max[1];
      this.bvhNodeData[offset + 6] = this.scene.bvhNodes[i].max[2];
      this.bvhNodeData[offset + 7] = this.scene.bvhNodes[i].skipLink;
      this.bvhNodeData[offset + 8] = this.scene.bvhNodes[i].hasRoot;
      this.bvhNodeData[offset + 9] = this.scene.bvhNodes[i].rightChild; 
      this.bvhNodeData[offset + 10] = this.scene.bvhNodes[i].objectIdx;
      this.bvhNodeData[offset + 11] = this.scene.bvhNodes[i].depth;

    }
    const requiredSizeBVH = this.bvhNodeData.byteLength;
    if (this.bvhNodesBuffer.size !== requiredSizeBVH) {
      // if (isInit) {
      //   this.bvhNodesBuffer.destroy();
      // }
      this.bvhNodesBuffer = this.device.createBuffer({
        size: requiredSizeBVH,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.updateBindGroups = true;
      // this.configureBindGroups();
    }
    this.device.queue.writeBuffer(this.bvhNodesBuffer, 0, this.bvhNodeData);
  }

  /*

    Writes to the spheres buffer with the values from the
    scene's sphere member (array of sphere types).
  */
  private writeBuffers(isInit: boolean) {
    
    this.writeCameraBuffer(isInit);
    this.writeRenderDataBuffer();
    // these functions may resize the spheresBuffer and/or BVHNodeBuffer
    // that would require reconfiguring the bind group
    this.writeSpheresBuffer(isInit);
    this.writeTrianglesBuffer(isInit);
    this.writeBVHNodesBuffer();

    if (this.updateBindGroups == true) {
      this.configureBindGroups();
    }
  }

  /*
    Creates the scene data and camera data
    that the shaders use.
  */
  private configureBuffers() {
    // Color Buffer: written to by the compute shader
    // read from by the vertex + fragment shaders.
    this.colorBuffer = this.device.createTexture({
      label: 'colorBuffer',
      size: {
        width: Renderer.canvas.width,
        height: Renderer.canvas.height, 
      },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING, // storage texture
    });

    this.boxDepthTexture = this.device.createTexture({
      label: 'boxDepthTexture',
      size: {
        width: Renderer.canvas.width,
        height: Renderer.canvas.height, 
      },
      format: 'r32float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Sampler: used by the fragment shader to sample texture
    // cooresponds to @binding(0) in fragment Shader
    this.sampler = this.device.createSampler({
      label: 'sampler',
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
      label: 'cameraBuffer',
      size: 48 * 4, // 32 * 4 ==  128
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    /*
      Sphere Buffer Format: array of spheres
      1st element: scene.spheres.length + 12 bytes padding
      (i + 1)th element buffer:
      {
        scene.spheres[i].position, - 3 floats
                                    --> 4*3 == 12 bytes, offset == 0
        scene.spheres[i].radius  , - 3 floats
                                  --> 4*1 == 4 bytes, offset == 12
        scene.spheres[i].color   , - 3 floats + 1 float padding
                                  --> 4*4 == 16 bytes, offset == 4*4  == 16
      },
    */
    // cooresponds to @binding(2) in compute Shader
    this.spheresBuffer = this.device.createBuffer({
      label: 'spheresBuffer',
      size: this.sphereDataLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.trianglesBuffer = this.device.createBuffer({
      label: 'trianglesBuffer',
      size: this.triangleDataLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // cooresponds to @binding(3) in compute Shader

    this.renderDataBuffer = this.device.createBuffer({
      label: 'renderDataBuffer',
      size: 48, 
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.accumulationBuffer = this.device.createBuffer({
      label: 'accumulationBuffer',
      size: Renderer.canvas.width * Renderer.canvas.height * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    
    this.bvhNodesBuffer = this.device.createBuffer({
      label: 'bvhNodesBuffer',
      size: 4*3 + 48 * this.scene.bvhNodes.length,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });


    const unitCubeVertices = new Float32Array([ // if facing in +Z
      0, 0, 0,  // 0 - front, bottom left
      1, 0, 0,  // 1 - back, bottom left
      1, 1, 0,  // 2 - back, top left
      0, 1, 0,  // 3 - front, top left
      0, 0, 1,  // 4 - front, bottom right
      1, 0, 1,  // 5 - back, bottom right
      1, 1, 1,  // 6 - back, top right
      0, 1, 1   // 7 - front, top right
    ]);
    const unitCubeIndices = new Uint16Array([// if facing in +Z
      // wireframe cube consists of 12 lines
      // 0 - 3: left square
      0, 1, // front to back, bottom left
      1, 2, // back, bottom left to top left
      2, 3, // back to front, top left
      3, 0, // front, top left to bottom left
      // 4 - 7:
      4, 5, // right square
      5, 6, 
      6, 7,
      7, 4,
      // 8 - 12:  front and back horizontal lines
      0, 4, 
      1, 5, 
      2, 6, 
      3, 7  
    ]);
  
  
    this.boxVertexBuffer = this.device.createBuffer({
      size: unitCubeVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.boxVertexBuffer.getMappedRange()).set(unitCubeVertices);
    this.boxVertexBuffer.unmap();
    
    this.boxIndexBuffer = this.device.createBuffer({
      size: unitCubeIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint16Array(this.boxIndexBuffer.getMappedRange()).set(unitCubeIndices);
    this.boxIndexBuffer.unmap();
  }

  /*
    Initializes the scene.
  */
  private createScene() {
    this.scene = new Scene();
    const sphereStructSizeBytes = //48
    4 * 3 +  // position 
    4 +      // radius
    4 * 3 +  // color
    4     + // material
    4     +  // roughness
    12;        //padding
    this.sphereDataLength = 4*4 + sphereStructSizeBytes * this.scene.spheres.length;
    
    const triangleStructBytes = // 80
    16 +
    16 +
    16 +
    16 +
    16;
  this.triangleDataLength = 4*4 + triangleStructBytes * this.scene.triangles.length;
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
    this.context = Renderer.canvas.getContext("webgpu") as GPUCanvasContext;
    this.textureFormat = navigator.gpu.getPreferredCanvasFormat();
    // this.textureFormat = "bgra8unorm-srgb";

    this.context.configure({
      device: this.device,
      format: this.textureFormat,
      alphaMode: "premultiplied",
    });
    // this.device.addEventListener('uncapturederror', event => alert(event.error.message));
  }

  private async getGPUDevice(): Promise<boolean> {
    if (!navigator.gpu) {
      this.fallback("Make sure WebGPU feature flag is turned on for this browser");
      this.isSupported = false;
      return false;
    }
    const adapter: GPUAdapter =
      (await navigator.gpu.requestAdapter()) as GPUAdapter;
    const device = await adapter?.requestDevice();

    if (!device || device == null) {
      this.fallback("Make sure WebGPU feature flag is turned on for this browser");
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
    Renderer.canvas.hidden = true;
  }
}