/* Engineering exhibition geometry. Capacities and simulation are unchanged. */
'use strict';
window.NZ_DETAIL=(function(){
  const C={shell:0xe3eae7,white:0xf1f4ef,steel:0x829b97,dark:0x334c4d,glass:0x749e9b,copper:0xba8847,blue:0x4e7f9e,teal:0x238e83,red:0xad6458};
  const models={},materials={},geometries={},buckets=new Map(),parts=[];
  let current=null,exploded=false,amount=0,api;
  function material(c){return materials[c]||(materials[c]=new THREE.MeshStandardMaterial({color:c,roughness:.65,metalness:c===C.copper?.35:.12}));}
  function group(parent,name){const g=new THREE.Group();g.name=name;parent.add(g);return g;}
  function shape(type,size,c,p,parent,rot=[0,0,0]){
    const k=type+':'+size.join(',');let geom=geometries[k];
    if(!geom)geom=geometries[k]=type==='box'?new THREE.BoxGeometry(...size):type==='cyl'?new THREE.CylinderGeometry(...size,20):new THREE.TorusGeometry(...size,8,24);
    const o=new THREE.Object3D();o.position.set(...p);o.rotation.set(...rot);o.updateMatrix();
    let byParent=buckets.get(parent);if(!byParent)buckets.set(parent,byParent=new Map());
    const key=k+':'+c;if(!byParent.has(key))byParent.set(key,{geom,mat:material(c),matrices:[]});byParent.get(key).matrices.push(o.matrix.clone());
  }
  const box=(w,h,d,c,x,y,z,g)=>shape('box',[w,h,d],c,[x,y,z],g);
  const cylinder=(r,h,c,x,y,z,g)=>shape('cyl',[r,r,h],c,[x,y,z],g);
  function rod(a,b,r,c,g){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=new THREE.Object3D();o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());const e=new THREE.Euler().setFromQuaternion(o.quaternion);shape('cyl',[r,r,new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))],c,o.position.toArray(),g,e.toArray().slice(0,3));}
  function ring(r,t,c,x,y,z,g,rot=[Math.PI/2,0,0]){shape('ring',[r,t],c,[x,y,z],g,rot);}
  function vent(x,y,z,w,h,g){box(w,h,.08,C.dark,x,y,z,g);for(let i=0;i<7;i++)box(w,.035,.11,C.steel,x,y-h/2+(i+.5)*h/7,z+.05,g);}
  function door(x,y,z,w,h,g){box(w,h,.09,C.white,x,y,z,g);box(.055,h,.13,C.steel,x-w/2,y,z+.04,g);box(.055,h,.13,C.steel,x+w/2,y,z+.04,g);box(w,.055,.13,C.steel,x,y+h/2,z+.04,g);box(.07,.35,.09,C.dark,x+w*.3,y,z+.1,g);}
  function bolts(x,y,z,w,h,g){for(const a of [-1,1])for(const b of [-1,1])shape('cyl',[.045,.045,.07],C.dark,[x+a*w/2,y+b*h/2,z],g,[Math.PI/2,0,0]);}
  function pad(x,z,w,d,g){box(w,.24,d,C.steel,x,.12,z,g);box(w-.3,.1,d-.3,C.white,x,.29,z,g);}
  function rail(x,z,w,d,y,g){for(const zz of [z-d/2,z+d/2]){for(const yy of [y+.4,y+.9])box(w,.06,.06,C.steel,x,yy,zz,g);for(let xx=x-w/2;xx<=x+w/2+.01;xx+=w/8)box(.06,1,.06,C.steel,xx,y+.5,zz,g);}for(const xx of [x-w/2,x+w/2]){box(.06,.06,d,C.steel,xx,y+.9,z,g);}}
  function ladder(x,z,h,g){for(const xx of [x-.24,x+.24])box(.065,h,.07,C.steel,xx,h/2,z,g);for(let yy=.35;yy<h;yy+=.35)box(.5,.055,.08,C.steel,x,yy,z,g);}
  function fan(x,y,z,r,g){cylinder(r,.12,C.dark,x,y,z,g);ring(r,.05,C.steel,x,y+.08,z,g);for(let i=0;i<4;i++){shape('box',[r*1.5,.04,.13],C.steel,[x,y+.09,z],g,[0,i*Math.PI/4,0]);}}
  function model(key,x,z){const root=group(scene,'Detailed '+key);root.userData.deviceKey=key==='ais'?'substation':key;root.position.set(x,0,z);const fine=group(root,'Close-range components');models[key]={root,fine,x,z};return models[key];}
  function removeBoxes(x,z,w,d,maxY=8){for(const o of scene.children.slice()){if(!o.isMesh||!o.geometry||!['BoxGeometry','CylinderGeometry'].includes(o.geometry.type)||o===socBar||o===h2Liquid||truckPool.includes(o)||beltBoxes.includes(o))continue;if(Math.abs(o.position.x-x)<w/2&&Math.abs(o.position.z-z)<d/2&&o.position.y<maxY)scene.remove(o);}}
  function movable(parent,name,offset){const g=group(parent,name);parts.push({g,offset:new THREE.Vector3(...offset),model:current});return g;}
  function transformerModel(key,x,z,rows){removeBoxes(x,z,8,rows===3?18:8,5);const m=model(key,x,z);current=key;pad(0,0,9,rows===3?18:8,m.root);
    for(let i=0;i<rows;i++){const zz=(i-(rows-1)/2)*5.5;
      const body=i===Math.floor(rows/2)?movable(m.root,'Tank and radiator shell',[0,5,0]):m.root;
      box(3.1,2.3,2.5,C.shell,0,1.6,zz,body);box(3.4,.18,2.8,C.steel,0,.55,zz,body);box(3.3,.18,2.7,C.white,0,2.85,zz,body);
      for(const xx of [-1.9,1.9]){for(let j=0;j<11;j++)box(.62,1.95,.095,C.steel,xx,1.65,zz-1.15+j*.23,body);rod([xx,.75,zz-1.25],[xx,.75,zz+1.25],.07,C.dark,body);rod([xx,2.55,zz-1.25],[xx,2.55,zz+1.25],.07,C.dark,body);}
      for(const xx of [-.95,0,.95]){cylinder(.12,.8,C.dark,xx,3.25,zz,body);for(let k=0;k<6;k++)cylinder(.22,.09,C.white,xx,2.94+k*.14,zz,body);cylinder(.07,.18,C.copper,xx,3.78,zz,body);}
      shape('cyl',[.38,.38,2.6],C.shell,[0,3.35,zz-.95],body,[0,0,Math.PI/2]);rod([1,2.85,zz],[1,3.35,zz-.95],.08,C.steel,body);
      box(.8,.8,.18,C.dark,.85,1.7,zz+1.34,body);box(.65,.65,.08,C.white,.85,1.7,zz+1.45,body);bolts(.85,1.7,zz+1.52,.5,.5,m.fine);
      if(i===Math.floor(rows/2)){const core=group(m.root,'Representative transformer core');box(2.3,1.5,.65,C.dark,0,1.5,zz,core);for(const xx of [-.8,0,.8]){cylinder(.34,1.2,C.copper,xx,1.55,zz+.4,core);for(let k=0;k<10;k++)ring(.35,.02,C.copper,xx,1+k*.12,zz+.4,m.fine);}}
    }
    for(const xx of [-3.4,3.4]){box(.7,1.8,.7,C.white,xx,1.25,0,m.root);vent(xx,1.3,.4,.5,.8,m.fine);}rail(0,0,9,rows===3?18:8,.35,m.fine);
  }
  function cabinet(key,x,z,w,h,d,explode){removeBoxes(x,z,w+.15,d+.15,h+.5);const m=model(key,x,z);current=key;pad(0,0,w+.8,d+.8,m.root);const originalRoot=m.root,charge=key==='panamaSc'||key==='panamaSc2';if(charge){m.conversion=group(originalRoot,'Existing isolation and rectifier section');m.root=m.conversion;m.conversion.add(m.fine);}box(w,.2,d,C.steel,0,.45,0,m.root);
    const shell=explode?movable(m.root,'Cabinet cover',[0,h+1,0]):m.root;
    box(w,.14,d,C.white,0,h+.5,0,shell);box(.12,h,d,C.shell,-w/2,h/2+.5,0,shell);box(.12,h,d,C.shell,w/2,h/2+.5,0,shell);box(w,h,.1,C.shell,0,h/2+.5,-d/2,shell);
    const front=explode?movable(m.root,'Front door',[0,0,d+1.2]):m.root;
    door(0,h/2+.5,d/2,w-.12,h-.1,front);vent(0,.9,d/2+.09,w*.75,.4,front);box(.45,.3,.08,C.dark,w*.2,h,d/2+.12,front);box(.3,.2,.04,C.teal,w*.2,h,d/2+.18,front);
    for(let j=0;j<5;j++){box(w-.35,.34,d-.3,C.dark,0,.8+j*(h-.5)/5,0,m.root);box(w-.5,.25,.08,C.steel,0,.8+j*(h-.5)/5,d/2-.1,m.fine);for(let k=0;k<6;k++)box(.04,.17,.04,C.copper,-w*.35+k*w*.14,.8+j*(h-.5)/5,d/2-.02,m.fine);}
    for(const xx of [-w*.3,w*.3])rod([xx,.4,-d/2],[xx,h,-d/2],.045,C.copper,m.fine);bolts(0,h+.55,d/2+.17,w*.8,.13,m.fine);if(charge){m.root=originalRoot;m.outputProtection=group(originalRoot,'Retained DC output protection');box(.65,1.65,1.25,C.shell,2.05,1.12,.8,m.outputProtection);box(.5,.5,.05,C.dark,2.05,1.5,1.46,m.outputProtection);box(.12,.15,.05,C.teal,2.05,1.55,1.5,m.outputProtection);box(.9,.2,1.6,C.steel,2.05,.2,.8,m.outputProtection);for(const side of [-1,1])rod([1.48,.65+side*.12,-1.2],[1.75,.65+side*.12,-1.2],.045,C.copper,m.outputProtection);}return m;
  }
  function storage(){removeBoxes(28,30,24,9,5);current='storage';return window.NZ_STORAGE.build({model,group,box,rod,cylinder,ring,shape,movable,C});}
  function building(key,x,z,w,h,d){const m=model(key,x,z);pad(0,0,w+1,d+1,m.root);
    for(let xx=-w/2;xx<=w/2;xx+=w/8){box(.16,h+.2,.2,C.white,xx,h/2,d/2+.12,m.root);box(.16,h+.2,.2,C.white,xx,h/2,-d/2-.12,m.root);}
    for(const zz of [-d/2,d/2]){box(w+.5,.2,.28,C.steel,0,h+.2,zz,m.root);box(w,.2,.16,C.steel,0,.55,zz+.1,m.root);}
    box(.2,.5,d,C.white,-w/2,h+.25,0,m.root);box(.2,.5,d,C.white,w/2,h+.25,0,m.root);
    const front=d/2+.22;
    for(const xx of [-w*.3,0,w*.3]){door(xx,1.35,front,Math.min(3,w/5),2.5,m.root);box(3.6,.14,1.5,C.steel,xx,2.8,front+.6,m.root);for(let j=0;j<9;j++)box(2.9,.035,.02,C.steel,xx,.22+j*.27,front+.07,m.fine);}
    for(let xx=-w/2+1;xx<w/2;xx+=2){box(1.45,.85,.08,C.glass,xx,h-.9,front,m.root);box(.035,.85,.04,C.white,xx,h-.9,front+.06,m.fine);}
    for(const xx of [-w*.27,w*.27]){box(2.2,.8,1.9,C.shell,xx,h+.7,0,m.root);fan(xx,h+1.14,0,.6,m.fine);vent(xx,h+.7,1,1.8,.5,m.fine);}
    ladder(w/2+.3,-d*.2,h+.6,m.fine);return m;
  }
  function dataBuilding(){const m=building('dc',134,-10,30,14.55,20);
    for(let f=0;f<4;f++)for(let j=0;j<10;j++){for(const zz of [-10.18,10.18]){box(2.5,2.5,.1,C.glass,-13.5+j*3,1.8+f*3.5,zz,m.root);box(.07,2.6,.16,C.white,-13.5+j*3,1.8+f*3.5,zz,m.fine);box(2.7,.07,.14,C.steel,-13.5+j*3,3.1+f*3.5,zz,m.fine);}}
    for(let j=0;j<6;j++)for(const xx of [-15.18,15.18]){box(.1,12.7,2.7,C.glass,xx,7,-8.5+j*3,m.root);box(.16,13,.08,C.white,xx,7,-8.5+j*3,m.fine);}
    rail(0,0,30,20,14.55,m.fine);
    for(let xx=-9;xx<=9;xx+=4.5){box(3.2,.8,2.5,C.shell,xx,15.15,4,m.root);fan(xx,15.62,4,.8,m.root);vent(xx,15.2,5.3,2.6,.5,m.fine);rod([xx,14.9,2.7],[xx,14.9,-3],.1,C.teal,m.root);}
    box(5,.22,3,C.steel,0,3.4,12,m.root);for(const xx of [-2.3,2.3])box(.15,3.3,.15,C.steel,xx,1.65,13,m.root);
  }
  function hydrogen(){const m=model('pem',16,66);pad(0,0,14,6,m.root);
    for(const xx of [-4,0,4]){door(xx,1.5,1.12,2.2,2.6,m.root);vent(xx,1,1.22,1.8,.55,m.fine);for(let j=0;j<10;j++)box(.09,1.8,.07,C.steel,xx-.8+j*.18,1.5,-1.1,m.fine);cylinder(.42,2.6,C.white,xx,1.7,-2.2,m.root);rod([xx,2.8,-2.2],[xx,2.8,0],.085,C.blue,m.root);ring(.12,.035,C.steel,xx,2.8,-1.4,m.fine,[0,0,0]);}
    rod([-5,3,-1.5],[5,3,-1.5],.1,C.blue,m.root);
    const tanks=model('h2tank',34,66);pad(0,0,13,6,tanks.root);
    for(const xx of [-4,0,4]){ring(1.72,.035,C.steel,xx,2.1,0,tanks.root);cylinder(.14,.8,C.steel,xx,3.85,0,tanks.root);rod([xx,4.2,0],[xx,4.2,-1.8],.08,C.blue,tanks.root);ring(.22,.03,C.teal,xx,4.2,-1.1,tanks.fine,[0,0,0]);ladder(xx+1.8,.2,3.6,tanks.fine);for(const dx of [-1,1])for(const dz of [-1,1]){box(.5,.16,.5,C.steel,xx+dx,.08,dz,tanks.root);bolts(xx+dx,.19,dz+.26,.28,.1,tanks.fine);}}
    rod([-4,4.2,-1.8],[4,4.2,-1.8],.1,C.blue,tanks.root);
    const tower=model('nh3',50,66);pad(0,0,8,6,tower.root);for(const yy of [2.3,5.2,7.2]){ring(1.82,.065,C.steel,0,yy,0,tower.root);box(4,.12,4,C.steel,0,yy,0,tower.root);rail(0,0,4,4,yy,tower.fine);}ladder(-2.05,.2,8,tower.root);rod([1.75,.5,-.7],[1.75,7.9,-.7],.12,C.teal,tower.root);for(const yy of [1.4,4,6.7]){rod([0,yy,0],[2.5,yy,0],.13,C.teal,tower.root);ring(.27,.06,C.steel,2.25,yy,0,tower.fine,[0,Math.PI/2,0]);}
    cabinet('fc',60,66,3.1,2.6,2.4,false);
  }
  function renewables(){const m=model('solar',-77,40);
    for(let r=0;r<9;r++)for(let c=0;c<22;c++){const x=-104+c*2.6+77,z=30+r*2.6-40;const g=group(m.fine,'PV cell and frame');g.position.set(x,.85,z);g.rotation.x=-.42;
      for(const xx of [-.95,.95])box(.04,.05,1.34,C.white,xx,.07,0,g);for(const zz of [-.65,.65])box(1.94,.05,.04,C.white,0,.07,zz,g);
      for(let j=1;j<6;j++)box(.016,.012,1.25,C.steel,-.95+j*1.9/6,.055,0,g);for(let j=1;j<4;j++)box(1.85,.012,.014,C.steel,0,.055,-.65+j*1.3/4,g);
      box(.6,.1,.4,C.steel,x,.1,z,m.root);rod([x-.7,.2,z-.2],[x-.7,.95,z+.3],.04,C.steel,m.root);
    }
    // v8: all PV equipment lives in the solar service belt; no legacy row cabinets.
    const wind=model('wind',-70,0);
    TURB_POS.forEach(([x,z],i)=>{const xx=x+70;pad(xx,z,2.4,2.4,wind.root);door(xx,1,z+.35,.45,1.1,wind.fine);for(const y of [3,6,8.6])ring(.25,.025,C.steel,xx,y,z,wind.fine);
      const rotor=rotors[i]; // v13 wind-product.js owns the sole nacelle enclosure.
      for(const blade of rotor.children){if(!blade.isGroup)continue;for(const o of blade.children.slice())blade.remove(o);const s=new THREE.Shape();s.moveTo(-.13,.3);s.lineTo(-.22,1);s.lineTo(-.14,2.5);s.lineTo(-.04,4);s.lineTo(.03,4.1);s.lineTo(.1,2.2);s.lineTo(.22,.65);s.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.015}),material(C.white));mesh.castShadow=true;blade.add(mesh);}
    });
  }
  function charging(){const P=window.NZ_MULTI_PLAN.charging,roof=P.canopy,m=model('supercharge',P.x,roof.z);
    removeBoxes(64,89,42,14,5);
    for(const o of scene.children.slice())if(o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.position.x===64&&o.position.z===89&&o.position.y>3.5&&o.position.y<4)scene.remove(o);
    box(40,.04,34,C.shell,0,.03,0,m.root);
    const canopy=group(m.root,'Unified photovoltaic charging canopy');
    // One shared, mipmapped cell texture; module boundaries remain geometry at every distance.
    const cells=document.createElement('canvas');cells.width=256;cells.height=512;
    const ctx=cells.getContext('2d');ctx.fillStyle='#111d2b';ctx.fillRect(0,0,256,512);
    for(let row=0;row<24;row++)for(let col=0;col<6;col++){
      const x=col*42+3,y=row*21+(row>=12?5:2),shade=(row*7+col*3)%5;
      ctx.fillStyle=['#24394f','#263c52','#283e54','#253a50','#293f55'][shade];ctx.fillRect(x,y,40,19);
      ctx.fillStyle='rgba(168,189,204,.13)';for(let k=1;k<4;k++)ctx.fillRect(x+k*10,y,1,19);
      ctx.fillStyle='rgba(177,197,209,.22)';ctx.fillRect(x,y+9,40,1);
    }
    const cellMap=new THREE.CanvasTexture(cells);cellMap.encoding=THREE.sRGBEncoding;cellMap.minFilter=THREE.LinearMipmapLinearFilter;cellMap.magFilter=THREE.LinearFilter;
    const panelMat=new THREE.MeshStandardMaterial({color:0xffffff,map:cellMap,roughness:.34,metalness:.08,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    const panels=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.12,2.30),panelMat,256);
    panels.name='Carport photovoltaic module glass';panels.receiveShadow=false;panels.material.polygonOffset=true;panels.material.polygonOffsetFactor=-1;panels.material.polygonOffsetUnits=-2;
    const modulePose=new THREE.Object3D();let moduleIndex=0;
    for(const dz of [-11,11]){
      box(roof.w,.16,10,C.dark,0,roof.h,dz,canopy);
      for(let row=0;row<4;row++)for(let col=0;col<32;col++){
        const x=(col-15.5)*1.17,z=dz+(row-1.5)*2.4;
        for(const dx of [-.56,.56])box(.03,.10,2.36,0xb0babd,x+dx,roof.h+.16,z,canopy);for(const dz of [-1.165,1.165])box(1.09,.10,.03,0xb0babd,x,roof.h+.16,z+dz,canopy);
        modulePose.position.set(x,roof.h+.23,z);modulePose.rotation.set(-Math.PI/2,0,0);modulePose.updateMatrix();panels.setMatrixAt(moduleIndex++,modulePose.matrix);
      }
      for(const z of [dz-5,dz+5])box(roof.w,.18,.09,C.white,0,roof.h,z,canopy);
      for(const x of [-roof.w/2,roof.w/2])box(.09,.18,10,C.white,x,roof.h,dz,canopy);
    }
    panels.instanceMatrix.needsUpdate=true;canopy.add(panels);
    // One connected structure with a daylight strip above the shared vehicle aisle.
    const daylight=new THREE.Mesh(new THREE.PlaneGeometry(37.6,11.8),new THREE.MeshStandardMaterial({color:0xc4e2df,transparent:true,opacity:.22,roughness:.25,metalness:.05,side:THREE.DoubleSide,depthWrite:false}));
    daylight.rotation.x=-Math.PI/2;daylight.position.set(0,roof.h+.08,0);daylight.name='Central daylight strip';canopy.add(daylight);
    for(const x of [-18,-12,-6,0,6,12,18])box(.14,.22,32,C.steel,x,roof.h-.22,0,canopy);
    for(const z of [-16,-6,6,16])box(38,.16,.15,C.white,0,roof.h+.02,z,canopy);
    for(const {x,z}of P.columns){box(.18,roof.h,.18,C.steel,x-P.x,roof.h/2,z-roof.z,canopy);box(.5,.2,.5,C.white,x-P.x,.15,z-roof.z,canopy);}
    P.rows.forEach((row,index)=>{const dz=row.z-roof.z,terminal=row.terminalZ-roof.z,direction=index===0?1:-1;
      box(38,.12,12,C.steel,0,.1,dz,m.root);
      for(let i=0;i<12;i++){const x=-16.5+i*3;
        if(index===0||i>=4)box(2.75,.02,7,C.teal,x,.175,dz,m.root);
        box(.65,2.1,.5,C.white,x,1.23,terminal,m.root);box(.43,.35,.06,C.dark,x,1.8,terminal+direction*.29,m.root);box(.28,.2,.07,C.teal,x,1.8,terminal+direction*.33,m.fine);
        // Gun docks and flexible leads are supplied by the vehicle connection adapter.
        if(index===0||i>=4)for(const dx of [-1.4,1.4])box(.06,.025,7,C.white,x+dx,.20,dz,m.root);
        if(index===0||i>=4)box(2.8,.025,.08,C.white,x,.20,dz-direction*3.5,m.root);
        for(const dx of [-.65,.65])cylinder(.085,.7,C.steel,x+dx,.5,terminal+direction*.55,m.root);
      }
      rod([-19,1,terminal],[18,1,terminal],.045,C.dark,m.root);
    });
    // Four south-row grids become one long bus bay, outside the central aisle.
    box(11.8,.025,3.5,C.teal,-12,.19,9,m.root);
    for(const z of [7.2,10.8])box(12,.025,.07,C.white,-12,.21,z,m.root);
    for(const x of [-18,-6])box(.07,.025,3.6,C.white,x,.21,9,m.root);

  }
  function industrial(){window.NZ_LAYOUT.zinc();
    building('factory',170,72,18,5,9);building('logistics',122,86,22,6.5,11);const fire=building('fire',178,28,16,6,9);box(16,.28,.15,C.red,0,4,4.8,fire.root);
    for(let j=0;j<18;j++)shape('cyl',[.15,.15,1.1],C.steel,[-8.5+j*.5,.92,6.6],models.factory.fine,[Math.PI/2,0,0]);
    for(const g of [armG,armJ]){shape('cyl',[.32,.32,.48],C.steel,[0,.3,0],g,[Math.PI/2,0,0]);box(.15,.4,.15,C.dark,.25,.6,0,g);}
    building('token',172,-10,9,4.5,7);
    cabinet('svgapf',102,30,4.8,3,3,false);const gen=cabinet('genset',124,32,6.2,3.2,3.4,false);cylinder(.26,3,C.steel,2.1,4,0,gen.root);ring(.3,.045,C.dark,2.1,5.5,0,gen.fine);vent(-1.5,2,1.82,1.9,1.8,gen.root);
    building('smr',-68.4,90,5.4,3,4.2);
    const line=model('line',48,-10);window.NZ_TOWERS.build(line);
  }
  function compile(){
    // PV panels share one component layer instead of hundreds of draw groups.
    for(const [parent,map] of [...buckets]){if(parent.name!=='PV cell and frame')continue;parent.updateMatrix();let target=buckets.get(parent.parent);if(!target)buckets.set(parent.parent,target=new Map());for(const [key,b] of map){if(!target.has(key))target.set(key,{geom:b.geom,mat:b.mat,matrices:[]});for(const matrix of b.matrices)target.get(key).matrices.push(parent.matrix.clone().multiply(matrix));}buckets.delete(parent);parent.parent.remove(parent);}
    let instances=0;
    for(const [parent,map] of buckets){const merged=new Map();for(const b of map.values()){
      instances+=b.matrices.length;
      if(b.matrices.length>=8){const mesh=new THREE.InstancedMesh(b.geom,b.mat,b.matrices.length);b.matrices.forEach((v,i)=>mesh.setMatrixAt(i,v));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=parent.name!=='Close-range components';mesh.receiveShadow=true;parent.add(mesh);}
      else {if(!merged.has(b.mat))merged.set(b.mat,[]);for(const matrix of b.matrices){const geom=b.geom.index?b.geom.toNonIndexed():b.geom.clone();geom.applyMatrix4(matrix);merged.get(b.mat).push(geom);}}
    }
      for(const [mat,list] of merged){const geom=new THREE.BufferGeometry();for(const attr of ['position','normal','uv']){const arrays=list.map(g=>g.attributes[attr]);const data=new Float32Array(arrays.reduce((n,a)=>n+a.array.length,0));let offset=0;for(const a of arrays){data.set(a.array,offset);offset+=a.array.length;}geom.setAttribute(attr,new THREE.BufferAttribute(data,arrays[0].itemSize));}geom.computeBoundingSphere();const mesh=new THREE.Mesh(geom,mat);mesh.castShadow=parent.name!=='Close-range components';mesh.receiveShadow=true;parent.add(mesh);list.forEach(g=>g.dispose());}
    }
    buckets.clear();console.log('[Detailed campus] components:',instances);return instances;
  }
  function init(){window.NZ_LAYOUT.setup({models,buckets,model,group,box,rod,cylinder,ring,door,vent,fan,pad,rail,shape,compile,C,cabinet});transformerModel('substation',10,-10,3);transformerModel('stepdown',92,-10,3);transformerModel('disttr',78,22,1);storage();dataBuilding();cabinet('panamaZn',144,66,3,3,4.4,true);cabinet('panamaSc',84,81,3,3,4.4,true);hydrogen();renewables();charging();industrial();window.NZ_LAYOUT.station();compile();current=null;
    const bus=model('bus',78,-10);for(const xx of [-2.2,0,2.2]){for(let j=0;j<8;j++)cylinder(.22,.1,C.white,xx,7+j*.14,0,bus.root);}compile();
  }
  function select(key){current=key;exploded=false;amount=0;for(const p of parts)p.g.position.set(0,0,0);const supported=parts.some(p=>p.model===key);const panel=document.getElementById('detailControls');if(panel){panel.hidden=key==='windNacelle';document.getElementById('detailExplode').hidden=!supported;document.getElementById('detailExplode').textContent='拆解组件';document.getElementById('detailCaption').textContent=supported?'观察外壳、功能组件与连接接口。':'近景可查看结构与接口细节。';}}
  function reset(){select(null);const p=document.getElementById('detailControls');if(p)p.hidden=true;}
  function update(){if(window.NZ_ENGINE.S.reduceMotion)amount=Number(exploded);else amount+=(Number(exploded)-amount)*.13;for(const p of parts)p.g.position.copy(p.offset).multiplyScalar(p.model===current?amount:0);for(const [key,m]of Object.entries(models))m.fine.visible=(!m.fine.userData.qualityOnly||S.quality==='high')&&(key===current||camera.position.distanceTo(new THREE.Vector3(m.x,3,m.z))<125);}
  function closeView(){const m=models[current];if(!m)return;api.cancelCamera();if(current==='storage'&&exploded){camera.position.set(56,17,72);controls.target.set(35.5,2.8,46.5);controls.update();return;}const layout=window.NZ_LAYOUT.focus(current);if(layout){camera.position.set(...layout.pos);controls.target.set(...layout.tgt);controls.update();return;}const size=current==='dc'?50:['solar','wind'].includes(current)?70:['factory','logistics','supercharge'].includes(current)?30:current==='storage'?25:['substation','stepdown','nh3'].includes(current)?22:16;const y=current==='dc'?8:current==='nh3'?4.5:3;camera.position.set(m.x+size*(current==='panamaDc'?-.85:.7),y+size*.55,m.z+size);controls.target.set(m.x,y,m.z);controls.update();}
  function ready(a){api=a;const panel=document.createElement('div');panel.id='detailControls';panel.hidden=true;panel.innerHTML='<div class="detail-kicker">结构观察 · 展示比例</div><p id="detailCaption"></p><div class="detail-buttons"><button id="detailCloseView">近景细节</button><button id="detailExplode">拆解组件</button></div><small>代表性组件示意；容量与运行参数沿用原模型。</small>';
    document.getElementById('infoDesc').after(panel);document.getElementById('detailCloseView').addEventListener('click',()=>{api.exitTour();closeView();});document.getElementById('detailExplode').addEventListener('click',()=>{api.exitTour();exploded=!exploded;closeView();document.getElementById('detailExplode').textContent=exploded?'装配复位':'拆解组件';document.getElementById('detailCaption').textContent=exploded?(current==='storage'?'上移箱体、前移柜门，显示电池模组、汇流与消防管路。':current.startsWith('panama')?'上移外壳、前移柜门，显示功率模块与母排接口。':'上移油箱外壳，显示代表性铁芯与绕组。'):'观察外壳、功能组件与连接接口。';});
  }
  return {init,select,reset,update,ready,models};
})();
