'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('./content.cjs'),N=require('../../NetZero-GridToChip-v20-VisitorPresentation/src/tour-narrative.js'),R=require('./model.cjs');
const full=N.compile(c.full),quick=R.compile(c.quick),dir=path.join(__dirname,'exports');fs.mkdirSync(dir,{recursive:true});
const rows={full:full.captionTimeline.map(x=>({id:x.id,chapter:x.chapter,title:x.title,start:x.globalStart,end:x.globalEnd,shot:x.scope==='building'?'building:'+N.clock(full.insert.from+x.globalStart-full.insert.globalStart)+'–'+N.clock(full.insert.from+x.globalEnd-full.insert.globalStart):x.shot,scope:x.scope,text:x.text})),quick:quick.timeline.map(x=>({id:x.id,chapter:x.chapter+1,title:x.title,start:x.start,end:x.end,shot:x.inside?'building:'+N.clock(quick.building.from+x.start-quick.building.at)+'–'+N.clock(quick.building.from+x.end-quick.building.at):x.shot,scope:x.inside?'building':'campus',text:x.text}))};
for(const [key,list]of Object.entries(rows)){
 const duration=key==='full'?full.totalSeconds:quick.duration;assert.equal(list[0].start,0);assert.equal(list.at(-1).end,duration);list.forEach((r,i)=>{if(i)assert.equal(r.start,list[i-1].end);});
 const title=key==='full'?'完整园区导览':'快速预览';
 const md=[`# ${title} · 接入稿与镜头时间表`,'','文案来源为已确认的 Markdown；时间表由网页实际使用的时间轴生成。完整导览已接入云扬男声配音，快速预览暂不配音。楼内起止标记为独立楼内应用的时间；进入、关闭的加载过渡会让墙钟总时长略长于叙述时间轴。',''];
 for(const r of list){md.push(`## ${N.clock(r.start)}–${N.clock(r.end)} · ${r.title}`,`镜头：${r.shot}｜段落：${r.id}｜${r.scope==='building'?'楼内正常速度':'园区镜头'}`,'',r.text||'（无口播，留出返回园区的观察时间。）','');}
 fs.writeFileSync(path.join(dir,title+'-接入稿.md'),md.join('\n'));
 fs.writeFileSync(path.join(dir,title+'-时间轴.json'),JSON.stringify({version:require('../../project-version.json').version,duration,rows:list},null,2)+'\n');
 fs.writeFileSync(path.join(dir,title+'-镜头表.csv'),'\ufeff'+['起点,终点,章节,镜头,段落,口播',...list.map(r=>[N.clock(r.start),N.clock(r.end),r.title,r.shot,r.id,r.text].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')+'\n');
}
console.log(`PASS updated narration and continuous ${full.totalSeconds}s / ${quick.duration}s timelines; exported narration and shot sheets`);
