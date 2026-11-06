'use strict';

window.NZ_STATION_ASSET = (function () {
  const state = { ready: false, active: 'original', error: null, mounts: {} };
  const swaps = [];
  const indicators = [];
  let api;
  let bar;
  let staging;

  function setModel(model) {
    if (!state.ready) return false;
    const upgraded = model === 'blender';
    for (const swap of swaps) {
      swap.group.visible = upgraded;
      for (const [object, visible] of swap.old) object.visible = !upgraded && visible;
    }
    for (const { light, y, scale } of indicators) {
      light.position.y = upgraded ? 1.61 : y;
      light.scale.copy(scale);
      if (upgraded) light.scale.multiplyScalar(.55);
    }
    state.active = upgraded ? 'blender' : 'original';
    if (bar) {
      bar.querySelector('[role="status"]').textContent = upgraded ? '当前写实外观' : '当前 r187 原外观';
      for (const button of bar.querySelectorAll('[data-model]')) {
        button.setAttribute('aria-pressed', String(button.dataset.model === state.active));
      }
    }
    return true;
  }

  function register(group, parent, originals) {
    const old = [];
    for (const original of originals) {
      original.traverse(node => {
        if (node.isMesh) old.push([node, node.visible]);
      });
    }
    swaps.push({ group, old });
    parent.attach(group);
  }

  function install(scene, plan) {
    const { THREE: T } = api;
    const currentPlan = window.NZ_MULTI_PLAN.charging;
    if (JSON.stringify(plan) !== JSON.stringify(currentPlan)) throw new Error('v20 charging layout differs from the GLB plan.');
    const models = window.NZ_DETAIL.models;
    const station = models.supercharge.root;
    const mounts = new Map();
    const mappings = [{ id: 'station', parent: station.parent, originals: [station] }];
    for (const supply of plan.dcSupplies) {
      const item = models[supply.key];
      const cover = item.conversion.getObjectByName('Cabinet cover');
      const door = item.conversion.getObjectByName('Front door');
      if (!cover || !door || !item.outputProtection ||
          !item.root.getWorldPosition(new T.Vector3()).equals(new T.Vector3(supply.x, 0, supply.z))) {
        throw new Error('Invalid DC branch mount: ' + supply.key);
      }
      mappings.push(
        { id: supply.key + '_shell', parent: cover, originals: [...cover.children] },
        { id: supply.key + '_door', parent: door, originals: [...door.children] },
        { id: supply.key + '_interior', parent: item.conversion, originals: item.conversion.children.filter(c => c !== cover && c !== door) },
        { id: supply.key + '_protection', parent: item.outputProtection, originals: [...item.outputProtection.children] }
      );
    }
    for (const mapping of mappings) {
      const group = new T.Group();
      group.name = 'Blender station · ' + mapping.id;
      group.userData.stationMount = mapping.id;
      group.userData.deviceKey = mapping.id === 'station' ? 'supercharge' : mapping.id.split('_')[0];
      mounts.set(mapping.id, group);
    }
    const meshes = [];
    scene.traverse(node => { if (node.isMesh) meshes.push(node); });
    scene.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const mount = mounts.get(mesh.name.split('__')[0]);
      if (!mount) throw new Error('Unknown GLB mount: ' + mesh.name);
      mesh.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mount.add(mesh);
      const skylight = mesh.material.name.includes('skylight');
      const cells = mesh.material.name.includes('Photovoltaic cells');
      mesh.castShadow = !skylight && !cells;
      mesh.receiveShadow = !skylight && !cells;
      if (skylight) mesh.material.depthWrite = false;
      for (const map of [mesh.material.map, mesh.material.roughnessMap, mesh.material.normalMap]) {
        if (map) map.anisotropy = Math.min(8, api.renderer.capabilities.getMaxAnisotropy());
      }
    }
    for (const [name, group] of mounts) {
      if (group.children.length === 0) throw new Error('Empty mount: ' + name);
      state.mounts[name] = group.children.length;
    }
    staging = new T.Group();
    staging.position.set(plan.canopy.x, 0, plan.canopy.z);
    for (const group of mounts.values()) staging.add(group);
    api.scene.add(staging);
    api.scene.updateMatrixWorld(true);
    const size = new T.Box3().setFromObject(mounts.get('station')).getSize(new T.Vector3());
    if (Math.abs(size.x - 40) > .05 || Math.abs(size.z - 34.62) > .05) throw new Error('Unexpected station footprint.');
    for (const mapping of mappings) register(mounts.get(mapping.id), mapping.parent, mapping.originals);
    staging.removeFromParent();
    state.ready = true;
    state.size = size.toArray();
    setModel('blender');
  }

  async function prepare(context) {
    api = context;
    const { plan, glb } = window.STATION_PACK;
    delete window.STATION_PACK;
    let timer;
    try {
      const compressed = Uint8Array.from(atob(glb), char => char.charCodeAt(0));
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      const bytes = await new Response(stream).arrayBuffer();
      const loaded = await Promise.race([
        new api.THREE.GLTFLoader().parseAsync(bytes, ''),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('GLB load timeout')), 10000); })
      ]);
      install(loaded.scene, plan);
    } catch (error) {
      state.error = error.message;
      state.ready = false;
      state.active = 'original';
      for (const swap of swaps) {
        swap.group.removeFromParent();
        for (const [node, visible] of swap.old) node.visible = visible;
      }
      staging?.removeFromParent();
      console.error('[Blender station]', error);
    } finally {
      clearTimeout(timer);
    }
  }

  function focus(view) {
    const views = {
      station: { pos: [110, 28, 145], tgt: [55, 2, 99] },
      terminal: { pos: [69, 3.5, 94], tgt: [65.5, 1.2, 84.7] },
      power: { pos: [43, 7, 102], tgt: [37.6, 1.65, 85] },
      south: { pos: [43, 7, 126], tgt: [36.7, 1.65, 109] }
    };
    const pose = views[view];
    api.cancelCamera();
    api.controls.autoRotate = false;
    api.camera.position.fromArray(pose.pos);
    api.controls.target.fromArray(pose.tgt);
    api.controls.update();
  }

  function showControls() {
    // The existing connection lamps sit inside the original screens. Move
    // them below the new bay labels while keeping their live materials.
    api.scene.traverse(node => {
      if (node.name.startsWith('Terminal connection indicator ')) {
        indicators.push({ light: node, y: node.position.y, scale: node.scale.clone() });
      }
    });
    bar = document.createElement('div');
    bar.id = 'station-preview';
    bar.style.cssText = 'position:fixed;z-index:999;top:84px;right:18px;max-width:calc(100vw - 36px);padding:9px 12px;background:#f9fcfbee;border:1px solid #b9ceca;border-radius:7px;color:#243f40;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font:13px "Microsoft YaHei",sans-serif';
    bar.innerHTML = '<strong>充电站外观</strong><button type="button" data-model="original">r187 原版</button><button type="button" data-model="blender">写实全站</button><button type="button" data-view="station">全站</button><button type="button" data-view="terminal">终端</button><button type="button" data-view="power">北排电源</button><button type="button" data-view="south">南排电源</button><span role="status"></span>';
    document.body.appendChild(bar);
    bar.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.model) setModel(button.dataset.model);
      if (button.dataset.view) focus(button.dataset.view);
    });
    if (state.ready) setModel('blender');
    else {
      bar.querySelector('[data-model="blender"]').disabled = true;
      bar.querySelector('[role="status"]').textContent = '写实资产加载失败，已恢复 r187 原外观';
    }
    focus('station');
  }

  return { prepare, showControls, state, setModel, focus };
})();
