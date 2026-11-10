'use strict';

window.NZ_PHOTO_ASSETS = (function () {
  let api;
  let active = true;
  let vehicles;
  let plants;
  let plate;
  const prototypes = new Map();
  const nativeInstances = [];
  const floorMaterials = new Set();
  const rebuilt = [];

  function begin(context) {
    api = context;
    plants = new api.THREE.Group();
    plants.name = 'Photoreal station planting';
    plants.position.set(64, 0, 98);
  }

  function collect(mesh) {
    const type = mesh.name.split('__')[0];
    if (type !== 'landscape' && !type.startsWith('vehicle-')) return false;
    mesh.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (type === 'landscape') {
      plants.add(mesh);
      return true;
    }
    if (!prototypes.has(type)) prototypes.set(type, new api.THREE.Group());
    prototypes.get(type).add(mesh);
    return true;
  }

  function setActive(value) {
    active = value;
    if (plants) plants.visible = value;
    if (vehicles) vehicles.visible = value;
    const zero = api ? new api.THREE.Matrix4().makeScale(0, 0, 0) : null;
    for (const { mesh, index, matrix } of nativeInstances) {
      mesh.setMatrixAt(index, value ? zero : matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (plate) {
      plate.mesh.geometry.setIndex(value ? plate.filtered : plate.index);
      plate.mesh.userData.vehicleRanges = value ? plate.ranges : plate.originalRanges;
    }
  }

  function registration(vehicle) {
    const T = api.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = vehicle.kind === 'ice' ? '#204e8b' : '#8bc28a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = vehicle.kind === 'ice' ? '#fff' : '#152f21';
    ctx.font = 'bold 38px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(vehicle.plate, 128, 46, 238);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const material = new T.MeshStandardMaterial({ map: texture, roughness: .7 });
    const length = { model3: 4.72, yu7: 5, li: 5.22, ice: 4.7, bus: 11.8 }[vehicle.kind];
    const group = new T.Group();
    for (const side of [-1, 1]) {
      const mesh = new T.Mesh(new T.PlaneGeometry(.48, .12), material);
      mesh.position.set(0, vehicle.kind === 'bus' ? .68 : .51, side * (length / 2 + .025));
      mesh.rotation.y = side === 1 ? 0 : Math.PI;
      group.add(mesh);
    }
    return group;
  }

  function afterBoot() {
    const T = api.THREE;
    vehicles = new T.Group();
    vehicles.name = 'Photoreal charging and parking fleet';
    const fleet = window.NZ_VEHICLES.audit().vehicles.filter(vehicle =>
      ['charging', 'parking'].includes(vehicle.zone) && prototypes.has('vehicle-' + vehicle.kind));
    const ids = new Set(fleet.map(vehicle => vehicle.id));
    const palette = ['#e5e5df', '#aab1b7', '#303942', '#315364', '#4d6255'];
    fleet.forEach((vehicle, index) => {
      const model = prototypes.get('vehicle-' + vehicle.kind).clone(true);
      model.position.fromArray(vehicle.p);
      model.rotation.y = vehicle.heading;
      model.userData.vehicleId = vehicle.id;
      model.name = 'Photoreal ' + vehicle.id;
      let paint;
      model.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.castShadow = mesh.receiveShadow = true;
        if (mesh.material.name.includes('Vehicle paint')) {
          if (!paint) {
            paint = mesh.material.clone();
            paint.color.set(palette[index % palette.length]);
          }
          mesh.material = paint;
        }
      });
      model.add(registration(vehicle));
      vehicles.add(model);
      rebuilt.push({ id: vehicle.id, kind: vehicle.kind, p: vehicle.p, port: vehicle.port });
    });
    api.scene.traverse(mesh => {
      if (!mesh.isInstancedMesh) return;
      const matrix = new T.Matrix4();
      if (mesh.userData.vehicleIds) {
        mesh.userData.vehicleIds.forEach((id, index) => {
          if (!ids.has(id)) return;
          mesh.getMatrixAt(index, matrix);
          nativeInstances.push({ mesh, index, matrix: matrix.clone() });
        });
      }
      if (!mesh.name.startsWith('Instanced environment ')) return;
      if (![0x897f69, 0x6e947d, 0x88a689, 0x5e8674].includes(mesh.material.color?.getHex())) return;
      const point = new T.Vector3();
      for (let index = 0; index < mesh.count; index++) {
        mesh.getMatrixAt(index, matrix);
        point.setFromMatrixPosition(matrix);
        if ([[81, 106], [81, 117], [81, 129], [41, 124]].some(([x, z]) => Math.hypot(point.x - x, point.z - z) < 2.3)) {
          nativeInstances.push({ mesh, index, matrix: matrix.clone() });
        }
      }
    });
    const originalPlates = api.scene.getObjectByName('Vehicle registration plates');
    if (originalPlates) {
      const geometry = originalPlates.geometry;
      const originalRanges = originalPlates.userData.vehicleRanges;
      const filtered = [];
      const ranges = [];
      for (const range of originalRanges) {
        if (ids.has(range.id)) continue;
        const start = filtered.length / 3;
        for (let i = range.start * 3; i < (range.start + range.count) * 3; i++) filtered.push(i);
        ranges.push({ id: range.id, start, count: range.count });
      }
      plate = { mesh: originalPlates, index: geometry.index, originalRanges, filtered, ranges };
    }
    api.scene.add(plants, vehicles);
    api.scene.traverse(mesh => {
      if (!mesh.isMesh || !mesh.material?.name?.includes('Site apron')) return;
      const geometry = mesh.geometry;
      if (!geometry.attributes.uv1) geometry.setAttribute('uv1', geometry.attributes.uv.clone());
      floorMaterials.add(mesh.material);
    });
    setActive(active);
  }

  return { begin, collect, afterBoot, setActive, floorMaterials,
    audit: () => ({ vehicles: rebuilt, prototypes: [...prototypes.keys()], nativeInstances: nativeInstances.length,
      floorMaterials: floorMaterials.size, active }) };
})();
