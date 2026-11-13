'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'NetZero-GridToChip-v20-VisitorPresentation');
const data=JSON.parse(fs.readFileSync(path.join(base,'导览文案.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'visual-upgrade/webgpu/dist/多园区-v20-r187-WebGPU.html'),'utf8');
const embedded=[];
for(const m of html.matchAll(/window\.NZ_TOUR_SCRIPT=(\{[^\n]+\});/g)){try{embedded.push(JSON.parse(m[1]));}catch{}}
assert(embedded.length,'No live tour script found');assert(embedded.some(x=>JSON.stringify(x)===JSON.stringify(data)),'Current page and source differ');
const model=require(path.join(base,'src/tour-narrative.js')).compile(data),clock=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const release=require(path.join(root,'project-version.json')).version;
const intro=[`# 多园区长时间导览 · 完整介绍词（独立修改稿）`,'',`导出日期：2026-11-13｜页面版本：v${release}｜全程参考时长：${clock(model.totalSeconds)}`,'','本文按当前页面长时间导览的实际播放顺序导出，包含园区八个章节、自动插入的数据中心楼内讲解及转场衔接语。楼内使用当前播放的完整句文案，避免重复列出分镜文字。','', '你可以直接修改下方正文。章节编号、段落 ID 与参考时间便于后续对应回填；文字改长或改短后，播放时长与镜头节奏需要另行校准。修改本副本不会自动改变项目页面。当前时间为脚本安排时间，不是录音实测时长。',''];
const lines=[...intro];let chapter=0;
for(const cue of model.captionTimeline){if(cue.chapter!==chapter){chapter=cue.chapter;lines.push(`## ${String(chapter).padStart(2,'0')} ${model.chapters[chapter-1].title}`,'');}lines.push(`### ${clock(cue.globalStart)}–${clock(cue.globalEnd)} · ${cue.scope==='building'?'楼内讲解':cue.kind==='transition'?'转场衔接':'园区讲解'} · ${cue.id}`,'',cue.text,'');}
const dir=path.join(root,'docs/导览文案'),stem='长时间导览完整介绍词-v'+release+'-独立修改稿';fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,stem+'.md'),lines.join('\n'),'utf8');
fs.writeFileSync(path.join(dir,stem+'.txt'),'\ufeff'+lines.join('\r\n').replace(/^#{1,3} /gm,''),'utf8');
console.log(JSON.stringify({duration:clock(model.totalSeconds),chapters:model.chapters.length,paragraphs:model.captionTimeline.length,files:[path.join(dir,stem+'.txt'),path.join(dir,stem+'.md')]},null,2));
