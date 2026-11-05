/* Physical-route and support audit against the same descriptors rendered by Three.js. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),M=require('../src/tower-model.js'),P=require('../src/multi-campus-plan.js'),m=M.create(P.renewableExport),checks={};
const test=(n,v)=>{checks[n]=!!v;console.log((v?'PASS ':'FAIL ')+n);},sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),clamp=v=>Math.max(0,Math.min(1,v));
function segmentDistance(p1,q1,p2,q2){const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s=0,t=0;if(a<1e-12&&e<1e-12)return M.dist(p1,p2);if(a<1e-12)t=clamp(f/e);else{const c=dot(d1,r);if(e<1e-12)s=clamp(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=den?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}return M.dist(M.mix(p1,q1,s),M.mix(p2,q2,t));}
const segments=p=>p.slice(1).map((b,i)=>[p[i],b]),phase=m.phasePaths.map(segments),steel=m.parts.filter(p=>['rod','angle'].includes(p.type)&&p.role==='structure');
let minSteel=Infinity,minPhase=Infinity,nearest=null;const clashes=[];
for(let i=0;i<phase.length;i++)for(const [a,b]of phase[i]){
 for(const p of steel){const gap=segmentDistance(a,b,p.a,p.b)-.055-p.r*(p.type==='angle'?1.8:1);if(gap<minSteel){minSteel=gap;nearest={phase:i,part:p.name,gap,a,b};}if(gap<0)clashes.push({phase:i,part:p.name,gap,a,b});}
 for(let j=i+1;j<phase.length;j++)for(const [c,d]of phase[j])minPhase=Math.min(minPhase,segmentDistance(a,b,c,d)-.11);
}
test('fivePurposefulSupports',m.supports.length===5&&m.supports.filter(s=>s.type==='angle-V').length===2&&m.supports.some(s=>s.type==='suspension-I'));
test('allPartsFinite',m.parts.every(p=>[...(p.p||[]),...(p.a||[]),...(p.b||[]),...(p.size||[]),...(p.axis||[])].every(Number.isFinite)));
test('allLinearPartsHaveVolume',m.parts.filter(p=>p.a).every(p=>M.dist(p.a,p.b)>.001&&p.r>0));
test('allPhasesContinuous',m.phasePaths.every(p=>p.length>40&&segments(p).every(([a,b])=>M.dist(a,b)>0)));
test('centerPowerRouteMatchesPhysicalPhase',JSON.stringify(m.path)===JSON.stringify(m.phasePaths[1]));
test('threePhasesDoNotCross',minPhase>.35);
test('liveConductorsClearSteel',clashes.length===0&&minSteel>.15);
test('allInsulatorEndsMeetConductors',m.attachments.every(a=>phase.some(ss=>ss.some(([p,q])=>segmentDistance(a.end,a.end,p,q)<1e-7))));
test('allInsulatorTopsHavePhysicalMounts',m.attachments.every(a=>steel.some(p=>segmentDistance(a.top,a.top,p.a,p.b)<p.r+1e-6)));
test('bodyBelowLiveLine',m.supports.filter(s=>s.id.startsWith('main')).every(s=>steel.filter(p=>p.owner===s.id&&p.name.includes('/leg-')).every(p=>p.b[1]<=10.5)));
test('earthwireTerminatesOnMasts',m.supports.every(s=>m.earthPath.some(p=>M.dist(p,[s.x,s.height,s.z])<1e-7)));
test('allThreeQualityTiers',new Set(m.parts.map(p=>p.tier)).size===3);
test('originalPlanFootprintKept',m.supports.filter(s=>s.id.startsWith('main')).every((s,i)=>s.x===P.renewableExport.towers[i].x&&s.z===P.renewableExport.towers[i].z));
test('noCircuitCountInvented',m.phasePaths.length===3&&m.nominalVoltageKV===220);
const report={checks,parts:m.parts.length,partCounts:Object.fromEntries(m.supports.map(s=>[s.id,m.parts.filter(p=>p.owner===s.id).length])),insulators:m.attachments.length,minimumSteelClearance:minSteel,minimumInterphaseClearance:minPhase,nearest,clashes:clashes.slice(0,20),units:m.units};
fs.writeFileSync(path.join(__dirname,'../evidence/v17-tower-geometry.json'),JSON.stringify(report,null,2));if(clashes.length)console.log(JSON.stringify(clashes.slice(0,5),null,2));console.log('Clearance',minSteel,'phase',minPhase);assert(Object.values(checks).every(Boolean),'tower geometry audit failed');module.exports={segmentDistance};
