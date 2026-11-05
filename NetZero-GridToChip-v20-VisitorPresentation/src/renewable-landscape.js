/* v7 procedural landscape and generation-side detailing; no external assets. */
'use strict';
window.NZ_RENEWABLES = (function () {
  const P=window.NZ_RENEWABLE_PLAN, h=P.height;
  const coarse=new THREE.Group(), basic=new THREE.Group(), fine=new THREE.Group();
  coarse.name='Renewable terrain and roads';basic.name='Renewable standard environment';fine.name='Renewable refined environment';
  scene.add(coarse,basic,fine);
  const C={road:0x8eaaa9,edge:0xd9e2df,gravel:0xc4c7b6,white:0xedf1ed,steel:0x718c88,dark:0x355958,leaf:0x6e947d,leaf2:0x88a689,bark:0x897f69,rock:0xa6ada2};
  const geo={box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(1,1,1,10),leaf:new THREE.IcosahedronGeometry(1,2),rock:new THREE.IcosahedronGeometry(1,0),pool:new THREE.CircleGeometry(1,24)};
  const buckets=new Map(),mats=new Map(),planted=[],fixtures=[],roadSamples=[],collectorSegments=[],coverage={};
  let minimumRoadSurfaceGap=Infinity;
  let quality='standard',night=false;
  const stats={trees:0,shrubs:0,rocks:0,lamps:0,roads:P.roads.length,turbines:12,pvPanels:window.NZ_SOLAR_PLAN.panels.length};
  function count(zone,key){if(!coverage[zone])coverage[zone]={trees:0,shrubs:0,lamps:0,roads:0};coverage[zone][key]++;}
  function material(c,kind='solid'){
    const key=c+':'+kind;
    if(!mats.has(key))mats.set(key,kind==='pool'?new THREE.MeshBasicMaterial({color:c,map:poolTexture,transparent:true,opacity:0,depthWrite:false}):new THREE.MeshStandardMaterial({color:c,roughness:kind==='metal'?.46:.88,metalness:kind==='metal'?.32:.03,emissive:kind==='lamp'?c:0,emissiveIntensity:0}));
    return mats.get(key);
  }
  function put(type,size,c,pos,parent=fine,rot=[0,0,0],kind='solid'){
    let map=buckets.get(parent);if(!map)buckets.set(parent,map=new Map());const key=type+':'+c+':'+kind;
    if(!map.has(key))map.set(key,{g:geo[type],m:material(c,kind),matrices:[]});
    const o=new THREE.Object3D();o.position.set(...pos);o.rotation.set(...rot);o.scale.set(...size);o.updateMatrix();map.get(key).matrices.push(o.matrix.clone());
  }
  function box(w,ht,d,c,x,y,z,parent=fine,kind='solid'){put('box',[w,ht,d],c,[x,y,z],parent,[0,0,0],kind);}
  function rod(a,b,r,c,parent=fine){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),delta=bb.clone().sub(aa);const rot=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));put('cyl',[r,delta.length(),r],c,aa.add(bb).multiplyScalar(.5).toArray(),parent,rot.toArray().slice(0,3),'metal');}
  const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d'),grad=ctx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'rgba(255,255,255,.8)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const poolTexture=new THREE.CanvasTexture(cv);

  // All quality modes share one continuous terrain mesh and the same sampling rule.
  const terrainG=new THREE.PlaneGeometry(P.bounds.x1-P.bounds.x0,P.bounds.z1-P.bounds.z0,P.terrainGrid.nx,P.terrainGrid.nz);terrainG.rotateX(-Math.PI/2);terrainG.translate((P.bounds.x0+P.bounds.x1)/2,0,(P.bounds.z0+P.bounds.z1)/2);
  const pos=terrainG.attributes.position,colors=new Float32Array(pos.count*3),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=P.rawHeight(x,z);pos.setY(i,y);
    const rugged=Math.max(0,Math.min(1,(y-33)/30));
    c.set('#b9c8b2').lerp(new THREE.Color('#bfc6bb'),rugged);
    const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
    c.lerp(new THREE.Color('#dce5df'),smooth(-115,-40,z));
    c.lerp(new THREE.Color('#e4ebe9'),smooth(-45,20,x)*smooth(-85,-25,z));
    const n=Math.sin(x*.023+z*.016)*Math.cos(z*.04)*.018;c.offsetHSL(0,0,n);
    colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  terrainG.setAttribute('color',new THREE.BufferAttribute(colors,3));terrainG.computeVertexNormals();
  const terrain=new THREE.Mesh(terrainG,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
  terrain.name='Continuous western hills';terrain.receiveShadow=true;coarse.add(terrain);
  // Empty legacy generation-side planting/roads are removed before batching.
  // New surface paths are tessellated to follow slopes without floating or cutting through hills.
  function pathMesh(points,width,color,parent,offset){
    const verts=[],indices=[],columns=Math.max(1,Math.ceil(width/.4)),stride=columns+1;
    points.forEach(([x,z],i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];const len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;
      for(let col=0;col<=columns;col++){const side=col/columns*2-1,xx=x+nx*width*.5*side,zz=z+nz*width*.5*side;verts.push(xx,h(xx,zz)+offset,zz);}
      if(i)for(let col=0;col<columns;col++){const k=i*stride+col;indices.push(k-stride,k-stride+1,k,k,k-stride+1,k+1);}
    });
    if(parent===coarse)for(let i=0;i<indices.length;i+=3){const k=indices.slice(i,i+3).map(v=>v*3);const x=k.reduce((n,v)=>n+verts[v],0)/3,z=k.reduce((n,v)=>n+verts[v+2],0)/3,y=k.reduce((n,v)=>n+verts[v+1],0)/3;minimumRoadSurfaceGap=Math.min(minimumRoadSurfaceGap,y-h(x,z));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();
    const m=new THREE.Mesh(g,material(color));m.receiveShadow=true;parent.add(m);return verts;
  }
  function densify(pts,step=1){const out=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step);for(let j=1;j<=n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}return out;}
  const segments=[];
  for(const road of P.roads){
    count(road.zone,'roads');const points=densify(road.pts,.5);
    pathMesh(points,road.width+1.2,C.gravel,basic,.30);pathMesh(points,road.width,C.road,coarse,.34);
    points.forEach(([x,z])=>roadSamples.push({x,z,y:h(x,z)+.34,width:road.width,zone:road.zone}));
    for(let i=1;i<road.pts.length;i++)segments.push({a:road.pts[i-1],b:road.pts[i],w:road.width,zone:road.zone});
    // White edge bands follow the terrain, with restrained dashed centers.
    for(const side of [-1,1]){
      const edge=points.map(([x,z],i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [x-(b[1]-a[1])/l*(road.width/2-.22)*side,z+(b[0]-a[0])/l*(road.width/2-.22)*side];});
      pathMesh(edge,.08,C.white,fine,.40);
    }
    if(road.width>=4)for(let i=0;i<points.length-4;i+=20)pathMesh(points.slice(i,i+5),.09,C.white,fine,.41);
    if(road.zone!=='solar'&&road.width>=4){
      const cable=points.map(([x,z],i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [x-(b[1]-a[1])/l*(road.width/2+1),z+(b[0]-a[0])/l*(road.width/2+1)];});
      pathMesh(cable,.18,C.steel,fine,.26);
      for(let i=3;i<cable.length;i+=60){const [x,z]=cable[i];box(.24,.32,.24,C.white,x,h(x,z)+.27,z,fine);}
    }
  }
  function distanceToSegment(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz,t=n?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/n)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
  function nearRoad(x,z,r){return segments.some(s=>distanceToSegment(x,z,s.a,s.b)<s.w/2+r);}
  function free(x,z,r,trees=false){
    if(x<P.bounds.x0+r+8||x>-18-r||z<P.bounds.z0+r+8||z>180-r)return false;
    const pv=P.solarBounds;if(x+r>pv.x0-3&&x-r<pv.x1+3&&z+r>pv.z0-3&&z-r<pv.z1+3)return false;
    if(P.sites.some(s=>Math.hypot(x-s.x,z-s.z)<(trees?20:9)+r))return false;
    if(nearRoad(x,z,r+1))return false;
    if(fixtures.some(s=>Math.hypot(x-s.x,z-s.z)<r+s.r+1))return false;
    return !planted.some(p=>Math.hypot(x-p.x,z-p.z)<(p.r+r)*.9);
  }
  const lamps=[];
  function lamp(x,z,zone){
    if(nearRoad(x,z,.6)||P.sites.some(s=>Math.hypot(x-s.x,z-s.z)<9))return;
    const y=h(x,z);box(.8,.22,.8,C.edge,x,y+.13,z,basic);rod([x,y+.2,z],[x,y+5.3,z],.075,C.steel,basic);
    rod([x,y+5.1,z],[x+1,y+5.1,z],.07,C.steel,fine);box(1.3,.12,.42,C.dark,x+.8,y+5.1,z,fine);box(1.08,.04,.32,0xe7e8ca,x+.8,y+5.02,z,fine,'lamp');
    put('pool',[4,4,1],0xe7e8ca,[x+1.2,y+.17,z],fine,[-Math.PI/2,0,0],'pool');
    const p={x:x+.8,y:y+5,z,tx:x+1.5,ty:y+.2,tz:z,zone:'outside-'+zone};lamps.push(p);fixtures.push({x,z,y,r:.55,kind:'lamp',zone});stats.lamps++;count(zone,'lamps');
  }
  for(const s of P.sites)lamp(s.x+11,s.z+8,s.zone);
  for(const [x,z] of [[-184,50],[-66,50],[-184,127],[-66,127],[-129,138],[-35,138]])lamp(x,z,'solar');

  // Level gravel aprons, foundations, collection switchgear and underground collector traces.
  for(const s of P.sites){
    const y=s.y;
    box(14,.18,14,C.gravel,s.x,y+.12,s.z,basic);box(6,.3,2.5,C.edge,s.x+8,y+.3,s.z-4,coarse);
    box(3.2,2.3,1.8,C.white,s.x+8,y+1.6,s.z-4,coarse);box(2.65,1.9,.07,C.steel,s.x+8,y+1.6,s.z-3.06,fine);
    for(let dx=-1;dx<=1;dx+=.5)box(.08,1.4,.07,C.dark,s.x+8+dx,y+1.6,s.z-3,fine);
    fixtures.push({x:s.x+8,z:s.z-4,y,r:2,kind:'collectorSwitch',zone:s.zone});
    for(let j=0;j<12;j++){const a=j*Math.PI/6;put('cyl',[.075,.2,.075],C.steel,[s.x+1.55*Math.cos(a),y+.48,s.z+1.55*Math.sin(a)],fine,[0,0,0],'metal');}
    for(const [dx,dz] of [[-6,-6],[-6,6],[6,-6],[6,6]])box(.13,.95,.13,C.white,s.x+dx,y+.7,s.z+dz,fine);
    // Collector route follows the same service road, only exposed markers at intervals.
    const lead=densify([[s.x+8,s.z-4],[s.x+9,s.z+14],[s.x,s.z+14]]);
    pathMesh(lead,.18,C.steel,fine,.15);collectorSegments.push({index:s.index,pts:lead.map(([x,z])=>[x,h(x,z)+.15,z])});
    for(let j=0;j<lead.length;j+=5){const [x,z]=lead[j];box(.18,.45,.18,C.white,x,h(x,z)+.24,z,fine);}
    const root=rotors[s.index].parent;
    // Curved/tapered blade planform replaces the old rectangular paddles in every mode.
    rotors[s.index].children.slice().forEach(o=>rotors[s.index].remove(o));
    rotors[s.index].scale.setScalar(P.turbine.rotorScale);
    const shape=new THREE.Shape();shape.moveTo(-.09,.25);shape.lineTo(-.20,.65);shape.lineTo(-.24,1.2);shape.lineTo(-.10,2.5);shape.lineTo(.03,3.7);shape.lineTo(.12,3.64);shape.lineTo(.18,2.4);shape.lineTo(.22,1.15);shape.lineTo(.10,.25);
    const bladeG=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false});
    for(let b=0;b<3;b++){const mesh=new THREE.Mesh(bladeG,material(C.white));mesh.rotation.z=b*Math.PI*2/3;mesh.castShadow=true;rotors[s.index].add(mesh);}
    // v13 compact nacelle products are built by wind-product.js.

  }
  window.NZ_ENVIRONMENT.registerLights(lamps);
  // PV perimeter, gate, maintenance access, service cabinets and drainage.
  const pv=P.solarBounds;
  const fence=(a,b)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=Math.ceil(len/5);
    for(let i=0;i<=n;i++){const x=a[0]+dx*i/n,z=a[1]+dz*i/n;rod([x,.1,z],[x,1.7,z],.045,C.steel,basic);}
    for(const y of [.6,1.45])rod([a[0],y,a[1]],[b[0],y,b[1]],.03,C.steel,basic);
    for(let d=0;d<=len;d+=.7){const x=a[0]+dx*d/len,z=a[1]+dz*d/len;rod([x,.28,z],[x,1.65,z],.013,C.steel,fine);}
  };
  fence([pv.x0,pv.z0],[pv.x1,pv.z0]);fence([pv.x0,pv.z1],[pv.x1,pv.z1]);fence([pv.x0,pv.z0],[pv.x0,pv.z1]);fence([pv.x1,pv.z0],[pv.x1,74]);fence([pv.x1,82],[pv.x1,pv.z1]);
  // Dedicated electrical service belt is built by solar-site.js.
  for(const x of [-145,-112])pathMesh(densify([[x,50],[x,76],[x,80],[x,110]]),1.4,C.gravel,basic,.10);
  pathMesh(densify([[-184,42],[-66,42],[-66,136]]),.4,C.dark,fine,.075);
  for(let z=48;z<130;z+=6)for(let dx=-.2;dx<=.2;dx+=.2)box(.04,.015,.72,C.steel,-66+dx,.09,z,fine);
  // Match campus materials while giving PV a controlled metallic response.
  const pvModel=scene.children.find(o=>o.name==='Detailed solar'&&o.visible);
  if(pvModel)pvModel.traverse(o=>{if(o.material&&o.material.color&&o.material.color.getHex()===0x4e7f9e){o.material=material(0x496979,'metal');o.material.roughness=.43;o.material.metalness=.24;}});

  // Deterministic vegetation; clear panels, turbine working platforms, roads and cabinets.
  let seed=7241;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function tree(x,z,s,zone){
    const r=2.1*s;if(!free(x,z,r,true))return false;const y=h(x,z);
    put('cyl',[.15*s,3.1*s,.19*s],C.bark,[x,y+1.55*s,z]);
    rod([x,y+1.8*s,z],[x+.65*s,y+3.1*s,z],.08*s,C.bark);
    for(const [dx,dy,dz,sz,color] of [[0,3.8,0,1.8,C.leaf],[1,3.3,.1,1.25,C.leaf2],[-.8,3.25,-.2,1.3,C.leaf]])put('leaf',[sz*s,sz*s*.78,sz*s],color,[x+dx*s,y+dy*s,z+dz*s]);
    planted.push({x,z,y,r,kind:'tree',zone});stats.trees++;count(zone,'trees');return true;
  }
  function shrub(x,z,s,zone){if(!free(x,z,.6*s))return false;const y=h(x,z);put('leaf',[.65*s,.45*s,.55*s],C.leaf2,[x,y+.4*s,z]);planted.push({x,z,y,r:.6*s,kind:'shrub',zone});stats.shrubs++;count(zone,'shrubs');return true;}
  for(const road of P.roads){const pts=densify(road.pts);for(let i=2;i<pts.length-1;i+=10){const [x,z]=pts[i],a=pts[i-1],b=pts[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;for(const side of [-1,1]){const nx=-(b[1]-a[1])/l*side,nz=(b[0]-a[0])/l*side;shrub(x+nx*(road.width/2+2.2),z+nz*(road.width/2+2.2),.65+rnd()*.5,road.zone);if(i%30===2&&road.zone!=='distant')tree(x+nx*(road.width/2+5.5),z+nz*(road.width/2+5.5),.6+rnd()*.35,road.zone);}}}
  for(let i=0;i<440;i++){
    const x=-538+rnd()*493,z=-390+rnd()*465,zone=z<-265?'distant':z<-90?'ridge':'west';
    if(i%7===0&&z>-250)tree(x,z,.55+rnd()*.4,zone);else shrub(x,z,.55+rnd()*.55,zone);
  }
  for(let i=0;i<105;i++){
    const x=-543+rnd()*515,z=-391+rnd()*310;if(!free(x,z,1.8))continue;const y=h(x,z);if(y<7)continue;
    put('rock',[1.1+rnd()*1.7,.6+rnd()*1.4,.9+rnd()*1.5],C.rock,[x,y+.3,z],fine,[rnd()*.3,rnd()*Math.PI,rnd()*.3]);stats.rocks++;
  }
  // PV planting is concentrated outside its fence, leaving all component rows unobscured.
  for(let x=-173;x<=-76;x+=9){tree(x,144,.72,'solar');shrub(x,140,.8,'solar');}
  for(let z=49;z<=107;z+=8){tree(-191,z,.65,'solar');shrub(-187,z,.75,'solar');}
  for(const [parent,map] of buckets)for(const b of map.values()){
    const mesh=new THREE.InstancedMesh(b.g,b.m,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=b.m.type!=='MeshBasicMaterial'&&b.m.emissive.getHex()===0;mesh.receiveShadow=b.m.type!=='MeshBasicMaterial';parent.add(mesh);
  }
  buckets.clear();
  // Camera navigation keeps the expanded terrain discoverable without shrinking campus close-ups.
  const views={
    all:window.NZ_MULTI_PLAN.home,
    wind:{pos:[245,380,330],tgt:[-285,20,-145]},
    west:{pos:[-70,120,210],tgt:[-370,9,12]},
    ridge:{pos:[-35,165,45],tgt:[-325,29,-164]},
    distant:{pos:[-33,180,-72],tgt:[-294,48,-332]},
    solar:{pos:[-38,280,420],tgt:[-305,1,99]}
  };
  let panel;
  function ready(api){
    panel=document.createElement('div');panel.id='renewableControls';panel.hidden=true;
    panel.innerHTML='<div class="detail-kicker">v13 · 场外风光与丘陵</div><p>平地、缓丘与远丘上的分布式风机，接入园区升压站。</p><div class="detail-buttons"><button data-landscape="all">园区与山峦全景</button><button data-landscape="west">西侧平地风机</button><button data-landscape="ridge">缓丘风机</button><button data-landscape="distant">远丘风机</button><button data-landscape="solar">光伏场站</button></div>';
    document.getElementById('detailControls').before(panel);
    panel.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{api.exitTour();api.cancelCamera();const v=views[b.dataset.landscape];camera.position.set(...v.pos);controls.target.set(...v.tgt);controls.update();}));
  }
  function selection(key){if(panel)panel.hidden=!['wind','solar','substation'].includes(key);}
  function setQuality(q){quality=q;basic.visible=q!=='compat';fine.visible=q==='high';}
  function update(on){night=!!on;for(const [key,m] of mats){if(key.endsWith(':lamp'))m.emissiveIntensity=on?2.4:0;if(key.endsWith(':pool'))m.opacity=on?.15:0;}}
  function audit(detailed=false){return {quality,basicVisible:basic.visible,refinedVisible:fine.visible,night,...stats,coverage,bounds:P.bounds,sites:P.sites.map(s=>({...s,hubY:rotors[s.index].parent.position.y})),rotorDiameter:P.rotorDiameter,terrainVertices:pos.count,minimumRoadSurfaceGap,solarFlat:h(-125,73)===0,...(detailed?{planted,fixtures,roadSamples,collectorSegments,roads:P.roads}:{})};}
  setQuality(window.NZ_ENGINE.S.quality);
  return {setQuality,update,audit,selection,ready,focus:key=>views[key]||null};
})();
