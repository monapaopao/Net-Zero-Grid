(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NZ_STRATEGY_STORY=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const starts=[0,10,32,43,53,77],cases={success:{initialSoc:35,gridLimitMW:250},limited:{initialSoc:12,gridLimitMW:80}};
const steps=[
 {title:'先看资源具备时的调度效果',text:'同样的风光与任务，初始 SOC 35%、购电上限 250 MW。A 固定功率处理，B 按期限与绿电余量安排；两者资源完全相同。'},
 {title:'成功工况：从保供到按期交付',text:'回放两小时过程，比较两种策略的实际处理功率与任务进度。更多完成任务可能需要更多购电，不能只看购电是否下降。'},
 {title:'成功的标准是保供与交付',text:'候选方案通过关键服务、批任务期限与物理边界检查。对照累计购电和剩余工作量，说明多交付所需的代价。'},
 {title:'保持风光和任务，降低可用资源',text:'切换至初始 SOC 12%、购电上限 80 MW。设备容量、风光和任务不变。这是另一组工况，不能把工况之间的差别归因于调度策略。'},
 {title:'受限工况：调度也有能力边界',text:'两种策略都存在关键服务未交付与任务逾期。候选方案减少积压，但不能弥补前期供给不足；当前仅回放预测后果。'},
 {title:'资源决定可行空间，策略决定利用方式',text:'资源具备时，候选策略保障按期交付；资源受限时，两种策略均未达标。每个工况内部公平比较策略，工况之间明确标出资源差异。'}
];
function at(t){const index=starts.reduce((a,v,i)=>t>=v?i:a,0),caseId=t<43?'success':'limited',execution=index===1||index===4,review=index===2||index===5;let fraction=index===1?(t-10)/22:index===4?(t-53)/24:index===2||index===5?1:0;return {index,caseId,execution,review,fraction:Math.max(0,Math.min(1,fraction)),stage:execution?'execute':review?'review':index===3?'transition':'forecast',...cases[caseId]};}
const n=(x,d=1)=>Number.isFinite(x)?x.toFixed(d):'—';
function decorate(d,pair,t){const p=at(t),name=p.caseId==='success'?'资源具备工况':'资源受限工况',scope='<div class="strategy-condition"><b>'+name+'</b><span>初始 SOC '+p.initialSoc+'% · 购电上限 '+p.gridLimitMW+' MW</span><small>本工况 A/B 同资源、同风光、同任务；另一工况仅改变初始 SOC 与购电通道。</small></div>';
 const a=pair.success.baseline.summary,b=pair.success.candidate.summary,c=pair.limited.baseline.summary,e=pair.limited.candidate.summary;
 const conclusion=p.caseId==='success'?'候选按期完成 '+(b.completed-b.lateCompleted)+'/'+b.total+' 项，关键在线服务未交付 '+n(b.criticalMissedMWh,2)+' MWh；相对基准增加购电 '+n(b.gridBuyMWh-a.gridBuyMWh)+' MWh，多处理 '+n(b.processedMWh-a.processedMWh)+' MWh 等效工作量。':'两种策略均未满足保供与期限要求；候选减少积压，但未解决前期供给不足。';
 if(p.index===2||p.index===5){
  const row=(label,A,B)=>'<tr><th>'+label+'</th><td>'+n(A)+'</td><td>'+n(B)+'</td></tr>';
  const table=(title,A,B)=>'<section><b>'+title+'</b><table><thead><tr><th>两小时结果</th><th>A 基准</th><th>B 候选</th></tr></thead><tbody>'+row('购电量 MWh',A.gridBuyMWh,B.gridBuyMWh)+row('按期完成／3项',A.completed-A.lateCompleted,B.completed-B.lateCompleted)+row('剩余工作 MWh',A.remainingMWh,B.remainingMWh)+row('关键未交付 MWh',A.criticalMissedMWh,B.criticalMissedMWh)+row('末态 SOC %',A.socEnd,B.socEnd)+row('末态储氢 kg',A.h2EndKg,B.h2EndKg)+row('制造剩余 MWh',A.debt.factory,B.debt.factory)+row('电解锌剩余 MWh',A.debt.zinc,B.debt.zinc)+'</tbody></table></section>';
  if(p.index===2)return {...d,review:true,html:'<div class="gc-heading"><b>成功工况：按期交付，而非单纯少购电</b><span>两小时完整结果</span></div>'+scope+'<div class="strategy-final strategy-single">'+table('同一起点、风光与任务',a,b)+'</div><p class="strategy-conclusion">'+conclusion+'</p><small class="strategy-boundary">候选通过本模型全部边界检查；工业生产与库存代价同时保留，购电差不代表全部代价。基准有 '+a.deadlineMissed+' 项未按期交付；下一段仅改变资源条件，保持设备容量、风光与任务不变。</small>'};
  return {...d,review:true,html:'<div class="gc-heading"><b>两个工况，一套公平比较方法</b><span>方案能力 · 两小时模型结果</span></div><div class="strategy-final">'+table('资源具备：SOC 35% · 购电上限250 MW',a,b)+table('资源受限：SOC 12% · 购电上限80 MW',c,e)+'</div><p class="strategy-conclusion">'+conclusion+' 资源具备时，候选通过检查，但并非购电更少。</p><small class="strategy-boundary">设备容量、风光轨迹、任务需求均保持一致。库存、工业生产代价和完整校核可在左侧详情核对；模型结果不代表现场业绩。</small>'};
 }
 return {...d,html:scope+(p.index===3?'<p class="strategy-conclusion">切换条件：SOC 35% → 12%；购电上限250 → 80 MW。此箭头仅表示工况切换。</p>':'')+d.html+(p.index===2?'<p class="strategy-conclusion">'+conclusion+'</p>':'')};
}
return {at,cases,starts,steps,decorate};
});
