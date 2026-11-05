/* Audience summaries are derived from the same recorded comparison, never fixed benefits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NZ_VISITOR_RESULTS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const n=(v,d=3)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const change=(delta,unit)=>Math.abs(delta)<1e-7?'基本持平':(delta<0?'减少 ':'增加 ')+n(Math.abs(delta))+' '+unit;
  function sst(comparison){
    const a=comparison.variants.existing.summary,b=comparison.variants.sst.summary,c=comparison.variants.coordinated.summary;
    return {scope:'两小时代表支路 · 参数为演示假设 · 不外推全园区',cards:[
      {title:'装备变化 A → B',value:n(a.conversionLossMWh)+' → '+n(b.conversionLossMWh)+' MWh',detail:'变换损耗'+change(b.conversionLossMWh-a.conversionLossMWh,'MWh')+'。相同调度下比较装备假设；损耗降幅不是全园区节能率。'},
      {title:'协同变化 B → C',value:n(b.maxGridImportMW,1)+' → '+n(c.maxGridImportMW,1)+' MW',detail:'接入点峰值'+change(c.maxGridImportMW-b.maxGridImportMW,'MW')+'。天气、需求、初始库存和设备容量保持一致。'},
      {title:'库存、弃电与交付代价',value:n(b.batteryEndMWh)+' → '+n(c.batteryEndMWh)+' MWh',detail:'末态电池如上；弃电'+change(c.curtailMWh-b.curtailMWh,'MWh')+'。IT交付 '+n(b.itMWh,2)+' → '+n(c.itMWh,2)+' MWh；充电交付 '+n(b.chargingMWh,2)+' → '+n(c.chargingMWh,2)+' MWh；C方案 IT缺供 '+n(c.unservedITMWh)+'、截止未交付 '+n(c.missedAtDeadlineMWh)+' MWh。库存消耗不能当作节能。'}
    ]};
  }
  return {sst};
});
