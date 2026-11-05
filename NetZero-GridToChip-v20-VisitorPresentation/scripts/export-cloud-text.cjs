'use strict';
module.exports=function(root){
  const fs=require('fs'),path=require('path'),data=require('../src/cloud-visit-content.js');
  const out=['多园区共享综合能源系统 v20 · 情境演示文案','三个协同情境约90秒，SST约108秒；载入和用户暂停另计。','校核通过后自动执行；受约束时自动解释并复盘，不等待人工操作。',''];
  for(const story of data.scenarios){out.push(story.number+' '+story.title,story.summary,'本次重点：'+story.goal);story.steps.forEach((s,i)=>out.push(String(i+1).padStart(2,'0')+' '+s.title,s.text));out.push('口径：'+story.boundary,'');}
  out.push(data.commonBoundary);fs.writeFileSync(path.join(root,'情境演示文案-v20.txt'),out.join('\n'),'utf8');
};
