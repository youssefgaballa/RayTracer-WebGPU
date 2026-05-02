import { mat4, vec3 } from "gl-matrix";
import { debug } from "./main";
import { Interval } from "./BVH/interval";
import { Renderer } from "./renderer";
type keysPressedType = {
  w:     boolean,
  a:     boolean,
  s:     boolean,
  d:     boolean,
  up:    boolean,
  down:  boolean
}

export class Camera {
  position: Float32Array;
  /* Spherical coordinate system:
     is same as en.wikipedia.org/wiki/Spherical_coordinate_system except: 
     WebGPU uses a left handed coordinate system with y-axis pointing up
     and the wikipedia page uses right handed system with z-axis up.
     So we swap the roles of the y axis and z-axis in the right handed system.
     So the calculation of y in this.forwards is the calculation of z in a 
     right handed coordinate system, and vice versa
  */
  
  /*
    Polar Angle (theta): betweeen the y-axis and polar axis
    Range: [0, Math.PI] 
    Need to make sure we dont go under 0 or over Math.PI or the camera could flip
  */
  pitch: number;
  pitchInterval: Interval = new Interval(0 + 0.001, 2*Math.PI - 0.001);

  /*
    Azimuthal Angle (phi): between x-axis and projection of the polar axis on x-z plane 
    Range: [-infinity, infinity]
    Doesnt need to be clamped. values are effectively in [0, 2 * Math.PI] range.
  */
  yaw: number;
  
  forwards!: Float32Array;
  right!: Float32Array;
  up!: Float32Array;

  fov: number;
  fovSlider: HTMLButtonElement 
  = document.getElementById("fov") as HTMLButtonElement;
  fovSpan: HTMLButtonElement 
  = document.getElementById("fov-val") as HTMLButtonElement;

  projectionMatrix!: Float32Array;
  viewMatrix!: Float32Array;
  viewProjectionMatrix!: mat4;
  inverseViewProjectionMatrix!: mat4;

  speed: number;
  keysPressed: keysPressedType = {
    w: false,
    a: false,
    s: false,
    d: false,

    up: false,
    down: false
  };
  mouseActive: boolean = false;
  sensitivity: number = 0.002;
  /*
    Need hasMoved boolean so that when it is true,
    the accumulation buffer is cleared and the boolean is reset to false.
    This way the accumulation buffer doesnt contain data from previous frames in which
    the camera is in a different position
  */
  public hasMoved: boolean = false;
  private debug0 = false;
  /*
    When I click on the canvas, sometimes the first invocation of the
    movemove event causes the cammera to snap to a random position.
    This boolean is needed to skip first invokation of mousemove
  */
  // secondMouseMove: boolean = false;
  /*
  When I click on the canvas, the pointer lock function call requestPointerLock needs to be 
  awaited. We must only set isPointerLocked to true after this function is done.
  This boolean enables the mousemove event listeners
  */
  isPointerLocked: boolean = false;

  constructor(position: number[]) {
    this.position = new Float32Array(position);
    // looking at +Z
    this.pitch = this.pitchInterval.clamp(Math.PI / 2);
    this.yaw = Math.PI / 2;
    this.fov = 75;
    this.speed = 0.04;
    this.recalculate_vectors();
    this.registerInputListeners();
  }

  recalculate_vectors() {

    this.forwards = new Float32Array([
      Math.sin(this.pitch) * Math.cos(this.yaw) , // x
      Math.cos(this.pitch),                                  // y
      Math.sin(this.pitch) * Math.sin(this.yaw) , // z
    ]);

    const fov_radians = (this.fov * Math.PI) / 180.0;
    const fov_factor = Math.tan(fov_radians / 2.0);

    this.right = new Float32Array([0.0, 0.0, 0.0]);
    vec3.cross(this.right, [0.0, 1.0, 0.0], this.forwards);
    vec3.normalize(this.right, this.right); 
    // vec3.scale(this.right, this.right, fov_factor);

    this.up = new Float32Array([0.0, 0.0, 0.0]);
    vec3.cross(this.up, this.forwards, this.right);
    vec3.normalize(this.up, this.up);
    // vec3.scale(this.up, this.up, fov_factor);
    const aspect = Renderer.canvas.clientWidth / Renderer.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 3000.0;
    const f = 1.0 / Math.tan(fov_radians / 2);
    const rangeInv = 1.0 / (zFar - zNear);    
   
    // this.projectionMatrix = new Float32Array([
    //     f / aspect, 0,      0,                           0, // column 0
    //     0,          f,      0,                           0, // colun 1
    //     0,          0,  zFar * rangeInv,           1,      // column 2
    //     0,          0, -(zFar * zNear)*rangeInv, 0        // column 3
    //   ]);
      // this.projectionMatrix = new Float32Array([ // website vewrsion
      //     f / aspect, 0,      0,                           0, // column 0
      //     0,          f,      0,                           0, // colun 1
      //     0,          0,  zFar * rangeInv,           -1,      // column 2
      //     0,          0, (zFar * zNear)*rangeInv, 0        // column 3
      //   ]);
    this.projectionMatrix = new Float32Array([
      f / aspect, 0,      0,                           0, // column 0
      0,          f,      0,                           0, // colun 1
      0,          0,  -(zFar) * rangeInv,           -1,      // column 2
      0,          0, -2*(zFar * zNear)*rangeInv, 0        // column 3
    ]);
  
    this.viewMatrix = new Float32Array([
      this.right[0],    this.up[0],    -this.forwards[0], 0, // 0 1 2 3 - colun 1
      this.right[1],    this.up[1],    -this.forwards[1], 0, // 4 5 6 7
      this.right[2],    this.up[2],    -this.forwards[2], 0, // 8 9 10 11
      -vec3.dot(this.right, this.position), 
      -vec3.dot(this.up, this.position), 
      vec3.dot(this.forwards, this.position), 1             // 12 13 14 15
  ]);

    if (!this.debug0) {
      console.log(Renderer.canvas.clientWidth, Renderer.canvas.clientHeight)
      console.log("this.viewMatrix", this.viewMatrix)
      console.log("this.projectionMatrix", this.projectionMatrix)
      this.debug0= true;
    }
   
    this.viewProjectionMatrix = mat4.create();
    mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix as mat4);
  
    this.inverseViewProjectionMatrix = mat4.create();
    mat4.invert(this.inverseViewProjectionMatrix, this.viewProjectionMatrix);



  }

  update() {
    
    let moveDir = vec3.create(); 

    // Forward / Backward
    if (this.keysPressed.w) {
      vec3.add(moveDir, moveDir, this.forwards);
    }
    if (this.keysPressed.s) {
      vec3.sub(moveDir, moveDir, this.forwards);
    }
  
    // Left / Right 
    if (this.keysPressed.d) {
      vec3.add(moveDir, moveDir, this.right);
    }
    if (this.keysPressed.a) {
      vec3.sub(moveDir, moveDir, this.right);
    }
    // set y-component to 0 since we dont want any vertical movement with w,a,s,d keys
    vec3.set(moveDir, moveDir[0], 0.0, moveDir[2])

    // Up / Down
    if (this.keysPressed.up) {
      vec3.add(moveDir, moveDir, this.up);
    }
    if (this.keysPressed.down) {
      vec3.sub(moveDir, moveDir, this.up);
    }
    // Normalize moveDir so that diagonal movement and axial movement is at the same speed.
    vec3.normalize(moveDir, moveDir);
    vec3.scale(moveDir, moveDir, this.speed);
    vec3.add(this.position, this.position, moveDir);

    if (this.keysPressed.w == false &&
      this.keysPressed.s == false &&
      this.keysPressed.d == false &&
      this.keysPressed.a == false &&
      this.keysPressed.up == false &&
      this.keysPressed.down == false &&
      this.mouseActive == false
    ) {
      this.hasMoved = false;

    }
    this.recalculate_vectors() 
  }

  private registerInputListeners() {
    // console.log(canvas)

    window.addEventListener('keydown', (event) => {
      // console.log(event.key)
      const key = event.key;
      if (key == "w") {
        this.keysPressed.w = true;
        this.hasMoved = true;
      } else if (key == "d") {
        this.keysPressed.d = true;
        this.hasMoved = true;
      } else if (key == "s") {
        this.keysPressed.s = true;
        this.hasMoved = true;
      } else if (key == "a") {
        this.keysPressed.a = true;
        this.hasMoved = true;
      } else if (key == " ") {
        this.keysPressed.up = true;
        this.hasMoved = true;
      } 
      if (event.ctrlKey == true) {
        this.keysPressed.down = true;
        this.hasMoved = true;
      }   

    });
  
    window.addEventListener('keyup', (event) => {
      // console.log(event.key)
      const key = event.key;
      if (key == "w") {
        this.keysPressed.w = false;
      } else if (key == "d") {
        this.keysPressed.d = false;
      } else if (key == "s") {
        this.keysPressed.s = false;
      } else if (key == "a") {
        this.keysPressed.a = false;
      } else if (key == " ") {
        this.keysPressed.up = false;
      }
      if (key === "Control") {
        this.keysPressed.down = false;
      }
      // if (event.ctrlKey == false) {
      //   this.keysPressed.down = false;
      // }   
    });

    Renderer.canvas.addEventListener('mousedown', async (event) => {
      // 0 = Left click
      if (event.button === 0) {
        this.mouseActive = true;
        await Renderer.canvas.requestPointerLock();
        // this.isPointerLocked = true;

      }
    });
    Renderer.canvas.addEventListener('mouseup', (event) => {
      // 0 = Left click
      if (event.button === 0) {
        this.mouseActive = false;
        document.exitPointerLock();
        // this.isPointerLocked = false;
      }
    });
    document.addEventListener('pointerlockchange', (event) => {
      this.isPointerLocked = (document.pointerLockElement === Renderer.canvas);
      
  }, false);

    window.addEventListener('mousemove', (e) => {
      // if (this.isPointerLocked == false) {
      //   this.mouseDelta.offsetX = e.movementX;
      //   this.mouseDelta.offsetY = e.movementY;
      // }
      if (document.pointerLockElement === Renderer.canvas && this.isPointerLocked == true) {
        if (Math.abs(e.movementX) > 500 || Math.abs(e.movementY) > 500) {
          return;
      }
        // this.mouseDelta.x += e.movementX - this.mouseDelta.offsetX;
        // this.mouseDelta.y += e.movementY - this.mouseDelta.offsetY;

        this.yaw -= e.movementX * this.sensitivity;
        this.pitch = this.pitchInterval.clamp(this.pitch + e.movementY * this.sensitivity);
        this.recalculate_vectors()
        this.hasMoved = true;
        if (debug) {
          // console.log(e.movementX * this.sensitivity, e.movementY * this.sensitivity)
          // console.log(this.pitch, this.yaw)
        }
          
      }
  }, false);

  this.fovSlider.addEventListener('input', (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.fov = parseInt(target.value);
      this.fovSpan.textContent = target.value;
      Renderer.frameCount = 0;
    }
  });
  this.fovSlider.value = this.fov.toString();
  this.fovSpan.textContent = this.fov.toString();
} 


}
