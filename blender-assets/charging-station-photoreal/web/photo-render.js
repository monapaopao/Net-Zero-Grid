'use strict';

window.NZ_RENDER_POLISH = (function (base) {
  const pack = window.NZ_PHOTO_PACK;
  delete window.NZ_PHOTO_PACK;
  let api;
  let reflection;
  let reflectionError;
  let mapsReady = false;
  let rebuild = false;
  let isNight = false;
  const lights = [];
  const emissive = new Set();

  function environment() {
    const T = api.THREE;
    const bytes = Uint8Array.from(atob(pack.hdr), char => char.charCodeAt(0));
    const data = new T.HDRLoader().parse(bytes.buffer);
    const texture = new T.DataTexture(data.data, data.width, data.height, T.RGBAFormat, data.type);
    Object.assign(texture, { colorSpace: data.colorSpace, minFilter: data.minFilter, magFilter: data.magFilter,
      generateMipmaps: false, flipY: true, mapping: T.EquirectangularReflectionMapping, needsUpdate: true });
    const pmrem = new T.PMREMGenerator(api.renderer);
    try {
      const next = pmrem.fromEquirectangular(texture);
      api.scene.environment = next.texture;
      reflection?.dispose();
      reflection = next;
      reflectionError = null;
    } catch (error) {
      reflectionError = error.message;
    } finally {
      texture.dispose();
      pmrem.dispose();
    }
  }

  function setup(context) {
    api = context;
    base.setup(context);
    environment();
    const T = api.THREE;
    const loader = new T.TextureLoader();
    const load = data => new Promise((resolve, reject) => loader.load('data:image/png;base64,' + data, resolve, undefined, reject));
    Promise.all([load(pack.indirect), load(pack.ao)]).then(([indirect, ao]) => {
      for (const texture of [indirect, ao]) {
        texture.flipY = false;
        texture.colorSpace = T.NoColorSpace;
        texture.channel = 1;
      }
      for (const material of window.NZ_PHOTO_ASSETS.floorMaterials) {
        material.lightMap = indirect;
        material.lightMapIntensity = isNight ? 0 : pack.irradianceScale;
        material.aoMap = ao;
        material.aoMapIntensity = .35;
        material.needsUpdate = true;
      }
      mapsReady = true;
    }).catch(error => { reflectionError = error.message; console.error('[Photoreal lightmaps]', error); });
    for (const x of [50, 64, 78]) {
      for (const z of [88, 108]) {
        const light = new T.PointLight('#e3edfc', 32, 19, 2);
        light.name = 'Station canopy fixture ' + x + '/' + z;
        light.position.set(x, 4.8, z);
        light.visible = false;
        api.scene.add(light);
        lights.push(light);
      }
    }
    api.scene.traverse(mesh => {
      if (!mesh.isMesh || !mesh.material?.name) return;
      if (/LED diffuser|Equipment display lettering/.test(mesh.material.name)) emissive.add(mesh.material);
    });
    api.renderer.domElement.addEventListener('webglcontextrestored', () => { rebuild = true; });
    window.NZ_PERF.setup(context);
  }

  function frame(light, camera, target, sun, hemi, ambient, rim, state, post) {
    base.frame(light, camera, target, sun, hemi, ambient, rim, state, post);
    if (rebuild && !api.renderer.getContext().isContextLost()) {
      rebuild = false;
      environment();
    }
    isNight = light.preset === 'night' || (light.preset === 'follow' && light.night);
    const { scene, renderer, THREE: T } = api;
    const direct = new T.Vector3(pack.sun[0], pack.sun[2], -pack.sun[1]);
    sun.position.copy(sun.target.position).addScaledVector(direct, 450);
    sun.intensity = isNight ? .055 : 2.4;
    sun.color.set(isNight ? '#9cb7de' : '#fff4df');
    hemi.intensity = isNight ? .045 : .30;
    hemi.color.set('#d6e5f5');
    hemi.groundColor.set('#726d5d');
    ambient.intensity = isNight ? .015 : .06;
    rim.intensity = isNight ? .02 : .08;
    scene.environmentIntensity = isNight ? .11 : .75;
    scene.background.set(isNight ? '#1c2734' : '#bdcbd4');
    scene.fog.color.copy(scene.background);
    scene.fog.near = 950;
    scene.fog.far = 2300;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isNight ? 1.35 : 1.10;
    if (typeof groundMat !== 'undefined') groundMat.color.set(isNight ? '#3b4249' : '#969c98');
    const near = camera.position.distanceTo(new T.Vector3(64, 2, 98)) < 180;
    const extent = near ? 58 : 390;
    if (sun.shadow.camera.right !== extent) {
      Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent });
      sun.shadow.camera.updateProjectionMatrix();
    }
    sun.shadow.normalBias = near ? .04 : .15;
    sun.shadow.bias = -.00015;
    for (const material of window.NZ_PHOTO_ASSETS.floorMaterials) material.lightMapIntensity = isNight ? 0 : pack.irradianceScale;
    for (const fixture of lights) fixture.visible = isNight && state.quality !== 'compat';
    for (const material of emissive) material.emissiveIntensity = isNight ? 2.5 : .35;
    post?.setParams({ aoGain: near ? 1.35 : 1.8, strength: isNight ? .12 : 0 });
  }

  return { setup, frame, vehicleMaterial: base.vehicleMaterial, factoryMaterial: base.factoryMaterial,
    status: () => ({ ...base.status(), reflection: !!reflection, reflectionError,
      outdoorHDR: !!reflection, mapsReady, night: isNight, localLights: lights.filter(light => light.visible).length }) };
})(window.NZ_RENDER_POLISH);
