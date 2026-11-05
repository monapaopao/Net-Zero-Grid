/* Green-compute replay presentation: no accounting or dispatch changes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NZ_GREEN_VIEW=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number.isFinite(x)?x.toFixed(1):'—',clock=t=>{const m=Math.round(t/60);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
function present(comparison,f,stage){
 const frames=comparison.candidate.frames,duration=comparison.scenario.durationSeconds,w=comparison.candidate.basis.weather;
 const ready=f.elapsed>0,state=f.state,command=f.command||{},previous=frames[Math.max(0,frames.findIndex(r=>r.elapsed===f.elapsed)-5)]||f;
 const wind=ready?state.windMW:w[0].windMW,solar=ready?state.solarMW:w[0].solarMW,batch=command.batchDeliveredMW||0,req=command.batchMW||0,st=state.stP||0;
 const difference=wind+solar-(previous.state.windMW+previous.state.solarMW),db=batch-(previous.command?.batchDeliveredMW||0);
 let action= !ready?'预设轨迹已载入；执行阶段开始回放计算结果。':f.queue.remainingMWh<1e-6?'批任务已全部完成，处理功率归零；不为消纳绿电虚增任务。':db>2&&difference>2?'风光出力上升，批任务实际处理功率随调度增加。':db<-2&&difference<-2?'风光回落，批任务实际处理功率降低，未完成工作继续保留。':command.reason||'读取当前任务与供电状态';
 if(ready)action+=' '+(st>0.1?'储能正在放电支撑。':st<-.1?'富余电力正在为储能充电。':'储能待机。')+(state.gridBuy>.1?'电网补充 '+num(state.gridBuy)+' MW。':'当前无外部购电。');
 const x=t=>42+t/duration*500,cursor=x(f.elapsed),points=frames.map(r=>({t:r.elapsed,wind:r.elapsed?r.state.windMW:w[0].windMW,solar:r.elapsed?r.state.solarMW:w[0].solarMW,critical:r.command?.criticalDeliveredMW||0,batch:r.command?.batchDeliveredMW||0,request:r.command?.batchMW||0}));points.forEach(p=>p.sum=p.wind+p.solar);
 function graph(series,ceiling,label){const max=Math.max(50,Math.ceil(ceiling/50)*50),y=v=>62-v/max*47,path=k=>points.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(2)+' '+y(p[k]).toFixed(2)).join(' ');
  const svg='<svg viewBox="0 0 650 83" preserveAspectRatio="none" aria-hidden="true">'+[0,max/2,max].map(v=>'<path d="M42 '+y(v)+'H542" stroke="#e3ece8"/>').join('')+series.map(([key,color,dash])=>'<path d="'+path(key)+'" fill="none" stroke="'+color+'" opacity=".22" stroke-width="1.5"'+(dash?' stroke-dasharray="4 3"':'')+'/><svg x="42" y="0" width="'+Math.max(0,cursor-42)+'" height="70" viewBox="42 0 '+Math.max(.001,cursor-42)+' 70" overflow="hidden"><path d="'+path(key)+'" fill="none" stroke="'+color+'" stroke-width="2"'+(dash?' stroke-dasharray="4 3"':'')+'/></svg>').join('')+'<path d="M'+cursor+' 10V65" stroke="#56766c" stroke-dasharray="3 2"/></svg>';
  return '<div class="gc-plot" role="img" aria-label="'+esc(label)+'">'+svg+[0,max/2,max].map(v=>'<span class="gc-axis-y" style="top:'+y(v)/83*100+'%">'+v+'</span>').join('')+[0,.25,.5,.75,1].map(u=>'<span class="gc-axis-x" style="left:'+x(u*duration)/650*100+'%">'+clock(u*duration)+'</span>').join('')+'</div>';
 }
 const weather=graph([['wind','#228d82'],['solar','#b3832c'],['sum','#315d91']],Math.max(...points.map(p=>p.sum)),'风电、光伏及合计出力，MW');
 const load=graph([['critical','#527b87'],['batch','#16916d'],['request','#a65c92',true]],Math.max(...points.map(p=>Math.max(p.critical,p.batch,p.request))),'关键服务与批任务实际功率，虚线为批任务请求，MW');
 const tasks=f.tasks.filter(t=>t.type==='batch'),taskRows=tasks.map(t=>{
  const status=t.completedAt!==null?(t.lateCompleted?'逾期完成':'完成'):f.elapsed<t.releaseSeconds?'未到达':t.deadlineMissed?'逾期':(command.allocations||[]).some(a=>a.id===t.id&&a.actualMW>.01)?'处理中':'等待';
  const bars=frames.filter(r=>r.elapsed<=f.elapsed&&(r.command?.allocations||[]).some(a=>a.id===t.id&&a.actualMW>.01)).map(r=>'<i class="gc-task-work" style="left:'+Math.max(0,r.elapsed-60)/duration*100+'%;width:'+60/duration*100+'%"></i>').join('');
  return '<div class="gc-task-row"><span>'+esc(t.id.replace('batch-',''))+'</span><div class="gc-task-track"><i class="gc-task-window" style="left:'+t.releaseSeconds/duration*100+'%;width:'+(t.deadlineSeconds-t.releaseSeconds)/duration*100+'%"></i>'+bars+'<i class="gc-task-deadline" style="left:'+t.deadlineSeconds/duration*100+'%"></i><i class="gc-task-cursor" style="left:'+f.elapsed/duration*100+'%"></i></div><span>'+Math.round(t.processedMWh/t.workMWh*100)+'% '+status+'</span></div>';
 }).join('');
 const lanes='<div class="gc-task-lanes" role="group" aria-label="三项任务执行时段、完成进度和截止期限">'+taskRows+'</div>';
 const metric=(label,value,unit)=>'<span>'+label+' <b>'+value+'</b><small>'+unit+'</small></span>';
 const live=metric('风电',num(wind),'MW')+metric('光伏',num(solar),'MW')+metric('批任务实际',ready?num(batch):'—','MW')+metric(st>.1?'储能放电':st<-.1?'储能充电':'储能待机',ready?num(Math.abs(st)):'—','MW')+metric('SOC',num(state.soc),'%')+metric('购电',ready?num(state.gridBuy):'—','MW');
 const a=comparison.baseline.summary,b=comparison.candidate.summary;
 const review=stage===5?'<div class="gc-review"><b>复盘 · 基准 → 协同</b><span>购电 '+num(a.gridBuyMWh)+' → '+num(b.gridBuyMWh)+' MWh</span><span>弃电 '+num(a.curtailMWh)+' → '+num(b.curtailMWh)+' MWh</span><span>末态SOC '+num(a.socEnd)+' → '+num(b.socEnd)+'%</span><span>按期批任务 '+(b.completed-b.lateCompleted)+'/'+b.total+'；剩余 '+num(b.remainingMWh)+' MWh</span><span>关键在线服务未交付 '+num(b.criticalMissedMWh)+' MWh</span><small>同起点、风光与任务；工业剩余任务：锌 '+num(b.debt.zinc)+'、制造 '+num(b.debt.factory)+' MWh。'+(b.unconvergedSteps?'有 '+b.unconvergedSteps+' 个物理步未收敛；详见左侧完整结果。':'')+'</small></div>':'';
 return {review:stage===5,action,batch,request:req,wind,solar,storage:st,grid:state.gridBuy,remaining:f.queue.remainingMWh,html:'<div class="gc-heading"><b>算力如何跟随绿电</b><span>仿真 +'+clock(f.elapsed)+' / +'+clock(duration)+' · '+(stage<4?'方案预览':stage===5?'复盘':comparison.candidate.constraints.every(c=>c.pass)?'已校核执行回放':'受约束预测回放')+'</span></div><div class="gc-live">'+live+'</div><div class="gc-chart-pair"><section><div class="gc-chart-title">风光出力 · MW <span>青：风电　橙：光伏　蓝：合计；淡线：预设轨迹</span></div>'+weather+'</section><section><div class="gc-chart-title">算力响应 · MW <span>蓝灰：关键 '+(ready?num(command.criticalDeliveredMW):'—')+'　绿：批实际 '+(ready?num(batch):'—')+'　紫虚：批请求 '+(ready?num(req):'—')+'</span></div>'+load+'</section></div><div class="gc-chart-title">任务 A / B / C <span>绿：实际处理　灰：可执行窗口　橙：截止；一分钟采样</span></div>'+lanes+'<p class="gc-action">'+esc(action)+'</p>'+review};
}
return {present};
});
