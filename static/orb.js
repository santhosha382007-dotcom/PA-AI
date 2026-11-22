// J.A.R.V.I.S 3D Interactive Glowing Particle Neural Orb
// Inspired by Iron Man holographic AI interface and video reference

class JarvisNeuralOrb {
  constructor(canvasId, containerId) {
    this.canvas = document.getElementById(canvasId);
    this.container = document.getElementById(containerId);
    if (!this.canvas || !this.container) return;

    this.state = "idle"; // "idle" | "listening" | "thinking" | "speaking"
    this.audioLevel = 0.0;
    this.targetAudioLevel = 0.0;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isMicActive = false;

    // Interaction rotation
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.rotationVelocity = { x: 0.002, y: 0.004 };

    this.initThree();
    this.initAudio();
    this.initEvents();
    this.animate();
  }

  initThree() {
    if (typeof THREE === "undefined") {
      console.warn("Three.js not loaded, skipping 3D orb initialization.");
      return;
    }

    const width = this.container.clientWidth || 300;
    const height = this.container.clientHeight || 300;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.z = 5.2;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Particle Texture
    const particleTexture = this.createParticleTexture();

    // 1. Sphere Shell Point Cloud (3,200 particles)
    const shellCount = 3200;
    const shellGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(shellCount * 3);
    const colors = new Float32Array(shellCount * 3);
    const seeds = new Float32Array(shellCount);
    this.originalPositions = new Float32Array(shellCount * 3);

    const baseRadius = 1.85;

    for (let i = 0; i < shellCount; i++) {
      // Fibonacci sphere distribution for uniform distribution
      const y = 1 - (i / (shellCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = 2.3999632 * i; // Golden angle

      const jitter = (Math.random() - 0.5) * 0.18;
      const r = baseRadius + jitter;

      const x = Math.cos(theta) * radiusAtY * r;
      const z = Math.sin(theta) * radiusAtY * r;
      const py = y * r;

      positions[i * 3] = x;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = z;

      this.originalPositions[i * 3] = x;
      this.originalPositions[i * 3 + 1] = py;
      this.originalPositions[i * 3 + 2] = z;

      seeds[i] = Math.random();

      // Color: Deep electric blue to cyan with neon highlights
      const colorRatio = Math.random();
      if (colorRatio > 0.85) {
        // Neon cyan / white
        colors[i * 3] = 0.8;
        colors[i * 3 + 1] = 0.98;
        colors[i * 3 + 2] = 1.0;
      } else if (colorRatio > 0.45) {
        // Cyan / Bright Blue
        colors[i * 3] = 0.0;
        colors[i * 3 + 1] = 0.85;
        colors[i * 3 + 2] = 1.0;
      } else {
        // Royal Electric Blue / Indigo
        colors[i * 3] = 0.05;
        colors[i * 3 + 1] = 0.35;
        colors[i * 3 + 2] = 0.98;
      }
    }

    shellGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    shellGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.shellGeometry = shellGeometry;
    this.shellSeeds = seeds;

    this.shellMaterial = new THREE.PointsMaterial({
      size: 0.065,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.shellPoints = new THREE.Points(shellGeometry, this.shellMaterial);
    this.scene.add(this.shellPoints);

    // 2. Swirling Vortex Ribbons (Filaments matching the video frames!)
    this.ribbons = [];
    const ribbonConfigs = [
      { count: 650, radius: 1.88, axis: "y", speed: 1.2, color: new THREE.Color(0x00f0ff) },
      { count: 650, radius: 1.82, axis: "x", speed: 0.9, color: new THREE.Color(0x0077ff) },
      { count: 650, radius: 1.86, axis: "z", speed: 1.4, color: new THREE.Color(0xa855f7) }
    ];

    ribbonConfigs.forEach((cfg) => {
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(cfg.count * 3);
      const cols = new Float32Array(cfg.count * 3);

      for (let i = 0; i < cfg.count; i++) {
        const u = (i / cfg.count) * Math.PI * 4;
        const r = cfg.radius + Math.sin(u * 3) * 0.12;

        let x = 0, y = 0, z = 0;
        if (cfg.axis === "y") {
          x = Math.cos(u) * r;
          y = (Math.sin(u * 2) * 0.85);
          z = Math.sin(u) * r;
        } else if (cfg.axis === "x") {
          x = (Math.sin(u * 2) * 0.85);
          y = Math.cos(u) * r;
          z = Math.sin(u) * r;
        } else {
          x = Math.cos(u) * r;
          y = Math.sin(u) * r;
          z = (Math.sin(u * 2) * 0.85);
        }

        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;

        cols[i * 3] = cfg.color.r;
        cols[i * 3 + 1] = cfg.color.g;
        cols[i * 3 + 2] = cfg.color.b;
      }

      geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geom.setAttribute("color", new THREE.BufferAttribute(cols, 3));

      const mat = new THREE.PointsMaterial({
        size: 0.08,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const ribbonPoints = new THREE.Points(geom, mat);
      this.scene.add(ribbonPoints);
      this.ribbons.push({ points: ribbonPoints, geom, config: cfg });
    });

    // 3. Floating Sparkle Stars
    const sparkleCount = 200;
    const sparkleGeom = new THREE.BufferGeometry();
    const sparklePos = new Float32Array(sparkleCount * 3);
    const sparkleCols = new Float32Array(sparkleCount * 3);

    for (let i = 0; i < sparkleCount; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const rad = 2.2 + Math.random() * 1.0;

      sparklePos[i * 3] = Math.cos(theta) * r * rad;
      sparklePos[i * 3 + 1] = u * rad;
      sparklePos[i * 3 + 2] = Math.sin(theta) * r * rad;

      sparkleCols[i * 3] = 0.5 + Math.random() * 0.5;
      sparkleCols[i * 3 + 1] = 0.9;
      sparkleCols[i * 3 + 2] = 1.0;
    }

    sparkleGeom.setAttribute("position", new THREE.BufferAttribute(sparklePos, 3));
    sparkleGeom.setAttribute("color", new THREE.BufferAttribute(sparkleCols, 3));

    const sparkleMat = new THREE.PointsMaterial({
      size: 0.045,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.sparklePoints = new THREE.Points(sparkleGeom, sparkleMat);
    this.scene.add(this.sparklePoints);

    // Initial Resize
    this.onResize();
  }

  createParticleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.25, "rgba(0, 240, 255, 0.85)");
    gradient.addColorStop(0.65, "rgba(0, 112, 243, 0.35)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  initAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }
    } catch (e) {
      console.warn("Web Audio not supported:", e);
    }
  }

  startMicAudioCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    if (this.isMicActive) return;

    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        if (!this.audioContext) return;
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.isMicActive = true;
      })
      .catch((err) => {
        console.warn("Microphone audio stream blocked, using synthetic audio driver:", err);
      });
  }

  setAudioLevel(level) {
    this.targetAudioLevel = Math.max(0.0, Math.min(1.0, level));
  }

  setState(state) {
    this.state = state;
    if (state === "listening") {
      this.startMicAudioCapture();
    }
  }

  initEvents() {
    window.addEventListener("resize", () => this.onResize());

    // Drag to rotate in 3D
    const onStart = (clientX, clientY) => {
      this.isDragging = true;
      this.previousMousePosition = { x: clientX, y: clientY };
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const deltaX = clientX - this.previousMousePosition.x;
      const deltaY = clientY - this.previousMousePosition.y;

      this.rotationVelocity.y = deltaX * 0.005;
      this.rotationVelocity.x = deltaY * 0.005;

      this.previousMousePosition = { x: clientX, y: clientY };
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener("mousedown", (e) => onStart(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", onEnd);

    // Touch support for Mobile Phone
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener("touchend", onEnd);
  }

  onResize() {
    if (!this.renderer || !this.camera || !this.container) return;
    const width = this.container.clientWidth || 300;
    const height = this.container.clientHeight || 300;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.renderer || !this.scene || !this.camera) return;

    const time = performance.now() * 0.001;

    // Read real microphone level if available
    if (this.analyser && this.dataArray && this.isMicActive) {
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      this.targetAudioLevel = avg / 128.0; // normalize
    } else if (this.state === "listening") {
      // Dynamic simulated breath wave
      this.targetAudioLevel = 0.2 + 0.15 * Math.sin(time * 6.0);
    } else if (this.state === "speaking") {
      this.targetAudioLevel = 0.35 + 0.3 * Math.abs(Math.sin(time * 8.0));
    } else if (this.state === "thinking") {
      this.targetAudioLevel = 0.15 + 0.1 * Math.sin(time * 12.0);
    } else {
      this.targetAudioLevel = 0.02 * Math.sin(time * 2.0);
    }

    // Smooth audio level lerp
    this.audioLevel += (this.targetAudioLevel - this.audioLevel) * 0.15;

    // Base Rotation
    if (!this.isDragging) {
      this.rotationVelocity.x *= 0.95;
      this.rotationVelocity.y *= 0.95;
      // Ambient rotation
      const baseSpinY = (this.state === "listening" || this.state === "thinking") ? 0.012 : 0.004;
      this.shellPoints.rotation.y += baseSpinY + this.rotationVelocity.y;
      this.shellPoints.rotation.x += this.rotationVelocity.x;
    } else {
      this.shellPoints.rotation.y += this.rotationVelocity.y;
      this.shellPoints.rotation.x += this.rotationVelocity.x;
    }

    // Dynamic scale pulse
    let scaleMultiplier = 1.0;
    if (this.state === "listening") scaleMultiplier = 1.15;
    else if (this.state === "speaking") scaleMultiplier = 1.1;

    const pulse = 1.0 + (this.audioLevel * 0.35) + Math.sin(time * 2.0) * 0.02;
    this.shellPoints.scale.setScalar(scaleMultiplier * pulse);

    // Animate point positions for organic flowing wave effect
    const posAttr = this.shellGeometry.attributes.position;
    const posArray = posAttr.array;
    const orig = this.originalPositions;
    const count = orig.length / 3;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const seed = this.shellSeeds[i];
      // Wave ripple
      const wave = Math.sin(time * 2.5 + seed * 15.0) * (0.04 + this.audioLevel * 0.12);
      posArray[idx] = orig[idx] * (1.0 + wave);
      posArray[idx + 1] = orig[idx + 1] * (1.0 + wave);
      posArray[idx + 2] = orig[idx + 2] * (1.0 + wave);
    }
    posAttr.needsUpdate = true;

    // Animate Filaments / Ribbons
    this.ribbons.forEach((ribbon, rIdx) => {
      const { points, config } = ribbon;
      const speed = config.speed * ((this.state === "thinking" || this.state === "listening") ? 2.2 : 1.0);
      points.rotation.y += 0.006 * speed;
      points.rotation.x += 0.004 * speed * (rIdx % 2 === 0 ? 1 : -1);
      points.scale.setScalar(scaleMultiplier * (1.0 + this.audioLevel * 0.25));
    });

    // Orbiting sparkles
    if (this.sparklePoints) {
      this.sparklePoints.rotation.y -= 0.002;
      this.sparklePoints.rotation.x += 0.001;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Export to window
window.JarvisNeuralOrb = JarvisNeuralOrb;
