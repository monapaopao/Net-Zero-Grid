'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=c=>{
 const file=path.join(__dirname,'../../audio/完整导览/正式版/manifest.json');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8')),byId=new Map(manifest.rows.map(r=>[r.id,r]));
 for(const ch of c.full.campus)for(const cue of ch.segments){const r=byId.get(cue.id);if(r){assert.equal(cue.text,r.text);cue.duration=Math.max(cue.duration,Math.ceil(r.audioDuration+.35));}}
 const rows=c.full.buildingCaptions,original=rows.map(r=>r.end-r.start),min=rows.map(r=>{const a=byId.get(r.id);assert.equal(a.text,r.text);return a.audioDuration+.25;}),dur=original.map((d,i)=>Math.max(d,min[i]));
 // Borrow nearby pauses rather than changing speech speed or the 99-second room length.
 for(let i=0;i<rows.length;i++){let extra=dur[i]-original[i];if(extra<=0)continue;const donors=rows.map((_,j)=>j).filter(j=>j!==i).sort((a,b)=>Math.abs(a-i)-Math.abs(b-i)||b-a);for(const j of donors){const amount=Math.min(extra,Math.max(0,dur[j]-min[j]));dur[j]-=amount;extra-=amount;if(extra<1e-7)break;}assert(extra<1e-7,'Insufficient room pause budget');}
 let t=0;rows.forEach((r,i)=>{r.start=+t.toFixed(6);t+=dur[i];r.end=+t.toFixed(6);assert(dur[i]+1e-6>=min[i]);});assert(Math.abs(t-99)<1e-6);rows.at(-1).end=99;
 c.audio=manifest;return c;
};
