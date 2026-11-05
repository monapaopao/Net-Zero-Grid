'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),previous=path.join(root,'../NetZero-GridToChip-v19-SSTEnergyRouter'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const preserved=['config.js','engine.js','dispatch-tasks.js','sst-simulation.js','sst-model.js','sst-three.js','wind-anatomy.js','wind-product.js','transmission-towers.js','storage-model.js','campus-detail.js','chemical-campus.js','solar-site-plan.js'];
const files=preserved.map(name=>{const original=hash(path.join(previous,'src',name)),current=hash(path.join(root,'src',name));assert.equal(current,original,name+' must remain unchanged');return {name,original,current,unchanged:true};});
const refinementManifest=JSON.parse(fs.readFileSync(path.join(root,'backups/v20-before-horizontal-factory-20261022-175654/preserved-hashes.json'),'utf8'));
const pickingFilter=`        // Three.js raycasts hidden meshes too; an opened roof must not mask
        // the equipment that is now visible beneath it.
        let visible = true;
        for (let node = h.object; node; node = node.parent) {
          if (!node.visible) { visible = false; break; }
        }
        const material = Array.isArray(h.object.material)
          ? h.object.material[h.face?.materialIndex ?? 0] : h.object.material;
        if (!visible || material?.visible === false ||
            (material?.transparent && material.opacity <= 0.001)) continue;
`;
const unchangedThisRefinement=refinementManifest.map(entry=>{
 const file=path.join(root,entry.path),current=hash(file);let compared=current,copyOnly=false,pickingOnly=false;
 if(entry.path==='src/reception.js'){
  const content=fs.readFileSync(file,'utf8'),newNote='五排原尺寸工位，流程与结构示意',oldNote='一条代表生产线，流程与结构示意';
  assert.equal(content.split(newNote).length,2);compared=crypto.createHash('sha256').update(content.replace(newNote,oldNote)).digest('hex');copyOnly=true;
 }
 if(entry.path==='src/premium.js'){
  const content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');assert.equal(content.split(pickingFilter).length,2);
  const baseline=fs.readFileSync(path.join(root,'backups/v20-before-horizontal-factory-20261022-175654',entry.path),'utf8');
  assert.equal(content.replace(pickingFilter,''),baseline.replace(/\r\n/g,'\n'));compared=crypto.createHash('sha256').update(baseline).digest('hex');pickingOnly=true;
 }
 assert.equal(compared.toLowerCase(),entry.sha256.toLowerCase(),entry.path+' must preserve the pre-factory interface and kernel');
 return {path:entry.path,sha256:current,copyOnly,pickingOnly,simulationAndGuideLogicUnchanged:true};
});
const before=JSON.parse(fs.readFileSync(path.join(previous,'导览文案.json'),'utf8')),after=JSON.parse(fs.readFileSync(path.join(root,'导览文案.json'),'utf8'));
const cameras=data=>data.campus.filter(c=>c.id!=='factory').map(c=>({id:c.id,segments:c.segments.map(s=>Object.fromEntries(['id','duration','move','shot','focus','equipment','mode'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]])))}));
assert.deepEqual(cameras(after),cameras(before));for(const [key,shot]of Object.entries(before.shots))if(!['factory','factoryClose'].includes(key))assert.deepEqual(after.shots[key],shot);assert.deepEqual(after.timing,before.timing);assert.deepEqual(after.building.map(s=>[s.id,s.start,s.end]),before.building.map(s=>[s.id,s.start,s.end]));
const oldPlan=require(path.join(previous,'src/multi-campus-plan.js')),newPlan=require(path.join(root,'src/multi-campus-plan.js'));
for(const [key,site]of Object.entries(oldPlan.sites))if(!['factory','emergency'].includes(key))assert.deepEqual(newPlan.sites[key],site);
for(const [key,move]of Object.entries(oldPlan.moves))if(key!=='factory')assert.deepEqual(newPlan.moves[key],move);
for(const facility of oldPlan.facilities)if(!['factoryraw','factoryproduct','factoryutility','factorydispatch','factorystaging','factoryfeed'].includes(facility.key))assert.deepEqual(newPlan.facilities.find(f=>f.key===facility.key),facility);
const compiled=require('../src/tour-narrative.js').compile(after);
assert.equal(compiled.totalSeconds,391);assert.equal(require('../src/reception-model.js').compile(JSON.parse(fs.readFileSync(path.join(root,'三分钟接待文案.json'),'utf8'))).duration,180);
const report={files,unchangedThisRefinement,campusCamerasOutsideFactoryUnchanged:true,factoryNewDetailSeconds:22,buildingVisualTimingUnchanged:true,fullTourSeconds:compiled.totalSeconds,receptionSeconds:180,defaultRuntimeAndTaskLogicUnchanged:true};
fs.writeFileSync(path.join(root,'evidence/v20-preservation.json'),JSON.stringify(report,null,2));console.log('PASS '+files.length+' core/model sources, non-factory cameras and all building visual times preserved');
