const assert=require('assert/strict'),fs=require('fs'),fixture=require('./visitor-fixture.cjs');
for(const owner of ['tour','reception']){
 const f=fixture(),bar=f.document.createElement('aside');bar.id=owner==='tour'?'tourBar':'receptionBar';const buttons=f.document.createElement('div');buttons.classList.add('tbtns');bar.append(buttons);f.document.body.append(bar);f.load('visitor-view.js');const v=f.sandbox.NZ_VISITOR_VIEW;v.ready(f.api);v.enter({owner});const p=f.nodes.get('visitorMetrics');
 v.update({owner,title:'多园区共享综合能源系统',lookKey:'overview',metrics:[{label:'本章重点',value:'多园区共享综合能源系统'}]});assert(!p.hidden);assert(p.innerHTML.includes('风光储与多类负荷联动'));assert(!p.innerHTML.includes('本章重点'));assert(!p.innerHTML.includes('多园区共享综合能源系统'));
 v.update({owner,lookKey:'compute',metrics:[{label:'IT负载',value:'150',unit:'MW',note:'模型快照'}]});assert(p.innerHTML.includes('150 MW'));assert(p.innerHTML.includes('模型快照'));
 v.update({owner,lookKey:'sst',metrics:[]});assert(p.innerHTML.includes('前瞻研究'));v.update({owner,lookKey:'unknown',metrics:[]});assert(p.hidden);assert(bar.classList.contains('visitor-no-look'));v.exit(owner);assert(!bar.classList.contains('visitor-no-look'));
 v.enter({owner:'cloud'});v.update({owner:'cloud',title:'情境标题',metrics:[{label:'指标',value:'12'}]});assert(!p.hidden);assert(p.innerHTML.includes('visitor-metric-heading'));assert(p.innerHTML.includes('12'));v.exit('cloud');console.log('PASS '+owner+' highlights, metrics, empty fallback, restore and cloud isolation');
}
const css=fs.readFileSync('src/visitor-view.css','utf8');assert(css.includes('flex:0 1 30%'));assert(css.includes('flex:1 1 calc(70% - 14px)'));assert(css.includes('border-top:1px solid #e5eeea'));console.log('PASS desktop split and mobile stacking source contracts');
