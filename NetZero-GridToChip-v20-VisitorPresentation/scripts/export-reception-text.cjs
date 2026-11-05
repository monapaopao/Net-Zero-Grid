'use strict';
module.exports=function(root,data){
  const fs=require('fs'),path=require('path'),model=require('../src/reception-model.js').compile(data);
  const time=(t,ms=false)=>{const n=Math.round(t*1000),h=Math.floor(n/3600000),m=Math.floor(n/60000)%60,s=Math.floor(n/1000)%60;return (ms?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+(ms?','+String(n%1000).padStart(3,'0'):'');};
  const coordination=model.chapters.find(c=>c.id==='coordination');
  const text=['多园区共享综合能源系统 v20 · 三分钟接待讲解稿','总时长 03:00；独立编排，非完整导览倍速。',`楼内选段：原时间轴${model.building.from}–${model.building.to}秒，正常速度；协同：${coordination.duration}秒回放2小时预设推演。`,''];
  model.chapters.forEach(c=>{text.push(`${String(c.index+1).padStart(2,'0')} ${c.title}　${time(c.start)}–${time(c.end)}`,c.scope);c.cues.forEach(s=>text.push(`[${time(s.start)}–${time(s.end)}] ${s.text}`));text.push('');});
  fs.writeFileSync(path.join(root,'三分钟接待讲解稿-v20.txt'),text.join('\n'),'utf8');
  fs.writeFileSync(path.join(root,'三分钟接待时间轴-v20.json'),JSON.stringify(model,null,2),'utf8');
  fs.writeFileSync(path.join(root,'三分钟接待配音时间表-v20.csv'),'\ufeff章节,标题,开始秒,结束秒,讲解内容\n'+model.timeline.map(r=>[r.chapter+1,r.title,r.start,r.end,r.text].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n'),'utf8');
  fs.writeFileSync(path.join(root,'三分钟接待字幕-v20.srt'),model.timeline.map((r,i)=>`${i+1}\n${time(r.start,true)} --> ${time(r.end,true)}\n${r.text}\n`).join('\n'),'utf8');
  return model;
};
