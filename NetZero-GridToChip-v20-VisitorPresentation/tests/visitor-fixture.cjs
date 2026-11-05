'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
module.exports=function(){
 const nodes=new Map(),document={activeElement:null,listeners:{},addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);},getElementById(id){return nodes.get(id)||null;}};
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.hidden=false;this.dataset={};this.style={};this.children=[];this.listeners={};this.attributes={};this.textContent='';this._html='';this.classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),remove:(...xs)=>xs.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle:(x,v)=>{const value=v===undefined?!this.classes.has(x):v;value?this.classes.add(x):this.classes.delete(x);return value;}};}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  append(...xs){xs.forEach(x=>{if(x.parentElement)x.parentElement.children=x.parentElement.children.filter(c=>c!==x);this.children.push(x);x.parentElement=this;});}appendChild(x){this.append(x);return x;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;}
  before(x){if(!this.parentElement)return;const p=this.parentElement;if(x.parentElement)x.parentElement.children=x.parentElement.children.filter(c=>c!==x);const i=p.children.indexOf(this);x.parentElement=p;p.children.splice(i,0,x);}
  replaceWith(x){this.before(x);this.remove();}
  get isConnected(){return !!this.parentElement||this===document.body;}
  get parentNode(){return this.parentElement;}
  getBoundingClientRect(){return {width:this.id==='sceneFrame'?1600:400,height:800,top:0,bottom:800,left:0,right:1600};}
  scrollIntoView(){} contains(e){return this===e||this.children.some(c=>c.contains(e));}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}focus(){document.activeElement=this;}
  querySelectorAll(selector){const all=this.children.flatMap(x=>[x,...x.querySelectorAll('*')]),attr=selector.match(/^\[data-([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]$/);return all.filter(x=>selector==='*'||selector==='button'&&x.tagName==='BUTTON'||selector.startsWith('.')&&x.classes.has(selector.slice(1))||attr&&(attr[2]===undefined?x.dataset[attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]!==undefined:x.dataset[attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]===attr[2]));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  set innerHTML(html){this._html=html;this.children=[];for(const match of html.matchAll(/<([\w-]+)([^>]*)>/g)){const e=new Element(match[1]);for(const a of match[2].matchAll(/([\w-]+)="([^"]*)"/g)){if(a[1]==='id')e.id=a[2];else if(a[1]==='class')a[2].split(/\s+/).forEach(c=>e.classes.add(c));else if(a[1].startsWith('data-'))e.dataset[a[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[2];else e.setAttribute(a[1],a[2]);}this.append(e);}}
  get innerHTML(){return this._html;}
 }
 document.createElement=tag=>new Element(tag);document.createComment=text=>{const e=new Element('#comment');e.textContent=text;return e;};document.body=new Element('body');document.head=new Element('head');document.activeElement=document.body;
 for(const id of ['sceneFrame','dcdtFrame','btnRun','btnTour']){const e=new Element();e.id=id;document.body.append(e);}
 const vector=a=>({a:a.slice(),toArray(){return this.a.slice();},fromArray(b){this.a=b.slice();return this;}}),copy=x=>JSON.parse(JSON.stringify(x));
 const originalState={running:true,timeScale:240,simTime:43200,itMW:150,dcLoadMW:176.4,soc:55,region:'xinjiang',scenario:'park',seed:42,reduceMotion:false};
 let visual={group:'compute',selected:'dc',labels:false,flows:false,details:true},flows={quality:'standard',focus:'compute',global:false,enabled:{power:false,data:true,control:false,cooling:true,process:true,heat:false},narrative:{active:false,eventId:null,routeIds:[],paused:false}},viewEntries=[],preview=[];
 const api={S:copy(originalState),cfg:require('../src/config.js'),NARRATION:{totalSeconds:369},TOUR_HOME:{pos:[480,385,515],tgt:[10,0,-45]},camera:{position:vector([7,8,9]),view:null,updateProjectionMatrix(){},clearViewOffset(){this.view=null;},setViewOffset(...v){this.view={enabled:true,fullWidth:v[0],fullHeight:v[1],offsetX:v[2],offsetY:v[3],width:v[4],height:v[5]};}},controls:{target:vector([1,2,3]),enabled:true,autoRotate:true,enableDamping:true},resize(){},refreshPresentation(){},cancelCamera(){},exitTour(){},closeInfo(){},closeDrawer(){},focus(){}};
 let buildingTime=33,buildingPlaying=false,buildingOpen=false;
 const sandbox={document,console,setTimeout,clearTimeout,performance:{now:()=>Date.now()},NZ_RECEPTION_MODEL:require('../src/reception-model.js'),NZ_RECEPTION_SCRIPT:JSON.parse(fs.readFileSync(path.join(__dirname,'../三分钟接待文案.json'),'utf8')),NZ_TOUR_SCRIPT:JSON.parse(fs.readFileSync(path.join(__dirname,'../导览文案.json'),'utf8')),NZ_TOUR_NARRATIVE:{clock:t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t)%60).padStart(2,'0')},NZ_WIND_PRODUCT:{pose:()=>({pos:[-60,46,96],tgt:[-70,12,-6]}),tour(){},tourTime(){}},NZ_CLOUD_VISIT:{isOpen:()=>false,close(){},open(){},start(){}},NZ_VISUAL:{state:()=>copy(visual),restore:v=>{visual=copy(v);}},NZ_FLOWS:{audit:()=>copy(flows),context:v=>flows.focus=v,setEnabled:(k,v)=>flows.enabled[k]=v,setGlobal:v=>flows.global=v,setNarrativeSignals:v=>flows.narrative={active:true,...v},clearNarrativeSignals:()=>flows.narrative={active:false,eventId:null,routeIds:[],paused:false}},NZ_SST_VISIT:{previewScheme:v=>preview.push(v),clearPreview:()=>preview.push('clear'),tick(){}},NZ_SST_SIMULATION:{compare:()=>require('../src/sst-simulation.js').compare()},GOBI_DCDT:{close:async()=>{buildingOpen=false;buildingPlaying=false;},prepare:async()=>true,reveal:async t=>{buildingOpen=true;buildingTime=t;return true;},playSegment:(from,to)=>{buildingTime=from;buildingPlaying=true;return true;},setPlaying:v=>buildingPlaying=v},LABELS3D:{dc:{el:new Element()},solar:{el:new Element()}},Event:class{}};
 sandbox.window=sandbox;nodes.get('dcdtFrame').contentWindow={NZ_BUILDING_TOUR:{state:()=>({time:buildingTime})}};vm.createContext(sandbox);
 sandbox.addEventListener=()=>{};sandbox.NZ_VISUAL.clear=()=>{visual.group=null;visual.selected=null;};
 const load=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),sandbox,{filename:file});
 return {sandbox,api,document,nodes,originalState,copy,load,visual:()=>copy(visual),flows:()=>copy(flows),preview,stepBuilding:dt=>{if(buildingPlaying)buildingTime=Math.min(62,buildingTime+dt);},building:()=>({time:buildingTime,playing:buildingPlaying,open:buildingOpen})};
};
