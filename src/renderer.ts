import { debug } from "./main";
import { Scene } from "./scene";
import textureShader from "./shaders/textureShader.wgsl?raw";
import computeShader from "./shaders/computeShader.wgsl?raw";
const DiffuseTypes: { simpleDiffuse: number, lambertian: number; } =  {
  simpleDiffuse: 0,
  lambertian: 1
};
export class Renderer {
  public isSupported: boolean = true;
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private textureFormat!: GPUTextureFormat;

  private computeShaderModule!: GPUShaderModule;
  private vertexShaderModule!: GPUShaderModule;
  private fragmentShaderModule!: GPUShaderModule;

  /* Actual Data that is fed into Buffers and Textures */
  private scene!: Scene;
  private renderData!: Uint32Array;
  private cameraData!: Float32Array; // 16 elements (including padding)
  private frameCount = 1;
  /* Set when user clicks respective button. see registerEventListeners(). */
  private temporalAccumulation = 0;
  private toggleTemporalAccumulationBtn: HTMLButtonElement 
  = document.getElementById("temporalAccumulation-btn") as HTMLButtonElement;

  private diffuseType!: number;
  private toggleDiffuseTypeBtn: HTMLSelectElement 
    = document.getElementById("diffuseType") as HTMLSelectElement;

  private hasGammaCorrection = 1;
  private toggleHasGammaCorrectionnBtn: HTMLButtonElement 
    = document.getElementById("hasGammaCorrection-btn") as HTMLButtonElement;

  /*

  */
  private showBVHBoxes = 0;
  private toggleShowBVHBoxesBtn: HTMLButtonElement 
    = document.getElementById("showBVHBoxes-btn") as HTMLButtonElement;

  /* Buffers, Samplers, and Textures */
  private renderDataBuffer!: GPUBuffer;
  private colorBuffer!: GPUTexture;
  private sampler!: GPUSampler;
  private cameraBuffer!: GPUBuffer;
  private spheresBuffer!: GPUBuffer;
  private accumulationBuffer!: GPUBuffer;
  private bvhNodesBuffer!: GPUBuffer;
  private boxVertexBuffer!: GPUBuffer;
  private boxIndexBuffer!: GPUBuffer;

  private depthTexture!: GPUTexture;

  /* Bind Groups and Bind Group Layouts */
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
    this.canvas = canvas;
  }

  public async init() {
    if (!(await this.getGPUDevice())) return;
    this.configureGPUCanvasContext();
    this.loadShaders();
    this.createScene();
    this.registerEventListeners();
    this.configureBuffers();
    this.writeBuffers();
    this.createDepthTexture();
    this.configureBindGroups();
    this.configurePipeline();
  }

  public registerEventListeners() {
    // early return if the buttons arent in the document (shouldnt happen)
    if (this.toggleTemporalAccumulationBtn == null
      || this.toggleDiffuseTypeBtn == null
      || this.toggleHasGammaCorrectionnBtn == null
      || this.toggleShowBVHBoxesBtn == null
    ) {
      return;
    } 
    // Initialize the default values
    this.temporalAccumulation = 
      this.toggleTemporalAccumulationBtn.classList.contains("active") ? 1 : 0;

    this.diffuseType = parseInt(this.toggleDiffuseTypeBtn.value);

    this.hasGammaCorrection 
    = this.toggleHasGammaCorrectionnBtn.classList.contains("active") ? 1 : 0;

    this.showBVHBoxes 
    = this.toggleShowBVHBoxesBtn.classList.contains("active") ? 1 : 0;

    // Register event listeners
    this.toggleTemporalAccumulationBtn.addEventListener('click', () => {
      this.toggleTemporalAccumulationBtn?.classList.toggle('active');
      this.temporalAccumulation = this.temporalAccumulation == 0 ? 1: 0;
      this.frameCount = 0;
    });
    this.toggleDiffuseTypeBtn.addEventListener('change', (event: Event) => {
      // console.log('Selected value:', event.target.value);
      const target = event.target as HTMLSelectElement;
      this.diffuseType = parseInt(target.value);
    });
    this.toggleHasGammaCorrectionnBtn.addEventListener('click', () => {
      this.toggleHasGammaCorrectionnBtn?.classList.toggle('active');
      this.hasGammaCorrection = this.hasGammaCorrection == 0 ? 1: 0;
      // this.frameCount = 0;
    });
    this.toggleShowBVHBoxesBtn.addEventListener('click', () => {
      this.toggleShowBVHBoxesBtn?.classList.toggle('active');
      this.showBVHBoxes = this.showBVHBoxes == 0 ? 1: 0;
      // this.frameCount = 0;
    });
  }

  public update() {
    this.frameCount++;
    this.renderData[2] = this.frameCount;
    this.renderData[3] = this.temporalAccumulation;
    this.renderData[4] = this.diffuseType;
    this.renderData[5] = this.hasGammaCorrection;
    this.renderData[6] = this.showBVHBoxes;


    this.device.queue.writeBuffer(
      this.renderDataBuffer,
      0, // Offset in bytes: cavnas.width + cavnas.height = 4 + 4 = 8
      this.renderData
    );
    this.scene.camera.update();
    this.cameraData[0] = this.scene.camera.position[0]
    this.cameraData[1] = this.scene.camera.position[1]
    this.cameraData[2] = this.scene.camera.position[2]
    this.cameraData[4] = this.scene.camera.forwards[0]
    this.cameraData[5] = this.scene.camera.forwards[1]
    this.cameraData[6] = this.scene.camera.forwards[2]
    this.cameraData[8] = this.scene.camera.right[0]
    this.cameraData[9] = this.scene.camera.right[1]
    this.cameraData[10] = this.scene.camera.right[2]
    this.cameraData[12] = this.scene.camera.up[0]
    this.cameraData[13] = this.scene.camera.up[1]
    this.cameraData[14] = this.scene.camera.up[2]
  
    this.device.queue.writeBuffer(
      this.cameraBuffer,
      0, // Offset in bytes: 
      this.cameraData
    );
    if (this.scene.camera.hasMoved == true && this.temporalAccumulation == 1) {
      // commandEncoder.clearBuffer(this.accumulationBuffer, 0, 
      //   this.canvas.width * this.canvas.height * 16);
      this.frameCount = 0;
    }
    if (debug) {
      // console.log(this.scene.camera)
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


    // if (this.renderData[6] === 1) { // Assuming index 6 is showBVHBoxes
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

    const depthStencilState: GPUDepthStencilState = {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'equal', // Only draw if the new pixel is "less" (closer) than the old one
  };
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
        cullMode: 'none', // Add this to ensure both sides of the lines are drawn
      },
    });
  }
  private createDepthTexture() {
    if (this.depthTexture) this.depthTexture.destroy();

    this.depthTexture = this.device.createTexture({
        size: [this.canvas.width, this.canvas.height],
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
          binding: 3, // @binding(3) - renderDataBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: {
            type: "uniform"
          }
        },
        {
          binding: 4, // @binding(4) - accumulationBuffer
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" } 
        },
        {
          binding: 5,// @binding(5) - bvhNodesBuffer
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
        {
          binding: 3, // @binding(3)
          resource: {
              buffer: this.renderDataBuffer 
          }
        },
        {
          binding: 4, // @binding(4)
          resource: {
              buffer: this.accumulationBuffer 
          }
        },
        {
          binding: 5,
          resource: {
              buffer: this.bvhNodesBuffer,
          }
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
        {
          binding: 2,// @binding(2)
          visibility: GPUShaderStage.VERTEX,
          buffer: {
              type: "read-only-storage",
              hasDynamicOffset: false
          }
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
        {
          binding: 2,
          resource: {
              buffer: this.bvhNodesBuffer,
          }
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
          binding: 1, // @binding(1) - cameraBuffer
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform",
          }  
        },
        {
          binding: 2, // @binding(2) - renderDataBuffer
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform"
          }
        },
        {
          binding: 3,// @binding(3) - bvh
          visibility: GPUShaderStage.VERTEX,
          buffer: {
              type: "read-only-storage",
              hasDynamicOffset: false
          }
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
          binding: 1, // @binding(1)
          resource: this.cameraBuffer,
        },
        {
          binding: 2, // @binding(2)
          resource: {
              buffer: this.renderDataBuffer 
          }
        },
        {
          binding:3,
          resource: {
              buffer: this.bvhNodesBuffer,
          }
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
    /*
      Format of CameraData struct:
      cameraPos: vec3<f32>,     - 4 * 3  = 12 bytes
      padding0: f32,            - 4 bytes
      cameraForwards: vec3<f32>,- 4 * 3  = 12 bytes
      padding1: f32,            - 4 bytes
      cameraRight: vec3<f32>,   - 4 * 3  = 12 bytes
      padding2: f32,            - 4 bytes
      cameraUp: vec3<f32>,      - 4 * 3  = 12 bytes
      padding3: f32,            - 4 bytes
      size of CameraData        - 64 bytes
    */
    this.cameraData = new Float32Array([
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
      0.0
    ]);
    this.device.queue.writeBuffer(this.cameraBuffer, 0,
      this.cameraData,
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
      4*4 + sphereStructSizeBytes * this.scene.spheres.length
    );
    const sphereDataAsF32: Float32Array = new Float32Array(sphereData);
    const sphereDataAsU32: Uint32Array = new Uint32Array(sphereData);
    const numSpheres: Uint32Array = new Uint32Array(1);
    numSpheres[0] = this.scene.spheres.length;
    sphereDataAsU32[0] = numSpheres[0];
    for (let i = 0; i < this.scene.spheres.length; i++) {
      const offset = 4 + i * entryLength;
      sphereDataAsF32[offset + 0] = this.scene.spheres[i].position[0];
      sphereDataAsF32[offset + 1] = this.scene.spheres[i].position[1];
      sphereDataAsF32[offset + 2] = this.scene.spheres[i].position[2];
      sphereDataAsF32[offset + 3] = this.scene.spheres[i].radius;
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

    this.renderData = new Uint32Array([
      this.canvas.width, this.canvas.height, this.frameCount, this.temporalAccumulation, 
      this.diffuseType, this.hasGammaCorrection, this.showBVHBoxes
    ]);
    this.device.queue.writeBuffer(this.renderDataBuffer, 0, this.renderData);

    // Write to BVH Nodes Buffer:
    
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
    const bvhNodesBufferNumElements = bvhNodesArrayOffset + bvhNodesEntryLength*this.scene.bvhNodes.length;
    const bvhNodeDataAsF32: Float32Array 
    = new Float32Array(bvhNodesEntryLength + 12 * this.scene.bvhNodes.length);
    // const bvhNodeDataAsU32: Uint32Array = new Uint32Array(bvhNodeDataAsF32);
    // const bvhNodeDataAsI32: Int32Array = new Int32Array(bvhNodeDataAsF32);

    bvhNodeDataAsF32[0] = this.scene.bvhNodes.length; // numNodes
    bvhNodeDataAsF32[1] = this.scene.bvhNodes[
      this.scene.bvhNodes.length - 1
    ].depth; // maxDepth
    for (let i = 2; i < bvhNodesArrayOffset; i++) { //padding
      bvhNodeDataAsF32[i] = 0.0;
    }
    for (let i = 0; i < this.scene.bvhNodes.length; i++) {
      const offset = bvhNodesArrayOffset + bvhNodesEntryLength*i; 
      bvhNodeDataAsF32[offset + 0] = this.scene.bvhNodes[i].min[0];
      bvhNodeDataAsF32[offset + 1] = this.scene.bvhNodes[i].min[1];
      bvhNodeDataAsF32[offset + 2] = this.scene.bvhNodes[i].min[2];
      bvhNodeDataAsF32[offset + 3] = 0.0;
      bvhNodeDataAsF32[offset + 4] = this.scene.bvhNodes[i].max[0];
      bvhNodeDataAsF32[offset + 5] = this.scene.bvhNodes[i].max[1];
      bvhNodeDataAsF32[offset + 6] = this.scene.bvhNodes[i].max[2];
      bvhNodeDataAsF32[offset + 7] = 0.0;
      // bvhNodeDataAsU32[offset + 8] = this.scene.bvhNodes[i].depth;
      bvhNodeDataAsF32[offset + 8] = this.scene.bvhNodes[i].leftChild;
      bvhNodeDataAsF32[offset + 9] = this.scene.bvhNodes[i].objectIdx;
      bvhNodeDataAsF32[offset + 10] = this.scene.bvhNodes[i].depth;
      //12 bytes padding
      bvhNodeDataAsF32[offset + 11] = 0.0;
      // bvhNodeDataAsU32[offset + 11] = 0.0;
    }
    if (debug) {
      // console.log("sphereDataAsF32: ", sphereDataAsF32)
      // console.log(sphereDataAsU32[0],this.scene.spheres.length )
      console.log("bvhNodeDataAsF32: ", bvhNodeDataAsF32);
      // console.log("bvhNodeDataAsU32: ", bvhNodeDataAsU32)
      // console.log("bvhNodeDataAsI32: ", bvhNodeDataAsI32)


    }

    this.device.queue.writeBuffer(this.bvhNodesBuffer, 0, bvhNodeDataAsF32, 
      0, bvhNodesBufferNumElements);

    
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
      label: 'colorBuffer',
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
      size: 16 * 4, // 16 * 4 ==  64
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
      size: 4*4 + ((4 * 8) * this.scene.spheres.length),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // cooresponds to @binding(2) in compute Shader

    this.renderDataBuffer = this.device.createBuffer({
      label: 'renderDataBuffer',
      size: 32, 
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.accumulationBuffer = this.device.createBuffer({
      label: 'accumulationBuffer',
      size: this.canvas.width * this.canvas.height * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    
    this.bvhNodesBuffer = this.device.createBuffer({
      label: 'bvhNodesBuffer',
      size: 16 + 48 * this.scene.bvhNodes.length,
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
      4, 5, //
      5, 6, 
      6, 7,
      7, 4, 
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
    this.scene = new Scene(this.canvas);

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
    // this.device.addEventListener('uncapturederror', event => alert(event.error.message));
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