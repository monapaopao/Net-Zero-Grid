'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=html=>{
 const c=require('./content.cjs'),model=require('../../NetZero-GridToChip-v20-VisitorPresentation/src/tour-narrative.js').compile(c.full),map=new Map(c.audio.rows.map(r=>[r.id,r]));
 const rows=model.captionTimeline.filter(r=>r.text).map(r=>{const a=map.get(r.id);assert.equal(a.text,r.text);assert(a.audioDuration<=r.globalEnd-r.globalStart);return {id:r.id,start:r.globalStart,end:r.globalEnd,duration:a.audioDuration,base64:fs.readFileSync(path.join(__dirname,'../../audio/完整导览/正式版',a.file)).toString('base64')};});
 const script='window.NZ_TOUR_AUDIO_DATA='+JSON.stringify({voice:c.audio.voice,rows})+';\n'+fs.readFileSync(path.join(__dirname,'audio.js'),'utf8');new vm.Script(script);
 html=html.replace('</head>','<script>/* ===== tour-audio.js ===== */\n'+script+'\n</script></head>');
 const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'Audio hook '+a);return s.replace(a,()=>b);};
 html=html.replace(/<script>\/\* ===== premium.js ===== \*\/\r?\n([\s\S]*?)\r?\n<\/script>/,(_,s)=>{
  s=once(s,'function startTour(){',"function startTour(){window.NZ_TOUR_AUDIO.begin();");
  s=once(s,'function tourTick(dtR){if(!tour.active)return;',"function tourTick(dtR){if(!tour.active)return;dtR=window.NZ_TOUR_AUDIO.delta(dtR);if(!window.NZ_TOUR_AUDIO.ready()){paintNarration();return;}");
  s=once(s,'if(child)tour.insideTime=clamp(child.state().time,DC_SEG.from,DC_SEG.to);',"if(child){const state=child.state();tour.insideTime=clamp(state.time,DC_SEG.from,DC_SEG.to);if(window.GOBI_DCDT.transitionState().phase==='visible'&&state.time<DC_SEG.to-.02&&tour.paused===state.playing){tour.paused=!state.playing;$('tourPause').textContent=tour.paused?'继续':'暂停';$('tourBar').classList.toggle('tour-paused',tour.paused);}}");
  s=once(s,"function exitTour(){if(!tour.active)return;",'function exitTour(){if(!tour.active)return;window.NZ_TOUR_AUDIO.stop();');
  s=once(s,"$('tourBar').dataset.caption=(caption||row).id;", "$('tourBar').dataset.caption=(caption||row).id;window.NZ_TOUR_AUDIO.sync(total,tour.paused||tour.closing||(tour.dcWait&&window.GOBI_DCDT.transitionState().phase!=='visible'));");
  s=once(s,'window.GOBI_DCDT.setPlaying(!tour.paused);}', 'window.GOBI_DCDT.setPlaying(!tour.paused);if(tour.active)paintNarration();}');
  new vm.Script(s);return '<script>/* ===== premium.js ===== */\n'+s+'\n</script>';
 });
 return html.replace('字幕与镜头独立编排，配音尚未生成；产品介绍参数与模型读数分别呈现。','已配男声讲解，可暂停或关闭配音；产品介绍参数与模型读数分别呈现。');
};
