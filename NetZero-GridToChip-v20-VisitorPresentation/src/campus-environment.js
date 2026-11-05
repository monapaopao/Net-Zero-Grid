/* Presentation geometry only. Coordinates follow the v6 campus layout. */
'use strict';
window.NZ_ENVIRONMENT = (function () {
  const basic = new THREE.Group(), high = new THREE.Group(), coarse = new THREE.Group();
  basic.name = 'Campus environment standard'; high.name = 'Campus environment refined';
  coarse.name = 'Campus road surfaces'; scene.add(coarse, basic, high);
  const buckets = new Map(), materials = new Map(), extraGroups = [], lights = [];
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    crown: new THREE.IcosahedronGeometry(1, 2),
    pool: new THREE.CircleGeometry(1, 24)
  };
  const C = { asphalt: 0x8eaaa9, kerb: 0xd9e2df, paving: 0xc5d1ce, grass: 0x93ac88,
    bark: 0x897f69, leaf: 0x6e947d, leaf2: 0x88a689, leaf3: 0x5e8674,
    white: 0xf1f0da, yellow: 0xd4b775, steel: 0x718c88, dark: 0x355958, blue: 0x517e88 };
  let quality = 'standard', nightOn = false;
  const stats = { trees: 0, shrubs: 0, roadLamps: 0, canopyLamps: 0, parkingSpaces: 0,benches:0 };
  const planted = [], streets = [], fixtures = [], coverage = {}, lightCandidates = [];
  // Building/yard footprints, including aprons and the warehouse vehicle envelope.
  // Ground cable ducts are added below so new plants cannot occupy maintenance routes.
  const protectedAreas = window.NZ_ENVIRONMENT_PLAN.protectedAreas.map(p=>({...p}));
  for (const duct of window.NZ_INFRA.audit().ducts) {
    if (duct.key === 'Gas generator output') continue; // coordinates local to its protected site
    for(let i=1;i<duct.pts.length;i++) {
      const a=duct.pts[i-1], b=duct.pts[i], r=duct.width/2+.35;
      protectedAreas.push({key:duct.key,x0:Math.min(a[0],b[0])-r,x1:Math.max(a[0],b[0])+r,z0:Math.min(a[2],b[2])-r,z1:Math.max(a[2],b[2])+r});
    }
  }
  for(const route of window.NZ_MULTI.connections())for(let i=1;i<route.pts.length;i++){
    const a=route.pts[i-1],b=route.pts[i],r=.65;
    protectedAreas.push({key:'v9 utility '+route.key,x0:Math.min(a[0],b[0])-r,x1:Math.max(a[0],b[0])+r,z0:Math.min(a[2],b[2])-r,z1:Math.max(a[2],b[2])+r});
  }
  function overlaps(a,b,margin=0){return a.x0<b.x1+margin&&a.x1>b.x0-margin&&a.z0<b.z1+margin&&a.z1>b.z0-margin;}
  function clear(x,z,r=1,roadMargin=.35){
    const b={x0:x-r,x1:x+r,z0:z-r,z1:z+r};
    if(!Object.values(window.NZ_MULTI_PLAN.sites).some(site=>window.NZ_MULTI_PLAN.contains(site,x,z,r))&&!window.NZ_MULTI_PLAN.roads.some(([zone,,rx,rz,w,d])=>zone==='regional'&&x>=rx-6&&x<=rx+w+6&&z>=rz-6&&z<=rz+d+6))return false;
    return !protectedAreas.some(p=>overlaps(b,p,.25))&&!streets.some(p=>overlaps(b,p,roadMargin));
  }
  function count(zone,kind){if(!coverage[zone])coverage[zone]={roads:0,trees:0,shrubs:0,lamps:0};coverage[zone][kind]++;}
  const poolCanvas = document.createElement('canvas'); poolCanvas.width = poolCanvas.height = 128;
  const poolContext = poolCanvas.getContext('2d');
  const gradient = poolContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.9)'); gradient.addColorStop(.4, 'rgba(255,255,255,.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)'); poolContext.fillStyle = gradient; poolContext.fillRect(0, 0, 128, 128);
  const poolTexture = new THREE.CanvasTexture(poolCanvas);
  function mat(color, kind) {
    const key = color + ':' + (kind || 'solid');
    if (!materials.has(key)) {
      const m = kind === 'pool'
        ? new THREE.MeshBasicMaterial({ color, map: poolTexture, transparent: true, opacity: 0, depthWrite: false })
        : new THREE.MeshStandardMaterial({ color, roughness: kind === 'metal' ? .42 : .86,
          metalness: kind === 'metal' ? .4 : .03,
          emissive: kind === 'lamp' ? color : 0, emissiveIntensity: 0 });
      materials.set(key, m);
    }
    return materials.get(key);
  }
  function instance(type, size, color, pos, parent = high, rotation = [0, 0, 0], kind) {
    let map = buckets.get(parent); if (!map) buckets.set(parent, map = new Map());
    const key = type + ':' + color + ':' + (kind || 'solid');
    if (!map.has(key)) map.set(key, { geometry: geometry[type], material: mat(color, kind), matrices: [], kind, type });
    const o = new THREE.Object3D(); o.position.set(...pos); o.rotation.set(...rotation); o.scale.set(...size); o.updateMatrix();
    map.get(key).matrices.push(o.matrix.clone());
  }
  function box(w, h, d, c, x, y, z, parent = high, kind) { instance('box', [w, h, d], c, [x, y, z], parent, [0, 0, 0], kind); }
  function rod(a, b, r, c, parent = high) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()));
    instance('cylinder', [r, delta.length(), r], c, av.add(bv).multiplyScalar(.5).toArray(), parent, rotation.toArray().slice(0, 3), 'metal');
  }
  function flush() {
    for (const [parent, map] of buckets) for (const b of map.values()) {
      const mesh = new THREE.InstancedMesh(b.geometry, b.material, b.matrices.length);
      b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = b.kind !== 'pool' && b.kind !== 'lamp'; mesh.receiveShadow = b.kind !== 'pool';
      mesh.name = 'Instanced environment ' + b.type; parent.add(mesh);
    }
    buckets.clear();
  }
  // Every road shares one design system. North uses a narrow service lane between
  // the high-voltage support corridor and the AIS yard, rather than crossing either.
  const network = window.NZ_ENVIRONMENT_PLAN.roads;
  network.forEach(([zone,name,x,z,w,d,y=.058])=>{const s={zone,name,x0:x,x1:x+w,z0:z,z1:z+d,y,horizontal:w>d};streets.push(s);count(zone,'roads');box(w,.045,d,C.asphalt,x+w/2,y,z+d/2,coarse);});
  for (const x of [107, 116, 125, 134, 143, 152, 161, 170, 179, 188, 197]) {
    box(4.2, .018, .15, C.white, x, .09, 140);
  }
  for (let z = 64; z < 134; z += 8) box(.15, .018, 3.8, C.white, 207, .09, z);
  for (const z of [137.15, 142.85]) box(100, .018, .10, C.white, 155, .09, z);
  for (const x of [121, 170, 189]) {
    box(2.6, .02, .2, C.white, x, .09, 142);
    for (const angle of [-Math.PI / 4, Math.PI / 4]) instance('box', [.95, .02, .18], C.white, [x + .9, .09, 142 + (angle > 0 ? -.28 : .28)], high, [0, angle, 0]);
  }
  for (let x = 105; x <= 202; x += 2) box(.03, .018, 1.85, C.steel, x, .156, 145.35);
  // Trees are placed in perimeter beds, away from vehicle lanes and electrical yards.
  function tree(x, z, s, n, zone='logistics', y=0) {
    if(!clear(x,z,2.1*s,.6))return false;
    if(planted.some(p=>p.kind==='tree'&&Math.hypot(p.x-x,p.z-z)<(p.r+2.1*s)*.9))return false;
    const foliage = [C.leaf, C.leaf2, C.leaf3][n % 3];
    instance('cylinder', [.15 * s, 3.9 * s, .15 * s], C.bark, [x, y+1.95 * s, z]);
    rod([x, y+2.7 * s, z], [x - .75 * s, y+4 * s, z + .35 * s], .075 * s, C.bark);
    rod([x, y+2.9 * s, z], [x + .7 * s, y+4.4 * s, z - .2 * s], .075 * s, C.bark);
    for (const [dx, dy, dz, r] of [[0, 4.7, 0, 1.5], [-.9, 4.1, .25, 1.2], [.8, 4.45, -.25, 1.15], [0, 5.45, .2, .95]])
      instance('crown', [r * s, r * s * .85, r * s], foliage, [x + dx * s, y+dy * s, z + dz * s], high, [0, n * .7, 0]);
    box(2, .09, 2, C.paving, x, y+.075, z); stats.trees++;count(zone,'trees');planted.push({kind:'tree',x,z,r:2.1*s,zone});return true;
  }
  let n = 0;
  for (let x = 112; x <= 200; x += 11) tree(x, 148, .77 + (n % 4) * .045, n++);
  for (const z of [106, 117, 129, 140]) tree(81, z, .86 + (n % 3) * .055, n++);
  for (const x of [78, 112, 127, 144, 159, 174, 189, 202]) tree(x, -28, .74 + (n % 4) * .06, n++, 'north');
  for (let x = 110; x < 205; x += 2.7) {
    shrub(x,148.5,'logistics');
  }
  for (let z = 105; z < 143; z += 2.2) {
    shrub(79.8,z,'entrance');
  }
  function shrub(x,z,zone,y=0){
    if(!clear(x,z,.7,.25))return false;
    instance('crown',[.65,.45,.6],(stats.shrubs%3)?C.leaf2:C.leaf,[x,y+.5,z]);
    stats.shrubs++;count(zone,'shrubs');planted.push({kind:'shrub',x,z,r:.7,zone});return true;
  }
  stats.parkingSpaces = 24; // v10 parking geometry is built by NZ_MULTI.
  // Loading bays, drainage and protective bollards; the truck remains unobstructed.
  for (const x of [122, 136, 150]) {
    for (const dx of [-4, 4]) box(.12, .02, 7.7, C.yellow, x + dx, .075, 129.5);
    box(8, .02, .12, C.yellow, x, .075, 133.35);
    for (const dx of [-5.5, 5.5]) {
      instance('cylinder', [.12, .85, .12], C.yellow, [x + dx, .45, 123.1]);
      instance('cylinder', [.125, .18, .125], C.dark, [x + dx, .6, 123.1]);
    }
  }
  box(44, .025, .3, C.dark, 136, .045, 134.8);
  for (let x = 115; x < 158; x += .65) box(.05, .02, .34, C.steel, x, .065, 134.8);
  for (const z of [66, 98, 132]) {
    box(.9, .018, .6, C.dark, 209.2, .09, z);
    for (let i = 0; i < 5; i++) box(.05, .02, .62, C.steel, 208.85 + i * .16, .11, z);
  }
  // Street heads and canopy fluorescent fixtures share emissive materials and pools.
  function pool(x, z, sx, sz, y=0) {
    instance('pool', [sx, sz, 1], 0xe9d6a1, [x, y+.105, z], high, [-Math.PI / 2, 0, 0], 'pool');
  }
  function lamp(x, z, toward, axis='z', zone='logistics', y=0) {
    if(!clear(x,z,.28,0))return;
    const dx=axis==='x'?toward:0,dz=axis==='z'?toward:0;
    box(.5, .15, .5, C.paving, x, y+.12, z, basic);
    rod([x,y+.15,z],[x,y+6.1,z],.075,C.steel,basic);
    rod([x,y+6.1,z],[x+dx*1.5,y+6.1,z+dz*1.5],.07,C.steel,basic);
    box(axis==='x'?1:.48,.15,axis==='x'?.48:1,C.steel,x+dx*1.3,y+6.05,z+dz*1.3,basic,'metal');
    box(axis==='x'?.8:.36,.035,axis==='x'?.36:.8,0xffedc9,x+dx*1.3,y+5.95,z+dz*1.3,high,'lamp');
    pool(x+dx*2.8,z+dz*2.8,3.2,4.2,y); stats.roadLamps++;count(zone,'lamps');
    fixtures.push({x,z,zone});lightCandidates.push({x:x+dx*1.3,y:y+5.95,z:z+dz*1.3,tx:x+dx*2.8,tz:z+dz*2.8,zone});
  }
  for (const x of [108, 130, 153, 176, 199]) lamp(x, 145.8, -1);
  for (const z of [110, 140]) lamp(87.7, z, 1);
  // Roadside details follow every segment and stop at junctions and protected yards.
  for(const s of streets){
    const from=s.horizontal?s.x0:s.z0,to=s.horizontal?s.x1:s.z1;
    const center=s.horizontal?(s.z0+s.z1)/2:(s.x0+s.x1)/2;
    const width=s.horizontal?s.z1-s.z0:s.x1-s.x0;
    const y=s.y>.1?.4:0;
    const at=(t,d)=>s.horizontal?[t,center+d]:[center+d,t];
    for(let t=from+1;t<to-.5;t+=2){
      for(const side of [-1,1]){
        const [x,z]=at(t,side*(width/2+.2));
        const kerb={x0:x-(s.horizontal?1:.15),x1:x+(s.horizontal?1:.15),z0:z-(s.horizontal?.15:1),z1:z+(s.horizontal?.15:1)};
        if(!protectedAreas.some(p=>overlaps(kerb,p))&&!streets.some(p=>p!==s&&overlaps(kerb,p,.2)))
          box(s.horizontal?1.9:.26,.18,s.horizontal?.26:1.9,C.kerb,x,y+.13,z,basic);
        const [wx,wz]=at(t,side*(width/2+1.25));
        if(clear(wx,wz,1,0)){
          box(s.horizontal?1.9:1.65,.10,s.horizontal?1.65:1.9,C.paving,wx,y+.08,wz,basic);
          box(s.horizontal?.025:1.65,.014,s.horizontal?1.65:.025,C.steel,wx,y+.14,wz);
        }
        const [gx,gz]=at(t,side*(width/2+3.4));
        if(clear(gx,gz,1,0))box(s.horizontal?1.9:1.65,.035,s.horizontal?1.65:1.9,C.grass,gx,y+.02,gz);
      }
    }
    for(let t=from+4;t<to-3;t+=8){
      const [x,z]=at(t,0);
      if(!streets.some(p=>p!==s&&overlaps({x0:x-.3,x1:x+.3,z0:z-.3,z1:z+.3},p)))
        box(s.horizontal?3:.12,.018,s.horizontal?.12:3,C.white,x,y+.09,z);
    }
    for(let t=from+5;t<to-2;t+=3.7)for(const side of [-1,1]){
      const [x,z]=at(t,side*(width/2+3.4));shrub(x,z,s.zone,y);
    }
    for(let t=from+8;t<to-3;t+=13)for(const side of [-1,1]){
      const [x,z]=at(t,side*(width/2+4.25));tree(x,z,.73+(n%4)*.05,n++,s.zone,y);
    }
    for(let t=from+9;t<to-3;t+=26){
      const side=s.zone==='west'?-1:1;
      const [x,z]=at(t,side*(width/2+.75));lamp(x,z,-side,s.horizontal?'z':'x',s.zone,y);
    }
  }
  // Interior gardens make the empty centre and forecourts read as used campus space.
  for(const [zone,cx,cz,w,d] of [['compute',132,33,25,11],['storage',30,46,31,6],['industrial',178,46,36,6],['nuclear',281,-378,29,5],['chemical',143,-251,50,8],['chemical',252,-148,44,6],['factory',284,59,35,5]]){
    const y=zone==='nuclear'?.4:0;
    for(let x=cx-w/2+1;x<cx+w/2;x+=2)for(let z=cz-d/2+1;z<cz+d/2;z+=2){
      if(clear(x,z,1,0))box(1.9,.035,1.9,C.grass,x,y+.02,z);
    }
    for(let x=cx-w/2+3;x<cx+w/2;x+=10)tree(x,cz,.87+(n%3)*.04,n++,zone,y);
    for(let x=cx-w/2+2;x<cx+w/2;x+=2.8)shrub(x,cz+d/2-.7,zone,y);
  }
  // Crossings at major pedestrian approaches; only lie on road surfaces.
  for(const [x,z,axis,w] of [[95,79,'z',10],[95,102,'z',10],[95,133.1,'z',10],[132,18.5,'x',5],[64,57,'x',6],[180,57,'x',6]]){
    for(let t=-1.5;t<=1.5;t+=1)box(axis==='x'?.6:w-.5,.02,axis==='x'?w-.5:.6,C.white,x+(axis==='x'?t:0),.095,z+(axis==='z'?t:0));
  }
  for (const x of [122, 136, 150]) {
    box(3.2, .12, .35, C.steel, x, 4.5, 124.3, high, 'metal');
    box(2.85, .04, .14, 0xffedc9, x, 4.42, 124.3, high, 'lamp');
    for (const dx of [-1.4, 1.4]) rod([x + dx, 4.55, 124.3], [x + dx, 4.85, 124.3], .025, C.steel);
    pool(x, 126.2, 3.4, 2.3); stats.canopyLamps++;
  }
  // Both charging rows share the existing night-light material and local-light pool.
  for(const {z}of window.NZ_MULTI_PLAN.charging.rows)for(const x of [52,64,76]){
    const roofY=window.NZ_MULTI_PLAN.charging.canopy.h;
    box(2,.10,.25,C.steel,x,roofY-.42,z,high,'metal');
    box(1.8,.025,.18,0xffedc9,x,roofY-.49,z,high,'lamp');
    for(const dx of [-.7,.7])rod([x+dx,roofY-.33,z],[x+dx,roofY-.37,z],.025,C.steel);
    pool(x,z+4,3.5,3,.15);stats.canopyLamps++;
    lightCandidates.push({x,y:window.NZ_MULTI_PLAN.charging.canopy.h-.50,z,tx:x,tz:z+4,zone:'public'});
  }
  // Four actual local lights supplement the display pools without extra shadow maps.
  for (const [x, y, z, tx, tz] of [[130, 5.95, 144.5, 130, 139], [176, 5.95, 144.5, 176, 139], [122, 4.42, 124.3, 122, 127], [150, 4.42, 124.3, 150, 127]]) {
    const l = new THREE.SpotLight(0xffe2b5, 0, 16, Math.PI / 3, .7, 1.3);
    l.position.set(x, y, z); l.target.position.set(tx, 0, tz); high.add(l, l.target); lights.push(l);
    lightCandidates.push({x,y,z,tx,tz,zone:'logistics'});
  }
  // Facade seams and roof accessories follow the enlarged warehouse dimensions.
  for (const x of [114.4, 157.6]) {
    box(.13, 7.2, 22.3, C.steel, x, 3.6, 111);
    box(.16, .16, 22.3, C.steel, x, 7.25, 111);
  }
  for (let x = 117; x <= 155; x += 3) box(.045, 1.3, .055, C.steel, x, 6.3, 122.16);
  for (const x of [120, 136, 152]) {
    box(2.4, .28, 2.2, C.steel, x, 7.45, 108);
    instance('cylinder', [.68, .14, .68], C.dark, [x, 7.65, 108]);
    for (let j = 0; j < 4; j++) instance('box', [1.15, .04, .12], C.steel, [x, 7.75, 108], high, [0, j * Math.PI / 4, 0]);
  }
  const truck = scene.getObjectByName('Scaled legacy logistics').children.find(o => o.isGroup && o.name === '');
  if (truck) {
    const detail = new THREE.Group(); detail.name = 'Refined logistics truck'; truck.add(detail); extraGroups.push(detail);
    box(.08, .8, 1.65, C.blue, 4.83, 2, 0, detail);
    for (const z of [-1.18, 1.18]) {
      box(1.35, .75, .04, C.blue, 3.9, 2, z, detail);
      rod([4.2, 2.1, z], [4.2, 2.1, z * 1.25], .035, C.steel, detail);
      box(.3, .35, .08, C.dark, 4.2, 2.05, z * 1.25, detail);
      for (const x of [3.8, 1.6, -3.2]) instance('cylinder', [.2, .04, .2], C.steel, [x, .42, z], detail, [Math.PI / 2, 0, 0], 'metal');
      for (let x = -4; x < 1.8; x += .4) box(.045, 2.45, .05, C.steel, x, 1.55, z * 1.075, detail);
    }
  }
  function sign(x, z, text, color) {
    if(!clear(x,z,.25,0))return;
    fixtures.push({x,z,r:.25,zone:'sign'});
    rod([x, .15, z], [x, 2.9, z], .045, C.steel);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192;
    const ctx = cv.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#e9f0e7'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 496, 176);
    ctx.fillStyle = '#f5f5e9'; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 96);
    const texture = new THREE.CanvasTexture(cv); texture.encoding = THREE.sRGBEncoding;
    const m = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: .7 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.12), m); mesh.position.set(x, 2.7, z); high.add(mesh);
  }
  sign(82, 137, 'P  访客停车', '#537f7a'); sign(104, 133, '物流装卸  →', '#537f7a'); sign(202, 133, '限速  15', '#537f7a');
  for(const [x,z,text] of [[114,50,'数据中心  ↑'],[285,-142,'氢氨储运  ↑'],[13,42,'储能检修  →'],[315,136,'制造区  ↑']])sign(x,z,text,'#537f7a');
  for (const z of [113, 124]) {
    if(!clear(85.1,z,1.6,.3))continue;
    for (const x of [83.8, 86.4]) box(.14, .5, 1.4, C.steel, x, .25, z);
    for (let x = 83.8; x <= 86.4; x += .35) box(.22, .09, 1.4, C.bark, x, .54, z);
    box(2.8, .65, .12, C.bark, 85.1, .94, z - .65);
    stats.benches++;fixtures.push({x:85.1,z,r:1.6,zone:'bench'});
  }
  for(const [x,z,y] of [[130,40,0],[30,42,0],[34,110,0],[179,42,0],[284,-380.5,.4]]){
    if(!clear(x,z,1.6,.3))continue;
    for(const dx of [-1.2,1.2])box(.14,.5,1.4,C.steel,x+dx,y+.25,z);
    for(let dx=-1.2;dx<=1.2;dx+=.35)box(.22,.09,1.4,C.bark,x+dx,y+.54,z);
    box(2.8,.65,.12,C.bark,x,y+.94,z-.65);stats.benches++;fixtures.push({x,z,r:1.6,zone:'bench'});
  }
  flush();
  function setQuality(q) {
    quality = q; basic.visible = q !== 'compat'; high.visible = q === 'high';
    extraGroups.forEach(g => { g.visible = q === 'high'; });
    if (q !== 'high') lights.forEach(l => { l.visible = false; });
  }
  function update(night) {
    nightOn = !!night;
    for (const [key, m] of materials) {
      if (key.endsWith(':lamp')) m.emissiveIntensity = night ? 2.4 : 0;
      if (key.endsWith(':pool')) m.opacity = night ? .13 : 0;
    }
    const nearby=lightCandidates.slice().sort((a,b)=>Math.hypot(a.tx-controls.target.x,a.tz-controls.target.z)-Math.hypot(b.tx-controls.target.x,b.tz-controls.target.z));
    lights.forEach((l,i) => {
      const p=nearby[i]; l.visible = quality === 'high' && night; l.intensity = night ? 7 : 0;
      if(p){l.position.set(p.x,p.y,p.z);l.target.position.set(p.tx,p.ty===undefined?(p.y>6?.4:0):p.ty,p.tz);l.userData.zone=p.zone;}
    });
  }
  function audit(detailed=false) { return { quality, refinedVisible: high.visible, basicVisible: basic.visible, night: nightOn,
    localLights: lights.filter(l => l.visible).length, ...stats, boundary: window.NZ_MULTI_PLAN.bounds, sites:window.NZ_MULTI_PLAN.sites,
    southRoad: { z0: 136, z1: 144 }, postDetails: extraGroups.map(g => g.visible),
    coverage,roadSegments:streets.length,activeLightZones:lights.filter(l=>l.visible).map(l=>l.userData.zone),
    ...(detailed?{streets,planted,fixtures,protectedAreas}:{}) }; }
  setQuality(window.NZ_ENGINE.S.quality);
  return { setQuality, update, audit, registerLights:candidates=>lightCandidates.push(...candidates) };
})();
