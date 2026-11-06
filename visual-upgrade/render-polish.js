'use strict';

window.NZ_RENDER_POLISH = (function () {
  let api;
  let reflection;
  let reflectionError;
  let region = 'campus';
  let closeStrength = 0;
  let rebuild = false;
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (value, from, to) => {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };

  function vehicleMaterial(T, key, color) {
    if (key === 'paint') {
      return new T.MeshPhysicalMaterial({ color, roughness: .30, metalness: .12, clearcoat: .46, clearcoatRoughness: .24 });
    }
    if (key === 'glass') {
      return new T.MeshPhysicalMaterial({ color, roughness: .21, metalness: .13, clearcoat: .29, clearcoatRoughness: .18 });
    }
    return new T.MeshStandardMaterial({ color, roughness: key === 'alloy' ? .43 : .68,
      metalness: key === 'alloy' ? .48 : key === 'trim' ? .27 : .04 });
  }

  function factoryMaterial(T, name, options) {
    if (name === 'floor') {
      return new T.MeshPhysicalMaterial({ ...options, color: 0x8faaa5, roughness: .88, metalness: 0, diffuseRoughness: .42 });
    }
    if (['steel', 'alloy', 'wire', 'copper'].includes(name)) {
      return new T.MeshStandardMaterial({ ...options, roughness: name === 'steel' ? .52 : .34,
        metalness: name === 'wire' || name === 'copper' ? .51 : .34 });
    }
    return new T.MeshStandardMaterial(options);
  }

  function bakeReflection() {
    const { THREE: T, renderer, scene } = api;
    const studio = new T.Scene();
    studio.background = new T.Color('#8eabbc');
    const panels = [
      { p: [-10, 13, 8], size: [13, 8], color: '#fff1d9', power: 2.8 },
      { p: [11, 7, -8], size: [15, 6], color: '#d4eeff', power: 1.8 },
      { p: [0, -11, 0], size: [32, 32], color: '#9daea3', power: .72 }
    ];
    for (const panel of panels) {
      const material = new T.MeshBasicMaterial({ color: new T.Color(panel.color).multiplyScalar(panel.power),
        toneMapped: false, side: T.DoubleSide });
      const mesh = new T.Mesh(new T.PlaneGeometry(...panel.size), material);
      mesh.position.fromArray(panel.p);
      mesh.lookAt(0, 0, 0);
      studio.add(mesh);
    }
    const generator = new T.PMREMGenerator(renderer);
    try {
      const next = generator.fromScene(studio, .045, .1, 60, { size: 128 });
      scene.environment = next.texture;
      reflection?.dispose();
      reflection = next;
      reflectionError = null;
    } catch (error) {
      reflectionError = error.message;
      scene.environment = null;
    } finally {
      generator.dispose();
      for (const mesh of studio.children) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  }

  function setup(context) {
    api = context;
    bakeReflection();
    api.renderer.domElement.addEventListener('webglcontextrestored', () => { rebuild = true; });
  }

  function frame(light, camera, target, sun, hemi, ambient, rim, state, post) {
    if (rebuild && !api.renderer.getContext().isContextLost()) {
      rebuild = false;
      bakeReflection();
    }
    const night = light.preset === 'night' || (light.preset === 'follow' && light.night);
    const distance = camera.position.distanceTo(target);
    const charge = (1 - ease(Math.hypot(target.x - 64, target.z - 98), 24, 63)) * (1 - ease(distance, 52, 150));
    const factory = (1 - ease(Math.hypot(target.x - 280, target.z - 18), 58, 110)) * (1 - ease(distance, 65, 180));
    closeStrength = Math.max(charge, factory);
    region = charge > .5 ? 'charge' : factory > .5 ? 'factory' : 'campus';
    const { scene, renderer } = api;
    scene.background.set(night ? '#c5d7dc' : '#e7eff2');
    scene.fog.color.copy(scene.background);
    scene.fog.near = mix(650, 780, closeStrength);
    scene.fog.far = mix(1950, 1650, closeStrength);
    scene.environmentIntensity = state.quality === 'compat' ? .16 : night ? .22 : .29 + charge * .34 + factory * .10;
    renderer.toneMappingExposure = night ? .90 : .93;
    sun.color.set(night ? '#bdd9e8' : '#fff1db');
    hemi.color.set('#dfedf4');
    hemi.groundColor.set('#aabfb4');
    ambient.intensity *= .72;
    hemi.intensity *= .78;
    sun.intensity *= night ? 1 : 1.18;
    rim.intensity *= 1 + charge * .40;
    const extent = mix(Math.max(192, Math.min(440, distance * .42)), 67, closeStrength);
    const shadowCamera = sun.shadow.camera;
    if (Math.abs(shadowCamera.right - extent) > 1) {
      Object.assign(shadowCamera, { left: -extent, right: extent, top: extent, bottom: -extent });
      shadowCamera.updateProjectionMatrix();
    }
    sun.shadow.normalBias = mix(.30, .10, closeStrength);
    post?.setParams({ aoGain: 1.8 + factory * .64 + charge * .28 });
  }

  return { setup, frame, vehicleMaterial, factoryMaterial,
    status: () => ({ region, closeStrength, reflection: !!api?.scene.environment, reflectionError }) };
})();
