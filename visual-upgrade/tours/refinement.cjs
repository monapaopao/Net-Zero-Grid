'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=c=>{
 const old=JSON.parse(fs.readFileSync(path.join(__dirname,'../../NetZero-GridToChip-v20-VisitorPresentation/导览文案.json'),'utf8'));
 const b=c.full,fast=c.quick;
 const outside='数据园区由数据中心、集中冷站、后备电源与网络运维设施共同支撑。';
 const enter='现在进入数据中心，沿供电链路探索直流配电、机柜与冷却设施。';
 const hvdc='西比里高效直流供电，通过缩短链路、减少重复转换，降低供电损耗，让能源系统与算力高效衔接。';
 let time=0;const mapped=[];
 b.building=old.building.map((s,i)=>{const duration=(s.end-s.start)+(i===0?7:i===12?9:i===15||i===16?3:0),r={...s,start:time,end:time+duration};time=r.end;mapped.push({oldStart:s.start,oldEnd:s.end,start:r.start,end:r.end});return r;});
 const remap=t=>{if(t===0)return 7;const r=mapped.find(x=>t>=x.oldStart&&t<=x.oldEnd)||mapped.at(-1);return r.start+(t-r.oldStart)/(r.oldEnd-r.oldStart)*(r.end-r.start);};
 b.buildingCaptions=[{id:'entry-new',start:0,end:7,text:enter},...old.buildingCaptions.map(s=>({...s,start:remap(s.start),end:remap(s.end),text:s.start===39?hvdc:s.text}))];
 b.timing.buildingInsert={chapter:'compute',afterSegment:'dc-enter',from:0,to:time};b.version=fast.version='21.4.0';
 Object.assign(b.shots,{solar:{pos:[20,225,320],tgt:[-155,15,5]},line:{pos:[135,115,170],tgt:[35,15,-15]},hub:{pos:[145,115,150],tgt:[35,4,-7]},zincWide:{pos:[185,66,-150],tgt:[131,3,-225]},factoryDemand:{pos:[390,145,235],tgt:[280,3,55]},gate:{pos:[95,40,230],tgt:[95,0,90]}});
 const weights=s=>(s.match(/[\p{L}\p{N}]/gu)||[]).length;
 function chunks(texts,duration,shots,prefix){let left=duration,sum=texts.reduce((n,s)=>n+weights(s),0);return texts.map((text,i)=>{const d=i===texts.length-1?left:Math.round(duration*weights(text)/sum);left-=d;const shot=shots[Math.min(i,shots.length-1)];return {id:prefix+'-'+i,text,duration:d,shot,move:i===0||shot!==shots[Math.min(i-1,shots.length-1)]?Math.min(7,d):0,kind:'narration'};});}
 const shots=[['home'],['solar','windClose'],['line','hub','hub'],[],['zincWide'],['nuclear'],['factoryDemand','charge','chargePower','chargePower'],['gate']];
 b.campus.forEach((ch,i)=>{if(i===3){ch.text=outside;ch.segments=[{id:'dc-enter',text:outside,duration:8,shot:'dcCampus',move:5,kind:'narration'},{id:'dc-next',text:'',duration:2,shot:'dcEntry',move:0,kind:'transition'}];return;}
  let paragraphs=c.approved.full[i].paragraphs;if(i===1){const t=paragraphs.join(''),cut=t.indexOf('。')+1;paragraphs=[t.slice(0,cut),t.slice(cut)];}ch.segments=chunks(paragraphs,c.approved.full[i].end-c.approved.full[i].start,shots[i],'full-refine-'+i);
  for(const [j,s]of ch.segments.entries()){if(i===0)s.move=0;if(i===4)s.focus='zinc';if(i===6&&j===0){s.factoryRoof='open';s.factoryMode='overview';}if(i===6&&j>0)s.focus='charge';}
 });
 b.campus.at(-1).segments.push({id:'full-gate-hold',text:'',duration:3,shot:'gate',move:0,kind:'transition'});
 const ids=['home','solar','line','dcCampus','zincWide','nuclear','factoryDemand','charge','gate'];
 fast.chapters.forEach((ch,i)=>{if(i===3){ch.cues=[{id:'quick-dc-exterior',text:outside,duration:8,move:5,shot:'dcCampus'},...b.buildingCaptions.map(s=>({id:'quick-'+s.id,text:s.text,duration:s.end-s.start,move:0,shot:'dcEntry',inside:true})),{id:'quick-dc-return',text:'',duration:2,move:0,shot:'dcEntry'}];ch.duration=8+time+2;return;}
  ch.cues=chunks(c.approved.quick[i].paragraphs,ch.duration,[ids[i],i===1?'windClose':i===2?'hub':i===7?'chargePower':ids[i]],'quick-refine-'+i);
  if(i===0)ch.cues.forEach(s=>s.move=0);if(i===4)ch.cues.forEach(s=>s.zincRoof=true);if(i===6)ch.cues.forEach(s=>{s.factoryRoof='open';s.factoryMode='overview';});if(i===1)ch.cues.forEach(s=>s.wind=s.shot==='windClose');
 });
 fast.chapters.at(-1).cues.push({id:'quick-gate-hold',text:'',duration:3,move:0,shot:'gate'});fast.chapters.at(-1).duration+=3;
 let qt=0;fast.chapters.forEach(ch=>{if(ch.id==='compute')fast.building={at:qt+8,until:qt+8+time,from:0,to:time};qt+=ch.duration;});fast.duration=qt;fast.title='快速预览';
 // Apply the approved room narration to the full route only, after quick cues are copied.
 const md=fs.readFileSync(path.join(__dirname,'../../docs/导览文案/数据中心楼内讲解词-99秒-润色稿.md'),'utf8');
 const captions=[...md.matchAll(/^## (\d+)｜(\d\d):(\d\d)–(\d\d):(\d\d)\r?\n\s*对应画面：[^\n]+\r?\n\s*([^\n]+)(?=\r?\n|$)/gm)].map(m=>({id:'full-room-approved-'+m[1],start:+m[2]*60+(+m[3]),end:+m[4]*60+(+m[5]),text:m[6].trim()}));
 const assert=require('node:assert/strict');assert.equal(captions.length,11);assert.equal(captions[0].start,0);assert.equal(captions.at(-1).end,time);captions.forEach((s,i)=>{if(i)assert.equal(s.start,captions[i-1].end);assert(s.end>s.start);});
 b.buildingCaptions=captions;b.version=require('../../project-version.json').version;
 c.buildingDuration=time;return require('./audio-timing.cjs')(c);
};
