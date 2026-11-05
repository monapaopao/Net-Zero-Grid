const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const old=fs.readFileSync(path.join(__dirname,'layout-fixture.cjs'),'utf8');
let fixture=old.slice(old.indexOf('const fixture=`')+15,old.indexOf('`;\nfor('));
const infrastructure=fs.readFileSync(path.join(__dirname,'infrastructure-fixture.cjs'),'utf8');
const inherited=infrastructure.slice(infrastructure.indexOf('const extra=`')+13,infrastructure.indexOf('`;\nfixture='));
if(!fixture.includes('layoutAudit')||!inherited.includes('smrDefaultOff'))throw Error('Fixture extraction failed');
const extra=`
function geometryMetrics(root){let triangles=0,meshes=0;root.traverse(o=>{if(!o.geometry)return;meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});return {triangles,meshes};}
records.gasMetrics=geometryMetrics(a.scene.getObjectByName('Detailed genset'));
if(window.NZ_INFRA){const i=window.NZ_INFRA.audit();
 if(i.ducts){
  records.corridors=i.ducts;records.terminals=i.terminals;
  const added=EDGES.filter(e=>['hvDataA','hvDataB'].includes(e.key));
  records.dataPrimaryEdges=added.map(e=>({key:e.key,points:e.pts,power:e.pw(),finite:e.pts.every(p=>p.every(Number.isFinite)),tubeMatchesParticles:e.visualTube.geometry.parameters.path.getPoint(.5).distanceTo(new THREE.Vector3(...edgePoint(e,.5)))<.01}));
  const hv=i.ducts.filter(d=>d.key.startsWith('HV ')),mv=i.ducts.filter(d=>d.key.startsWith('MV '));
  const segments=ds=>ds.flatMap(d=>d.pts.slice(1).map((p,j)=>[d.pts[j],p]));
  function intersect(s,t){const [a,b]=s,[c,d]=t;const x1=Math.min(a[0],b[0]),x2=Math.max(a[0],b[0]),z1=Math.min(a[2],b[2]),z2=Math.max(a[2],b[2]);const x3=Math.min(c[0],d[0]),x4=Math.max(c[0],d[0]),z3=Math.min(c[2],d[2]),z4=Math.max(c[2],d[2]);return Math.max(x1,x3)<=Math.min(x2,x4)+1e-6&&Math.max(z1,z3)<=Math.min(z2,z4)+1e-6;}
  Object.assign(records.checks,{
    allCorridorsOrthogonal:i.ducts.every(d=>d.pts.slice(1).every((p,j)=>Math.abs(p[0]-d.pts[j][0])<1e-6||Math.abs(p[2]-d.pts[j][2])<1e-6)),
    dataPrimaryPathsContinuous:records.dataPrimaryEdges.length===2&&records.dataPrimaryEdges.every(e=>e.finite&&e.tubeMatchesParticles),
    dataPrimaryAllocationBalanced:Math.abs(added.reduce((sum,e)=>sum+e.pw(),0)-i.normalMW)<1e-8&&added.every(e=>i.terminals.some(t=>t.end.every((v,j)=>Math.abs(v-e.pts.at(-1)[j])<1e-8))),
    primarySecondaryCorridorsSeparate:!segments(hv).some(s=>segments(mv).some(t=>intersect(s,t))),
    sixThreePhaseTerminations:i.terminals.length===18&&['dataPrimary-18.25','dataPrimary-10','dataPrimary-1.75','industrialPrimary14.3','industrialPrimary22','industrialPrimary29.7'].every(key=>i.terminals.filter(t=>t.key===key).length===3),
    noLongPrimaryFan:i.terminals.every(t=>Number.isFinite(t.end[0])&&t.end[1]<6),
    refinedMachineTrain:['Refined compressor casing','Refined combustion casing','Refined turbine casing','Refined generator and coupling','Lubrication skid and connected auxiliary pipes','Refined air intake filter house and duct','Refined exhaust duct silencer and stack','Fuel conditioning skid with valves and instruments'].every(n=>a.scene.getObjectByName(n)),
    gasDetailInsideExistingSite:boxOf(a.scene.getObjectByName('Detailed genset')).min.x>=161-.05&&boxOf(a.scene.getObjectByName('Detailed genset')).max.x<=207+.05&&boxOf(a.scene.getObjectByName('Detailed genset')).min.z>=-21-.05&&boxOf(a.scene.getObjectByName('Detailed genset')).max.z<=5+.05
  });
 }
}
const view=new URLSearchParams(location.search).get('view');
if(view==='cables'){a.focus('disttr');a.cancelCamera();a.camera.position.set(112,39,81);a.controls.target.set(78,3,22);a.controls.update();}
else if(view==='gas'){a.focus('genset');a.cancelCamera();a.press('gasCutaway');a.cancelCamera();a.camera.position.set(214,27,26);a.controls.target.set(182,2.8,-8);a.controls.update();}
else if(view==='machine'){a.focus('genset');a.cancelCamera();a.press('gasCutaway');a.cancelCamera();a.camera.position.set(182,15,21);a.controls.target.set(181,2.5,-8);a.controls.update();}
else{a.camera.position.set(365,330,430);a.controls.target.set(15,0,10);a.controls.update();}
`;
fixture=fixture.replace("const pre=document.createElement('pre');",inherited+extra+"const pre=document.createElement('pre');");
for(const [version,folder]of [['v6',root],['v5',path.join(root,'..','NetZero-GridToChip-v5-Infrastructure')]]){
 const html=fs.readFileSync(path.join(folder,'dist','Net-Zero-grid-premium.html'),'utf8'),at=html.lastIndexOf('</body>');
 fs.writeFileSync(path.join(root,'tests',version+'-cable-preview.html'),html.slice(0,at)+fixture+html.slice(at));
}
console.log('v5/v6 matched camera and routing audit fixtures generated.');
