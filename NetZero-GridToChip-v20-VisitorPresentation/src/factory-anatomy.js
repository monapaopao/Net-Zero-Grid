/* Native shared hall: static workcell parts batch across all rows, while
 * moving groups share geometry. Every roof/cladding material is independent. */
'use strict';
window.NZ_FACTORY=(function(){
 const M=window.NZ_FACTORY_LINE,data=M.create(),validation=M.audit(data),state=M.state();
 if(!validation.passed)throw Error('Factory line geometry audit failed');
 let api,THREE,root,hero,roofGroup,panel,selected=false,saved=null,tourPaused=false,buildStats,lastPose,lastQuality,lastRoof=null,culled=false,glints,wasteFlows;
 const liquidPaths=[],instancedMotion=[],fine=[],materials={},roofMaterials={},meshCache={},lines=[],modes=['overview','process','payout','treatment','takeup','raw','packing','waste'];
 const fallback={center:[280,18],w:56,d:192,h:9,rows:[-25.6,-2.8,20,42.8,65.6].map(z=>({center:[280,z],rotationY:0})),ports:{process:[304,1.4,114]}};
 const hall=window.NZ_MULTI_PLAN?.factoryHall||fallback,lineScale=hall.lineScale||1;
 data.colors.waste=0x967c56;data.colors.clean=0x3e8e9b;
 const views={overview:{pos:[365,120,200],tgt:[280,3,18]},process:{pos:[310,19,40],tgt:[291,1.6,24.45]},payout:{pos:[292,9,36],tgt:[284.25,1.6,24.45]},treatment:{pos:[299,10,35],tgt:[288.4,1.6,24.45]},takeup:{pos:[307,9,34],tgt:[297.75,1.6,24.45]},raw:{pos:[312,38,-21],tgt:[280,2,-65]},packing:{pos:[312,38,145],tgt:[280,2,101]},waste:{pos:[309,100,67],tgt:[244,3,-23]}};
 const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 // Fade only sub-module texture detail with view distance; geometry and shadowed roof stay intact.
 function configurePV(m){
  m.onBeforeCompile=shader=>{
   shader.uniforms.nzPVFarColor={value:new THREE.Color('#243a4f')};
   shader.fragmentShader='uniform vec3 nzPVFarColor;\n'+shader.fragmentShader;
   if(!shader.fragmentShader.includes('#include <map_fragment>'))throw Error('PV material map shader hook missing');
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    #ifdef USE_MAP
     float nzPVDetail = 1.0 - smoothstep(130.0, 430.0, length(vViewPosition));
     diffuseColor.rgb = mix(nzPVFarColor, diffuseColor.rgb, nzPVDetail);
    #endif`);
  };
  m.customProgramCacheKey=()=> 'nz-rooftop-pv-distance-v1';
 }
 function material(name){
  if(materials[name])return materials[name];
  const options={color:data.colors[name]??0xb0bfb6,roughness:['alloy','wire'].includes(name)?.4:.7,metalness:['alloy','steel','wire','copper'].includes(name)?.42:.06};
  if(name==='pv'){
   if(typeof document!=='undefined'&&document.createElement){const cv=document.createElement('canvas');cv.width=256;cv.height=512;const c=cv.getContext('2d');c.fillStyle='#111d2b';c.fillRect(0,0,256,512);for(let r=0;r<24;r++)for(let k=0;k<6;k++){const x=k*42+3,y=r*21+(r>=12?5:2);c.fillStyle=['#24394f','#263c52','#283e54'][(r+k)%3];c.fillRect(x,y,40,19);c.fillStyle='rgba(177,197,209,.22)';for(let j=1;j<4;j++)c.fillRect(x+j*10,y,1,19);c.fillRect(x,y+9,40,1);}const map=new THREE.CanvasTexture(cv);map.encoding=THREE.sRGBEncoding;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.generateMipmaps=true;
    map.anisotropy=Math.max(1,Math.min(8,api?.renderer?.capabilities?.getMaxAnisotropy?.()||1));options.map=map;options.color=0xffffff;}options.roughness=.52;options.metalness=.04;options.polygonOffset=true;options.polygonOffsetFactor=-1;options.polygonOffsetUnits=-2;
  }
  if(name==='water'){options.transparent=true;options.opacity=.22;options.depthWrite=false;options.roughness=.3;}
  if(name==='glass'){options.transparent=true;options.opacity=.23;options.depthWrite=false;options.roughness=.24;options.metalness=.14;}
  const result=new THREE.MeshStandardMaterial(options);if(name==='pv')configurePV(result);return materials[name]=result;
 }
 function roofMaterial(name){if(roofMaterials[name])return roofMaterials[name];const m=material(name).clone();if(name==='pv')configurePV(m);m.name='Factory independent roof '+name;m.userData.closed={opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite};return roofMaterials[name]=m;}
 function geometry(p){
  const key=p.type+':'+p.size.join(',');if(meshCache[key]&&p.type!=='rod'&&p.type!=='tube')return meshCache[key];
  let g;if(p.type==='pvface')g=new THREE.PlaneGeometry(...p.size);else if(p.type==='box')g=new THREE.BoxGeometry(...p.size);else if(p.type==='cyl')g=new THREE.CylinderGeometry(p.size[0],p.size[0],p.size[1],20,1);else if(p.type==='ring')g=new THREE.TorusGeometry(p.size[0],p.size[1],6,28);else if(p.type==='sleeve'){const shape=new THREE.Shape();shape.absarc(0,0,p.size[0],0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,p.size[1],0,Math.PI*2,true);shape.holes.push(hole);g=new THREE.ExtrudeGeometry(shape,{depth:p.size[2],bevelEnabled:false,curveSegments:20});g.translate(0,0,-p.size[2]/2);}else if(p.type==='rod')g=new THREE.CylinderGeometry(p.size[0],p.size[0],dist(p.p,p.b),10,1);
  else{const points=p.points.map(a=>new THREE.Vector3(...a)),curve=new THREE.Curve(),lengths=[0];let total=0;for(let j=1;j<points.length;j++){total+=points[j].distanceTo(points[j-1]);lengths.push(total);}curve.getPoint=t=>{const d=t*total;let j=1;while(j<lengths.length-1&&lengths[j]<d)j++;return points[j-1].clone().lerp(points[j],(d-lengths[j-1])/(lengths[j]-lengths[j-1]));};g=new THREE.TubeGeometry(curve,Math.max(2,p.points.length*3),p.size[0],8,false);}
  if(p.type!=='rod'&&p.type!=='tube')meshCache[key]=g;return g;
 }
 function oriented(p,pivot=[0,0,0]){
  const o=new THREE.Object3D();if(p.type==='rod'){o.position.fromArray(p.p).add(new THREE.Vector3(...p.b)).multiplyScalar(.5).sub(new THREE.Vector3(...pivot));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...p.b).sub(new THREE.Vector3(...p.p)).normalize());}
  else if(p.type==='tube')o.position.set(...pivot.map(v=>-v));else{o.position.set(...p.p.map((v,i)=>v-pivot[i]));if(p.axis){const zAxis=p.type==='ring'||p.type==='sleeve'||p.type==='pvface';o.quaternion.setFromUnitVectors(new THREE.Vector3(0,zAxis?0:1,zAxis?1:0),new THREE.Vector3(...p.axis));}}o.updateMatrix();return o.matrix;
 }
 function merge(list){const g=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){const arrays=list.map(g=>g.attributes[name]),values=new Float32Array(arrays.reduce((sum,a)=>sum+a.array.length,0));let off=0;for(const a of arrays){values.set(a.array,off);off+=a.array.length;}g.setAttribute(name,new THREE.BufferAttribute(values,arrays[0].itemSize));}g.computeBoundingSphere();return g;}
 function addBucket(buckets,key,p,matrix,parent,roof=false){if(!buckets.has(key))buckets.set(key,{parent,mat:p.mat,roof,group:p.group,tier:p.tier,deviceKey:p.deviceKey,geometries:[],ranges:[],triangles:0});const b=buckets.get(key),source=geometry(p),g=source.index?source.toNonIndexed():source.clone();g.applyMatrix4(matrix);const count=g.attributes.position.count/3;b.ranges.push({name:p.name,start:b.triangles,count});b.triangles+=count;b.geometries.push(g);if(p.type==='rod'||p.type==='tube')source.dispose();}
 function emitBuckets(buckets){const meshes=[];for(const b of buckets.values()){const mesh=new THREE.Mesh(merge(b.geometries),b.roof?roofMaterial(b.mat):material(b.mat));mesh.name=b.roof?'Shared factory roof '+b.mat:'Factory merged '+b.mat;if(b.deviceKey)mesh.userData.deviceKey=b.deviceKey;mesh.userData.partRanges=b.ranges;mesh.userData.partNames=b.ranges.map(r=>r.name);mesh.castShadow=b.mat!=='water'&&b.mat!=='glass';mesh.receiveShadow=b.mat!=='pv';if(b.mat==='pv')mesh.castShadow=false;b.parent.add(mesh);b.geometries.forEach(g=>g.dispose());meshes.push(mesh);}return meshes;}
 function hallParts(){
  const out=[],w=hall.w,d=hall.d,h=hall.h,W=w/2,D=d/2;
  const put=(name,type,p,size,mat='steel',roof=false,tier='standard',extra={})=>out.push({name,type,p,size,mat,roof,tier,...extra});
  const box=(n,p,s,m='steel',r=false,t='standard')=>put(n,'box',p,s,m,r,t),cyl=(n,p,r,h,m='alloy',roof=false,axis=[0,1,0],tier='standard')=>put(n,'cyl',p,[r,h],m,roof,tier,{axis}),ring=(n,p,r,t,m='alloy',roof=false,axis=[0,0,1])=>put(n,'ring',p,[r,t],m,roof,'standard',{axis}),rod=(n,a,b,r=.06,m='steel',roof=false,tier='standard')=>put(n,'rod',a,[r],m,roof,tier,{b});
  box('Shared hall foundation',[0,.18,0],[w,.36,d],'floor');
  for(const x of [-23,23]){box('Continuous side operating aisle '+x,[x,.37,0],[5.7,.025,d-2],'white');for(const dx of [-2.88,2.88])box('Side aisle yellow boundary '+x+dx,[x+dx,.39,0],[.07,.018,d-2],'yellow');}
  for(const z of [-71,71]){box('Warehouse cross aisle '+z,[0,.375,z],[w-1,.025,3.2],'white');for(const dz of [-1.64,1.64])box('Warehouse cross aisle edge '+z+dz,[0,.394,z+dz],[w-1,.018,.06],'yellow');}
  box('Central operating aisle',[0,.375,0],[4,.025,136],'white');
  for(const x of [-W+.13,W-.13])box('Hall side curb '+x,[x,.62,0],[.26,.5,d],'shell');for(const z of [-D+.13,D-.13])for(const x of [-20,20])box('Hall end curb '+x+z,[x,.62,z],[15.5,.5,.26],'shell');
  // Upper walls, columns, beams, deck, PV, gutters and mullions all fade.
  box('Shared insulated roof deck',[0,h,0],[w,.2,d],'white',true);
  for(const x of [-W+.14,W-.14]){if(x<0){
    let last=-D+.25;for(const z of [-84,-80,-76,-72]){const lo=z-.24,hi=z+.24;if(lo>last)box('West wall between liquid ports '+z,[x,4.8,(last+lo)/2],[.2,7.6,lo-last],'shell',true);box('West wall below liquid port '+z,[x,3.65,z],[.2,5.3,.48],'shell',true);box('West wall above liquid port '+z,[x,7.85,z],[.2,1.5,.48],'shell',true);last=hi;}box('West wall beyond liquid ports',[x,4.8,(last+D-.25)/2],[.2,7.6,D-.25-last],'shell',true);
   }else box('Hall upper side cladding '+x,[x,4.8,0],[.2,7.6,d-.5],'shell',true);box('Roof longitudinal eave '+x,[x,h-.28,0],[.24,.4,d],'steel',true);box('Roof rain gutter '+x,[x,h+.04,0],[.35,.18,d],'alloy',true);}
  const port=hall.ports?.process||fallback.ports.process,p=[port[0]-hall.center[0],port[1],port[2]-hall.center[1]];
  for(const z of [-D+.14,D-.14]){for(const x of [-19,19]){if(z>0&&x>0){const x0=10,x1=W,cut0=p[0]-.8,cut1=p[0]+.8;box('Hall end upper wall left of services',[(x0+cut0)/2,4.8,z],[cut0-x0,7.6,.2],'shell',true);box('Hall end upper wall right of services',[(cut1+x1)/2,4.8,z],[x1-cut1,7.6,.2],'shell',true);box('Hall wall below service apertures',[p[0],(1+p[1]-.13)/2,z],[1.6,p[1]-.13-1,.2],'shell',true);box('Hall wall above service apertures',[p[0],(8.6+p[1]+.13)/2,z],[1.6,8.6-p[1]-.13,.2],'shell',true);for(const [a,b]of [[-.8,-.61],[-.35,-.13],[.13,.35],[.61,.8]])box('Hall wall service web '+a,[p[0]+(a+b)/2,p[1],z],[b-a,.26,.2],'shell',true);}else box('Hall end upper wall '+x+z,[x,4.8,z],[18,7.6,.2],'shell',true);}box('Hall end door header '+z,[0,7.55,z],[20,2.1,.25],'white',true);box('Hall loading shutter '+z,[0,3.65,z],[10,5.9,.18],'steel',true);for(let j=0;j<23;j++)box('Loading shutter slat '+z+' '+j,[0,.8+j*.25,z+Math.sign(z)*.13],[9.9,.025,.06],'alloy',true,'high');for(const x of [-5.2,5.2])box('Loading shutter jamb '+x+z,[x,3.65,z],[.24,6.1,.42],'white',true);}
  for(let j=0;j<=12;j++){const z=-D+1+j*(d-2)/12;for(const x of [-W+.55,W-.55]){box('Hall steel column '+x+' '+j,[x,4.55,z],[.28,8.3,.32],'white',true);box('Hall column base '+x+' '+j,[x,.49,z],[.7,.24,.76],'alloy');for(const dx of [-.25,.25])for(const dz of [-.26,.26])cyl('Column base bolt '+x+j+dx+dz,[x+dx,.64,z+dz],.04,.07,'dark',false,[0,1,0],'high');}box('Hall roof cross beam '+j,[0,h-.35,z],[w-.8,.35,.22],'steel',true);rod('Hall roof lower tie '+j,[-W+.6,h-1,z],[W-.6,h-1,z],.06,'alloy',true);for(let k=0;k<8;k++)rod('Hall roof truss web '+j+' '+k,[-W+.6+k*(w-1.2)/8,k%2?h-.35:h-1,z],[-W+.6+(k+1)*(w-1.2)/8,k%2?h-1:h-.35,z],.04,'alloy',true,'high');}
  // Module detail follows the charging canopy; low roof-mounted rails and access strips are specific to this hall.
  for(let row=0;row<48;row++)for(let col=0;col<32;col++){
   const x=(col-15.5)*1.65,z=(row-23.5)*3.8,n='Hall PV '+row+' '+col;
   if((col===15||col===16)||row%12===0)continue;
   box(n+' rails',[x,h+.17,z],[1.35,.16,3.55],'steel',true);
   // Four real perimeter bars, rather than a bright solid slab under the active area.
   for(const dx of [-.73,.73])box(n+' frame side '+dx,[x+dx,h+.36,z],[.04,.12,3.58],'alloy',true);
   for(const dz of [-1.76,1.76])box(n+' frame end '+dz,[x,h+.36,z+dz],[1.42,.12,.06],'alloy',true);
   put(n+' cells','pvface',[x,h+.40,z],[1.38,3.46],'pv',true,'standard',{axis:[0,1,0]});
  }
  for(let k=0;k<23;k++)box('Roof bay seam '+k,[0,h+.11,-D+8+k*8],[w-.4,.025,.045],'alloy',true,'high');
  // Warehouse reels reuse the actual production rotor geometry at the same world scale.
  function reel(n,x,y,z,mat){
   const group=mat==='wire'?'payoutRotor':'takeupRotor',pivot=data.assemblies[group];
   const point=p=>p.map((v,i)=>(v-pivot[i])*lineScale+[x,y,z][i]);
   for(const part of data.parts.filter(p=>p.group===group)){
    const p={...part,name:n+' '+part.name,p:point(part.p),size:part.size.map(v=>v*lineScale),group:'fixed',roof:false};
    if(part.b)p.b=point(part.b);if(part.points)p.points=part.points.map(point);out.push(p);
   }
  }
  // Two rack banks, two shelf levels, five matching reels per shelf: 20 raw reels.
  for(const z of [-83])for(const x of [-10.5,10.5]){const n='Raw coil rack '+x+' '+z;for(const dx of [-5.7,5.7])for(const dz of [-2,2]){box(n+' upright '+dx+dz,[x+dx,3,z+dz],[.15,5.2,.16],'teal');box(n+' anchor '+dx+dz,[x+dx,.48,z+dz],[.42,.16,.42],'alloy');}for(const y of [.87,3.65])for(const dz of [-2,2])box(n+' cross beam '+y+dz,[x,y,z+dz],[11.6,.23,.18],'steel');for(const y of [.98,3.76]){box(n+' shelf '+y,[x,y,z],[11.5,.1,4.1],'alloy');for(const dx of [-4.4,-2.2,0,2.2,4.4]){reel(n+' stock '+y+' '+dx,x+dx,y+.76,z,'wire');for(const side of [-1,1])box(n+' cradle '+y+dx+side,[x+dx+side*.48,y+.14,z],[.12,.18,1.05],'steel');}}}
  // Two compact rows of eight dispatch pallets: 16 finished reels, clear of packing benches.
  for(const z of [83,88])for(const x of [-17,-13,-9,-5,5,9,13,17]){const n='Finished reel pallet '+x+' '+z;for(const dx of [-.8,0,.8])box(n+' bearer '+dx,[x+dx,.51,z],[.2,.2,1.9],'steel');box(n+' deck',[x,.67,z],[2.5,.12,2],'alloy');reel(n,x,1.42,z,'ceramic');for(const dx of [-.95,.95]){box(n+' strap top '+dx,[x+dx,2.16,z],[.04,.03,1.8],'teal');for(const dz of [-.9,.9])box(n+' strap drop '+dx+dz,[x+dx,1.42,z+dz],[.04,1.48,.03],'teal');}box(n+' dispatch label',[x,.92,z+1.02],[.75,.24,.03],'white');for(let j=0;j<3;j++)box(n+' label print '+j,[x,.99-j*.06,z+1.04],[.53-j*.07,.015,.008],'dark',false,'high');}
  for(const x of [-10.5,10.5]){const n='Packing bench '+x,z=77;box(n+' top',[x,1.65,z],[10,.15,3.6],'white');for(const dx of [-4.5,4.5])for(const dz of [-1.45,1.45])box(n+' leg '+dx+dz,[x+dx,1.03,z+dz],[.16,1.1,.16],'steel');box(n+' scale',[x-2,1.83,z],[2,.21,1.6],'dark');box(n+' wrap dispenser',[x+3,2.25,z],[1,.95,1],'teal');cyl(n+' wrap roll',[x+3,2.92,z],.32,1,'white',false,[0,0,1]);}
  // Three actual through bores in both the wall and gland plate; no opaque cap crosses a service centreline.
  for(const [a,b]of [[-.8,-.61],[-.35,-.13],[.13,.35],[.61,.8]])box('Hall gland mounting web '+a,[p[0]+(a+b)/2,p[1],p[2]-.08],[b-a,1.5,.18],'steel');for(const side of [-1,1])box('Hall gland mounting horizontal '+side,[p[0],p[1]+side*.44,p[2]-.08],[1.6,.62,.18],'steel');
  for(const dx of [-.48,0,.48]){put('Hall service gland bore '+dx,'sleeve',[p[0]+dx,p[1],p[2]-.05],[.20,.13,.42],'alloy');for(const dz of [-.28,.18])ring('Hall service gland collar '+dx+' '+dz,[p[0]+dx,p[1],p[2]+dz],.165,.035);}
  for(const x of [-26.7,26.7]){box('Hall side cable trunk '+x,[x,.68,0],[.42,.24,d-5],'steel');box('Hall side cable trunk cover '+x,[x,.82,0],[.47,.035,d-5],'alloy');rod('Hall crossfeed riser '+x,[x,.82,92],[x,1.4,92],.1,'dark');}
  rod('Hall service infeed',[p[0],p[1],p[2]-.18],[p[0],p[1],92],.1,'dark');rod('Hall service crossfeed',[-26.7,p[1],92],[26.7,p[1],92],.1,'dark');
  // Each scaled cell receives an overhead branch; no low pipe crosses a logistics aisle.
  for(let i=0;i<hall.rows.length;i++){const row=hall.rows[i],feed=data.ports.lineFeed,z=row.center[1]-18+feed[2]*lineScale,x=row.center[0]-280+feed[0]*lineScale,side=row.column?26.7:-26.7;
   rod('Row '+i+' riser',[side,.82,z],[side,7.5,z],.05,'dark');rod('Row '+i+' overhead',[side,7.5,z],[x,7.5,z],.05,'dark');rod('Row '+i+' drop',[x,7.5,z],[x,feed[1]*lineScale,z],.05,'dark');
  }
  // Separate discharge mains run below the floor, with actual risers at each cell.
  for(const row of hall.rows){const z=row.center[1]-18;for(const [dx,mat,y]of [[-2.575,'waste',-.4],[1.225,'clean',-.7]]){const x=row.center[0]-280+dx;rod('Cell discharge riser '+row.row+row.column+mat,[x,.55,z],[x,y,z],.06,mat);rod('Cell discharge branch '+row.row+row.column+mat,[x,y,z],[0,y,z],.06,mat);}}
  // Visible bridge replaces the buried factory-to-plant transfers. Internal collectors remain below the floor.
  function liquidPath(id,points,mat,concept=false){liquidPaths.push({id,points,mat,concept});for(let i=1;i<points.length;i++)rod('Liquid link '+id+' '+i,points[i-1],points[i],.12,mat);for(let i=1;i<points.length-1;i++){const p=points[i];cyl('Link joint '+id+i,p,.18,.08,'alloy',false,[0,1,0]);}}
  for(const [mat,y,zz]of [['waste',-.4,-76],['clean',-.7,-72]]){
   rod(mat+' buried collector',[0,y,59],[0,y,zz],.10,mat);rod(mat+' buried branch to bridge',[0,y,zz],[-19,y,zz],.10,mat);
   liquidPath(mat==='waste'?'工艺废液分类收集':'清洗废水分类收集',[[-19,y,zz],[-19,6.6,zz],[-55,6.6,zz],[-55,2.4,zz],[-57,2.4,zz]],mat);
  }
  // A representative isolated side-stream loop keeps the twenty line-side circulation systems in place.
  const representative=hall.rows[0],rx=representative.center[0]-280,rz=representative.center[1]-18;
  const treatmentOut=[rx-1.8,.725,rz-.55],treatmentIn=[rx-3.3,.725,rz-.55];
  liquidPath('工艺循环液旁滤回液',[treatmentOut,[treatmentOut[0],-.95,treatmentOut[2]],[-19,-.95,treatmentOut[2]],[-19,-.95,-80],[-19,6.6,-80],[-55,6.6,-80],[-55,2.3,-80],[-72,2.3,-80],[-72,2.3,-81.3]],'teal');
  liquidPath('工艺循环液过滤回槽',[[-68,2.3,-82.7],[-68,2.3,-84],[-55,2.3,-84],[-55,6.6,-84],[-19,6.6,-84],[-19,-1.2,-84],[-19,-1.2,treatmentIn[2]],[treatmentIn[0],-1.2,treatmentIn[2]],treatmentIn],'teal');
  // Clear-span portal supports keep the corridor and road free of low pipes or posts.
  for(const x of [-52,-32]){for(const z of [-87,-69]){box('Liquid bridge footing '+x+z,[x,.24,z],[1,.48,1],'alloy');box('Liquid bridge column '+x+z,[x,3.25,z],[.24,6,.24],'steel');}box('Liquid bridge crossbeam '+x,[x,6.15,-78],[.3,.32,18.5],'steel');}
  for(const z of [-86,-70])box('Liquid bridge longitudinal beam '+z,[-42,6.15,z],[22,.3,.18],'steel');
  for(const z of [-84,-80,-76,-72]){
   put('Liquid wall sleeve '+z,'sleeve',[-27.86,6.6,z],[.23,.17,.5],'alloy',false,'standard',{axis:[1,0,0]});
   for(const x of [-50,-38,-26]){ring('Liquid pipe clamp '+x+z,[x,6.6,z],.18,.025,'alloy',false,[1,0,0]);rod('Liquid clamp saddle '+x+z,[x,6.15,z],[x,6.39,z],.04,'steel');}
  }
  box('Circulation sidefilter skid',[-70,.5,-82],[7,.4,3],'steel');
  for(const x of [-72,-68]){cyl('Sidefilter body '+x,[x,1.8,-82],.7,2.4,'shell');cyl('Sidefilter flange '+x,[x,3.05,-82],.78,.14,'alloy');for(let k=0;k<8;k++){const t=k*Math.PI/4;cyl('Sidefilter bolt '+x+k,[x+.62*Math.cos(t),3.18,-82+.62*Math.sin(t)],.04,.12,'dark');}box('Sidefilter isolation valve '+x,[x,2.3,-81.2],[.3,.3,.3],'teal');ring('Sidefilter valve wheel '+x,[x,2.65,-81.2],.2,.035,'alloy',false,[0,1,0]);}
  rod('Sidefilter serial connection',[-72,1.1,-82],[-68,1.1,-82],.10,'teal');
  // Dedicated waste-liquid plant: bunded tanks, pump skids, treatment and residual handling.
  box('Waste plant impermeable pad',[-70,.16,-90],[34,.32,40],'floor');
  for(const x of [-86.5,-53.5])box('Waste bund side '+x,[x,.65,-90],[.35,.9,40],'shell');
  for(const z of [-109.5,-70.5])box('Waste bund end '+z,[-70,.65,z],[34,.9,.35],'shell');
  for(const [i,x,z,mat]of [[0,-59,-76,'waste'],[1,-59,-72,'clean'],[2,-79,-101,'clean'],[3,-66,-101,'waste']]){
   const n='Waste tank '+i;cyl(n+' body',[x,2.5,z],2,4,'shell');cyl(n+' roof',[x,4.55,z],2.1,.14,mat);cyl(n+' access hatch',[x,4.72,z],.5,.20,'alloy');
   for(const yy of [.65,4.1])ring(n+' strap '+yy,[x,yy,z],2.04,.055,'steel',false,[0,1,0]);
   for(const dx of [-1.3,1.3])for(const dz of [-1.3,1.3])box(n+' foot '+dx+dz,[x+dx,.5,z+dz],[.3,.7,.3],'steel');
   rod(n+' vent',[x+1,4.6,z],[x+1,5.3,z],.1,'steel');rod(n+' outlet',[x,1,z-2],[x,1,-87],.1,mat);
  }
  box('Treatment skid base',[-73,.55,-88],[15,.3,7],'steel');
  for(let i=0;i<4;i++){const x=-79+i*3.8;cyl('Treatment vessel '+i,[x,2.2,-88],1,3,'shell');cyl('Treatment vessel lid '+i,[x,3.76,-88],1.08,.15,'teal');ring('Treatment flange '+i,[x,3.65,-88],1.04,.07,'alloy',false,[0,1,0]);for(let k=0;k<8;k++){const t=k*Math.PI/4;cyl('Treatment bolt '+i+k,[x+.9*Math.cos(t),3.9,-88+.9*Math.sin(t)],.055,.12,'dark');}rod('Treatment manifold '+i,[x,1,-89],[x,1,-93],.10,'steel');}
  rod('Treatment common manifold',[-79,1,-93],[-60,1,-93],.13,'steel');
  for(let i=0;i<3;i++){const x=-80+i*7;box('Pump plinth '+i,[x,.55,-78],[4,.4,3],'alloy');cyl('Pump motor '+i,[x,1.3,-78],.5,1.8,'teal',false,[1,0,0]);for(let j=0;j<5;j++)cyl('Motor fin '+i+j,[x-.65+j*.3,1.3,-78],.55,.06,'steel',false,[1,0,0]);rod('Pump discharge '+i,[x,1.3,-79],[x,1.3,-87],.10,'steel');ring('Valve wheel '+i,[x,1.8,-82],.3,.05,'alloy',false,[0,1,0]);}
  box('Residual liquid enclosed store',[-81,1.5,-104],[7,2.5,5],'shell');box('Residual store lid',[-81,2.85,-104],[7.3,.18,5.3],'white');
  box('Waste monitoring cabinet',[-57,1.9,-101],[2,3,1.5],'white');box('Waste monitor display',[-57,2.3,-100.23],[1.3,.65,.04],'dark');
  for(let j=0;j<3;j++)cyl('Waste status lamp '+j,[-57.5+j*.5,1.7,-100.2],.1,.06,j?'yellow':'teal',false,[0,0,1]);
  // Service hall shares the exact same fading roof group and control state as production.
  // Envelope world x192..228,z-93..-50; all tanks, vents and the bridge clear the structure.
  box('Service hall foundation',[-70,.18,-89.5],[36,.36,43],'floor');
  box('Service hall roof',[-70,7.9,-89.5],[36,.24,43],'white',true);
  box('Service hall west wall',[-87.8,4.2,-89.5],[.24,7.2,42.6],'shell',true);
  box('Service hall north wall',[-70,4.2,-110.8],[35.6,7.2,.24],'shell',true);
  let end=-111;for(const z of [-84,-80,-76,-72]){const lo=z-.28,hi=z+.28;
   box('Service hall east wall span '+z,[-52.2,4.2,(end+lo)/2],[.24,7.2,lo-end],'shell',true);
   box('Service hall below inlet '+z,[-52.2,3.35,z],[.24,5.5,.56],'shell',true);
   box('Service hall above inlet '+z,[-52.2,7.45,z],[.24,.7,.56],'shell',true);
   put('Service hall inlet sleeve '+z,'sleeve',[-52.2,6.6,z],[.25,.18,.5],'alloy',true,'standard',{axis:[1,0,0]});end=hi;
  }box('Service hall east wall tail',[-52.2,4.2,(end-68)/2],[.24,7.2,-68-end],'shell',true);
  for(const x of [-81,-59])box('Service hall south wall '+x,[x,4.2,-68.2],[13.6,7.2,.24],'shell',true);
  box('Service hall door header',[-70,6.4,-68.2],[8.4,2.8,.3],'white',true);
  box('Service hall equipment shutter',[-70,2.75,-68.2],[8,4.4,.15],'steel',true);
  for(let j=0;j<18;j++)box('Service shutter slat '+j,[-70,.7+j*.24,-68.08],[7.9,.025,.04],'alloy',true,'high');
  for(const z of [-110,-97,-83,-69])for(const x of [-87,-53]){box('Service column '+x+z,[x,4.1,z],[.24,7.4,.24],'white',true);box('Service column shoe '+x+z,[x,.48,z],[.7,.26,.7],'alloy');}
  for(const z of [-110,-97,-83,-69])box('Service roof beam '+z,[-70,7.6,z],[35,.25,.2],'steel',true);
  for(const x of [-83,-57]){box('Service roof exhaust base '+x,[x,8.15,-96],[2,.25,2],'alloy',true);cyl('Service roof exhaust '+x,[x,8.65,-96],.65,.8,'steel',true);cyl('Service exhaust cowl '+x,[x,9.1,-96],.9,.16,'white',true);}
  for(const x of [-85,-55]){box('Service facade window '+x,[x,3.4,-68.02],[3,1.3,.035],'glass',true);box('Service window sill '+x,[x,2.71,-68],[3.2,.09,.16],'alloy',true);}
  box('Service entry apron',[-70,.1,-65],[10,.2,6],'floor');
  for(const p of out)if(p.name.startsWith('Service '))p.deviceKey='factorywaste';
  for(const part of out){if(/^(Waste |Treatment |Pump |Motor fin|Valve wheel|Residual )/.test(part.name))part.deviceKey='factorywaste';else if(/^Raw coil rack /.test(part.name))part.deviceKey='factoryraw';else if(/^(Finished reel pallet |Packing bench )/.test(part.name))part.deviceKey='factoryproduct';}
  return out;
 }
 function nativeBuild(){
  const old=window.NZ_DETAIL.models.factory;if(!old)throw Error('Factory device model missing');root=old.root;for(const child of root.children.slice()){child.visible=false;child.traverse(o=>o.visible=false);}const legacy=api.scene.getObjectByName('Scaled legacy factory');if(legacy)legacy.visible=false;
  root.position.set(hall.center[0],0,hall.center[1]);root.scale.set(1,1,1);old.x=hall.center[0];old.z=hall.center[1];root.userData.deviceKey='factory';root.userData.factoryHall={w:hall.w,d:hall.d};hero=new THREE.Group();hero.name='Shared horizontal wire factory hall';hero.userData.deviceKey='factory';root.add(hero);roofGroup=new THREE.Group();roofGroup.name='Shared factory roof and PV';hero.add(roofGroup);
  const highStatic=new THREE.Group(),highRoof=new THREE.Group();highStatic.name='Factory shared close detail';highRoof.name='Factory roof close detail';hero.add(highStatic);roofGroup.add(highRoof);fine.push(highStatic,highRoof);
  const rowDefs=hall.rows||fallback.rows,buckets=new Map(),dynamicBuckets=new Map(),dynamicNames=Object.keys(data.assemblies).filter(n=>n!=='fixed'&&n!=='roof');
  for(let i=0;i<rowDefs.length;i++){const row=rowDefs[i],center=row.center||[hall.center[0],row.z],g=new THREE.Group();g.name='Factory workcell '+(i+1);g.position.set(center[0]-hall.center[0],0,center[1]-hall.center[1]);g.rotation.y=row.rotationY||0;g.scale.setScalar(lineScale);g.userData.lineIndex=i;hero.add(g);g.updateMatrix();const record={root:g,groups:{},center:center.slice(),matrix:g.matrix.clone()};lines.push(record);for(const name of dynamicNames){const a=new THREE.Group();a.name='Factory row '+(i+1)+' assembly '+name;a.position.fromArray(data.assemblies[name]);g.add(a);const hi=new THREE.Group();hi.name='Factory close detail '+name;a.add(hi);fine.push(hi);a.userData.fine=hi;record.groups[name]=a;}}
  for(const p of data.parts){if(p.group==='roof')continue;if(p.group==='fixed')for(let i=0;i<lines.length;i++){const parent=p.tier==='high'?highStatic:hero,k='line-static:'+p.mat+':'+p.tier,matrix=lines[i].matrix.clone().multiply(oriented(p));addBucket(buckets,k,{...p,name:'Row '+(i+1)+' '+p.name},matrix,parent);}else addBucket(dynamicBuckets,p.group+':'+p.mat+':'+p.tier,p,oriented(p,data.assemblies[p.group]),null);}
  const dynamicMeshes=[];for(const b of dynamicBuckets.values()){const geom=merge(b.geometries);b.geometries.forEach(g=>g.dispose());const mesh=new THREE.InstancedMesh(geom,material(b.mat),lines.length);mesh.name='Factory instanced '+b.group+' '+b.mat;mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;(b.tier==='high'?highStatic:hero).add(mesh);instancedMotion.push({mesh,group:b.group});dynamicMeshes.push(mesh);}
  const architecture=hallParts();for(const p of architecture){const parent=p.roof?(p.tier==='high'?highRoof:roofGroup):(p.tier==='high'?highStatic:hero);addBucket(buckets,'hall:'+p.roof+':'+p.mat+':'+p.tier+':'+(p.deviceKey||'factory'),p,oriented(p),parent,p.roof);}
  const wireBuckets={wire:[],ceramic:[]};for(const segment of data.path.segments){const curve=new THREE.Curve();curve.getPoint=t=>new THREE.Vector3(...M.pointOn(segment,t));const source=new THREE.TubeGeometry(curve,segment.kind==='arc'?12:1,data.config.wireRadius,8,false),name=segment.b[0]<-2.1?'wire':'ceramic';for(const line of lines){const geom=source.index?source.toNonIndexed():source.clone();geom.applyMatrix4(line.matrix);wireBuckets[name].push(geom);}source.dispose();}
  let wireCount=0;for(const [name,list]of Object.entries(wireBuckets))if(list.length){const mesh=new THREE.Mesh(merge(list),material(name));mesh.name='Factory continuous '+name+' wires';hero.add(mesh);wireCount++;list.forEach(g=>g.dispose());}
  wasteFlows=new THREE.Group();wasteFlows.name='Selected wastewater flow schematic';wasteFlows.visible=false;hero.add(wasteFlows);
  for(const route of liquidPaths){
   const points=route.points.map(p=>new THREE.Vector3(...p)),curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:data.colors[route.mat],dashSize:1,gapSize:.6,depthWrite:false,transparent:true,opacity:.9}));line.computeLineDistances();line.name=route.id;wasteFlows.add(line);
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(36),3));const dots=new THREE.Points(geo,new THREE.PointsMaterial({color:data.colors[route.mat],size:5,sizeAttenuation:false,depthWrite:false}));dots.userData.curve=curve;dots.userData.liquidRoute=route.id;wasteFlows.add(dots);
  }
  const staticMeshes=emitBuckets(buckets),highlightGeo=new THREE.SphereGeometry(data.config.wireRadius*lineScale*1.22,6,4),highlightMat=new THREE.MeshStandardMaterial({color:0xf0eee2,roughness:.4,metalness:.25});glints=new THREE.InstancedMesh(highlightGeo,highlightMat,12*lines.length);glints.name='All row wire travel glints';glints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);hero.add(glints);
  const allMeshes=staticMeshes.concat(dynamicMeshes),uniqueGeometries=new Set(allMeshes.map(m=>m.geometry));buildStats={partCount:data.parts.length,displayedLineParts:data.parts.length*lines.length,hallPartCount:architecture.length,lineCount:lines.length,workcellFootprint:data.config.footprint.map(v=>v*lineScale),staticMeshBuckets:staticMeshes.length,dynamicMeshBuckets:dynamicBuckets.size,dynamicMeshes:dynamicMeshes.length,wireMeshes:wireCount,movingGlints:12*lines.length,meshCount:allMeshes.length+wireCount+1,uniqueGeometries:uniqueGeometries.size+wireCount+1,sharedDynamicGeometries:dynamicBuckets.size,preservedRoot:root.uuid,roofPVModules:architecture.filter(p=>p.type==='pvface').length};
  // Real meshes carry device tags across the entire hall. Keep the ground-hit fallback local.
  const pick=typeof DEVICES!=='undefined'?(Array.isArray(DEVICES)?DEVICES.find(d=>d.key==='factory'):DEVICES.factory):null;if(pick){pick.p=[hall.center[0],hall.h/2,hall.center[1]];pick.r=Math.min(18,Math.max(6,hall.w/4));}applyPose();
 }
 function applyRoof(){const a=Math.max(0,Math.min(1,state.roof));if(a===lastRoof)return;const closed=a<1e-6;roofGroup.visible=a<.99999;for(const m of Object.values(roofMaterials)){const b=m.userData.closed,transparent=closed?b.transparent:true,depthWrite=closed?b.depthWrite:false;if(m.transparent!==transparent||m.depthWrite!==depthWrite)m.needsUpdate=true;m.opacity=b.opacity*(1-a);m.transparent=transparent;m.depthWrite=depthWrite;}roofGroup.traverse(o=>{if(o.isMesh)o.castShadow=closed&&o.material!==roofMaterials.pv;});lastRoof=a;}
 function applyPose(){
  if(!hero)return;const p=M.pose(state,data);lastPose=p;for(const line of lines){for(const [name,g]of Object.entries(line.groups)){g.position.fromArray(data.assemblies[name]);const delta=p.movingTranslations?.[name];if(delta)g.position.add(new THREE.Vector3(...delta));}if(line.groups.payoutRotor)line.groups.payoutRotor.rotation.z=p.payoutAngle;if(line.groups.takeupRotor)line.groups.takeupRotor.rotation.z=p.takeupAngle;if(line.groups.traverse&&!p.movingTranslations)line.groups.traverse.position.z=(data.assemblies.traverse?.[2]||0)+p.traverse;for(const r of p.rollerAngles)if(line.groups[r.group])line.groups[r.group].rotation.z=r.angle;}
  for(const item of instancedMotion){for(let i=0;i<lines.length;i++){const group=lines[i].groups[item.group];group.updateMatrix();item.mesh.setMatrixAt(i,lines[i].matrix.clone().multiply(group.matrix));}item.mesh.instanceMatrix.needsUpdate=true;}
  const total=p.path.reduce((n,s)=>n+s.length,0),object=new THREE.Object3D();for(let i=0;i<lines.length;i++)for(let j=0;j<12;j++){object.position.fromArray(M.sample(p.path,(p.distance+j*total/12)%total)).applyMatrix4(lines[i].matrix);object.updateMatrix();glints.setMatrixAt(i*12+j,object.matrix);}glints.instanceMatrix.needsUpdate=true;for(const g of fine)g.visible=api.S.quality==='high';lastQuality=api.S.quality;applyRoof();
  wasteFlows.visible=state.mode==='waste'||!!saved;if(wasteFlows.visible)for(const dots of wasteFlows.children.filter(o=>o.isPoints)){const a=dots.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=dots.userData.curve.getPoint((i/a.count+state.distance*.025)%1);a.setXYZ(i,v.x,v.y,v.z);}a.needsUpdate=true;}

 }
 function paint(){if(!panel)return;const roof=panel.querySelector('[data-factory="roof"]');roof.textContent=state.open?'合上屋顶':'打开屋顶';roof.setAttribute('aria-pressed',String(state.open));for(const b of panel.querySelectorAll('[data-factory-mode]'))b.setAttribute('aria-pressed',String(b.dataset.factoryMode===state.mode));}
 function setOpen(open,options={}){const before=state.open,roof=state.roof;state.open=!!open;if(options.immediate||api?.S.reduceMotion)state.roof=Number(state.open);if(before!==state.open||roof!==state.roof){applyPose();paint();}return state.open;}
 function setMode(mode,options={}){if(!modes.includes(mode))mode='process';state.mode=mode;if(wasteFlows)wasteFlows.visible=mode==='waste'||!!saved;if(mode!=='overview')setOpen(true,options);if(api&&options.camera!==false){const v=views[mode];api.cancelCamera();api.camera.position.fromArray(v.pos);api.controls.target.fromArray(v.tgt);api.controls.update();}paint();return mode;}
 function snapshot(){return {open:state.open,roof:state.roof,mode:state.mode,distance:state.distance};}
 function restore(s){if(!s)return;state.open=!!s.open;state.roof=Math.max(0,Math.min(1,Number(s.roof)||0));state.mode=modes.includes(s.mode)?s.mode:'overview';state.distance=Math.max(0,Number(s.distance)||0);applyPose();paint();}
 function tour(cue){if(cue===null||cue===false){if(saved){const old=saved;saved=null;tourPaused=false;restore(old);}return;}if(!saved)saved=snapshot();const v=typeof cue==='string'?{mode:cue,open:true}:cue||{};tourPaused=!!v.paused;if(v.mode&&v.mode!==state.mode)setMode(v.mode,{camera:false});if(v.open!==undefined)setOpen(v.open);}
 function reset(){saved=null;tourPaused=false;M.reset(state);applyPose();paint();}
 function selection(key){selected=['factory','factoryraw','factoryproduct','factorywaste'].includes(key);if(panel)panel.hidden=!selected;if(key==='factorywaste')setMode('waste',{camera:false});if(key==='factoryraw')setMode('raw',{camera:false});if(key==='factoryproduct')setMode('packing',{camera:false});}
 function tick(dt){if(!hero)return;const roofMoving=Math.abs(state.roof-Number(state.open))>1e-5;culled=!selected&&!saved&&!roofMoving&&api.camera.position.distanceTo(root.position)>190;if(culled){if(lastQuality!==api.S.quality)applyPose();return;}const distance=state.distance,roof=state.roof;M.advance(state,dt,{paused:tourPaused,reducedMotion:api.S.reduceMotion,running:!!saved||api.S.running&&api.S.factory>0});if(distance!==state.distance||roof!==state.roof||lastQuality!==api.S.quality)applyPose();}
 function ready(a){
  if(api)return;api=a;THREE=a.THREE;nativeBuild();
  if(typeof INFO!=='undefined')INFO.factorywaste={t:'导线工厂 · 循环液与废液处理区',d:'工艺循环液过滤回槽；工艺废液与清洗废水分别收集，经调节与模块化处理后设置回用或外送接口。',from:'导线工艺槽排放支路 / 清洗排水',to:'分类暂存 → 调节与处理 → 回用或外送',p:[['边界','功能框架，水质与处理工艺待配置'],['配套','封闭处理车间、管桥、独立循环旁滤和分类收集设备'],['结构观察','与导线工厂共用开顶控制，屋面与上部围护同步渐隐'],['循环供回','线边循环保留；同液系旁滤后回槽'],['清洗回用','处理后回用接口待水质确认；工艺废液不直接回槽']],note:'不虚构药剂、处理效率或排放指标；不接雨水系统。'};
  if(typeof addLabel==='function'){const l=addLabel('factorywaste',[210,7,-72],'导线工厂 · 循环液与废液处理区','可见管廊 · 循环供回与分类收集','功能框架');l.el.dataset.key='factorywaste';l.el.tabIndex=0;l.el.setAttribute('role','button');l.el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();l.el.click();}});}

  if(typeof INFO!=='undefined'&&INFO.factory){const info=INFO.factory;info.t='西比里铝基新型导线智能工厂';info.d='共用长车间沿纵深布置两列十排半尺寸连续处理工位，铝线沿车间短边水平穿过放线、导向张力、电解液处理、清洗、牵引与收线。原料入库和成品包装位于同一厂房两端，侧边通道贯通全厂。';info.p=info.p.filter(r=>!['展示工艺','结构观察','运行边界'].includes(r[0]));info.p.push(['展示工艺','原料入库 → 二十条水平连续处理工位 → 成品包装出库'],['结构观察','共享屋顶、光伏和上部结构渐隐，展示工位、仓储和两侧通道'],['运行边界','沿用既有工厂调度；展示工位不另计产能、负荷或能耗']);info.note='工艺结构与运动为展示示意，工位重复不代表新增产能。工厂容量、计划、保安负荷与爬坡约束沿用原核算。';}
  if(typeof LABELS3D!=='undefined'&&LABELS3D.factory){const label=LABELS3D.factory;label.el.querySelector('.nm').textContent='西比里铝基新型导线智能工厂';label.el.setAttribute('aria-label','西比里铝基新型导线智能工厂');const pr=label.el.querySelector('.pr');if(pr)pr.textContent='原料入库 · 二十条水平工位 · 成品包装';}
  if(typeof document!=='undefined'&&document.createElement){panel=document.createElement('div');panel.id='factoryControls';panel.hidden=true;panel.innerHTML='<div class="detail-kicker">智能工厂 · 结构观察</div><p>两列十排半尺寸工位沿长车间排布；线材在每排内保持水平直线，原料与成品仓储共用厂房；西侧管桥连接循环液与废液处理配套。</p><div class="detail-buttons"><button data-factory="roof" aria-pressed="false">打开屋顶</button><button data-factory="reset">装配复位</button></div><div class="detail-buttons"><button data-factory-mode="overview">全厂总览</button><button data-factory-mode="process">中央工位</button><button data-factory-mode="raw">原料入库</button><button data-factory-mode="packing">成品包装</button><button data-factory-mode="waste">循环液与废液配套</button><button data-factory-mode="payout">放线与张力</button><button data-factory-mode="treatment">处理与清洗</button><button data-factory-mode="takeup">牵引与收线</button></div><small>二十条为结构展示，不新增核算容量或负荷。导览暂停时全部运动冻结。</small>';const mount=document.getElementById('detailControls');if(mount)mount.after(panel);panel.querySelector('[data-factory="roof"]').addEventListener('click',()=>{api.exitTour();setOpen(!state.open);});panel.querySelector('[data-factory="reset"]').addEventListener('click',()=>{api.exitTour();reset();});for(const b of panel.querySelectorAll('[data-factory-mode]'))b.addEventListener('click',()=>{api.exitTour();setMode(b.dataset.factoryMode);});paint();}
 }
 function audit(){return {...validation,liquidLinks:liquidPaths.map(r=>({id:r.id,points:r.points,mat:r.mat})),state:snapshot(),tourActive:!!saved,tourPaused,culled,build:buildStats,hall:{center:hall.center.slice(),w:hall.w,d:hall.d,h:hall.h},rows:lines.map(l=>({center:l.center.slice(),rotationY:l.root.rotation.y,assemblies:Object.fromEntries(Object.entries(l.groups).map(([n,g])=>[n,{position:g.position.toArray(),rotation:g.rotation.z}]))})),roof:{visible:roofGroup?.visible,materials:Object.fromEntries(Object.entries(roofMaterials).map(([n,m])=>[n,{opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,independent:m!==materials[n]}]))},views,pose:lastPose?{payoutAngle:lastPose.payoutAngle,takeupAngle:lastPose.takeupAngle,traverse:lastPose.traverse,reelTraverse:lastPose.reelTraverse,roof:lastPose.roof}:null,root:root?{uuid:root.uuid,key:root.userData.deviceKey,position:root.position.toArray(),scale:root.scale.toArray()}:null};}
 return {ready,tick,setOpen,setMode,selection,tour,reset,snapshot,restore,audit,data};
})();
