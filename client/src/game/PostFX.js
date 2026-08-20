import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// One combined shader for vignette + filmic color grade + grain, instead of
// three separate passes — keeps the extra draw-call cost low.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignetteStrength: { value: 0.32 },
    grainStrength: { value: 0.002 },
    // Story-driven red bleed (Act I's apartment) plus a one-shot white flash
    // for the instant the lighting turns over. Both idle at 0.
    redWash: { value: 0 },
    flash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignetteStrength;
    uniform float grainStrength;
    uniform float redWash;
    uniform float flash;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // subtle teal-shadow / warm-highlight split tone
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(0.03, 0.05, 0.07);
      vec3 highlightTint = vec3(0.04, 0.02, 0.0);
      color.rgb += shadowTint * (1.0 - smoothstep(0.0, 0.5, lum));
      color.rgb += highlightTint * smoothstep(0.5, 1.0, lum);

      // gentle filmic contrast curve
      color.rgb = pow(color.rgb, vec3(1.04));
      color.rgb = mix(color.rgb, smoothstep(0.0, 1.0, color.rgb), 0.25);

      // story red wash — pushes everything toward blood red while keeping
      // shape readable (luminance survives, the blue/green channels don't)
      if (redWash > 0.0) {
        vec3 bled = vec3(lum * 1.5 + 0.035, lum * 0.17, lum * 0.19);
        color.rgb = mix(color.rgb, mix(color.rgb * vec3(1.12, 0.34, 0.36), bled, 0.55), redWash);
      }
      color.rgb += vec3(flash, flash * 0.12, flash * 0.14);

      // vignette
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * vignetteStrength * 2.2;
      color.rgb *= clamp(vig, 0.0, 1.0);

      // film grain
      float grain = (hash(vUv * vec2(1920.0, 1080.0) + time) - 0.5) * grainStrength;
      color.rgb += grain;

      gl_FragColor = vec4(color.rgb, color.a);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.time = 0;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.4, 0.82);
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.composer.addPass(new OutputPass());

    this._wash = 0;
    this._washTarget = 0;
    this._washSpeed = 0.4;
    this._flash = 0;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  /** Fades the red story wash toward `target` (0..1) over `duration` seconds. */
  setRedWash(target, { duration = 2.6 } = {}) {
    this._washTarget = THREE.MathUtils.clamp(target, 0, 1);
    this._washSpeed = 1 / Math.max(0.1, duration);
  }

  /** One-shot bright hit, decaying on its own — used when the lights turn over. */
  pulseFlash(amount = 0.35) {
    this._flash = Math.max(this._flash, amount);
  }

  render(dt) {
    this.time += dt;
    this.grade.uniforms.time.value = this.time;

    this._wash = THREE.MathUtils.damp(this._wash, this._washTarget, this._washSpeed * 3, dt);
    if (Math.abs(this._wash - this._washTarget) < 0.002) this._wash = this._washTarget;
    this.grade.uniforms.redWash.value = this._wash;

    this._flash = Math.max(0, this._flash - dt * 0.9);
    this.grade.uniforms.flash.value = this._flash;

    this.composer.render(dt);
  }
}
