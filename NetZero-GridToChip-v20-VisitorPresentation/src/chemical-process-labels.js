/* v15 process review labels. Named callouts only; no additional devices or energy accounting. */
'use strict';
window.NZ_CHEMICAL_LABELS=(function(){
  const tags=[
    {id:'H01',name:'电解制氢模块',owner:'pem',p:[181,3.4,-174]},
    {id:'H02',name:'氢气纯化干燥',owner:'h2purify',p:[150.5,4.1,-174]},
    {id:'H03',name:'氢气压缩机撬',owner:'h2purify',p:[160.2,2.6,-176.4]},
    {id:'H04',name:'高压气态储氢',owner:'h2tank',p:[199,5.7,-174]},
    {id:'N01',name:'供氮净化与缓冲',owner:'nitrogen',p:[247,4.2,-174]},
    {id:'A01',name:'合成气／循环压缩机',owner:'nh3cycle',p:[211,2.8,-186]},
    {id:'A02',name:'进出料换热器',owner:'nh3cycle',p:[219.3,4.5,-187]},
    {id:'A03',name:'氨合成反应器',owner:'nh3',p:[215,10.5,-174]},
    {id:'A04',name:'产品冷却器',owner:'nh3cool',p:[243,3,-190]},
    {id:'A05',name:'气液分离器',owner:'nh3cool',p:[251,4.6,-188.5]},
    {id:'A06',name:'氨产品压力储罐',owner:'ammoniastock',p:[276,3.8,-174]},
    {id:'A07',name:'氨产品泵组',owner:'ammoniastock',p:[282,1.8,-179]},
    {id:'A08',name:'氨产品装卸计量',owner:'ammoniaload',p:[276,2.2,-156.6]},
    {id:'A09',name:'槽车装卸臂',owner:'ammoniaload',p:[270.1,2.9,-155]},
    {id:'R01',name:'未反应气循环返回',owner:'nh3cycle',p:[233,7.4,-192]},
    {id:'U01',name:'冷却供回管',owner:'nh3cool',p:[230,1.7,-181.1]},
    {id:'P01',name:'主干工艺管廊',owner:'nh3',p:[178,7.9,-192]}
  ];
  const owners=new Set(tags.map(t=>t.owner)),ns='http://www.w3.org/2000/svg',v=new THREE.Vector3();
  let enabled=true,active=false,layer,svg,workflow,button,api,placed=[],lastFrame=null;
  const color=t=>t.id.startsWith('H')?'#398ad1':t.id.startsWith('A')?'#80649d':'#277f72';
  function inContext(state){const p=controls.target,near=camera.position.distanceTo(p)<440;return near&&p.z<-125&&p.z>-277&&p.x>115&&p.x<310&&(state.group==='hydrogen'||p.z<-135);}
  function covers(key,state){return owners.has(key)&&enabled&&state.labels&&inContext(state);}
  function visibleRect(el,frame){if(!el||el.hidden||getComputedStyle(el).visibility==='hidden')return null;const b=el.getBoundingClientRect();if(b.width<2||b.height<2)return null;return {x:b.left-frame.left,y:b.top-frame.top,w:b.width,h:b.height};}
  const overlaps=(a,b,gap=5)=>a.x<b.x+b.w+gap&&a.x+a.w>b.x-gap&&a.y<b.y+b.h+gap&&a.y+a.h>b.y-gap;
  function update(state){
    if(!layer)return;
    const context=inContext(state);active=enabled&&state.labels&&context;button.hidden=!context;button.textContent='工艺标签：'+(enabled?'开':'关');button.setAttribute('aria-pressed',String(enabled));
    layer.hidden=workflow.hidden=!active;if(!active){placed=[];return;}
    const frame=document.getElementById('sceneFrame').getBoundingClientRect(),w=frame.width,h=frame.height;
    svg.setAttribute('viewBox','0 0 '+w+' '+h);camera.updateMatrixWorld();
    const blocked=['sceneHeading','flowLayers','campusCompass','tourBar'].map(id=>visibleRect(document.getElementById(id),frame)).filter(Boolean);
    const tools=visibleRect(document.querySelector('.scene-tools'),frame);if(tools)blocked.push(tools);const foot=visibleRect(workflow,frame);if(foot)blocked.push(foot);
    for(const [key,label]of Object.entries(LABELS3D)){if(owners.has(key)||label.el.classList.contains('hidden')||label.el.classList.contains('layer-hidden')||label.el.style.display==='none')continue;const b=visibleRect(label.el,frame);if(b)blocked.push(b);}
    const projected=[];
    for(const t of tags){v.set(...t.p).project(camera);t.anchor={x:(v.x*.5+.5)*w,y:(-.5*v.y+.5)*h};t.el.hidden=false;t.line.style.display='';t.dot.style.display='';
      if(v.z>1||v.z<-1||v.x<-1||v.x>1||v.y<-1||v.y>1){t.el.hidden=true;t.line.style.display=t.dot.style.display='none';continue;}
      projected.push({t,x:t.anchor.x,y:t.anchor.y,w:t.el.offsetWidth||160,h:t.el.offsetHeight||28});
    }
    projected.sort((a,b)=>a.x-b.x||a.y-b.y);placed=[];
    for(const item of projected){
      const {t}=item,candidates=[];
      for(const dy of [-42,-76,-110,-144,12,46,80,114,-178,148])for(const dx of [0,-86,86,-172,172,-258,258,-344,344]){
        const x=Math.max(10,Math.min(w-item.w-10,item.x-item.w/2+dx)),y=Math.max(12,Math.min(h-item.h-12,item.y+dy));
        candidates.push({x,y,w:item.w,h:item.h,cost:(x+item.w/2-item.x)**2+(y+item.h/2-item.y+22)**2});
      }
      candidates.sort((a,b)=>a.cost-b.cost);
      const box=candidates.find(b=>!blocked.some(o=>overlaps(b,o,6))&&!placed.some(o=>overlaps(b,o,6)));
      if(!box){t.el.hidden=true;t.line.style.display=t.dot.style.display='none';continue;}
      placed.push({...box,id:t.id,owner:t.owner,anchor:{...t.anchor}});t.el.style.left=box.x+'px';t.el.style.top=box.y+'px';t.el.classList.toggle('selected',state.selected===t.owner);
      const x=Math.max(box.x+5,Math.min(box.x+box.w-5,item.x)),y=item.y<box.y?box.y:item.y>box.y+box.h?box.y+box.h:Math.max(box.y+3,Math.min(box.y+box.h-3,item.y));
      t.line.setAttribute('x1',x);t.line.setAttribute('y1',y);t.line.setAttribute('x2',item.x);t.line.setAttribute('y2',item.y);t.dot.setAttribute('cx',item.x);t.dot.setAttribute('cy',item.y);
    }
    lastFrame={width:w,height:h,blocked};
  }
  function ready(a){
    api=a;const frame=document.getElementById('sceneFrame');layer=document.createElement('div');layer.id='chemicalReviewLabels';layer.hidden=true;layer.setAttribute('role','group');layer.setAttribute('aria-label','氢氨关键工艺设备标签');
    svg=document.createElementNS(ns,'svg');svg.setAttribute('aria-hidden','true');layer.append(svg);
    for(const t of tags){t.line=document.createElementNS(ns,'line');t.dot=document.createElementNS(ns,'circle');t.dot.setAttribute('r','2.5');t.dot.setAttribute('fill',color(t));svg.append(t.line,t.dot);
      t.el=document.createElement('button');t.el.type='button';t.el.className='chemical-review-tag';t.el.dataset.processTag=t.id;t.el.style.setProperty('--tag-color',color(t));t.el.innerHTML='<b>'+t.id+'</b><span>'+t.name+'</span>';t.el.title=t.id+' '+t.name+' · 点击查看所属设备档案';t.el.addEventListener('click',()=>api.focus(t.owner));layer.append(t.el);
    }
    workflow=document.createElement('div');workflow.id='chemicalReviewFlow';workflow.hidden=true;workflow.innerHTML='<strong>氢氨工艺核对</strong><span>H01 制氢 → H02/03 纯化压缩 → H04 储氢 → A01 压缩 → A02 换热 → A03 合成 → A02 热回收 → A04/05 冷却分离 → A06/07 储运 → A08/09 装卸</span><small>N01 供氮 → A01　·　R01：A05 分离气 → A01 循环压缩 → A02 换热 → A03　·　U01 冷却供回　·　P01 主干管廊</small>';
    frame.append(layer,workflow);button=document.createElement('button');button.id='btnChemicalLabels';button.className='iconbtn';button.type='button';button.hidden=true;button.addEventListener('click',()=>{enabled=!enabled;update(window.NZ_VISUAL.state());});document.querySelector('.scene-tools').prepend(button);
  }
  function audit(){return {enabled,active,labels:tags.map(({id,name,owner,p})=>({id,name,owner,p})),placed,frame:lastFrame};}
  return {ready,update,covers,audit};
})();
