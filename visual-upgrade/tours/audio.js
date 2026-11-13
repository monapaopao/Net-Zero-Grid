/* One approved narrator, local audio, driven by the full tour's timeline. */
'use strict';
window.NZ_TOUR_AUDIO=(()=>{
 const data=window.NZ_TOUR_AUDIO_DATA,cache=new Map();
 let ctx,gain,meter,pending,active=false,muted=false,source=null,current=null,origin=0,lastTick=0,button,error='',generation=0,lastFrame=null,starts=0;
 function cut(){if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}current=null;}
 function paint(){if(!button)return;button.textContent=error?'配音重试':pending?'配音准备中…':muted?'配音：关':'配音：开';button.setAttribute('aria-pressed',String(!muted));button.title=error||'完整导览男声配音';}
 function mount(){if(button)return;button=document.createElement('button');button.id='tourVoice';button.type='button';button.className='iconbtn';button.addEventListener('click',async()=>{if(error||ctx?.state==='suspended'){await prepare();}else{muted=!muted;if(muted)cut();paint();}if(lastFrame)sync(lastFrame.time,lastFrame.paused);});document.querySelector('#tourBar .tbtns').append(button);paint();}
 async function prepare(){
  if(pending)return pending;error='';
  try{if(!ctx){ctx=new AudioContext();gain=ctx.createGain();meter=ctx.createAnalyser();meter.fftSize=256;gain.connect(meter);meter.connect(ctx.destination);}await ctx.resume();
   const job=Promise.all(data.rows.map(async r=>{if(cache.has(r.id))return;const bytes=Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0));const buffer=await ctx.decodeAudioData(bytes.buffer);cache.set(r.id,buffer);}));pending=job;paint();await job;pending=null;lastTick=ctx.currentTime;paint();
  }catch(e){pending=null;error='配音加载未完成，请点击重试';cut();paint();}
 }
 function begin(){generation++;active=true;lastFrame=null;cut();mount();prepare();}
 function ready(){return !active||muted||(!pending&&!error&&cache.size===data.rows.length&&ctx?.state==='running');}
 function sync(time,paused){
  // The room's own play/pause control also controls its narration.
  if(active&&window.__NZ_TEST?.tourState().dcWait&&window.GOBI_DCDT?.transitionState().phase==='visible'){
   try{paused=paused||document.getElementById('dcdtFrame').contentWindow.NZ_BUILDING_TOUR.state().playing===false;}catch{}
  }
  lastFrame={time,paused};if(!active)return;
  if(paused||!ready()||muted){cut();return;}
  const row=data.rows.find(r=>time>=r.start&&time<r.end),buffer=row&&cache.get(row.id),offset=row?time-row.start:0;
  if(!row||!buffer||offset>=buffer.duration){cut();return;}
  if(current===row.id&&source&&Math.abs((ctx.currentTime-origin)-offset)<.6)return;
  cut();source=ctx.createBufferSource();source.buffer=buffer;source.connect(gain);current=row.id;origin=ctx.currentTime-offset;starts++;
  const node=source;node.onended=()=>{if(source===node){node.disconnect();source=null;}};node.start(0,Math.max(0,offset));
 }
 function delta(fallback){if(!ctx||!active)return fallback;const now=ctx.currentTime,dt=lastTick?now-lastTick:fallback;lastTick=now;return muted?fallback:Math.max(0,dt);}
 function stop(){generation++;active=false;cut();lastFrame=null;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active){const a=window.__NZ_TEST;if(a?.tourState().active&&!a.tourState().paused)a.toggleTourPause();cut();}});
 function peak(){if(!meter)return 0;const values=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(values);return values.reduce((n,v)=>Math.max(n,Math.abs(v)),0);}
 return {begin,ready,sync,delta,stop,state:()=>({active,muted,pending:!!pending,error,context:ctx?.state||'uninitialized',decoded:cache.size,clips:data.rows.length,current,position:current&&ctx?ctx.currentTime-origin:null,starts,generation,playing:!!source,frame:lastFrame,peak:peak()})};
})();
