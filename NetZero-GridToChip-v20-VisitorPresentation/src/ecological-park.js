/* Reception landscape, display coordinates only. No energy or carbon accounting. */
'use strict';
window.NZ_PARK=(function(){
 const P=window.NZ_RENEWABLE_PLAN,h=P.height,root=new THREE.Group(),base=new THREE.Group(),detail=new THREE.Group(),micro=new THREE.Group();root.name='Campus ecological park';base.name='Park shared landscape';detail.name='Park standard furnishings';micro.name='Park refined details';root.add(base,detail,micro);scene.add(root);
 const bounds={x0:-194,x1:66,z0:-292,z1:-60},buckets=new Map(),fixtures=[],trees=[],paths=[],zones=[],flowerBeds=[],lampMaterials=[];
 const C={grass:0x96ae8a,path:0xd3d6c4,edge:0xbecbb3,leaf:0x759478,leaf2:0x8ba17f,bark:0x887f6a,steel:0x6c8580,wood:0xb7a68b,light:0xeee6ca};
 const geos={box:new THREE.BoxGeometry(1,1,1),trunk:new THREE.CylinderGeometry(1,1,1,8),crown:new THREE.IcosahedronGeometry(1,1)},mats=new Map();
 function put(type,size,color,x,y,z,fine=false,rotation=0){const small=fine&&Math.max(...size)<.8,key=[type,color,fine,small].join(':');if(!buckets.has(key)){const material=new THREE.MeshStandardMaterial({color,roughness:type==='trunk'?.8:.9});mats.set(key,material);buckets.set(key,{type,fine,small,material,matrices:[]});}const o=new THREE.Object3D();o.position.set(x,y,z);o.rotation.y=rotation;o.scale.set(...size);o.updateMatrix();buckets.get(key).matrices.push(o.matrix.clone());}
 function surface(points,width,name,color=C.path){const vertices=[],indices=[];for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1;for(const side of [-1,1]){const x=p[0]-(b[1]-a[1])/d*width*.5*side,z=p[1]+(b[0]-a[0])/d*width*.5*side;vertices.push(x,h(x,z)+.15,z);}if(i){const k=i*2;indices.push(k-2,k-1,k,k-1,k+1,k);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:1}));m.name=name;m.receiveShadow=true;base.add(m);
 }
 function path(pts,width,name){const samples=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));for(let j=1;j<=n;j++)samples.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}paths.push({name,pts,width});surface(samples,width,name);}
 const outline=[[55,-92],[55,-72],[-146,-72],[-178,-92],[-178,-138],[-148,-142],[-100,-140],[-48,-148],[-43,-230],[-153,-241],[-178,-238],[-157,-268],[40,-268],[56,-248],[55,-92]];
 path(outline,3,'Park continuous walking loop');path([[74,-92],[64,-92],[53,-92]],3.4,'Park entrance connected to regional road');path([[55,-148],[-28,-136],[-80,-134],[-157,-140],[-178,-138]],2.8,'Park northern garden connector');
 path([[56,-228],[-28,-242],[-90,-246],[-170,-235],[-178,-238]],2.8,'Park southern meadow connector');
 path([[74,-236],[64,-236],[56,-236]],3,'Park secondary entrance');
 path([[20,-143],[20,-202],[55,-220]],2.6,'Park crosswalk to rest node');
 path([[-28,-136],[-58,-112],[-65,-102],[-100,-86],[-156,-85]],2.2,'Park rain garden promenade');
 // Dense ground grid follows the same rendered terrain surface, including the shoulder at the west edge.
 const verts=[],idx=[],nx=130,nz=116,dx=260/nx,dz=232/nz;
 function inLawn(x,z){const cx=Math.max(-182,Math.min(54,x)),cz=Math.max(-280,Math.min(-72,z));if(Math.hypot(x-cx,z-cz)>12)return false;
  if(P.sites.some(s=>Math.hypot(x-s.x,z-s.z)<21))return false;
  for(const road of P.roads)for(let i=1;i<road.pts.length;i++)if(distanceSegment(x,z,road.pts[i-1],road.pts[i])<road.width/2+1.3)return false;return true;}
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=-194+i*dx,z=-292+j*dz;verts.push(x,h(x,z)+.06,z);}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=-194+(i+.5)*dx,z=-292+(j+.5)*dz;if(!inLawn(x,z))continue;const k=j*(nx+1)+i;idx.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
 const lawnG=new THREE.BufferGeometry();lawnG.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));lawnG.setIndex(idx);lawnG.computeVertexNormals();const lawn=new THREE.Mesh(lawnG,new THREE.MeshStandardMaterial({color:C.grass,roughness:1}));lawn.name='Park open central meadow';lawn.receiveShadow=true;base.add(lawn);
 function distanceSegment(x,z,a,b){const vx=b[0]-a[0],vz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1)));return Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t);}
 function clear(x,z,r){if(x-r<bounds.x0||x+r>bounds.x1||z-r<bounds.z0||z+r>bounds.z1)return false;
  if(P.sites.some(s=>Math.hypot(x-s.x,z-s.z)<P.rotorDiameter/2+r+25))return false;
  const roads=P.roads.concat(paths.map(p=>({...p,zone:'park'})));for(const road of roads)for(let i=1;i<road.pts.length;i++)if(distanceSegment(x,z,road.pts[i-1],road.pts[i])<road.width/2+r+1)return false;
  return true;
 }
 const meadow={x0:-125,x1:-25,z0:-128,z1:-91};
 zones.push({name:'Central open meadow',...meadow},{name:'Western shade groves',x0:-188,x1:-148,z0:-260,z1:-100},{name:'Entrance flower gardens',x0:30,x1:64,z0:-115,z1:-78},{name:'Rain garden and dry creek',x0:-101,x1:-51,z0:-113,z1:-79},{name:'Rest plaza',x0:9,x1:35,z0:-190,z1:-164},{name:'Light exercise garden',x0:9,x1:35,z0:-227,z1:-205},{name:'Southern viewing garden',x0:-169,x1:-143,z0:-234,z1:-216});
 function reserved(x,z,r){return zones.some(q=>q.name!=='Western shade groves'&&x+r>q.x0&&x-r<q.x1&&z+r>q.z0&&z-r<q.z1);}
 function tree(x,z,k){const r=2.8+(k%3)*.35;if(!clear(x,z,r)||reserved(x,z,r)||trees.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+r+.7))return;const y=h(x,z),height=5.8+(k%4)*.45;put('trunk',[.19,height*.72,.19],C.bark,x,y+height*.36,z);put('crown',[r,height*.38,r*.88],k%2?C.leaf:C.leaf2,x,y+height*.77,z);put('crown',[r*.7,height*.25,r*.68],k%2?C.leaf2:C.leaf,x+.7,y+height*.94,z-.4);trees.push({x,z,r,height});}
 // Broad edge groves and small internal stands; deterministic jitter avoids a plantation grid.
 for(let row=0;row<24;row++)for(let col=0;col<27;col++){
  const k=row*27+col,x=-186+col*9+(Math.sin(k*2.7)*2.2),z=-283+row*9.2+Math.cos(k*1.9)*2;
  const edge=x<-143||x>41||z<-259||z>-84;
  const stand=(x<-126&&z>-219&&z<-152)||(x>0&&x<43&&z>-256&&z<-234);
  if(edge||stand)tree(x,z,k);
 }
 for(let i=0;i<145;i++){const side=i%4,x=side===0?-188:side===1?61:-180+(i%27)*8.7,z=side<2?-278+Math.floor(i/4)*5.6:side===2?-284:-66;if(!clear(x,z,.8)||reserved(x,z,.8))continue;put('crown',[.9,.65,.8],i%3?C.leaf2:C.leaf,x,h(x,z)+.65,z);}
 function bench(x,z,rot,y=h(x,z)){for(const dx of [-1.2,1.2])put('box',[.13,.8,.75],C.steel,x+dx,y+.4,z,true);for(let i=0;i<4;i++)put('box',[3,.08,.16],C.wood,x,y+.85,z-.3+i*.2,true,rot);for(const dx of [-1.2,1.2])put('box',[.12,1.4,.12],C.steel,x+dx,y+.9,z+.48,true);for(let i=0;i<3;i++)put('box',[3,.13,.08],C.wood,x,y+1.1+i*.2,z+.48,true,rot);fixtures.push({type:'bench',x,z});}
 for(const [x,z]of [[13,-170],[31,-170],[13,-185],[31,-185],[43,-255],[-165,-110],[40,-103],[13,-214],[31,-214]])bench(x,z,0);
 // A single ordinary pergola and small platform; no additional dark photovoltaic roof.
 const px=22,pz=-179,py=h(px,pz);put('box',[14,.18,9],C.path,px,py+.12,pz,true);
 for(const x of [px-6,px+6])for(const z of [pz-3.5,pz+3.5])put('box',[.22,3.6,.22],C.steel,x,h(x,z)+1.8,z,true);
 for(const x of [px-6,px+6])put('box',[.24,.2,8],C.steel,x,py+3.55,pz,true);
 for(let i=0;i<9;i++)put('box',[13,.15,.22],C.wood,px,py+3.7,pz-3.5+i*.875,true);fixtures.push({type:'pergola',x:px,z:pz});
 for(const [x,z]of [[60,-96],[60,-149],[60,-205],[50,-260],[-50,-274],[-145,-273],[-184,-214],[-184,-143],[-154,-78],[-60,-78],[20,-169],[20,-207],[-65,-131]]){const y=h(x,z);put('trunk',[.065,3.3,.065],C.steel,x,y+1.65,z,true);put('box',[.6,.14,.4],C.light,x,y+3.35,z,true);fixtures.push({type:'lamp',x,z});}

 // Compact plazas and a coherent set of service details.
 function pad(cx,cz,w,d,name,color=C.path){const pts=[];for(let i=0;i<=Math.ceil(d);i++)pts.push([cx,cz-d/2+i*d/Math.ceil(d)]);surface(pts,w,name,color);}
 pad(53,-92,15,15,'Park entry plaza');pad(22,-179,26,22,'Park shaded rest plaza');pad(22,-216,26,20,'Park exercise surface',0xb2bfa7);
 for(const [x,z]of [[59,-91],[60,-238],[30,-169]]){
  const y=h(x,z);put('box',[.14,2.7,.14],C.steel,x,y+1.35,z,true);put('box',[2.5,.9,.10],C.wood,x,y+2.25,z,true);
  for(let j=0;j<3;j++)put('box',[1.9-j*.18,.035,.025],C.steel,x-.1,y+2.48-j*.19,z+.067,true);
  fixtures.push({type:'wayfinding',x,z});
 }
 for(const [x,z]of [[60,-98],[31,-186],[31,-223]]){const y=h(x,z);for(let j=0;j<3;j++){put('box',[.62,.95,.65],j===0?C.wood:C.steel,x+j*.75,y+.5,z,true);put('box',[.58,.1,.61],C.wood,x+j*.75,y+1.02,z,true);}fixtures.push({type:'sortedBins',x,z});}
 {const x=12,z=-185,y=h(x,z);put('box',[.5,1.1,.5],C.steel,x,y+.55,z,true);put('box',[.8,.12,.65],C.wood,x,y+1.15,z,true);put('trunk',[.04,.2,.04],C.steel,x+.2,y+1.28,z,true);fixtures.push({type:'drinkingPoint',x,z});}
 // Flower borders, small bed edges and ornamental grass tufts read as planted drifts.
 for(const [cx,cz,w,d]of [[39,-103,17,6],[45,-81,18,5],[7,-178,3,20],[37,-178,3,20],[-162,-108,9,5],[-153,-244,13,5]]){
  flowerBeds.push({cx,cz,w,d});pad(cx,cz,w,d,'Park flowerbed soil',0xa4a68b);
  for(let i=0;i<Math.floor(w*d/1.8);i++){const x=cx-w/2+.5+((i*1.37)%Math.max(1,w-1)),z=cz-d/2+.5+((i*2.11)%Math.max(1,d-1));if(!clear(x,z,.3))continue;put('crown',[.45,.27,.4],C.leaf,x,h(x,z)+.28,z);put('crown',[.24,.17,.23],[0xc6bd9b,0xb9b9aa,0xacb795][i%3],x,h(x,z)+.58,z,true);}
  fixtures.push({type:'flowerBorder',x:cx,z:cz});
 }
 // Dry rain garden: no industrial fluid connection or modeled water balance.
 pad(-73,-94,24,15,'Park rain garden gravel',0xb6bbad);
 const creek=[[-57,-109],[-62,-102],[-75,-98],[-84,-91],[-98,-86]],creekSamples=[];
 for(let i=1;i<creek.length;i++){const a=creek[i-1],b=creek[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));for(let j=0;j<n;j++)creekSamples.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}creekSamples.push(creek.at(-1));surface(creekSamples,3.7,'Park shallow dry creek',0xa1ada7);
 for(let i=0;i<creekSamples.length;i+=2){const [x,z]=creekSamples[i];for(const side of [-1,1]){put('crown',[.5,.23,.37],0xbcc0b4,x+side*2.1,h(x+side*2.1,z)+.24,z,true);if(i%6===0)for(let k=0;k<3;k++)put('box',[.05,.7+k*.12,.07],C.leaf,x+side*3+k*.2,h(x+side*3,z)+.35,z,true);}}
 fixtures.push({type:'rainGarden',x:-73,z:-94});
 // A small raised footbridge is a spur from the promenade, with actual deck supports.
 path([[-65,-102],[-86,-102],[-86,-94],[-84.5,-94]],1.8,'Park rain garden bridge approach');path([[-77.5,-94],[-65,-94],[-65,-102]],1.8,'Park rain garden bridge return');
 const bridgeY=Math.max(h(-84.5,-94),h(-77.5,-94))+1.0;
 for(let j=0;j<12;j++)put('box',[.54,.15,2.1],C.wood,-84.5+j*.64,bridgeY,-94,true);
 for(const x of [-84.5,-77.5])for(const z of [-95,-93]){const ground=h(x,z);put('box',[.14,bridgeY-ground+1,.14],C.steel,x,ground+(bridgeY-ground+1)/2,z,true);}
 for(const z of [-95,-93])put('box',[7.5,.1,.1],C.wood,-81,bridgeY+1,z,true);
 for(let i=0;i<3;i++)for(const side of [-1,1]){const x=side<0?-86+i*.5:-77+i*.5,ground=h(x,-94),top=ground+(bridgeY-ground)*(side<0?(i+1)/3:(3-i)/3);put('box',[.5,Math.max(.12,top-ground),2.1],C.wood,x,ground+Math.max(.12,top-ground)/2,-94,true);}fixtures.push({type:'footbridge',x:-81,z:-94});
 // Light exercise stations: stretch bars, step blocks and a low balance rail.
 for(const x of [17,22,27]){const z=-214,y=h(x,z);for(const dx of [-1,1])put('trunk',[.08,2.1,.08],C.steel,x+dx,y+1.05,z,true);put('box',[2.2,.1,.1],C.wood,x,y+2.1,z,true);put('box',[1.4,.3,.7],C.wood,x,y+.15,z+3,true);}fixtures.push({type:'exercise',x:22,z:-214});
 // Viewing deck supports follow the hill shoulder independently.
 const vx=-156,vz=-225,vy=Math.max(...[-6,6].flatMap(dx=>[-4,4].map(dz=>h(vx+dx,vz+dz))))+.7;
 put('box',[14,.2,10],C.wood,vx,vy,vz,true);for(const dx of [-6,6])for(const dz of [-4,4]){const ground=h(vx+dx,vz+dz);put('box',[.2,vy-ground,.2],C.steel,vx+dx,ground+(vy-ground)/2,vz+dz,true);}
 bench(-155,-224,0,vy+.1);fixtures.push({type:'viewingDeck',x:vx,z:vz});
 path([[-153,-241],[-164,-234],[-164,-225]],2,'Park viewing deck approach');
 for(let i=0;i<5;i++){const x=-165+i*.5,ground=h(x,vz),top=ground+(vy-ground)*(i+1)/5;put('box',[.5,Math.max(.12,top-ground),2.5],C.wood,x,ground+Math.max(.12,top-ground)/2,vz,true);}

 for(const b of buckets.values()){const mesh=new THREE.InstancedMesh(geos[b.type],b.material,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.name='Park instances '+b.type;mesh.castShadow=true;mesh.receiveShadow=true;(b.small?micro:b.fine?detail:base).add(mesh);if(b.material.color.getHex()===C.light)lampMaterials.push(b.material);}
 function setQuality(q){detail.visible=q!=='compat';micro.visible=q==='high';base.visible=true;}
 function update(night){lampMaterials.forEach(m=>{m.emissive.setHex(C.light);m.emissiveIntensity=night?1.6:0;});}
 function audit(){return {bounds,zones,flowerBeds,meadow,approximateArea:(bounds.x1-bounds.x0)*(bounds.z1-bounds.z0),trees:trees.map(t=>({...t})),paths,fixtures,instanceBuckets:buckets.size,detailVisible:micro.visible,standardFurnishingsVisible:detail.visible,openMeadow:true,terrainDraped:true,energyAccounting:false};}
 setQuality(window.NZ_ENGINE.S.quality);return {setQuality,update,audit,root};
})();
