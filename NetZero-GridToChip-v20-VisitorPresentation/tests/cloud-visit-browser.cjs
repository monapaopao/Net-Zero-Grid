'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class CDP{
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];this.requests=[];ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&this.pending.has(message.id)){const job=this.pending.get(message.id);this.pending.delete(message.id);message.error?job.reject(message.error):job.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')this.errors.push(message.params.entry);if(message.method==='Network.requestWillBeSent')this.requests.push(message.params.request.url);});}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
}
async function main(){
  const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);if(!browser)throw Error('Chrome/Edge not found');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nz-v17-cloud-'));
  const child=spawn(browser,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1920,1080','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const report={checks:{},scenarios:{},layouts:{}};const check=(name,condition)=>{report.checks[name]=!!condition;console.log((condition?'PASS ':'FAIL ')+name);};let cdp;
  try{
    const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<150&&!fs.existsSync(active);i++)await sleep(200);if(!fs.existsSync(active))throw Error('Browser CDP did not start');
    const port=fs.readFileSync(active,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),ws=new WebSocket(targets.find(item=>item.type==='page').webSocketDebuggerUrl);
    await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));cdp=new CDP(ws);for(const domain of ['Runtime','Log','Page','Network'])await cdp.send(domain+'.enable');
    const resize=async(width,height=1080)=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);};await resize(1920);
    await cdp.send('Page.navigate',{url:'file:///'+path.join(ROOT,'dist/Net-Zero-grid-premium.html').replace(/\\/g,'/')});
    let ready=false;for(let i=0;i<200;i++){if(await cdp.eval('!!window.__NZ_TEST&&!!window.NZ_CLOUD_VISIT&&!!window.NZ_FLOWS')){ready=true;break;}await sleep(150);}if(!ready)throw Error('Cloud visit module not ready');
    await cdp.eval("(()=>{const a=window.__NZ_TEST;a.S.running=false;a.exitTour();a.cancelCamera();a.controls.enableDamping=false;document.querySelector('[data-q=standard]').click();document.getElementById('toast').replaceChildren();window.__cloudLedgerFreeze=()=>JSON.stringify({K:a.K,L:a.L});window.__cloudRestoreFreeze=()=>JSON.stringify({S:a.S,K:a.K,L:a.L});window.__cloudBefore=window.__cloudRestoreFreeze();return true;})()");
    const shot=async name=>{const result=await cdp.send('Page.captureScreenshot',{format:'png'});fs.mkdirSync(path.join(ROOT,'screenshots'),{recursive:true});fs.writeFileSync(path.join(ROOT,'screenshots',name),Buffer.from(result.data,'base64'));};
    const click=async selector=>{const point=await cdp.eval('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)throw Error("Missing click target");e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,clickable:r.width>0&&r.height>0&&(hit===e||e.contains(hit))};})()');if(!point.clickable)throw Error('Target occluded '+selector+' '+JSON.stringify(point));await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});await sleep(160);};
    const key=async(key,code,keyCode,text)=>{await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,...(text?{text}:{} )});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});await sleep(160);};
    check('version17',await cdp.eval("window.NZ_CONFIG.version==='17.0.0'"));
    check('controllerAPIsPresent',await cdp.eval("['open','close','start','pause','seek','next','previous','replay','selectStrategy','preview','execute','audit'].every(key=>typeof window.NZ_CLOUD_VISIT[key]==='function')"));
    const waitFor=async(expression,label,timeout=45000)=>{const begin=Date.now();while(Date.now()-begin<timeout){if(await cdp.eval(expression))return;await sleep(100);}throw Error('Timed out '+label+': '+await cdp.eval('JSON.stringify(window.NZ_CLOUD_VISIT.audit())'));};
    const audit=()=>cdp.eval('window.NZ_CLOUD_VISIT.audit()');
    const fill=async(selector,value)=>{await cdp.eval('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)throw Error("Missing input");e.value='+JSON.stringify(String(value))+';e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));})()');await sleep(100);};
    const snapshot=()=>cdp.eval('window.__cloudRestoreFreeze()');
    const ledger=()=>cdp.eval('window.__cloudLedgerFreeze()');
    const baseline=await snapshot(),ledgerBefore=await ledger();
    check('entranceRenamed',await cdp.eval("document.getElementById('btnTour').textContent.includes('云参观')"));
    await click('#btnTour');
    check('realEntranceOpensCatalog',(await audit()).open&&(await audit()).mode==='catalog');
    await click('#cvScenariosTab');
    check('threeScenarioCards',await cdp.eval("document.querySelectorAll('[data-cv-start]').length===3"));
    await key('Home','Home',36);
    check('tabKeyboardHome',await cdp.eval("document.getElementById('cvTourTab').getAttribute('aria-selected')==='true'"));
    await key('End','End',35);
    check('tabKeyboardEnd',await cdp.eval("document.getElementById('cvScenariosTab').getAttribute('aria-selected')==='true'"));
    const layout=async(width,height,phase)=>{await resize(width,height);const data=await cdp.eval("(()=>{const rect=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),st=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,display:st.display,visibility:st.visibility};};return {viewport:{width:innerWidth,height:innerHeight},bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,panel:rect('cvPanel'),body:rect('cvBody'),controls:rect('cvControls'),hud:rect('cvHud'),close:rect('cvClose'),entrance:rect('btnTour'),frame:rect('sceneFrame'),cameraView:window.__NZ_TEST.camera.view,contentScrollWidth:document.getElementById('cvBody').scrollWidth,contentClientWidth:document.getElementById('cvBody').clientWidth};})()");report.layouts[phase+'-'+width+'x'+height]=data;check(phase+'PanelFits'+width,data.panel.x>=0&&data.panel.y>=0&&data.panel.right<=width+1&&data.panel.bottom<=height+1&&!data.bodyOverflow);check(phase+'CloseFits'+width,data.close.x>=data.panel.x&&data.close.right<=data.panel.right&&data.close.bottom<=height);if(phase==='running'){check('runningControlsFit'+width,data.controls.bottom<=height&&data.controls.y>=data.panel.y&&data.controls.height>0);check('runningPanelHorizontalOverflowContained'+width,data.contentScrollWidth<=data.contentClientWidth+2);check('runningFixedPrimaryHitTest'+width,await cdp.eval('(()=>{const e=document.getElementById("cvPause"),r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&(h===e||e.contains(h));})()'));}await shot('v17-cloud-'+phase+'-'+width+'.png');};
    for(const [width,height]of [[1920,1080],[1366,768],[900,700],[3840,2160]])await layout(width,height,'catalog');
    await resize(1920,1080);
    for(const id of ['coordination','green-compute','strategy']){
      console.log('Scenario '+id);
      await click('[data-cv-start="'+id+'"]');
      await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",id+' load');
      check(id+'ActualCardStarts',(await audit()).scenario===id&&(await audit()).active);
      check(id+'OldTourInactive',await cdp.eval('!window.__NZ_TEST.tourState().active'));
      check(id+'IsolatedLedger',await ledger()===ledgerBefore);
      await click('#cvPause');const held=await audit(),cameraHeld=await cdp.eval('window.__NZ_TEST.camera.position.toArray().concat(window.__NZ_TEST.controls.target.toArray())');await sleep(650);const still=await audit();check(id+'PauseFreezesCamera',JSON.stringify(cameraHeld)===JSON.stringify(await cdp.eval('window.__NZ_TEST.camera.position.toArray().concat(window.__NZ_TEST.controls.target.toArray())')));
      check(id+'PauseFreezesReplay',held.paused&&held.time===still.time&&JSON.stringify(held.frame)===JSON.stringify(still.frame));
      if(id==='coordination'){await click('#cvPause');await sleep(450);const movingCamera=await cdp.eval('window.__NZ_TEST.camera.position.toArray().concat(window.__NZ_TEST.controls.target.toArray())');check('resumeContinuesInterruptedCamera',JSON.stringify(movingCamera)!==JSON.stringify(cameraHeld));await click('#cvPause');}
      await click('#cvNext');check(id+'NextStep',(await audit()).stage==='feedback');
      await click('#cvPrev');check(id+'PreviousStep',(await audit()).stage==='forecast');
      await cdp.eval('window.NZ_CLOUD_VISIT.seek(90)');
      const gate=await audit();check(id+'CannotSkipExecutionGate',gate.time===42&&gate.waiting&&gate.paused&&!gate.confirmed);
      report.scenarios[id]={gate,restoreBefore:baseline};
      if(gate.executable){check(id+'FixedPrimaryOffersExecution',await cdp.eval('document.getElementById("cvPause").textContent==="执行方案"'));await click('#cvPause');check(id+'ExecuteConfirms',(await audit()).confirmed&&!(await audit()).waiting);await cdp.eval('window.NZ_CLOUD_VISIT.seek(90)');check(id+'ReviewReached',(await audit()).stage==='review'&&(await audit()).paused);}
      else{check(id+'FixedPrimaryOffersConstraints',await cdp.eval('document.getElementById("cvPause").textContent==="查看约束"'));await click('#cvPause');check(id+'FixedPrimaryOpensConstraints',await cdp.eval('document.getElementById("cvCompareDetails").open')&&!(await audit()).confirmed);check(id+'RejectedUnsafeCandidate',await cdp.eval('document.getElementById("cvExecute").disabled'));await click('[data-cv-action="repair"]');await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",id+'repair');const repaired=await audit();check(id+'RepairComputed',repaired.appliedOptions.initialSoc===55&&repaired.appliedOptions.gridLimitMW===400);}
      if(id==='strategy'){
        await fill('#cvStrategy','delivery');const changed=await audit();check('strategyChangeInvalidatesConfirmation',changed.strategy==='delivery'&&!changed.confirmed&&changed.paused&&changed.waiting);check('strategyChangeDisablesExecution',await cdp.eval('document.getElementById("cvExecute").disabled'));
        await cdp.eval('window.NZ_CLOUD_VISIT.seek(22)');check('dirtySeekKeepsExecutionDisabled',await cdp.eval('document.getElementById("cvExecute").disabled'));await fill('[data-cv-param="initialSoc"]',120);await cdp.eval('window.NZ_CLOUD_VISIT.seek(22)');check('invalidSeekKeepsExecutionDisabled',await cdp.eval('document.getElementById("cvExecute").disabled'));check('invalidParametersDirectExecuteReturnsFalse',await cdp.eval('window.NZ_CLOUD_VISIT.execute()===false'));check('invalidParametersProduceNotice',await cdp.eval('document.getElementById("cvNotice").textContent.length>0'));await fill('[data-cv-param="initialSoc"]',65);await fill('[data-cv-param="pricePerKWh"]',0.83);check('dirtyFixedPrimaryOffersPreview',await cdp.eval('document.getElementById("cvPause").textContent==="重新推演"'));await click('#cvPause');await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",'price preview');const priced=await audit();check('parameterPreviewApplied',priced.appliedOptions.initialSoc===65&&priced.appliedOptions.pricePerKWh===0.83);check('priceRecomputesCost',priced.comparison.candidate.gridCostYuan!==null&&priced.comparison.candidate.gridCostYuan>=0);check('fairComparisonBasis',priced.comparison.basis.sameInitial&&priced.comparison.basis.sameTasks&&priced.comparison.basis.sameWeather);
        await fill('[data-cv-param="gridLimitMW"]',0);await fill('[data-cv-param="initialSoc"]',10);await click('#cvPreview');await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",'unsafe preview');const failed=await audit();check('insufficientPowerFailsGate',!failed.executable);check('unsafeExecutionDisabled',await cdp.eval('document.getElementById("cvExecute").disabled'));
        await cdp.eval('window.NZ_CLOUD_VISIT.execute()');check('unsafeDirectExecuteRejected',!(await audit()).confirmed);
        await click('[data-cv-action="repair"]');await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",'safe repair');
        for(const [width,height]of [[1920,1080],[1366,768],[900,700],[3840,2160]])await layout(width,height,'running');
        await resize(900,700);await cdp.eval('window.NZ_CLOUD_VISIT.seek(42)');if((await audit()).executable){await click('#cvPause');check('narrowFixedPrimaryExecutesWithoutPanelScroll',(await audit()).confirmed);await cdp.eval('window.NZ_CLOUD_VISIT.pause()');await shot('v17-cloud-narrow-executed.png');}await resize(1920,1080);
        report.strategy=await audit();
      }
      check(id+'LedgerUnaffectedAfterReplay',await ledger()===ledgerBefore);
      await click('#cvClose');
      check(id+'CloseHidesModule',!(await audit()).open);
      const after=await snapshot();check(id+'ExactOriginalStateRestored',after===baseline);report.scenarios[id].restored=after===baseline;
      if(after!==baseline)report.scenarios[id].restoreAfter=after;
      await click('#btnTour');await click('#cvScenariosTab');
    }
    await click('#cvTourTab');await click('[data-cv-action="tour"]');
    check('originalTourStartsThroughSharedModule',await cdp.eval('window.__NZ_TEST.tourState().active')&&!(await audit()).open);
    await sleep(1500);check('originalTourHoldsPanoramaForIntro',await cdp.eval('window.__NZ_TEST.tourState().chap===0&&window.__NZ_TEST.tourState().t>1&&window.__NZ_TEST.TOUR[0].dur>=20'));
    await click('#btnTour');check('openingModuleStopsOriginalTour',await cdp.eval('!window.__NZ_TEST.tourState().active')&&(await audit()).open);
    await key('Escape','Escape',27);check('escapeClosesModule',!(await audit()).open);
    await cdp.eval("window.NZ_CLOUD_VISIT.open('scenarios')");await click('[data-cv-start="coordination"]');await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",'keyboard scenario replay');await cdp.eval("document.getElementById('selScenario').focus()");await key('ArrowDown','ArrowDown',40);await key('Enter','Enter',13);check('keyboardScenarioSwitchExitsReplay',!(await audit()).active);
    await cdp.eval('window.GOBI_DCDT.open()');await waitFor("window.GOBI_DCDT.transitionState().phase==='visible'",'building visible',25000);const closeResult=await cdp.eval('(()=>{const d=window.GOBI_DCDT,p=d.close(),q=d.close();return Promise.all([p,q]).then(()=>({same:p===q,state:d.transitionState()}));})()');check('buildingRepeatedCloseSharesCompletion',closeResult.same&&closeResult.state.phase==='idle'&&!closeResult.state.mounted);
    check('noLingeringNarrativeAfterExit',await cdp.eval('!window.NZ_FLOWS.audit().narrative.active'));
    await cdp.eval("window.__NZ_TEST.S.running=false;window.NZ_CLOUD_VISIT.open('scenarios')");
    await click('[data-cv-start="coordination"]');await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",'quality replay');
    for(const q of ['compat','standard','high']){const selector='[data-q='+q+']',exists=await cdp.eval('!!document.querySelector('+JSON.stringify(selector)+')');if(exists){await cdp.eval('document.querySelector('+JSON.stringify(selector)+').click()');check('qualitySwitchExitsReplay'+q,!(await audit()).active);await cdp.eval("window.NZ_CLOUD_VISIT.open('scenarios')");await click('[data-cv-start="coordination"]');await waitFor("window.NZ_CLOUD_VISIT.audit().mode==='playing'",q+' replay');await cdp.eval('window.NZ_CLOUD_VISIT.pause()');await shot('v17-cloud-quality-'+q+'.png');}}
    await cdp.eval('window.NZ_CLOUD_VISIT.close()');

    await cdp.eval('window.NZ_CLOUD_VISIT.close()');
    report.flowSignals=await cdp.eval("(()=>{const f=window.NZ_FLOWS,a=window.__NZ_TEST;f.context('overview');f.setGlobal(true);f.setEnabled('data',true);f.setEnabled('control',true);a.S.reduceMotion=false;f.clearNarrativeSignals();f.update(100,.1);const power=f.audit().routes.filter(r=>r.type==='power').map(r=>[r.id,r.rate,r.count]);f.setNarrativeSignals({eventId:'test-command',routeIds:['energy-command-compute','energy-command-storage','unknown-route'],paused:false});f.update(101,.1);const moving=f.audit(),p0=moving.routes.find(r=>r.id==='energy-command-compute').phase;f.update(102,.1);const p1=f.audit().routes.find(r=>r.id==='energy-command-compute').phase;f.setNarrativeSignals({eventId:'test-paused',routeIds:['energy-command-compute'],paused:true});f.update(103,.1);const paused=f.audit(),hold=paused.routes.find(r=>r.id==='energy-command-compute').phase;f.update(104,.5);const frozen=f.audit().routes.find(r=>r.id==='energy-command-compute').phase;f.setNarrativeSignals({eventId:'test-reduced',routeIds:['energy-command-compute'],paused:false});a.S.reduceMotion=true;f.update(105,0);const reduced=f.audit();a.S.reduceMotion=false;f.setEnabled('control',false);f.update(106,.1);const disabled=f.audit();f.setEnabled('control',true);f.setGlobal(false);f.update(107,.1);const globalOff=f.audit();f.setGlobal(true);f.clearNarrativeSignals();f.update(108,.1);const restored=f.audit();return {power,moving,phaseMoved:p0!==p1,paused,frozen:hold===frozen,reduced,disabled,globalOff,restored};})()");
    const f=report.flowSignals,selected=f.moving.routes.filter(r=>r.narrativeSelected),other=f.moving.routes.filter(r=>(r.type==='data'||r.type==='control')&&!r.narrativeSelected),paused=f.paused.routes.find(r=>r.id==='energy-command-compute'),reduced=f.reduced.routes.find(r=>r.id==='energy-command-compute');
    check('computeControlPathHasCorrectEndpoints',selected.some(r=>r.id==='energy-command-compute'&&r.type==='control'&&r.from==='energy.ems'&&r.to==='compute.noc'));
    check('eventIdentifiersAndValidRoutesAuditable',f.moving.narrative.active&&f.moving.narrative.eventId==='test-command'&&f.moving.narrative.routeIds.length===2);
    check('onlyEventInformationRoutesMove',selected.every(r=>r.count>0)&&other.every(r=>r.count===0));
    check('powerRatesAndCountsUnaffectedByNarrative',JSON.stringify(f.power)===JSON.stringify(f.moving.routes.filter(r=>r.type==='power').map(r=>[r.id,r.rate,r.count])));
    check('eventParticlePositionsAdvance',f.phaseMoved);
    check('pausedSignalsHaveStaticDirectionMarkers',f.paused.narrative.paused&&paused.staticDirections&&paused.count===0&&f.frozen);
    check('reducedMotionUsesStaticDirectionMarkers',reduced.staticDirections&&reduced.count===0);
    check('narrativeCannotOverrideCategoryOff',f.disabled.routes.filter(r=>r.type==='control').every(r=>!r.visible&&r.count===0&&!r.staticDirections));
    check('narrativeCannotOverrideGlobalOff',f.globalOff.routes.every(r=>!r.visible&&r.count===0&&!r.staticDirections));
    check('clearingNarrativeRestoresAmbientInformationFlow',!f.restored.narrative.active&&f.restored.routes.some(r=>r.type==='data'&&r.count>0));
    report.errors=cdp.errors;report.totalChecks=Object.keys(report.checks).length;check('noExternalNetworkDependencies',!cdp.requests.some(url=>/^https?:/i.test(url)));check('noRuntimeErrors',report.errors.length===0);
    report.generatedAt=new Date().toISOString();fs.mkdirSync(path.join(ROOT,'evidence'),{recursive:true});fs.writeFileSync(path.join(ROOT,'evidence/v17-cloud-visit-browser.json'),JSON.stringify(report,null,2));console.log('Evidence: evidence/v17-cloud-visit-browser.json');if(Object.values(report.checks).some(value=>!value))process.exitCode=1;
  }finally{if(cdp)cdp.ws.close();child.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
