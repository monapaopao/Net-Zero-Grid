/* v15: a metering framework and local calculator, never an accounting writer. */
'use strict';
window.NZ_TOKEN_METER=(function(){
  const RATE_PER_MW=window.NZ_CONFIG.DISPATCH.tokenPerMWh/3600,KWH_PER_MILLION=1000/(window.NZ_CONFIG.DISPATCH.tokenPerMWh/1e6);
  const parameters={taskTokens:'5000',deliveryPct:'50',price:''};
  let api,panel,entry,labelButton,selected=null,expanded=false,tab='output',lastUpdate=-Infinity,currentMetrics=null;
  const byId=id=>document.getElementById(id);
  const clean=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  function inputNumber(value,min,max){if(value===''||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;}
  function calculate(itMW,dayTokenB,p=parameters){
    const power=clean(itMW),tokensPerSecond=power*RATE_PER_MW,oneHourTokens=tokensPerSecond*3600,dayTokens=clean(dayTokenB)*1e9;
    const task=inputNumber(p.taskTokens,1,1e9),delivery=inputNumber(p.deliveryPct,0,100),priceBlank=String(p.price??'').trim()==='',price=priceBlank?null:inputNumber(p.price,0,1e6);
    const errors={};if(task===null)errors.taskTokens='请输入 1 至 10 亿的任务用量';if(delivery===null)errors.deliveryPct='请输入 0–100%';if(!priceBlank&&price===null)errors.price='请输入 0 至 100 万的单价';
    const deliveredTokens=delivery===null?null:oneHourTokens*delivery/100;
    return {itMW:power,tokensPerSecond,oneHourTokens,dayTokens,kWhPerMillion:KWH_PER_MILLION,taskCount:task===null?null:oneHourTokens/task,deliveredTokens,amount:price===null||deliveredTokens===null?null:deliveredTokens/1e6*price,valid:Object.keys(errors).length===0,errors,priceBlank};
  }
  const number=(n,d=2)=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
  function quantity(n,unit){if(n===null||!Number.isFinite(n))return '—';if(Math.abs(n)>=1e12)return number(n/1e12)+' 万亿'+unit;if(Math.abs(n)>=1e8)return number(n/1e8)+' 亿'+unit;if(Math.abs(n)>=1e4)return number(n/1e4)+' 万'+unit;return number(n)+unit;}
  const put=(id,value)=>{const el=byId(id);if(el&&el.textContent!==value)el.textContent=value;};
  function suppliedIT(){const p=window.NZ_CONFIG.PLANT,request=S.itMW/p.panamaEta+p.dcFixedMW+p.dcAuxRatio*S.itMW;return S.itMW*Math.max(0,Math.min(1,S.dcLoadMW/Math.max(1e-9,request)));}
  function update(){
    currentMetrics=calculate(suppliedIT(),S.dTokB,parameters);if(!panel||!expanded)return currentMetrics;
    const m=currentMetrics;
    const b=S.taskLedger;if(b){const shares=Object.entries(b.meter.dcSourceMWh).map(([k,v])=>(window.NZ_CONFIG.MIX_LABEL[k]||k)+' '+number(b.meter.dcMWh?v/b.meter.dcMWh*100:0,1)+'%').join(' · ');put('tokenRunSummary','本次运行累计 '+quantity(b.meter.tokens,' Token')+'；IT '+number(b.meter.itMWh)+' MWh，数据中心 '+number(b.meter.dcMWh)+' MWh。来源按全园区母线比例归属（示意）：'+shares+'。GPU·h、数据用量和真实业务分摊待配置。');}
    put('tokenRate',number(m.tokensPerSecond/1e6));put('tokenIT',number(m.itMW)+' MW');put('tokenDay',quantity(m.dayTokens,' Token'));put('tokenHour',quantity(m.oneHourTokens,' Token'));put('tokenEnergy',number(m.kWhPerMillion,1)+' kWh');
    put('tokenTaskCount',quantity(m.taskCount,' 项'));put('tokenDelivered',quantity(m.deliveredTokens,' Token'));
    put('tokenAmount',m.amount===null?'—':number(m.amount)+' 元');
    put('tokenPriceState',m.priceBlank?'设置单价后显示模拟金额':m.errors.price||'按演示单价折算，非实际交易');
    for(const key of ['taskTokens','deliveryPct','price']){
      const input=panel.querySelector('[data-token-input='+key+']'),message=panel.querySelector('[data-token-error='+key+']');
      input.setAttribute('aria-invalid',String(!!m.errors[key]));message.textContent=m.errors[key]||'';
    }
    return m;
  }
  function setTab(value,moveFocus=false){
    if(!['output','calculator','framework'].includes(value))return;tab=value;
    panel.querySelectorAll('[data-token-tab]').forEach(button=>{const active=button.dataset.tokenTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&moveFocus)button.focus();});
    panel.querySelectorAll('[data-token-pane]').forEach(pane=>pane.hidden=pane.dataset.tokenPane!==tab);
  }
  function sync(){
    const active=expanded&&selected==='token';panel.hidden=!active;entry.hidden=selected!=='token'||active;
    document.body.classList.toggle('token-meter-open',active);labelButton.setAttribute('aria-expanded',String(active));entry.setAttribute('aria-expanded',String(active));
    if(active){byId('infoTitle').textContent='算力、数据与服务计量';setTab(tab);update();}
  }
  function show(key){selected=key;if(key!=='token')expanded=false;sync();}
  function hide(){selected=null;expanded=false;sync();}
  function open(){api.exitTour();api.closeDrawer();api.focus('token');expanded=true;tab='output';sync();byId('infoCard').scrollTop=0;}
  function collapse(){expanded=false;sync();byId('infoTitle').textContent=INFO.token.t;entry.focus();}
  function ready(a){
    if(typeof LABELS3D!=='undefined'&&LABELS3D.token){const name=LABELS3D.token.el.querySelector('.nm');if(name)name.textContent='等效推理产出估算';}
    api=a;panel=document.createElement('section');panel.id='tokenMeter';panel.hidden=true;panel.setAttribute('aria-label','Token 计量与交易框架');
    panel.innerHTML=`<div class="token-meter-top"><span>计量框架 · 演示估算</span><button type="button" id="tokenMeterCollapse">收起</button></div>
      <div class="token-tabs" role="tablist" aria-label="计量与交易内容">
        <button type="button" role="tab" id="tokenTabOutput" data-token-tab="output" aria-controls="tokenPaneOutput" aria-selected="true">计量概览</button>
        <button type="button" role="tab" id="tokenTabCalculator" data-token-tab="calculator" aria-controls="tokenPaneCalculator" aria-selected="false">假设折算</button>
        <button type="button" role="tab" id="tokenTabFramework" data-token-tab="framework" aria-controls="tokenPaneFramework" aria-selected="false">交易框架</button>
      </div>
      <div id="tokenPaneOutput" data-token-pane="output" role="tabpanel" aria-labelledby="tokenTabOutput">
        <div class="token-rate"><small>等效推理产出估算</small><strong id="tokenRate">—</strong><span>百万 Token / 秒 · 估算</span></div>
        <dl class="token-metrics"><div><dt>当前 IT 功率</dt><dd id="tokenIT">—</dd></div><div><dt>每百万 Token 的 IT 用电</dt><dd id="tokenEnergy">—</dd></div><div><dt>当日累计 · 仿真估算</dt><dd id="tokenDay">—</dd></div><div><dt>按当前速率运行一小时</dt><dd id="tokenHour">—</dd></div></dl>
        <p id="tokenRunSummary" class="token-help"></p><div class="token-formula">IT 用电 → 等效推理产出 → 服务用量 → 计费结算</div>
        <p class="token-help">当日累计随仿真时间累积；一小时数值是按当前速率外推，二者分别显示。</p>
        <details class="token-assumptions"><summary>查看换算口径</summary><p>沿用园区展示系数：1 MW IT 功率约对应 0.463 百万 Token/s，约 0.6 Wh / 千 Token。系数为近似估算。</p><p>采用 IT 侧用电口径，按实际供电比例折算 IT 侧功率，再估算推理产出。此处是等效产出示意，非实测吞吐或已交付服务量。</p></details>
      </div>
      <div id="tokenPaneCalculator" data-token-pane="calculator" role="tabpanel" aria-labelledby="tokenTabCalculator" hidden>
        <p class="token-help">以下为可调整的演示参数，仅折算“按当前速率运行一小时”的估算量。</p>
        <label class="token-field" for="tokenTaskInput">每项任务平均用量 <span>Token / 项</span><input id="tokenTaskInput" data-token-input="taskTokens" type="number" min="1" max="1000000000" step="1" value="5000" inputmode="decimal" aria-describedby="tokenTaskError"><small id="tokenTaskError" data-token-error="taskTokens"></small></label>
        <label class="token-field" for="tokenDeliveryInput">可计费交付比例 <span>% · 演示假设</span><input id="tokenDeliveryInput" data-token-input="deliveryPct" type="number" min="0" max="100" step="1" value="50" inputmode="decimal" aria-describedby="tokenDeliveryError"><small id="tokenDeliveryError" data-token-error="deliveryPct"></small></label>
        <label class="token-field" for="tokenPriceInput">演示单价 <span>元 / 百万 Token</span><input id="tokenPriceInput" data-token-input="price" type="number" min="0" max="1000000" step="any" placeholder="可留空" inputmode="decimal" aria-describedby="tokenPriceError"><small id="tokenPriceError" data-token-error="price"></small></label>
        <dl class="token-results"><div><dt>每小时等效任务量</dt><dd id="tokenTaskCount">—</dd><small>一小时估算 Token ÷ 每项任务用量</small></div><div><dt>每小时模拟计费用量</dt><dd id="tokenDelivered">—</dd><small>一小时估算 Token × 可计费交付比例</small></div><div><dt>每小时模拟金额</dt><dd id="tokenAmount">—</dd><small id="tokenPriceState">设置单价后显示模拟金额</small></div></dl>
        <p class="token-help">等效任务量基于全部估算产出折算。参数仅用于演示，不写入园区账本。</p>
      </div>
      <div id="tokenPaneFramework" data-token-pane="framework" role="tabpanel" aria-labelledby="tokenTabFramework" hidden>
        <p class="token-intro">以任务为对象，记录算力使用、数据调用和服务交付量，按约定规则形成可核验的计量与结算记录。</p>
        <table class="token-business"><caption>多业务计量 · 框架示意</caption><thead><tr><th scope="col">业务类型</th><th scope="col">计量单位</th></tr></thead><tbody><tr><td>大模型推理</td><td>输入 / 输出 Token</td></tr><tr><td>算力租赁</td><td>GPU·小时</td></tr><tr><td>数据服务</td><td>GB / 调用 / 授权次数</td></tr><tr><td>应用服务</td><td>次数 / 任务 / 套餐</td></tr></tbody></table>
        <ol class="token-workflow" aria-label="计量结算流程"><li>服务需求</li><li>资源预留</li><li>用量计量</li><li>交付确认</li><li>模拟结算</li></ol>
        <p class="token-help">同一任务编号关联算力、数据和服务记录。多维用量可以并列记录，结算按服务约定选择，同一项服务不重复收费。</p>
        <div class="token-framework-note">输入 / 输出 Token 尚未拆分；GPU·h、数据 GB、调用量和服务等级待配置。模型 Token 不是交易凭证，生成产出不代表真实订单或收入。</div>
        <p id="serviceRunMeter"></p><p>演示订单：100 万 Token。创建后才开始计量；确认交付时锁定用量，不能重复结算。</p><button id="serviceCreate" type="button">创建模拟需求</button><button id="serviceConfirm" type="button">确认模拟交付</button><p id="serviceResult" aria-live="polite">尚无模拟订单；单价沿用假设折算页，可留空。</p>
      </div>`;
    byId('infoLive').after(panel);
    let orderId=null,orderRun=null;
    const engine=()=>window.__NZ_TEST.engine;
    const serviceMessage=t=>byId('serviceResult').textContent=t;
    byId('serviceCreate').onclick=()=>{if(document.body.classList.contains('cv-running'))return serviceMessage('情境回放期间不创建主场景订单');const o=engine().createServiceOrder();orderId=o.id;orderRun=o.runId;serviceMessage(o.id+' · '+o.status);};
    byId('serviceConfirm').onclick=()=>{try{if(document.body.classList.contains('cv-running'))throw Error('情境回放期间不确认主场景订单');if(!orderId)throw Error('请先创建模拟需求');const o=engine().confirmServiceOrder(orderId,parameters.price);serviceMessage(o.id+' · '+o.status+' · '+o.quantity.toFixed(0)+' Token · '+(o.amount===null?'单价待配置':o.amount.toFixed(2)+' 元（模拟）'));}catch(e){serviceMessage(e.message);}};
    TICKERS.push(()=>{if(!window.__NZ_TEST)return;const b=S.taskLedger;if(!b)return;if(orderRun&&orderRun!==b.runId){orderRun=null;orderId=null;serviceMessage('情景已重置，旧订单不计入本次运行');}if(expanded)byId('serviceRunMeter').textContent='本次运行 '+b.runId+' · 累计估算 '+(b.meter.tokens/1e9).toFixed(3)+' 十亿 Token；IT '+b.meter.itMWh.toFixed(2)+' MWh；数据中心 '+b.meter.dcMWh.toFixed(2)+' MWh。仅在全部 IT 视作等效推理的演示假设下成立；未分摊真实业务能耗。';});
    entry=document.createElement('button');entry.id='tokenMeterOpen';entry.className='token-meter-entry';entry.type='button';entry.textContent='计量与交易 ▸';entry.hidden=true;entry.setAttribute('aria-controls','tokenMeter');byId('infoDesc').after(entry);entry.addEventListener('click',open);
    labelButton=document.createElement('button');labelButton.id='tokenMeterLabelButton';labelButton.type='button';labelButton.textContent='计量与交易 ▸';labelButton.setAttribute('aria-controls','tokenMeter');labelButton.setAttribute('aria-expanded','false');
    LABELS3D.token.el.append(labelButton);LABELS3D.token.el.setAttribute('role','group');LABELS3D.token.el.removeAttribute('tabindex');
    labelButton.addEventListener('click',event=>{event.stopPropagation();open();});labelButton.addEventListener('keydown',event=>event.stopPropagation());
    for(const type of ['pointerdown','pointerup'])labelButton.addEventListener(type,event=>event.stopPropagation());
    byId('tokenMeterCollapse').addEventListener('click',collapse);
    panel.querySelectorAll('[data-token-tab]').forEach(button=>{button.addEventListener('click',()=>setTab(button.dataset.tokenTab));button.addEventListener('keydown',event=>{const tabs=['output','calculator','framework'],index=tabs.indexOf(tab);let next;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;if(next!==undefined){event.preventDefault();setTab(tabs[next],true);}});});
    panel.querySelectorAll('[data-token-input]').forEach(input=>input.addEventListener('input',()=>{parameters[input.dataset.tokenInput]=input.value;update();}));
    TICKERS.push(()=>{if(performance.now()-lastUpdate<350)return;lastUpdate=performance.now();if(expanded)update();});
    sync();
  }
  function audit(){return {open:expanded&&selected==='token',selected,tab,parameters:{...parameters},metrics:calculate(suppliedIT(),S.dTokB,parameters)};}
  return {ready,show,hide,open,collapse,update,calculate,audit};
})();