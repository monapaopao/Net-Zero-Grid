/* v17: one deterministic script drives captions, camera cues and offline exports. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NZ_TOUR_NARRATIVE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function chunks(text,max=34){const out=[];let line='';for(const phrase of text.match(/[^，。！？；：]+[，。！？；：]?/g)||[text]){if(line.length+phrase.length>max&&line){out.push(line);line='';}if(phrase.length>max){if(line){out.push(line);line='';}for(let i=0;i<phrase.length;i+=max)out.push(phrase.slice(i,i+max));}else line+=phrase;}if(line)out.push(line);return out;}
 function compile(data){
   if(data.campus.length!==8)throw Error('Expected eight tour chapters');
   const ids=new Set();let exterior=0;const gate=data.timing.buildingInsert,buildingSeconds=gate.to-gate.from;
   const chapters=data.campus.map((c,i)=>{let local=0;const segments=c.segments.map(s=>{if(ids.has(s.id))throw Error('Duplicate cue '+s.id);ids.add(s.id);if(!(s.duration>0)||s.move<0||s.move>s.duration)throw Error('Invalid cue duration '+s.id);if(!['home','windClose','windWide'].includes(s.shot)&&!data.shots[s.shot])throw Error('Unknown shot '+s.shot);if(s.equipment&&!data.products[s.equipment])throw Error('Unknown product '+s.equipment);const cue={...s,start:local,end:local+s.duration,chapterIndex:i};local=cue.end;return cue;});const chapter={...c,index:i,segments,dur:local,exteriorStart:exterior};exterior+=local;return chapter;});
   const compute=chapters.find(c=>c.id===gate.chapter),boundary=compute.segments.find(s=>s.id===gate.afterSegment);if(!boundary||!compute.segments.some(s=>s.kind==='transition'&&s.start>=boundary.end))throw Error('Building return requires an outgoing transition');
   const insert={...gate,chapter:compute.index,at:boundary.end,duration:buildingSeconds,globalStart:compute.exteriorStart+boundary.end};
   const timeline=[];
   for(const c of chapters)for(const s of c.segments){const after=c.index>insert.chapter||(c.index===insert.chapter&&s.start>=insert.at);timeline.push({...s,chapter:c.index+1,title:c.title,scope:'campus',globalStart:c.exteriorStart+s.start+(after?buildingSeconds:0),globalEnd:c.exteriorStart+s.end+(after?buildingSeconds:0)});if(c.index===insert.chapter&&s.id===gate.afterSegment)for(const b of data.building.filter(b=>b.start<gate.to&&b.end>gate.from)){timeline.push({...b,kind:'building',shot:'building:'+b.id,chapter:c.index+1,title:b.title,scope:'building',globalStart:insert.globalStart+Math.max(b.start,gate.from)-gate.from,globalEnd:insert.globalStart+Math.min(b.end,gate.to)-gate.from});}}
   timeline.sort((a,b)=>a.globalStart-b.globalStart);
   const buildingCaptions=data.buildingCaptions||data.building;
   if(buildingCaptions[0].start!==0||buildingCaptions.at(-1).end!==data.building.at(-1).end||buildingCaptions.some((c,i)=>!(c.end>c.start)||i&&c.start!==buildingCaptions[i-1].end))throw Error('Building captions must cover the visual tour continuously');
   const captionTimeline=timeline.filter(c=>c.scope!=='building').concat(buildingCaptions.filter(c=>c.start<gate.to&&c.end>gate.from).map(c=>({...c,chapter:compute.index+1,title:compute.title+' · 楼内',kind:'building',scope:'building',shot:'building:'+c.id,cueIds:data.building.filter(b=>b.start<c.end&&b.end>c.start).map(b=>b.id),globalStart:insert.globalStart+Math.max(c.start,gate.from)-gate.from,globalEnd:insert.globalStart+Math.min(c.end,gate.to)-gate.from}))).sort((a,b)=>a.globalStart-b.globalStart);
   if(captionTimeline.some((c,i)=>i&&Math.abs(c.globalStart-captionTimeline[i-1].globalEnd)>1e-8))throw Error('Narration caption gap');
   const subtitles=captionTimeline.map(c=>({cue:c.id,chapter:c.chapter,scope:c.scope,start:c.globalStart,end:c.globalEnd,text:chunks(c.text).join('\n')}));
   return {version:data.version,chapters,insert,exteriorSeconds:exterior,totalSeconds:exterior+buildingSeconds,timeline,captionTimeline,subtitles,estimated:true,products:data.products};
 }
 function at(chapter,t){return chapter.segments.find(s=>t>=s.start&&t<s.end)||chapter.segments[chapter.segments.length-1];}
 function subtitleAt(model,t){return model.subtitles.find(s=>t>=s.start&&t<s.end)||null;}
 function captionAt(model,t){const rows=model.captionTimeline||model.timeline;return rows.find(s=>t>=s.globalStart&&t<s.globalEnd)||rows.at(-1);}
 function globalTime(model,chapter,t,inside=null,completed=false){const c=model.chapters[chapter],b=model.insert;if(chapter===b.chapter&&inside!==null)return b.globalStart+Math.max(0,Math.min(b.duration,inside-b.from));return c.exteriorStart+t+(chapter>b.chapter||(chapter===b.chapter&&completed&&t>=b.at)?b.duration:0);}
 const clock=v=>{const n=Math.max(0,Math.floor(v));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
 return {compile,at,subtitleAt,captionAt,globalTime,chunks,clock};
});
