'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),legacy=path.join(root,'NetZero-GridToChip-v20-VisitorPresentation');
const read=name=>fs.readFileSync(path.join(root,'docs/导览文案',name),'utf8');
function parse(text){return [...text.split('\n---')[0].matchAll(/^## (\d+) (.*?)｜(\d\d):(\d\d)–(\d\d):(\d\d)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(m=>({title:m[2],start:+m[3]*60+(+m[4]),end:+m[5]*60+(+m[6]),paragraphs:m[7].trim().split(/\r?\n\s*\r?\n/).filter(Boolean)}));}
const count=s=>(s.match(/[\p{L}\p{N}]/gu)||[]).length;
function distribute(texts,total){const weights=texts.map(count),sum=weights.reduce((a,b)=>a+b,0);let remain=total;return texts.map((text,i)=>{const duration=i===texts.length-1?remain:Math.max(2,Math.round(total*weights[i]/sum));remain-=duration;assert(duration>0);assert(count(text)/duration<=5.5,'Narration reading budget: '+text);return {text,duration};});}
function sentences(ps){return ps.flatMap(p=>p.match(/[^。！？]+[。！？]|[^。！？]+$/g)||[]);}
const longText=read('五分钟展厅导览介绍词-v21.2.0-定稿.md'),quickText=read('三分钟快速预览介绍词-v21.2.0-独立修改稿.md');
const full=parse(longText),quick=parse(quickText);assert.equal(full.length,8);assert.equal(quick.length,9);
const base=JSON.parse(fs.readFileSync(path.join(legacy,'导览文案.json'),'utf8'));
base.version='21.3.0';
base.shots.chargePower={pos:[78,28,126],tgt:[42,2,88]};base.shots.factoryDemand={pos:[350,105,185],tgt:[280,3,18]};
const groups=['overview','generation','power','compute','hydrogen','nuclear','loads','overview'];
const shotLists=[['home'],['solar','windClose'],['line','line','storage','hub'],['dcCampus','dcEntry'],['chemical','zinc'],['nuclear'],['factoryDemand','charge','chargePower'],['home']];
function shotFor(index,j,total){if(index===6)return j<2?'factoryDemand':j<4?'charge':'chargePower';const list=shotLists[index];return list[Math.min(list.length-1,Math.floor(j*list.length/total))];}
base.campus=full.map((c,i)=>{const old=base.campus[i];let chunks=sentences(c.paragraphs),total=c.end-c.start;
 if(i===3){chunks=c.paragraphs.slice(0,2);total=28;}
 const segments=distribute(chunks,total).map((x,j)=>({...x,id:i===3&&j===chunks.length-1?'dc-enter':`full-${i+1}-${j+1}`,shot:shotFor(i,j,chunks.length),move:j===0?(i===0?0:Math.min(7,x.duration)):shotFor(i,j,chunks.length)!==shotFor(i,j-1,chunks.length)?Math.min(6,x.duration):0,kind:'narration',...(i===2&&j<2?{focus:'line'}:{}),...(i===6&&j>=2?{focus:'charge'}:{})}));
 if(i===3)segments.push({id:'dc-next',text:'',duration:2,move:0,shot:'dcEntry',kind:'transition'});
 return {...old,title:c.title,text:c.paragraphs.join(''),group:groups[i],segments};});
base.timing.buildingInsert={chapter:'compute',afterSegment:'dc-enter',from:42,to:77};
// Outside the inserted interval the building keeps its independent tour captions.
const inside=distribute(full[3].paragraphs.slice(2),35);let bt=42;
base.buildingCaptions=[{id:'full-building-pre',start:0,end:42,text:''},...inside.map((x,i)=>{const row={id:'full-building-'+(i+1),start:bt,end:bt+x.duration,text:x.text};bt=row.end;return row;})];
const oldQuick=JSON.parse(fs.readFileSync(path.join(legacy,'三分钟接待文案.json'),'utf8'));
const ids=['welcome','generation','energy','compute','chemical','nuclear','factory','charging','closing'];
const contexts=['overview','wind','energy','compute','chemical','nuclear','factory','public','overview'];
const labels=[['wind','solar','dc','factory'],['windNacelle','solar'],['line','substation','storage'],['dc','cooling'],['metal','nh3','pem'],['smr'],['factory'],['supercharge','panamaSc'],['wind','dc','factory']];
const qshots=[['home'],['solar','windClose'],['line','storage'],['dcPower'],['chemical','zinc'],['nuclear'],['factoryDemand'],['charge','chargePower'],['home']];
const fast={...oldQuick,version:'21.3.0',title:'三分钟快速预览',building:{at:70,until:94,from:50,to:74}};
fast.chapters=quick.map((c,i)=>{const chunks=c.paragraphs,list=qshots[i];return {id:ids[i],title:c.title,duration:c.end-c.start,context:contexts[i],labels:labels[i],flows:i===0||i===8?[]:i===3?['power','data','cooling']:['power','control'],scope:i===5?'区外核电基荷 · 研究场景':i===7?'产品展示 · 参考参数非实时读数':'多园区融合能源方案',cues:distribute(chunks,c.end-c.start).map((x,j)=>({...x,id:`quick-new-${i+1}-${j+1}`,move:j===0?(i===0?0:Math.min(6,x.duration)):i===1&&j===1?Math.min(6,x.duration):0,shot:list[Math.min(list.length-1,Math.floor(j*list.length/chunks.length))],...(i===3?{inside:true}:{}),...(i===1&&j>0?{wind:true}:{})}))};});
function compact(s){return s.replace(/\s/g,'');}
const compiled=require(path.join(legacy,'src/tour-narrative.js')).compile(base);
assert.equal(compiled.totalSeconds,300);assert.equal(compact(compiled.captionTimeline.map(c=>c.text).join('')),compact(full.flatMap(c=>c.paragraphs).join('')));
assert.equal(compact(fast.chapters.flatMap(c=>c.cues.map(x=>x.text)).join('')),compact(quick.flatMap(c=>c.paragraphs).join('')));
module.exports={full:base,quick:fast,approved:{full,longText,quick,quickText},count};
module.exports=require('./refinement.cjs')(module.exports);
