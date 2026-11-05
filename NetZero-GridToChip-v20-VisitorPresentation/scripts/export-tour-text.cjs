/* Export estimated narration timelines. The same compiler is used by the browser. */
'use strict';
const fs=require('fs'),path=require('path'),N=require('../src/tour-narrative.js');
module.exports=function(root,content){
 const m=N.compile(content),clock=N.clock;
 const intro=['多园区共享综合能源系统 — 导览字幕与配音脚本','','所有时间均为配音制作估算，尚未加载或生成音频。','字幕与镜头时间轴分离，唯一来源：导览文案.json（buildingCaptions 为楼内完整句字幕）。修改后运行 node build.cjs --verify。',`园区段 ${m.exteriorSeconds} 秒；楼内自动段 ${m.insert.duration} 秒；完整参观 ${clock(m.totalSeconds)}。楼内时间已计入全程。`,''];
 const txt=[...intro],md=['# 导览字幕与配音脚本','',...intro.slice(2),'','| 全程时间 | 章节 / 段落 | 镜头 / 类型 | 装备 | 口播正文 |','|---|---|---|---|---|'];
 const csv=[['章节','章节标题','段落ID','范围','段落类型','镜头','关键装备','全程起秒','全程止秒','预计秒数','口播正文','时间性质']];
 for(const r of m.captionTimeline){const eq=r.equipment?content.products[r.equipment].title:'',time=clock(r.globalStart)+'–'+clock(r.globalEnd);txt.push(`${String(r.chapter).padStart(2,'0')}/08 ${r.title} ｜ ${time} ｜ ${r.kind} ｜ ${r.id}`,`镜头：${r.shot}${eq?' ｜ 装备：'+eq:''}`,r.text,'');md.push(`| ${time} | ${r.chapter}/08 · ${r.title} / ${r.id} | ${r.shot} / ${r.kind} | ${eq} | ${r.text.replace(/\|/g,'／')} |`);csv.push([r.chapter,m.chapters[r.chapter-1].title,r.id,r.scope,r.kind,r.shot,eq,r.globalStart,r.globalEnd,r.globalEnd-r.globalStart,r.text,'估算']);}
 txt.push('【独立楼内导览的额外返回段；不计入园区自动参观】');md.push('','## 独立楼内导览的额外返回段','');for(const b of content.buildingCaptions.filter(b=>b.start>=m.insert.to)){txt.push(clock(b.start)+'–'+clock(b.end)+' '+b.title,b.text);md.push('- '+clock(b.start)+'–'+clock(b.end)+' '+b.title+'：'+b.text);}
 md.push('','## 调整说明','','duration 为讲解段时长，move 为该段镜头移动时长，其余时间定点展示。transition 为上下章承接语。compute 的 dc-enter 之后插入楼内段，再播放本章离场语。','字幕按语义分句，与估算时间同步；正式录音后应重新校准时间。','产品功能按用户提供资料与方案设计表达；节能率、吨锌电耗降幅和算力密度提升均未设实测值。');
 fs.writeFileSync(path.join(root,'导览文字.txt'),txt.join('\n'),'utf8');fs.writeFileSync(path.join(root,'导览文字.md'),md.join('\n'),'utf8');
 fs.writeFileSync(path.join(root,'导览配音时间表.csv'),'\ufeff'+csv.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'utf8');
 const stamp=v=>{const ms=Math.round(v*1000);return String(Math.floor(ms/3600000)).padStart(2,'0')+':'+String(Math.floor(ms/60000)%60).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+','+String(ms%1000).padStart(3,'0');};
 fs.writeFileSync(path.join(root,'导览字幕-估算.srt'),m.subtitles.map((r,i)=>`${i+1}\n${stamp(r.start)} --> ${stamp(r.end)}\n${r.text}\n`).join('\n'),'utf8');
 const standalone=content.buildingCaptions;fs.writeFileSync(path.join(root,'独立数据楼字幕-v20.srt'),standalone.map((r,i)=>`${i+1}\n${stamp(r.start)} --> ${stamp(r.end)}\n${N.chunks(r.text).join('\n')}\n`).join('\n'),'utf8');fs.writeFileSync(path.join(root,'独立数据楼讲解稿-v20.txt'),['独立数据楼导览 · 77 秒；短镜头共享完整句字幕',...standalone.map(r=>clock(r.start)+'–'+clock(r.end)+' '+r.text)].join('\n'),'utf8');
 fs.writeFileSync(path.join(root,'导览时间轴-估算.json'),JSON.stringify(m,null,2),'utf8');
 console.log(`Narration: 8 chapters, ${m.timeline.length} cues, ${m.subtitles.length} captions, ${m.totalSeconds}s incl. building`);return m;
};
