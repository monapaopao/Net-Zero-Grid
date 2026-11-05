'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];this.requests=[];ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&this.pending.has(message.id)){const job=this.pending.get(message.id);this.pending.delete(message.id);message.error?job.reject(message.error):job.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')this.errors.push(message.params.entry);if(message.method==='Network.requestWillBeSent')this.requests.push(message.params.request.url);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
}
async function main(){
 const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync),profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v18-dispatch-'));
 const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;const report={checks:{},samples:[]},check=(n,v)=>{report.checks[n]=!!v;console.log((v?'PASS ':'FAIL ')+n);};
 try{
  const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);const port=fs.readFileSync(active,'utf8').split('\n')[0],tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));cdp=new CDP(ws);for(const d of ['Runtime','Log','Network','Page'])await cdp.send(d+'.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});let ready=false;for(let i=0;i<200;i++){if(await cdp.eval('!!window.__NZ_TEST')){ready=true;break;}await sleep(150);}if(!ready)throw Error('Scene not ready '+JSON.stringify(cdp.errors));
  const shot=async n=>{const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ROOT,'screenshots/v18-'+n+'.png'),Buffer.from(s.data,'base64'));};

  await cdp.eval('window.__NZ_TEST.S.running=false');await sleep(500);
  check('version18',await cdp.eval("NZ_CONFIG.version==='18.0.0'&&document.title.includes('v18')"));
  check('eightScenarioOptions',await cdp.eval("document.getElementById('selScenario').options.length===8"));
  await cdp.eval("document.getElementById('selScenario').value='deadline';document.getElementById('selScenario').dispatchEvent(new Event('change',{bubbles:true}));window.__NZ_TEST.engine.advance(3600);window.__NZ_TEST.refreshPresentation();document.getElementById('dispatchOpen').click()");await sleep(700);
  check('taskPanelShowsSeparateLedger',await cdp.eval("document.getElementById('dispatchBody').textContent.includes('电解锌')&&document.getElementById('dispatchBody').textContent.includes('智能制造')&&document.getElementById('dispatchBody').textContent.includes('逾期')"));
  check('noDebtPool',await cdp.eval("!document.getElementById('flexHud').textContent.includes('欠账池')"));
  await shot('fulfillment');
  for(const [w,h]of [[1366,768],[390,844]]){await cdp.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500});await sleep(300);check('panelFits'+w,await cdp.eval("(()=>{const r=document.getElementById('dispatchPanel').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight;})()"));await shot('panel-'+w);}
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await cdp.eval("document.getElementById('dispatchClose').click();NZ_TOKEN_METER.open();document.querySelector('[data-token-tab=framework]').click();document.getElementById('serviceCreate').click();window.__NZ_TEST.engine.advance(30);document.getElementById('serviceConfirm').click()");await sleep(400);
  check('unpricedSettlementExplicit',await cdp.eval("document.getElementById('serviceResult').textContent.includes('单价待配置')"));await shot('token-framework');
  const id=await cdp.eval('window.__NZ_TEST.engine.taskSnapshot().runId');
  await cdp.eval("document.getElementById('dispatchReset').click()");await sleep(600);
  check('resetClearsServiceAndMeter',await cdp.eval(`(()=>{const b=window.__NZ_TEST.engine.taskSnapshot();return b.runId!==${JSON.stringify(id)}&&b.orders.length===0&&b.meter.tokens===0;})()`));
  await cdp.eval("NZ_TOKEN_METER.hide();window.__NZ_TEST.closeInfo();window.NZ_CLOUD_VISIT.open('scenarios')");
  check('cloudCatalogEight',await cdp.eval("document.querySelectorAll('[data-cv-start]').length===8"));
  const before=await cdp.eval('JSON.stringify(window.__NZ_TEST.engine.exportLedger())');
  await cdp.eval("window.NZ_CLOUD_VISIT.start('deadline').then(()=>true)");
  check('cloudCalculated',await cdp.eval("!!NZ_CLOUD_VISIT.audit().comparison&&!NZ_CLOUD_VISIT.audit().error"));
  check('fairConditions',await cdp.eval("(()=>{const b=NZ_CLOUD_VISIT.audit().comparison.basis;return b.sameInitial&&b.sameTasks&&b.sameWeather;})()"));
  await cdp.eval('NZ_CLOUD_VISIT.seek(65)');await sleep(400);await shot('cloud-dispatch');
  check('cloudTaskLedgerMatchesScene',await cdp.eval("window.__NZ_TEST.S.taskLedger.scenario==='deadline'"));
  await cdp.eval('NZ_CLOUD_VISIT.close()');
  check('cloudRestoresMainExactly',before===await cdp.eval('JSON.stringify(window.__NZ_TEST.engine.exportLedger())'));
  check('noRuntimeErrors',cdp.errors.length===0);check('offlineResources',!cdp.requests.some(u=>/^https?:/i.test(u)));report.errors=cdp.errors;
  fs.writeFileSync(path.join(ROOT,'evidence/v18-browser.json'),JSON.stringify(report,null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
 }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
