'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Vehicle upgrade anchor: '+a);return s.replace(a,()=>b);}
module.exports=function upgrade(name,source){
 if(name==='vehicle-model.js')return read('model.js');
 if(name!=='vehicles-anatomy.js')return source;
 let code=source,start=code.indexOf(' function geom(p)'),end=code.indexOf(' function merge(gs)',start);
 if(start<0||end<0)throw Error('Missing vehicle geometry adapter');
 code=code.slice(0,start)+read('geometry.js')+'\n'+code.slice(end);
 code=once(code,"if(p.type!=='loft'&&p.type!=='rod')","if(!['hull','panel','rod'].includes(p.type))");
 // Opaque glazing uses the existing reflection environment, not transmission passes.
 code=once(code,'glass:0x2c464e','glass:0x526c77');
 code=once(code,'cargo:0x77978f','cargo:0xb5c3bd,amber:0xc68535');
 // Cull fine geometry per instance bucket, not by one global charging-area switch.
 code=once(code,"m.frustumCulled=false;(b.tier==='fine'?fine:base).add(m);","m.frustumCulled=true;m.computeBoundingSphere?.();m.userData.vehicleTier=b.tier;m.userData.vehiclePositions=b.ids.map(id=>vehicles.find(v=>v.id===id).p);(b.tier==='fine'?fine:base).add(m);");
 const old="const close=api.camera.position.distanceTo(new T.Vector3(64,1,98))<150||api.camera.position.distanceTo(new T.Vector3(55,1,131))<120||api.camera.position.distanceTo(new T.Vector3(144,1,-60))<100;fine.visible=api.S.quality==='high'||api.S.quality!=='compat'&&close;";
 code=once(code,old,"const limit=api.S.quality==='high'?95:55,eye=api.camera.position;for(const mesh of fine.children){mesh.visible=api.S.quality!=='compat'&&mesh.userData.vehiclePositions.some(p=>(eye.x-p[0])**2+(eye.y-p[1])**2+(eye.z-p[2])**2<limit*limit);}fine.visible=fine.children.some(mesh=>mesh.visible);");
 return code;
};
