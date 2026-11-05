/* Integration regression: the campus contains light sprites before vehicles boot.
 * Uses bundled Three.js in Node, without a browser or WebGL renderer. */
'use strict';
const assert=require('assert/strict'),fs=require('fs'),THREE=require('../src/three.js');
const {make}=require('./vehicles-native.test.cjs');
let spritesTested=0,nonSolidTested=0,hiddenTested=0;
const f=make(true,(scene,T)=>{
 // Sun/moon glow sprites use this actual scene material type. Camera-less
 // terrain probes used to enter Sprite.raycast and throw during application boot.
 for(const name of ['Sun glow','Moon glow','Data direction marker']){
  const sprite=new T.Sprite(new T.SpriteMaterial({transparent:true,depthWrite:false}));
  sprite.name=name;const native=sprite.raycast;
  sprite.raycast=function(...args){spritesTested++;return native.apply(this,args);};
  scene.add(sprite);
 }
 const particles=new T.Points(new T.BufferGeometry(),new T.PointsMaterial());
 particles.raycast=()=>{nonSolidTested++;};scene.add(particles);
 const line=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial());
 line.raycast=()=>{nonSolidTested++;};scene.add(line);
 const hidden=new T.Group();hidden.visible=false;
 const mesh=new T.Mesh(new T.BoxGeometry(2,.1,2),new T.MeshBasicMaterial());
 mesh.raycast=()=>{hiddenTested++;};hidden.add(mesh);scene.add(hidden);
});
assert.equal(spritesTested,0,'Ground queries must not raycast billboard sprites');
assert.equal(nonSolidTested,0,'Ground queries must ignore particles and lines');
assert.equal(hiddenTested,0,'Hidden ancestor geometry must be excluded before intersection');
assert.equal(f.V.audit().vehicles.length,23);
assert.equal(f.V.audit().routes.length,9);
assert(f.nodes.get('vehicleCard'));
const a=f.V.audit();
assert(Math.abs(a.vehicles.find(v=>v.id==='charge-N01').p[1]-.189)<1e-5);
assert(Math.abs(a.vehicles.find(v=>v.id==='park-0-2').p[1]-.159)<1e-5);
f.V.tick(1);assert.equal(f.S.sc,7.2);
fs.writeFileSync('evidence/v20-vehicles-startup.json',JSON.stringify({passed:true,checks:3,spritesTested,nonSolidTested,hiddenTested,vehicles:a.vehicles.length,chargingConnections:a.routes.length,browserVerified:false,note:'Native Three.js initialization regression with campus sprite and particle object types; not a full browser startup or pixel test.'},null,2));
console.log('PASS vehicle initialization completes with existing campus light sprites');
console.log('PASS terrain probes exclude billboards, particles, lines and hidden geometry');
console.log('PASS vehicles retain pavement height, charge connections and energy state');
