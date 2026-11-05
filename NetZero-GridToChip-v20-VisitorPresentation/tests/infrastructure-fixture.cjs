const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const old=fs.readFileSync(path.join(__dirname,'layout-fixture.cjs'),'utf8');
let fixture=old.slice(old.indexOf('const fixture=`')+15,old.indexOf('`;\nfor('));
if(!fixture.includes('layoutAudit'))throw Error('Fixture extraction failed');
fixture=fixture.replace('355,305,405','365,330,430').replace('10,0,40','15,0,10');
const extra=`
if(window.NZ_INFRA){
 const i=window.NZ_INFRA.audit();records.infrastructure=i;
 const smr=a.scene.getObjectByName('Detailed smr');const gas=a.scene.getObjectByName('Detailed genset');const mv=a.scene.getObjectByName('Detailed dcfeed');
 const b=boxOf(smr);records.smrBounds={min:b.min.toArray(),max:b.max.toArray()};
 records.smrIsland=boxOf(a.scene.getObjectByName('SMR nuclear island building')).getSize(new THREE.Vector3()).toArray();
 records.gasBounds={min:boxOf(gas).min.toArray(),max:boxOf(gas).max.toArray()};
 const end=(key,port)=>i.routes[key].at(-1).every((v,j)=>Math.abs(v-port[j])<1e-8);
 const saved=[S.gensetMW,S.dcLoadMW];records.flowCases=[];
 for(const [g,d]of [[0,176],[50,176],[50,50],[50,30],[0,58],[20,340]]){S.gensetMW=g;S.dcLoadMW=d;const q=window.NZ_INFRA.audit();records.flowCases.push({g,d,normal:q.normalMW,backup:q.backupMW,balanced:Math.abs(q.normalMW+q.backupMW-d)<1e-8});}S.gensetMW=saved[0];S.dcLoadMW=saved[1];
 const routed=['smr','genset','bus2tr','bus2dist','tr2dc','tr2dcB','dcA','dcB','feedIn','svgShunt'];records.routedEdges=EDGES.filter(e=>routed.includes(e.key)).map(e=>({key:e.key,points:e.pts,power:e.pw(),finite:e.pts.every(p=>p.every(Number.isFinite)),tubeMatchesParticles:e.visualTube.geometry.parameters.path.getPoint(.5).distanceTo(new THREE.Vector3(...edgePoint(e,.5)))<.01}));
 Object.assign(records.checks,{
  smrBehindA1:i.smrPosition[2]+i.sites.smr.d/2<-22,
  smrSeparateFromRenewables:i.smrPosition[0]-i.sites.smr.w/2>-79,
  smrFitsIndependentSite:b.min.x>=107-.01&&b.max.x<=213+.01&&b.min.z>=-137-.01&&b.max.z<=-63+.01,
  smrIslandComparableToA1:records.smrIsland[0]>23&&records.smrIsland[0]<31&&records.smrIsland[2]>20&&records.smrIsland[2]<25,
  gasOutsideA1AndSmr:i.sites.genset.x-i.sites.genset.w/2>150&&i.sites.genset.z-i.sites.genset.d/2>-63,
  gasFeedTerminatesAtMV:end('genset',i.ports.roomGas),
  dataFeedEntersA1:end('dcA',i.ports.dcA)&&end('dcB',i.ports.dcB),
  threePhasePhysicalRoutes:i.physical.length>=10&&i.physical.every(p=>p.phaseCount===3),
  compensationIsParallel:INFO.svgapf.d.includes('并联')&&EDGES.find(e=>e.key==='svgShunt').pw()===0,
  sourceDisplayAllocation:records.flowCases.every(c=>c.balanced&&c.backup<=c.g&&c.backup<=c.d&&c.normal>=0),
  allNewRoutesContinuous:records.routedEdges.length===routed.length&&records.routedEdges.every(e=>e.finite&&e.tubeMatchesParticles),
  gasEnclosureClosed:a.scene.getObjectByName('Removable gas turbine enclosure roof').visible&&a.scene.getObjectByName('Removable gas turbine enclosure front').visible,
  mvRoomClosed:a.scene.getObjectByName('MV room removable roof').visible&&a.scene.getObjectByName('MV room removable front').visible,
  smrDefaultOff:!S.smrEnabled&&S.smr===0
 });
}
`;
fixture=fixture.replace("const pre=document.createElement('pre');",extra+"const pre=document.createElement('pre');");
for(const [version,folder]of [['v5',root],['v4',path.join(root,'..','NetZero-GridToChip-v4-Scale')]]){
 const html=fs.readFileSync(path.join(folder,'dist','Net-Zero-grid-premium.html'),'utf8');const at=html.lastIndexOf('</body>');
 fs.writeFileSync(path.join(root,'tests',version+'-infrastructure-preview.html'),html.slice(0,at)+fixture+html.slice(at));
}
console.log('v4/v5 comparison and infrastructure audit fixtures generated.');
