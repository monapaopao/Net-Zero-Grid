const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const fixture=`<script>
(function(){
const a=window.__NZ_TEST;a.S.running=false;a.S.simTime=12*3600;a.cancelCamera();
a.camera.position.set(355,305,405);a.controls.target.set(10,0,40);a.camera.fov=34;a.camera.updateProjectionMatrix();a.controls.update();
const records={version:a.cfg.version};
function boxOf(root){const b=new THREE.Box3();root.updateMatrixWorld(true);root.traverse(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();if(o.isInstancedMesh){for(let i=0;i<o.count;i++){const m=new THREE.Matrix4();o.getMatrixAt(i,m);b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().multiply(m)));}}else b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});return b;}
const dc=a.scene.getObjectByName('Detailed dc');records.dataBuilding={position:dc.position.toArray(),scale:dc.scale.toArray(),bounds:boxOf(dc).getSize(new THREE.Vector3()).toArray()};
if(window.NZ_LAYOUT){
const workshop=a.scene.getObjectByName('Detailed metal');const room=a.scene.getObjectByName('Indoor process equipment');const supply=a.scene.getObjectByName('Detailed panamaZn');
const enclosure=new THREE.Box3(new THREE.Vector3(106,-.01,66),new THREE.Vector3(146,7.8,86));
records.rectifierBounds={min:boxOf(supply).min.toArray(),max:boxOf(supply).max.toArray()};records.indoorProcess=enclosure.containsBox(boxOf(room));records.indoorRectifier=enclosure.containsBox(boxOf(supply));
records.closedWorkshop=window.NZ_LAYOUT.mode()==='closed'&&a.scene.getObjectByName('Workshop roof').visible&&!room.visible&&!supply.visible;
records.exteriorDataRectifierLabels=document.querySelectorAll('[data-key="panamaDc"]').length;
records.turbines=rotors.map(r=>({hub:r.parent.position.toArray(),scale:r.parent.scale.toArray()}));
records.minTurbineDistance=Math.min(...TURB_POS.flatMap((p,i)=>TURB_POS.slice(i+1).map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))));
records.rotorDiameter=8.2*rotors[0].parent.scale.x;
records.buildings={};for(const [key,dimensions]of [['factory',[18,5,9]],['logistics',[22,6,11]],['fire',[16,5.5,9]]]){const root=a.scene.getObjectByName('Scaled legacy '+key);const mesh=root.children.find(o=>o.geometry&&o.geometry.type==='BoxGeometry'&&dimensions.every((v,i)=>v===[o.geometry.parameters.width,o.geometry.parameters.height,o.geometry.parameters.depth][i]));records.buildings[key]=boxOf(mesh).getSize(new THREE.Vector3()).toArray();}
TICKERS.forEach(fn=>fn(15,0));a.scene.updateMatrixWorld(true);records.conveyorPositions=beltBoxes.map(b=>b.getWorldPosition(new THREE.Vector3()).toArray());records.socBarPosition=socBar.getWorldPosition(new THREE.Vector3()).toArray();records.currentDeviceLabels=Object.keys(LABELS3D).length;records.edges=EDGES.map(e=>({key:e.key,length:e.len,finite:e.pts.every(p=>p.every(Number.isFinite)),tubeMatchesParticles:e.visualTube?e.visualTube.geometry.parameters.path.getPoint(.5).distanceTo(new THREE.Vector3(...edgePoint(e,.5)))<.01:null})).filter(e=>['wind','solar','trans','metalE','panZnAc','panZnDc','tr2dc'].includes(e.key));
records.checks={animatedObjectsStayInFacility:records.conveyorPositions.every(p=>p[0]>=163&&p[0]<=183&&p[2]>91&&p[2]<94)&&records.socBarPosition[0]>24&&records.socBarPosition[0]<32,fixedA1:records.dataBuilding.position.join(',')==='134,0,-10'&&records.dataBuilding.scale.every(v=>v===1),indoorProcess:records.indoorProcess,indoorRectifier:records.indoorRectifier,closedWorkshop:records.closedWorkshop,noExteriorRectifier:!INFO.panamaDc&&!LABELS3D.panamaDc&&records.exteriorDataRectifierLabels===0,turbinesClear:records.minTurbineDistance>records.rotorDiameter,routeContinuity:records.edges.every(e=>e.finite&&e.length>0&&e.tubeMatchesParticles)};
}
const pre=document.createElement('pre');pre.id='layoutAudit';pre.style.cssText='display:none';pre.textContent=JSON.stringify(records,null,2);document.body.append(pre);
})();</script>`;
for(const [version,source]of [['v4',path.join(root,'dist','Net-Zero-grid-premium.html')],['v3',path.join(root,'..','NetZero-GridToChip-v3-Detail','dist','Net-Zero-grid-premium.html')]]){const html=fs.readFileSync(source,'utf8');fs.writeFileSync(path.join(root,'tests',version+'-layout-preview.html'),html.slice(0,html.lastIndexOf('</body>'))+fixture+html.slice(html.lastIndexOf('</body>')));}
console.log('Independent v3/v4 screenshot and scene audit fixtures created.');
