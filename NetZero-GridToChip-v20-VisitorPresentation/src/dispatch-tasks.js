/* v18: per-run, deadline-based production and metering. No DOM dependencies. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NZ_TASKS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
let serial=0;
const EPS=1e-7,copy=x=>JSON.parse(JSON.stringify(x));
function create(cfg,S){
 const P=cfg.PLANT,D=cfg.DISPATCH;const sc=cfg.SCENARIOS[S.scenario]||cfg.SCENARIOS.park;
 const b={runId:'run-'+Date.now().toString(36)+'-'+(++serial),scenario:S.scenario,start:S.simTime,elapsed:0,cycle:0,tasks:[],extra:{zinc:0,factory:0},targetH2Kg:D.targetH2Kg,initialSoc:S.soc,initialH2Kg:S.h2Kg,meter:{tokens:0,itMWh:0,dcMWh:0,dcSourceMWh:{},gridLoadMWh:0,gridChargeMWh:0,criticalUnservedMWh:0,chargingLimitedMWh:0,violations:0,reserveBelowSeconds:0},orders:[]};
 function add(key,amount,release,deadline,origin){b.tasks.push({id:b.runId+'-'+key+'-'+b.tasks.length,key,unit:'MWh',target:amount,done:0,release,deadline,origin,completedAt:null,missedAtDeadline:false});}
 function cycle(i){const start=b.start+i*D.cycleHours*3600;for(const key of ['zinc','factory'])add(key,P[key==='zinc'?'zincPlanMW':'factoryPlanMW']*D.cycleHours,start,start+D.cycleHours*3600,'本周期演示生产计划');}
 cycle(0);
 if(sc.initialTasks)for(const t of sc.initialTasks)add(t.key,t.mwh,b.start-t.ageHours*3600,b.start+t.dueHours*3600,'情景预设待完成任务（形成于起步前 '+t.ageHours+' h）');
 function remaining(t){return Math.max(0,t.target-t.done);}
 function pending(key){return b.tasks.filter(t=>t.key===key&&remaining(t)>EPS).sort((a,c)=>a.deadline-c.deadline);}
 function status(key,now){const tasks=b.tasks.filter(t=>t.key===key),todo=pending(key),cap=P[key==='zinc'?'zincMW':'factoryMW'];let cumulative=0,rate=0,impossible=false;
  for(const t of todo){cumulative+=remaining(t);const hours=(t.deadline-now)/3600;rate=Math.max(rate,cumulative/Math.max(1/3600,hours));if(hours<=0||cumulative>Math.max(0,hours)*cap)impossible=true;}
  const target=tasks.reduce((n,t)=>n+t.target,0),done=tasks.reduce((n,t)=>n+t.done,0),overdue=todo.filter(t=>t.deadline<=now).reduce((n,t)=>n+remaining(t),0);
  return {key,unit:'MWh',target,done,remaining:Math.max(0,target-done),overdue,completionPct:target?100*done/target:100,extra:b.extra[key],nextDeadline:todo[0]?.deadline??null,requiredMW:rate,capacityMW:cap,impossible,missedTasks:tasks.filter(t=>t.missedAtDeadline).length};
 }
 function command(key,now,dtH){const s=status(key,now),plan=P[key==='zinc'?'zincPlanMW':'factoryPlanMW'];const todo=pending(key);let work=0,need=0;
  for(const t of todo){work+=remaining(t);need=Math.max(need,work/Math.max(1/3600,(t.deadline-now)/3600-D.deadlineBufferHours));}
  return {want:Math.min(s.capacityMW,s.remaining/Math.max(dtH,1e-9),Math.max(plan,need)),protect:Math.min(s.capacityMW,need),cap:Math.min(s.capacityMW,s.remaining/Math.max(dtH,1e-9)),urgent:s.nextDeadline!==null&&s.nextDeadline-now<D.urgentHours*3600,...s};
 }
 function begin(now){const i=Math.floor(Math.max(0,now-b.start-1e-6)/(D.cycleHours*3600));while(b.cycle<i)cycle(++b.cycle);}
 function finish(R,dtH,dt){const now=S.simTime;b.elapsed=now-b.start;
  for(const [key,mw]of [['zinc',R.sink.zinc],['factory',R.sink.factory]]){let energy=mw*dtH;for(const t of pending(key)){const a=Math.min(remaining(t),energy);t.done+=a;energy-=a;if(remaining(t)<=EPS)t.completedAt=now;if(energy<=EPS)break;}b.extra[key]+=Math.max(0,energy);}
  for(const t of b.tasks)if(now>=t.deadline&&remaining(t)>EPS)t.missedAtDeadline=true;
  const deliveredIT=S.itMW*Math.max(0,Math.min(1,R.sink.dc/Math.max(1e-9,R.dcLoad))),m=b.meter;
  m.itMWh+=deliveredIT*dtH;m.tokens+=deliveredIT*D.tokenPerMWh*dtH;m.dcMWh+=R.sink.dc*dtH;
  for(const [k,v]of Object.entries(S.stepFrac||{}))m.dcSourceMWh[k]=(m.dcSourceMWh[k]||0)+v*R.sink.dc*dtH;
  m.gridLoadMWh+=R.gridBuyLoad*dtH;m.gridChargeMWh+=R.chargeGrid*dtH;m.criticalUnservedMWh+=Math.max(0,R.dcLoad-R.sink.dc)*dtH;
  m.chargingLimitedMWh+=Math.max(0,S.trucks*P.scGunMW-R.sink.sc)*dtH;
  if(S.soc<D.reserveSoc-EPS)m.reserveBelowSeconds+=dt;
  if(Math.abs(R.residual)>1e-6||Math.abs(S.lastH2ResidualKg)>1e-6||S.soc<P.socLow-EPS||S.soc>P.socHigh+EPS)m.violations++;
  S.debtZinc=status('zinc',now).remaining;S.debtFac=status('factory',now).remaining;S.debtPem=0;
  S.debtZincCarry=S.debtZinc;S.debtFacCarry=S.debtFac;S.debtPemCarry=0;
  S.dispatchReason=S.unservedMW>EPS?'电网与设备供给能力不足，记录未供电与任务受限':R.gridBuyLoad>EPS?(S.releaseMW>EPS?'柔性负荷已压减；电网补充关键负荷和生产需求':'按任务期限保障生产，由电网补充供电'):S.stP>EPS?'储能参与补充供电':S.curtail>EPS?'任务、储能及外送能力受限，记录弃电':'按任务需求消纳电源，剩余电量用于库存恢复或外送';
  S.storageReason=S.stP>EPS?'实际放电':S.stP<-EPS?'实际充电':S.soc<=P.socLow+EPS?'已达到最低 SOC':S.stMode==='charge'?'充电模式':S.soc<=D.reserveSoc+EPS?'保留运行备用':'当前无需充放电';
 }
 function snapshot(){return {...copy(b),production:['zinc','factory'].map(k=>status(k,S.simTime)),hydrogen:{unit:'kg',inventory:S.h2Kg,target:b.targetH2Kg,gap:Math.max(0,b.targetH2Kg-S.h2Kg),reason:S.h2Kg>=P.tankKg*.98?'储罐接近满，按下游需求制氢':'按下游耗氢及目标库存补充；非固定用电欠账'},assumptions:'24 h 等效用电任务；能力估算仅含额定上限，不含未来天气、爬坡或停机预测；不存在真实订单'};}
 function order(){const o={id:b.runId+'-service-'+(b.orders.length+1),runId:b.runId,kind:'等效推理',unit:'Token（输入输出未拆分）',requested:1000000,createdAt:S.simTime,meterStart:Math.max(b.meter.tokens,...b.orders.map(x=>x.meterStart+x.requested)),quantity:null,price:null,amount:null,status:'已创建模拟需求',delivered:false};b.orders.push(o);return copy(o);}
 function settle(id,price){const o=b.orders.find(x=>x.id===id);if(!o)throw Error('订单不属于当前运行');if(o.delivered)return copy(o);const n=price==null||String(price).trim()===''?null:Number(price);if(n!==null&&(!Number.isFinite(n)||n<0))throw Error('单价无效');o.quantity=Math.min(o.requested,Math.max(0,b.meter.tokens-o.meterStart));if(o.quantity<o.requested-EPS)throw Error('当前计量不足，继续仿真后再确认交付');o.price=n;o.amount=n===null?null:o.quantity/1e6*n;o.delivered=true;o.status=n===null?'模拟交付已确认 · 单价待配置':'模拟结算已记录 · 非实际收入';o.confirmedAt=S.simTime;return copy(o);}
 return {begin,finish,command,snapshot,order,settle,b};
}
return {create};});
