/* Actual Three.js route construction and animation; no renderer or browser. */
'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),THREE=require('../src/three.js');
const root=path.join(__dirname,'..'),plan=require('../src/multi-campus-plan.js'),chemical=require('../src/chemical-campus-plan.js');
const canvasContext=new Proxy({},{get:()=>()=>{}}),canvas=()=>({width:32,height:32,getContext:()=>canvasContext});
const state={dcLoadMW:150,factory:50,windMW:100,metal:20,h2P:20,nh3KgH:100,smrEnabled:false,reduceMotion:false,turbP:Array(12).fill(5)};
const camera=new THREE.PerspectiveCamera(45,16/9,.1,3000);camera.position.set(365,120,200);camera.lookAt(280,3,18);camera.updateMatrixWorld(true);
const context={THREE,scene:new THREE.Scene(),camera,renderer:{domElement:{clientWidth:1920,clientHeight:1080}},S:state,EDGES:[],TICKERS:[],document:{createElement:canvas},window:{NZ_MULTI_PLAN:plan,NZ_CHEMICAL_PLAN:chemical,NZ_CONFIG:{QUALITY:{standard:{particles:24},high:{particles:32},compat:{particles:10}}},innerWidth:1920,innerHeight:1080}};
vm.createContext(context);
for(const source of ['solar-site-plan.js','renewable-landscape-plan.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',source),'utf8'),context,{filename:source});
// Wind geometry is outside this regression. Preserve valid endpoint identities
// while constructing the real road graph and every actual factory route.
const renewable=context.window.NZ_RENEWABLE_PLAN;
context.window.NZ_WIND_PRODUCT={endpoint(i){const s=renewable.sites[i];return [s.x,s.y+32,s.z];},routePath(){return null;}};
vm.runInContext(fs.readFileSync(path.join(root,'src/campus-flows.js'),'utf8'),context,{filename:'campus-flows.js'});
const flows=context.window.NZ_FLOWS,checks={};
function test(name,fn){fn();checks[name]=true;console.log('PASS '+name);}
const audit=()=>JSON.parse(JSON.stringify(flows.audit())),first=audit(),route=id=>audit().routes.find(r=>r.id===id);
const nearPoint=(a,b)=>assert(a.every((v,i)=>Math.abs(v-b[i])<1e-7),a+' != '+b);
test('all factory interfaces use the new physical registry',()=>{
 for(const kind of ['control','utility','process'])assert.deepEqual(first.nodes.find(n=>n.id==='factory.'+kind).p,plan.factoryHall.ports[kind]);
 assert.deepEqual(first.nodes.find(n=>n.id==='heat.sink').p,plan.factoryHall.ports.heat);
 for(const r of first.routes){nearPoint(r.pts[0],first.nodes.find(n=>n.id===r.from).p);nearPoint(r.pts.at(-1),first.nodes.find(n=>n.id===r.to).p);}
});
const factoryRoutes=['factory-status-upload','manufacturing-business-data','energy-command-factory','factory-local-control','factory-cooling-supply','factory-cooling-return','inter-campus-heat-supply','inter-campus-heat-return'];
test('external routes stay outside production and internal warehouses',()=>{
 const b=plan.factoryHall.bounds;
 for(const id of factoryRoutes)for(const p of route(id).pts)assert(!(p[0]>b.x0+1e-6&&p[0]<b.x1-1e-6&&p[2]>b.z0+1e-6&&p[2]<b.z1-1e-6),id+' crosses the hall at '+p);
});
test('factory utility supply and return use rectilinear apron paths',()=>{
 for(const id of ['factory-cooling-supply','factory-cooling-return'])for(let i=1,r=route(id);i<r.pts.length;i++){
  const a=r.pts[i-1],b=r.pts[i];assert(!(Math.abs(a[0]-b[0])>1e-8&&Math.abs(a[2]-b[2])>1e-8),id+' diagonal');
 }
});
test('active factory data control and cooling move without altering engine state',()=>{
 const before=JSON.stringify(state);flows.context('factory');flows.update(1,.1);const a=audit();flows.update(1.4,.4);const b=audit();
 for(const id of factoryRoutes.filter(id=>!id.startsWith('inter-campus'))){const r=a.routes.find(r=>r.id===id),after=b.routes.find(r=>r.id===id);assert(r.visible&&r.count>0,id);assert(after.phase>r.phase,id);}
 assert.equal(JSON.stringify(state),before);assert.equal(b.enabled.heat,false);
});
test('narrative pause freezes communication and exit restores normal signaling',()=>{
 flows.setNarrativeSignals({eventId:'factory-review',routeIds:['energy-command-factory'],paused:true});flows.update(2,.3);
 const paused=route('energy-command-factory');assert(paused.staticDirections&&paused.count===0&&paused.narrativeSelected);flows.update(2.4,.4);assert.equal(route('energy-command-factory').phase,paused.phase);
 flows.clearNarrativeSignals();flows.update(3,.2);assert(route('energy-command-factory').count>0);
});
test('layer switches and reduced motion retain new route endpoints',()=>{
 flows.setEnabled('cooling',false);flows.update(4,.1);assert(!route('factory-cooling-supply').visible);flows.setEnabled('cooling',true);
 state.reduceMotion=true;flows.update(4.4,.4);assert.equal(route('factory-cooling-supply').count,0);assert(route('energy-command-factory').staticDirections);
 state.reduceMotion=false;assert.deepEqual(route('factory-local-control').pts.at(-1),plan.factoryHall.ports.process);
});
fs.writeFileSync(path.join(root,'evidence/v20-factory-flows.json'),JSON.stringify({checks,passed:Object.keys(checks).length,factoryRoutes:factoryRoutes.map(route),liveBrowserVerified:false},null,2));
