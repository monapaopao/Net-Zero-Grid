/* Independent reception timeline: no speed-up of the full tour. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NZ_RECEPTION_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const readingCharacters=text=>(text.match(/[\p{L}\p{N}]/gu)||[]).length;
  function compile(data){
    const readingLimit=data.timing?.maxCharactersPerSecond??5.2;
    if(!(readingLimit>0&&readingLimit<=5.2))throw Error('Invalid reception reading limit');
    let time=0;const ids=new Set(),timeline=[],chapters=data.chapters.map((chapter,index)=>{
      const start=time,cues=chapter.cues.map(cue=>{if(ids.has(cue.id)||!(cue.duration>=4)||cue.move<0||cue.move>cue.duration||typeof cue.text!=='string'||!cue.text.endsWith('。'))throw Error('Invalid reception cue '+cue.id);const readingRate=readingCharacters(cue.text)/cue.duration;if(readingRate>readingLimit+1e-8)throw Error('Reception reading budget exceeded '+cue.id);ids.add(cue.id);const row={...cue,start:time,end:time+cue.duration,chapter:index,title:chapter.title,readingRate};time=row.end;timeline.push(row);return row;});
      if(Math.abs(time-start-chapter.duration)>1e-8)throw Error('Reception chapter duration '+chapter.id);
      return {...chapter,index,start,end:time,cues};
    });
    if(time!==180||time!==data.duration)throw Error('Reception must be 180 seconds');
    if(data.building.until-data.building.at!==data.building.to-data.building.from)throw Error('Building excerpt must play at normal speed');
    const inside=timeline.filter(cue=>cue.inside);
    if(!inside.length||inside[0].start!==data.building.at||inside.at(-1).end!==data.building.until||inside.some((cue,index)=>index&&cue.start!==inside[index-1].end))throw Error('Building excerpt must match inside narration');
    return {title:data.title,duration:time,chapters,timeline,building:data.building,collaboration:data.collaboration,readingLimit};
  }
  function at(model,time){const t=clamp(time,0,model.duration-1e-9),cue=model.timeline.find(c=>t>=c.start&&t<c.end);return {cue,chapter:model.chapters[cue.chapter]};}
  function frameAt(run,elapsed){const frames=run.frames;let low=0,high=frames.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(frames[mid].elapsed<=elapsed)low=mid;else high=mid-1;}return frames[low];}
  return {compile,at,frameAt,clamp,readingCharacters};
});
