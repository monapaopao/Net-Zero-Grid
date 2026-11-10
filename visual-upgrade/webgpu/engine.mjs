import * as T from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pass, uniform, mix, vec4, color, texture, positionView, smoothstep, float, uv, instancedBufferAttribute } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { createHaloMaterial } from './halo.mjs';

const particles = [];
// Keep the legacy animation's geometry/material references; draw textured quads
// instead of WebGPU's fixed one-pixel point primitives.
class FlowPoints extends T.Points {
  constructor(geometry, material) {
    super(geometry, material);
    this.layers.set(31);
    const nodeMaterial = new T.PointsNodeMaterial();
    for (const key of ['color', 'opacity', 'transparent', 'depthWrite', 'depthTest', 'blending', 'map', 'size', 'sizeAttenuation', 'alphaTest']) {
      nodeMaterial[key] = material[key];
    }
    const positions = new T.InstancedBufferAttribute(geometry.attributes.position.array, 3).setUsage(T.DynamicDrawUsage);
    nodeMaterial.positionNode = instancedBufferAttribute(positions);
    const sprite = new T.Sprite(nodeMaterial);
    sprite.count = geometry.attributes.position.count;
    sprite.frustumCulled = false;
    sprite.raycast = () => {};
    this.add(sprite);
    particles.push({ source: this, sprite, positions, version: -1 });
  }
}
globalThis.THREE = { ...T, OrbitControls, Points: FlowPoints };
globalThis.NZ_GPU = {
  ready: false, lost: false, backend: 'initializing',
  createHaloMaterial,
  updateParticles() {
    for (const item of particles) {
      const {source, sprite} = item;
      if (item.positions.array !== source.geometry.attributes.position.array) {
        item.positions = new T.InstancedBufferAttribute(source.geometry.attributes.position.array, 3).setUsage(T.DynamicDrawUsage);
        sprite.material.positionNode = instancedBufferAttribute(item.positions);
        sprite.material.needsUpdate = true;
        item.version = -1;
      }
      const positions = item.positions;
      if (item.version !== source.geometry.attributes.position.version) {
        positions.needsUpdate = true;
        item.version = source.geometry.attributes.position.version;
      }
      sprite.count = Math.min(source.geometry.drawRange.count, source.geometry.attributes.position.count);
      sprite.visible = sprite.count > 0 && source.material.visible;
      for (const key of ['color', 'opacity', 'size']) sprite.material[key] = source.material[key];
      for (const key of ['map', 'sizeAttenuation', 'transparent', 'depthTest', 'depthWrite', 'blending', 'alphaTest']) {
        if (sprite.material[key] !== source.material[key]) {
          sprite.material[key] = source.material[key];
          sprite.material.needsUpdate = true;
        }
      }
      sprite.renderOrder = source.renderOrder;
    }
    this.particleSystems = particles.length;
  },
  configurePV(m) {
    m.colorNode = mix(color('#243a4f'), texture(m.map).rgb,
      float(1).sub(smoothstep(130, 430, positionView.length())));
  },
  async init(renderer) {
    await renderer.init();
    renderer.info.autoReset = false;
    this.backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2 fallback';
    if (!renderer.backend.isWebGPUBackend && !new URLSearchParams(location.search).has('forceWebGL')) {
      renderer.dispose();
      throw new Error('当前浏览器未能启用 WebGPU。请使用支持 WebGPU 的 Chrome 或 Edge、开启硬件加速，并通过本地文件、localhost 或 HTTPS 打开。未启动 WebGL 回退展示。');
    }
    renderer.onDeviceLost = info => {
      this.lost = true;
      this.error = info.message || info.reason || 'GPU device lost';
      document.body.classList.add('ctx-lost');
    };
  }
};
globalThis.NZPost = {
  create(renderer, scene, camera) {
    const scenePass = pass(scene, camera);
    const base = scenePass.getTextureNode('output');
    const occlusion = ao(scenePass.getTextureNode('depth'), null, camera);
    occlusion.radius.value = 2;
    occlusion.resolutionScale = .5;
    const aoWeight = uniform(.55), bloomWeight = uniform(0), vignette = uniform(.025);
    const bloomPass = bloom(base, 1, .4, 1.1);
    const pipeline = new T.RenderPipeline(renderer);
    let shade = mix(float(1), occlusion.getTextureNode().r, aoWeight);
    let lighting = base.rgb;
    let gi;
    if (new URLSearchParams(location.search).has('ssgi')) {
      gi = ssgi(base, scenePass.getTextureNode('depth'), null, camera);
      gi.useTemporalFiltering = false;
      gi.sliceCount.value = 3;
      gi.stepCount.value = 8;
      gi.radius.value = 8;
      gi.giIntensity.value = 2;
      const indirect = denoise(gi.getGINode(), scenePass.getTextureNode('depth'), null, camera);
      const ambient = denoise(gi.getAONode(), scenePass.getTextureNode('depth'), null, camera);
      shade = mix(float(1), ambient.r, aoWeight);
      lighting = lighting.add(indirect.rgb);
    }
    globalThis.NZ_GPU.effect = gi ? 'SSGI + denoise' : 'GTAO';
    const edge = float(1).sub(uv().sub(.5).length().mul(vignette));
    pipeline.outputNode = vec4(lighting.mul(shade).add(bloomPass.rgb.mul(bloomWeight)).mul(edge), base.a);
    const post = {
      enabled: false, ao: true, bloom: false,
      setEnabled(value) { this.enabled = value; },
      setParams(p) {
        if (p.ao !== undefined) this.ao = p.ao;
        aoWeight.value = this.ao ? Math.min(.75, (p.aoGain || 1.8) * .30) : 0;
        if (p.strength !== undefined) { bloomWeight.value = p.strength; this.bloom = p.strength > 0; }
        if (p.threshold !== undefined) bloomPass.threshold.value = p.threshold;
        if (p.vignette !== undefined) vignette.value = p.vignette;
      },
      size() {},
      contextRestored() { pipeline.needsUpdate = true; },
      renderWithBloom() { pipeline.render(); },
      dispose() { pipeline.dispose(); scenePass.dispose(); occlusion.dispose(); bloomPass.dispose(); gi?.dispose(); }
    };
    return post;
  }
};
