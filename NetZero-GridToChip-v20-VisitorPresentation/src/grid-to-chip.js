/* Visual presentation only. The energy engine and bookkeeping are unchanged. */
'use strict';
(function(){
  const groups = [
    {id:'overview',name:'园区总览',en:'Campus overview',text:'从风光发电到算力与工业负荷，探索园区的能源协同。',key:null,keys:['fire']},
    {id:'generation',name:'风光发电',en:'Renewable generation',text:'风机与光伏阵列经架空馈线汇入升压变电站。',key:'wind',keys:['wind','windNacelle','solar','substation']},
    {id:'power',name:'供配电',en:'Power infrastructure',text:'从 AIS 一次间隔、双母线到主变与中压馈线。',key:'substation',keys:['substation','line','bus','stepdown','disttr','svgapf','flexbus']},
    {id:'storage',name:'储能系统',en:'Energy storage',text:'储能通过 PCS 接入柔性母线，平衡园区供需。',key:'storage',keys:['storage','flexbus']},
    {id:'compute',name:'数据中心园区',en:'Grid to Chip',text:'进入 A1 数据楼，从供电链路探索到服务器与芯片。',key:'dc',keys:['dc','token','dcfeed','stepdown','logistics','maintenance','cooling','ups','noc','firewater','phase2','phase3']},
    {id:'backup',name:'燃气轮机',en:'Gas turbine',text:'燃气轮机经发电机、开关配电与专用馈线接入数据楼中压配电。',key:'genset',keys:['genset','dcfeed','dc','stepdown']},
    {id:'hydrogen',name:'化工与电冶金园区',en:'Hydrogen & ammonia',text:'独立生产分区：电解锌、制氢、储氢、合成氨与氢回发。',key:'nh3',keys:['pem','h2tank','nh3','fc','metal','panamaZn','nitrogen','chemwater','zincstock','ammoniastock','chemicalfeed']},
    {id:'loads',name:'智能制造与公共充电',en:'Flexible demand',text:'电解锌、智能工厂与超充站参与柔性消纳。',key:'factory',keys:['factory','factorywaste','factoryfeed','factoryraw','factoryproduct','factoryutility','factorydispatch','factorystaging','supercharge','carport','panamaSc','panamaSc2','parking']},
    {id:'nuclear',name:'独立核电园区',en:'Independent SMR campus',text:'东北侧的独立研究园区，经站内升压设备接入高压母线。',key:'smr',keys:['smr','bus']}
  ];
  for(const f of window.NZ_MULTI_PLAN.facilities){const section=groups.find(g=>g.id===(f.zone==='chemical'?'hydrogen':f.zone==='compute'?'compute':'loads'));if(section&&!section.keys.includes(f.key))section.keys.push(f.key);}
  const V = {group:'overview',selected:null,labels:true,flows:true,details:false};
  const $id = id=>document.getElementById(id);
  const palm = window.NZ_CONFIG.PALETTE;
  // Recolor existing geometry with a restrained material family; preserve texture maps.
  const remap = {
    '9aa3ad':'edf1f0','8b959e':'d4dedd','7d8790':'e4eae8','6a737c':'a6b7b6',
    '77828c':'bdccca','8d97a3':'e5ecea','39434e':'d4dfdc','2a323b':'d9e3e0',
    '41617e':'c0d6d3','2c3640':'7f9d9b','39453d':'d7e3dd','4a5248':'d7dfdb',
    '1b2129':'ced9d8','222a32':'dae4e1','1c232b':'526968','3a4650':'95a7a5',
    '46525e':'a7b8b5','5c6670':'b4c4c1','2c4a63':'496979','84b07c':'a8bcb0',
    'd97a4e':'c7d6ce','c98d4e':'bfa578','d99a5b':'bccfc6','cc6f5f':'c1d0c7'
  };
  const seen = new Set();
  scene.traverse(o=>{
    if(!o.material || o.isPoints || o===gridH) return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){
      if(seen.has(m)) continue; seen.add(m);
      if(m.color && !m.map && o.geometry && o.geometry.type!=='TubeGeometry'){
        const h=m.color.getHexString();
        if(remap[h]) m.color.set('#'+remap[h]);
        else if(m.isMeshStandardMaterial){
          const c={}; m.color.getHSL(c);
          if(c.s<.24) m.color.setHSL(c.h,c.s*.4,Math.max(.68,c.l));
          else if(c.h>.18&&c.h<.48) m.color.setHSL(.39,.10,.65);
          else if(c.h<.12||c.h>.94) m.color.setHSL(.40,.06,.78);
        }
      }
      if(m.isMeshStandardMaterial){m.roughness=Math.max(.55,m.roughness);m.metalness=Math.min(.18,m.metalness);}
    }
  });
  pvPanelM.color.set('#496979');pvPanelM.roughness=.6;pvPanelM.metalness=.15;
  dcGlassM.color.set('#c0d6d3');dcGlassM.roughness=.58;dcGlassM.metalness=.12;dcGlassM.opacity=.93;
  WINMATS.forEach(m=>{m.color.set('#789995');m.emissive.set('#d1e9dd');});
  gridH.visible=false;
  // A solid miniature base with a light beveled-looking rim and a large studio floor.
  groundMat.color.set('#e4ebe9');groundMat.roughness=.9;
  const base=bx(360,1.6,240,0xcbd8d4,50,-.95,50);base.receiveShadow=true;
  const studio=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600),new THREE.MeshBasicMaterial({color:0xf4f7f7,toneMapped:false,fog:false}));
  studio.rotation.x=-Math.PI/2;studio.position.y=-1.8;studio.visible=false;scene.add(studio);
  // Small, non-emissive facade details help recognize the A1 building from above.
  for(let x=123;x<=145;x+=5.5){bx(3.5,.12,2,0xc0ceca,x,14.62,-7);bx(3.5,.12,2,0xc0ceca,x,14.62,-14);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(4.5,4.7,64),new THREE.MeshBasicMaterial({color:0x087d73,transparent:true,opacity:.7,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.13;ring.visible=false;scene.add(ring);
  sunL.shadow.normalBias=.045;sunL.shadow.bias=-.0002;
  sunL.shadow.camera.left=-190;sunL.shadow.camera.right=190;sunL.shadow.camera.top=170;sunL.shadow.camera.bottom=-170;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  camera.fov=34;camera.updateProjectionMatrix();
  controls.maxDistance=1600;camera.far=2600;camera.updateProjectionMatrix();
  CAM_DEF.pos.splice(0,3,...window.NZ_MULTI_PLAN.home.pos);CAM_DEF.tgt.splice(0,3,...window.NZ_MULTI_PLAN.home.tgt);fitView();
  window.NZ_ENGINE.S.lightPreset='day-lab';
  // Match each original edge to its tube, in the same construction order.
  const tubes=scene.children.filter(o=>o.isMesh&&o.geometry.type==='TubeGeometry');
  EDGES.forEach((e,i)=>{
    e.visualTube=tubes[i];
    if(e.points){e.points.material.blending=THREE.NormalBlending;e.points.material.opacity=.88;e.points.material.size=.65;}
    if(e.visualTube){e.visualTube.material.transparent=true;e.visualTube.material.opacity=.42;}
  });
  window.NZ_DETAIL.init();
  window.NZ_INFRA.prepare();
  window.NZ_LAYOUT.apply();
  window.NZ_INFRA.apply();
  window.NZ_MULTI.apply();
  const retiredFactory=scene.getObjectByName('Scaled legacy factory');if(retiredFactory)retiredFactory.visible=false;
  // Clear old planting from the revised road surfaces before it is merged into
  // static batches; keep unaffected legacy landscaping in standard/compat modes.
  for(const o of scene.children.slice()){
    if(!o.isMesh||!o.geometry)continue;
    const p=o.geometry.parameters||{};
    const planting=o.geometry.type==='ConeGeometry'||o.geometry===bushG||
      (o.geometry.type==='SphereGeometry'&&p.radius>.65&&o.position.y<5)||
      (o.geometry.type==='CylinderGeometry'&&p.radiusTop<.16&&p.radiusBottom<.26&&p.height<3);
    if((planting&&o.position.x<-20)||(planting&&window.NZ_ENVIRONMENT_PLAN.roads.some(([, ,x,z,w,d])=>o.position.x>=x-.2&&o.position.x<=x+w+.2&&o.position.z>=z-.2&&o.position.z<=z+d+.2)))scene.remove(o);
    if(o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.position.y===.03&&o.position.x<-20)scene.remove(o);
  }
  // Batch static meshes by material. Animated objects retain their own geometry,
  // transforms and materials; device picking uses the original spatial registry.
  const moving=new Set([ground,base,socBar,h2Liquid,flagMesh,...truckPool,...beltBoxes]);
  const batches=new Map();
  scene.updateMatrixWorld(true);
  for(const o of scene.children.slice()){
    const m=o.material;
    if(!o.isMesh||moving.has(o)||!m||Array.isArray(m)||!m.isMeshStandardMaterial||m.transparent||m.emissive.getHex()!==0||o.geometry.type==='TubeGeometry')continue;
    const key=m.uuid+'|'+o.castShadow+'|'+o.receiveShadow;
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);
  }
  let batched=0;
  for(const objects of batches.values()){
    if(objects.length<3)continue;
    const geometries=objects.map(o=>{const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);return g;});
    const merged=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv']){
      if(!geometries.every(g=>g.attributes[name]))continue;
      const count=geometries.reduce((n,g)=>n+g.attributes[name].array.length,0);
      const array=new Float32Array(count);let offset=0;
      for(const g of geometries){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
      merged.setAttribute(name,new THREE.BufferAttribute(array,geometries[0].attributes[name].itemSize));
    }
    merged.computeBoundingSphere();
    const mesh=new THREE.Mesh(merged,objects[0].material);mesh.castShadow=objects[0].castShadow;mesh.receiveShadow=objects[0].receiveShadow;
    mesh.name='Static campus batch';scene.add(mesh);objects.forEach(o=>scene.remove(o));geometries.forEach(g=>g.dispose());batched+=objects.length;
  }
  console.log('[Grid to Chip] batched static meshes:',batched);
  const chain={wind:['wind','trans'],solar:['solar','trans'],substation:['wind','solar','trans'],bus:['wind','solar','trans','bus2tr','feedIn'],stepdown:['trans','bus2tr','tr2dc','tr2dcB','dcA','dcB'],dc:['trans','smr','bus2tr','tr2dc','tr2dcB','dcA','dcB','genset'],panamaDc:['bus2tr','tr2dc'],storage:['stg','feedIn','feedOut','feedOutW'],pem:['feedIn','feedOutW','pem','h2gas'],h2tank:['h2gas','h2use'],nh3:['pem','h2gas','h2use','nh3'],fc:['h2use','fc'],factory:['feedIn','feedOut','facE'],metal:['feedIn','feedOut','metalE','panZnAc','panZnDc'],supercharge:['scE','panScAc','panScDc','scSecondAc','scSecondDc']};
  chain.nh3.push('feedOutW','nh3E');chain.pem.push('feedOutW');chain.fc.push('fcGas');chain.smr=['smr'];chain.genset=['genset','dcA','dcB'];chain.dcfeed=['tr2dc','tr2dcB','genset','dcA','dcB'];chain.disttr=['bus2dist','feedIn','feedOut','feedOutW','svgShunt'];chain.svgapf=['feedIn','svgShunt'];chain.bus.push('smr','bus2dist');chain.substation.push('bus2dist');
  for(const key of ['h2purify','nitrogen','nh3cycle','nh3cool','ammoniastock','ammoniaload'])chain[key]=['feedOutW','pem','h2gas','h2use','nh3E','nh3'];
  for(const key of ['dc','stepdown','bus','dcfeed'])chain[key].push('hvDataA','hvDataB');
  const keyGroup=key=>groups.find(g=>g.keys&&g.keys.includes(key));
  const labelColor=key=>['pem','h2tank','fc'].includes(key)?palm.hydrogen:key==='nh3'?palm.ammonia:['dc','token'].includes(key)?'#369ccc':palm.power;
  for(const [key,l] of Object.entries(LABELS3D)){
    l.el.dataset.key=key;l.el.style.setProperty('--label-color',labelColor(key));
    if(!l.el.classList.contains('zone')){l.el.tabIndex=0;l.el.setAttribute('role','button');l.el.setAttribute('aria-label',l.el.querySelector('.nm').textContent);l.el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();l.el.click();}});}
  }
  function selectGroup(id){
    const g=groups.find(g=>g.id===id)||groups[0];V.group=g.id;
    $id('sceneTitle').textContent=g.name;$id('sceneSubtitle').textContent=g.text;$id('sceneEyebrow').textContent=g.en.toUpperCase();$id('sceneLocation').textContent='园区 / '+g.name;
    document.querySelectorAll('.campus-link').forEach(b=>{const active=b.dataset.group===g.id;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'true':'false');});
  }
  function selected(key){
    window.NZ_CHEMICAL.selection(key);
    if(window.NZ_WIND_PRODUCT)window.NZ_WIND_PRODUCT.selection(key);
    if(window.NZ_FLOWS)window.NZ_FLOWS.selection(key);
    window.NZ_LAYOUT.selection(key);
    if(window.NZ_RENEWABLES)window.NZ_RENEWABLES.selection(key);
    if(window.NZ_SOLAR)window.NZ_SOLAR.selection(key);
    window.NZ_DETAIL.select(key);
    if(window.NZ_FACTORY)window.NZ_FACTORY.selection(key);
    window.NZ_INFRA.selection(key);
    V.selected=key;
    const g=keyGroup(key);if(g)selectGroup(g.id);
    const l=LABELS3D[key];ring.visible=!!l;
    if(l)ring.position.set(l.anc.x,(key==='wind'?window.NZ_RENEWABLE_PLAN.height(l.anc.x,l.anc.z):0)+.13,l.anc.z);
    $id('enterBuilding').hidden=key!=='dc';
  }
  function clear(){if(window.NZ_FACTORY)window.NZ_FACTORY.selection(null);window.NZ_CHEMICAL.selection(null);if(window.NZ_WIND_PRODUCT)window.NZ_WIND_PRODUCT.selection(null);if(window.NZ_FLOWS)window.NZ_FLOWS.context("overview");window.NZ_INFRA.selection(null);window.NZ_LAYOUT.selection(null);if(window.NZ_RENEWABLES)window.NZ_RENEWABLES.selection(null);if(window.NZ_SOLAR)window.NZ_SOLAR.selection(null);window.NZ_DETAIL.reset();V.selected=null;ring.visible=false;selectGroup('overview');}
  function tourChapter(index){window.NZ_CHEMICAL.selection(null);const chapter=window.NZ_TOUR_SCRIPT.campus[index];if(window.NZ_WIND_PRODUCT)window.NZ_WIND_PRODUCT.tour(chapter.id);if(window.NZ_FLOWS)window.NZ_FLOWS.context(({generation:"wind",power:"energy",hydrogen:"chemical",loads:"factory"})[chapter.group]||chapter.group);window.NZ_INFRA.selection(null);window.NZ_LAYOUT.selection(null);if(window.NZ_RENEWABLES)window.NZ_RENEWABLES.selection(null);if(window.NZ_SOLAR)window.NZ_SOLAR.selection(null);window.NZ_DETAIL.reset();V.selected=null;ring.visible=false;selectGroup(chapter.group||'overview');}
  function filterLabels(){
    const dc=LABELS3D.dc;
    if(dc){const s=window.NZ_ENGINE.S;dc.lv.textContent='IT '+s.itMW.toFixed(1)+' MW · 进线 '+s.dcLoadMW.toFixed(1)+' MW · PUE '+s.pue.toFixed(2);}
    const g=groups.find(g=>g.id===V.group);
    const overview=['wind','solar','substation','storage','dc','nh3','supercharge','metal','factory','smr','genset','cooling','noc','ups','phase2','phase3','fire','token'];
    for(const [key,l]of Object.entries(LABELS3D)){
      const permitted=V.labels&&!window.NZ_CHEMICAL_LABELS.covers(key,V)&&(key===V.selected||(g.id==='overview'?overview.includes(key):g.keys.includes(key)));
      l.el.classList.toggle('layer-hidden',!permitted);
    }
    window.NZ_LAYOUT.filter();
    if(LABELS3D.windNacelle)LABELS3D.windNacelle.el.classList.toggle('layer-hidden',!V.labels||!['generation'].includes(g.id));
  }
  function beforeRender(light,rimL){
    window.NZ_CHEMICAL_LABELS.update(V);
    window.NZ_DETAIL.update();window.NZ_INFRA.update();window.NZ_MULTI.update();
    const night=light.preset==='night'||(light.preset==='follow'&&light.night);
    const day=light.preset==='follow'?light.dl:night?0:1;
    scene.background.set(night?'#dce5e7':'#f4f7f7');scene.fog.color.copy(scene.background);scene.fog.near=1500;scene.fog.far=2800;
    // Move the directional shadow footprint with the observed region. Close-ups
    // retain the original shadow density; the wide overview covers the terrain.
    const delta=new THREE.Vector3().subVectors(controls.target,sunL.target.position);sunL.position.add(delta);sunL.target.position.copy(controls.target);
    const extent=Math.max(190,Math.min(460,camera.position.distanceTo(controls.target)*.42));
    if(Math.abs(sunL.shadow.camera.right-extent)>1){Object.assign(sunL.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:10,far:1400});sunL.shadow.camera.updateProjectionMatrix();}
    groundMat.color.set(night?'#a1b7b5':'#e4ebe9');studio.material.color.copy(scene.background);
    sunL.color.set(night?'#b7d0dc':'#fff9f0');sunL.intensity=night?.28:.85;
    ambL.color.set('#f0f7f4');ambL.intensity=night?.15:.18;
    hemiL.color.set('#f3f8f7');hemiL.groundColor.set('#bccfca');hemiL.intensity=night?.30:.55;
    if(light.preset==='follow'&&!night){sunL.intensity=.35+.50*day;hemiL.intensity=.3+.25*day;}
    rimL.color.set('#e6f3f1');rimL.intensity=.12;rimL.position.set(-140,180,240);rimL.target.position.set(50,0,50);
    sunSp.material.opacity=0;moonSp.material.opacity=0;starMat.opacity=0;
    lampPoolMat.opacity=night?.14:0;
    pvPanelM.color.set(night?'#3b5664':'#496979');pvPanelM.roughness=.6;pvPanelM.metalness=.15;
    const linked=V.selected?chain[V.selected]:null;
    for(const e of EDGES){
      const active=Math.abs(e.pw())>1e-6;const highlight=linked&&linked.includes(e.key);
      const inScope=window.NZ_FLOW_RENDERER.contextVisible(e);
      if(e.visualTube){e.visualTube.visible=V.flows&&inScope;e.visualTube.material.opacity=V.selected?(highlight?.62:.20):(active?.32:.12);}
      e.points.visible=V.flows&&inScope&&active&&!S.reduceMotion;
    }
    if(window.NZ_FLOWS)window.NZ_FLOWS.afterEdges();
    window.NZ_FLOW_RENDERER.afterVisibility();
  }
  function ready(api){
    window.NZ_FLOW_RENDERER.init();
    window.NZ_DETAIL.ready(api);
    window.NZ_TOKEN_METER.ready(api);
    window.NZ_CHEMICAL.ready(api);
    window.NZ_CHEMICAL_LABELS.ready(api);
    window.NZ_MULTI.ready(api);
    if(window.NZ_RENEWABLES)window.NZ_RENEWABLES.ready(api);
    if(window.NZ_SOLAR)window.NZ_SOLAR.ready(api);
    window.NZ_WIND_PRODUCT.ready(api);window.NZ_FLOWS.ready(api);
    window.NZ_LAYOUT.ready(api);window.NZ_INFRA.ready(api);
    $id('campusLinks').innerHTML=groups.map((g,i)=>'<button class="campus-link'+(i===0?' active':'')+'" data-group="'+g.id+'"><b>'+String(i).padStart(2,'0')+'</b>'+g.name+'<span>›</span></button>').join('');
    $id('campusLinks').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(!b)return;api.exitTour();api.closeDrawer();const g=groups.find(g=>g.id===b.dataset.group);if(g.key){api.focus(g.key);selectGroup(g.id);}else{$id('infoClose').click();$id('btnCamReset').click();clear();}});
    $id('showCampusLabels').addEventListener('change',e=>{V.labels=e.target.checked;filterLabels();});
    $id('showCampusFlows').addEventListener('change',e=>{V.flows=e.target.checked;if(window.NZ_FLOWS)window.NZ_FLOWS.setGlobal(V.flows);});
    $id('btnLabelDetail').addEventListener('click',()=>{V.details=!V.details;document.body.classList.toggle('labels-detail',V.details);$id('btnLabelDetail').classList.toggle('on',V.details);$id('btnLabelDetail').setAttribute('aria-pressed',String(V.details));});
    $id('enterBuilding').addEventListener('click',()=>window.GOBI_DCDT.open());
    $id('navNotes').addEventListener('click',()=>api.drawer('policy'));
    $id('btnViewHome').addEventListener('click',()=>{$id('infoClose').click();$id('btnCamReset').click();clear();});
    $id('btnCamReset').addEventListener('click',clear);
    selectGroup('overview');filterLabels();
  }
  function restore(state){
    clear();if(state.selected)selected(state.selected);else selectGroup(state.group||'overview');Object.assign(V,state);
    $id('showCampusLabels').checked=V.labels;$id('showCampusFlows').checked=V.flows;document.body.classList.toggle('labels-detail',V.details);$id('btnLabelDetail').classList.toggle('on',V.details);$id('btnLabelDetail').setAttribute('aria-pressed',String(V.details));filterLabels();
  }
  window.NZ_VISUAL={ready,selected,clear,tourChapter,beforeRender,filterLabels,restore,state:()=>({...V})};
})();
