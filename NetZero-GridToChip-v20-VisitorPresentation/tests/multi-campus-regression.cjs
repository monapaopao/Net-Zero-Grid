/* Spatial release must preserve dispatch, mass balance and cumulative bookkeeping. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..'),BASE=path.join(ROOT,'../NetZero-GridToChip-v12-NacelleEnergyFlows');
const C8=require(path.join(BASE,'src/config.js')),C9=require(path.join(ROOT,'src/config.js'));
const F8=require(path.join(BASE,'src/engine.js')),F9=require(path.join(ROOT,'src/engine.js'));
const report={checks:{},scenarios:{},backupManifest:[]};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(hash(path.join(BASE,'src/engine.js')),hash(path.join(ROOT,'src/engine.js')));report.checks.kernelByteIdentical=true;
for(const key of ['TIME','PLANT','GRID','POWER_QUALITY','MIX_KEYS'])assert.deepEqual(C9[key],C8[key]);report.checks.physicalParametersUnchanged=true;
const normalize=v=>{if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['version','scenarioLabel','generatedAt'].includes(k)).map(([k,x])=>[k,normalize(x)]));return v;};
for(const scenario of ['park','surplus','night','lowwind','smr']){
 const old=F8.createEngine(JSON.parse(JSON.stringify(C8))),next=F9.createEngine(JSON.parse(JSON.stringify(C9)));
 old.reset({scenario});next.reset({scenario});let maxError=0;
 for(let minute=0;minute<1440;minute++){
  old.advance(60);next.advance(60);
  for(const [key,v]of Object.entries(old.S))if(typeof v==='number'){assert.equal(next.S[key],v,scenario+' '+minute+' '+key);maxError=Math.max(maxError,Math.abs(next.S[key]-v));}
  for(const key of ['zincState','factoryState','pemState','solverConverged'])assert.equal(next.S[key],old.S[key]);
 }
 assert.deepEqual(normalize(next.exportLedger()),normalize(old.exportLedger()));
 report.scenarios[scenario]={minutes:1440,maxError,gridMWh:next.L.gridBuyMWh,factoryMWh:next.L.actualFactoryMWh};
 console.log('PASS '+scenario+' 24h: all numeric states and cumulative ledger unchanged');
}
report.checks.fiveScenarios24Hours=true;
const input='Z:/sata11-13321902665/Hu的文档/xibili/实验室介绍/01-实验室核心介绍/03-企宣标准与品牌/logo标准文档/正式v1.0版本/Codex/发布版/XIBILI_Logo_Assets_V1.2/Logo资产_V1.2/01_主标识/SVG/XIBILI_Logo_Primary_DeepTeal_V1.2.svg';
assert.equal(hash(input),hash(path.join(ROOT,'assets/XIBILI_Logo_Primary_DeepTeal_V1.2.svg')));report.checks.suppliedVectorUnmodified=true;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else report.backupManifest.push({file:path.relative(BASE,p).replace(/\\/g,'/'),sha256:hash(p)});}}
walk(BASE);report.backupManifest.sort((a,b)=>a.file.localeCompare(b.file));
fs.writeFileSync(path.join(ROOT,'evidence/v12-preserved-manifest.json'),JSON.stringify(report.backupManifest,null,2));
delete report.backupManifest;
fs.writeFileSync(path.join(ROOT,'evidence/v13-regression.json'),JSON.stringify(report,null,2));
console.log('PASS supplied SVG unchanged; v12 read-only manifest saved');
