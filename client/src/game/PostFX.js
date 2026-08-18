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
    grainStrength: { value: 0.016 },
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
    renderer.toneMappingExposure = 1.9;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.4, 0.82);
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.composer.addPass(new OutputPass());
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  render(dt) {
    this.time += dt;
    this.grade.uniforms.time.value = this.time;
    this.composer.render(dt);
  }
}
