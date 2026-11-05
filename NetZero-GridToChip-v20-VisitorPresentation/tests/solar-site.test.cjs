'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),P=require('../src/solar-site-plan.js');
global.window=global;require('../src/multi-campus-plan.js');require('../src/renewable-landscape-plan.js');
test('shared PV plan expands display modules without capacity change and clears all service footprints by 2 units',()=>{
  const a=P.audit();assert.ok(a.panelCount>1800);assert.deepEqual(a.conflicts,[]);assert.deepEqual(a.equipmentConflicts,[]);
  assert.ok(a.equipment.every(e=>e.x0>=-550&&e.x1<=-72&&e.z0>=49&&e.z1<=168));
});
test('north is -Z; fixed 24-degree array faces true south',()=>{
  const n=P.normal();assert.ok(Math.abs(n[0])<1e-12);assert.ok(n[1]>0&&n[2]>0);
  assert.ok(Math.abs(Math.acos(n[1])/P.rad-24)<1e-10);
});
test('NOAA check includes civil timezone and east-positive longitude',()=>{
  const settings={...P.cfg,date:'2026-03-20',latitude:40,longitude:0,timezone:0,hour:12};
  const noon=P.sun(settings).solarNoon,atNoon=P.sun({...settings,hour:noon});
  assert.ok(Math.abs(atNoon.azimuth-180)<.1);assert.ok(Math.abs(atNoon.elevation-50)<1);
  assert.ok(P.sun({...settings,hour:noon-3}).direction[0]>0);
  assert.ok(P.sun({...settings,hour:noon+3}).direction[0]<0);
  assert.ok(P.sun({...settings,hour:0}).elevation<0);
  assert.ok(Math.abs(P.sun({...settings,longitude:87.6,timezone:8}).solarNoon-noon-2.16)<1e-9);
});
test('winter noon and extreme latitude checks remain finite',()=>{
  const s=P.sun();assert.ok(s.elevation>20&&s.elevation<25);assert.ok(s.direction[2]>0);
  assert.ok(Math.abs(s.direction.reduce((v,x)=>v+x*x,0)-1)<1e-10);
  for(const latitude of [-89,0,89])for(const hour of [0,6,12,18]){
    const v=P.sun({...P.cfg,latitude,hour});assert.ok(Number.isFinite(v.azimuth)&&Number.isFinite(v.elevation));
  }
  assert.ok(P.audit().winter.some(v=>v.elevation>0&&!v.rowShadowRisk));
});
