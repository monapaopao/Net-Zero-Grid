/* v13 compact nacelle transformer; coordinated display proportions, fixed-heading tour. */
'use strict';
window.NZ_WIND_PRODUCT=(function(){
  const P=window.NZ_RENEWABLE_PLAN,items=[],replacements=[];
  const productChapter=window.NZ_TOUR_SCRIPT.campus.find(c=>c.id==='windProduct');
  const title=window.NZ_TOUR_SCRIPT.products.windTransformer.title,text=window.NZ_TOUR_SCRIPT.products.windTransformer.text;
  const compact={scale:.58,pivot:[0,.13,-2.8],center:[0,-.08,-2.27]};
  const localCompact=p=>p.map((v,i)=>(v-compact.pivot[i])*compact.scale+compact.center[i]);
  const viewDirection=[470,385,560];
  const geo={box:new THREE.BoxGeometry(1,1,1),coil:new THREE.CylinderGeometry(.23,.23,.74,20),rib:new THREE.TorusGeometry(.234,.012,5,20),rod:new THREE.CylinderGeometry(1,1,1,8)};
  const mats={shell:new THREE.MeshStandardMaterial({color:0xe7efec,roughness:.7}),aluminum:new THREE.MeshStandardMaterial({color:0xc3ccd0,roughness:.35,metalness:.75}),core:new THREE.MeshStandardMaterial({color:0x526564,roughness:.55,metalness:.35}),insulation:new THREE.MeshStandardMaterial({color:0xe9ece1,roughness:.8}),teal:new THREE.MeshStandardMaterial({color:0x238e83,roughness:.55}),dark:new THREE.MeshStandardMaterial({color:0x304b4c,roughness:.6})};
  mats.air=new THREE.MeshStandardMaterial({color:0x7da19a,roughness:.7,transparent:true,opacity:.18,depthWrite:false});
  let api,selected=0,opened=false,amount=0,target=0,quality='standard',panel,tourId=null,focusedPart='whole';
  const anatomy=window.NZ_WIND_ANATOMY.build(THREE),partText={whole:'直驱发电机 → 全功率变流器 → 机舱干式变压器 → 塔内出线。单台代表性结构示意。',transformer:'西比里陶瓷基耐电晕干式变压器（铝绕组）。三相绝缘绕组、闭合铁芯、夹件及安装座；高低压电缆分层布置。',generator:'永磁直驱发电机示意：主轴与转子转动，定子、支座和接线盒保持固定。',converter:'全功率变流器示意：机侧功率模块、直流母线及电容、网侧功率模块、控制与散热组件。'};
  const anatomyValidation=window.NZ_WIND_ANATOMY.validate();
  function box(g,name,w,h,d,x,y,z,material){const o=new THREE.Mesh(geo.box,material);o.name=name;o.scale.set(w,h,d);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;}
  function rod(g,a,b,r,material){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),delta=bb.clone().sub(aa),o=new THREE.Mesh(geo.rod,material);o.scale.set(r,delta.length(),r);o.position.copy(aa).add(bb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(o);return o;}
  function shellPanel(g,name,vertices,material){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.renderOrder=3;g.add(mesh);return mesh;}
  for(const s of P.sites){
    const root=rotors[s.index].parent,g=new THREE.Group();g.name='XIBILI nacelle transformer '+s.index;g.userData.deviceKey='windNacelle';g.userData.windIndex=s.index;root.add(g);
    const fixed=new THREE.Group(),tail=new THREE.Group(),internals=new THREE.Group(),fine=new THREE.Group();g.add(fixed,tail,internals,fine);
    internals.name='Transformer internals';
    // The tail extends opposite the rotor plane. The nacelle is attached to the yaw frame, not the rotor.
    const frontCover=mats.shell.clone();frontCover.transparent=true;
    box(fixed,'Nacelle drivetrain enclosure',1.55,1.1,1.7,0,.02,-.87,frontCover);
    box(fixed,'Continuous nacelle support deck',1.55,.10,2.84,0,-.55,-1.44,mats.core);
    const cover=mats.shell.clone();cover.transparent=true;cover.depthWrite=false;cover.side=THREE.DoubleSide;
    const a=.775,b=.56,z0=-1.72,z1=-2.86,y0=.57,y1=.385,bottom=-.5;
    shellPanel(tail,'Rear roof',[[-a,y0,z0],[-b,y1,z1],[b,y1,z1],[a,y0,z0]],cover);
    shellPanel(tail,'Rear left panel',[[-a,bottom,z0],[-b,bottom,z1],[-b,y1,z1],[-a,y0,z0]],cover);
    shellPanel(tail,'Rear right panel',[[a,y0,z0],[b,y1,z1],[b,bottom,z1],[a,bottom,z0]],cover);
    box(tail,'Rear end panel',b*2,y1-bottom,.04,0,(y1+bottom)/2,z1,cover).renderOrder=3;
    const outlineGeometry=new THREE.BufferGeometry();outlineGeometry.setAttribute('position',new THREE.Float32BufferAttribute([[-a,y0,z0],[-b,y1,z1],[-b,y1,z1],[b,y1,z1],[b,y1,z1],[a,y0,z0],[-b,y1,z1],[-b,bottom,z1],[b,y1,z1],[b,bottom,z1],[-b,bottom,z1],[b,bottom,z1]].flat(),3));
    const outline=new THREE.LineSegments(outlineGeometry,new THREE.LineBasicMaterial({color:0x7aada6,transparent:true,opacity:0,depthWrite:false}));g.add(outline);
    box(internals,'Transformer mounting cradle',1.42,.13,1.4,0,-.41,-2.75,mats.core);
    for(const y of [-.27,.46])box(internals,'Laminated core yoke',1.44,.15,.2,0,y,-2.79,mats.core);
    for(const x of [-.48,0,.48]){
      box(internals,'Core limb',.14,.74,.16,x,.095,-2.79,mats.core);
      const coil=new THREE.Mesh(geo.coil,mats.aluminum);coil.name='Aluminum winding';coil.position.set(x,.095,-2.75);internals.add(coil);
      for(let j=0;j<9;j++){const rib=new THREE.Mesh(geo.rib,mats.aluminum);rib.rotation.x=Math.PI/2;rib.position.set(x,-.22+j*.078,-2.75);internals.add(rib);}
      box(internals,'Insulation wrap exterior',.36,.07,.38,x,.51,-2.75,mats.insulation);
      box(internals,'Terminal block',.19,.16,.22,x,.65,-2.72,mats.teal);
      rod(internals,[x,.65,-2.72],[x,.65,-1.88],.025,mats.aluminum);
    }
    for(const x of [-.8,.8]){box(internals,'Air cooling passage',.10,.82,1.05,x,.05,-2.75,mats.air);for(let j=0;j<8;j++)box(fine,'Vent louver',.025,.72,.018,x,.06,-3.15+j*.11,mats.core);}
    box(internals,'Temperature monitoring interface',.22,.17,.1,.55,.3,-3.38,mats.teal);
    const forward=new THREE.Group();forward.visible=false;g.add(forward);
    box(forward,'Generator interface',.7,.45,.65,0,.02,-.55,mats.core);
    box(forward,'Converter interface',.45,.6,.35,.38,.02,-1.3,mats.teal);
    for(const part of [internals,fine]){part.scale.setScalar(compact.scale);part.position.set(...compact.center.map((v,i)=>v-compact.pivot[i]*compact.scale));}
    replacements.push({index:s.index,removed:'地面单机升压变',installed:'机舱陶瓷基耐电晕干式变压器（铝绕组）',ground:'35 kV 集电开关 / 保护 / 计量 / 通信柜',retained:'共享能源枢纽场站主变',rating:'代表机组 6 MW；变压器容量与变比待配置'});
    if(s.index===0){g.add(anatomy.group);anatomy.group.visible=false;}
    items.push({root,g,fixed,tail,internals,fine,forward,cover,frontCover,outline,index:s.index});
  }
  function worldPoint(index,p){items[index].root.updateWorldMatrix(true,false);return items[index].root.localToWorld(new THREE.Vector3(...p)).toArray();}
  function endpoint(index,part='transformer'){
    if(index===0)return worldPoint(index,window.NZ_WIND_ANATOMY.ports[part+'1']||window.NZ_WIND_ANATOMY.ports.transformer1);
    const local={generator:[0,.1,-.55],converter:[.38,.1,-1.3],converterOut:[.38,.1,-1.3],transformer:localCompact([0,.1,-2.75]),transformerHV:localCompact([0,.1,-2.75]),cable:localCompact([0,-.5,-2.8])}[part];return worldPoint(index,local);
  }
  function routePath(index,kind){return index===0?(window.NZ_WIND_ANATOMY.paths[kind]||[]).map(p=>worldPoint(index,p)):null;}
  function pose(index=selected,direction=viewDirection,distance=18.5){
    const targetPart=index===0?focusedPart:'whole',tgt=index===0?worldPoint(index,window.NZ_WIND_ANATOMY.centers[targetPart]):endpoint(index);
    if(index===0&&targetPart!=='whole')distance=targetPart==='transformer'?8.8:10;
    const vector=new THREE.Vector3(...direction).normalize().multiplyScalar(distance);return {pos:new THREE.Vector3(...tgt).add(vector).toArray(),tgt};
  }
  function selectIndex(i){selected=Math.max(0,Math.min(items.length-1,Number(i)||0));amount=0;focusedPart='whole';
    const p=endpoint(selected);if(LABELS3D.windNacelle)LABELS3D.windNacelle.anc.set(p[0],p[1]+3,p[2]);const d=DEVICES.find(d=>d.key==='windNacelle');if(d)d.p=p.slice();
    if(panel)panel.querySelector('select').value=String(selected);return selected;
  }
  function selection(key){opened=key==='windNacelle';target=opened?1:0;controls.minDistance=opened?8:18;if(panel)panel.hidden=!['wind','windNacelle'].includes(key);}
  function setOpen(value){opened=!!value;target=opened?1:0;if(panel){const b=panel.querySelector('[data-wind-action=transparent]');b.textContent=opened?'恢复机舱外壳':'剖视机舱结构';b.setAttribute('aria-pressed',String(opened));}}
  function update(dt){if(tourId!=='windProduct')amount=S.reduceMotion?target:amount+(target-amount)*(1-Math.exp(-5*Math.max(0,dt)));
    items.forEach(m=>{const active=m.index===selected,alpha=active?1-.91*amount:1;m.cover.opacity=alpha;m.cover.depthWrite=alpha>.98;m.frontCover.opacity=alpha;m.frontCover.depthWrite=alpha>.98;m.fixed.getObjectByName('Nacelle drivetrain enclosure').castShadow=alpha>.98;m.outline.material.opacity=active?.32*amount:0;m.internals.visible=active&&amount>.015;m.forward.visible=active&&amount>.015;m.fine.visible=active&&amount>.1&&quality==='high';
      if(m.index===0){const near=camera.position.distanceTo(m.root.getWorldPosition(new THREE.Vector3()))<135,hero=active&&near;
        m.fixed.visible=!hero;m.tail.visible=!hero;
        if(hero){m.internals.visible=false;m.forward.visible=false;m.fine.visible=false;m.outline.visible=false;}else m.outline.visible=true;
        anatomy.update({visible:hero,amount:active?amount:0,angle:rotors[0].rotation.z,part:focusedPart,reduced:S.reduceMotion});
      }
    });
    if(panel){panel.querySelector('[data-wind-action=transparent]').textContent=opened?'恢复机舱外壳':'剖视机舱结构';panel.querySelector('.wind-anatomy-detail').textContent=selected===0?partText[focusedPart]:'此机组保留简化表达；精细结构展示位于第 1 台代表风机。';panel.querySelectorAll('[data-wind-part]').forEach(b=>{b.disabled=selected!==0;b.setAttribute('aria-pressed',String(b.dataset.windPart===focusedPart));});const p=S.turbP[selected]||0;panel.querySelector('.wind-live').textContent='代表机组 '+(selected+1)+' · 当前 '+p.toFixed(2)+' MW · 全场 '+S.windMW.toFixed(1)+' MW';}
  }
  function tour(id){tourId=id;controls.minDistance=18;if(id==='windProduct'){selectIndex(0);focusedPart='whole';setOpen(true);amount=1;update(0);}else{setOpen(false);}}
  function tourTime(t){if(tourId!=='windProduct')return;amount=1;opened=true;target=1;update(0);}
  INFO.windNacelle={t:title,media:'power',d:text,from:'发电机 / 变流接口',to:'机舱升压 → 塔内电缆 → 地面集电开关 → 场站主变',p:[['绕组','铝绕组；外部显示复合绝缘包覆，端子为银灰色金属'],['安装','第 1 台机组展示支承、三相铁芯绕组与分层电缆'],['单机核算','沿用 6 MW 机组；不增加装机容量'],['地面设备','原同功能升压变改为集电开关与保护通信柜'],['待配置','额定容量、变比、尺寸、质量、散热及结构校核']],note:'概念结构与产品功能展示；不包含材料层级放大，不宣称未经验证的寿命或整机免维护。'};
  INFO.wind.d+=' 单机升压改由机舱尾部干式变压器承担；地面为集电开关、保护、计量与通信设备。场站主变继续保留。';
  addLabel('windNacelle',endpoint(0),'风力发电机组','','','wind-unit-label');LABELS3D.windNacelle.lv.textContent='';selectIndex(0);
  function ready(a){api=a;panel=document.createElement('section');panel.id='windProductControls';panel.hidden=true;
    panel.innerHTML='<div class="detail-kicker">西比里 · 机舱变产品</div><label>代表风机 <select>'+P.sites.map(s=>'<option value="'+s.index+'">'+(s.index+1)+' · '+({west:'平地',ridge:'缓丘',distant:'远丘'}[s.zone])+'</option>').join('')+'</select></label><div class="detail-buttons"><button data-wind-action="close">机舱结构近景</button><button data-wind-action="transparent" aria-pressed="false">剖视机舱结构</button></div><div class="wind-part-buttons" role="group" aria-label="机舱部件查看"><button data-wind-part="whole" aria-pressed="true">整机结构</button><button data-wind-part="transformer" aria-pressed="false">干式变压器</button><button data-wind-part="generator" aria-pressed="false">发电机</button><button data-wind-part="converter" aria-pressed="false">变流器</button></div><p class="wind-anatomy-detail"></p><p class="wind-live"></p><small>机舱变替代单机地面升压变；场站主变保留。额定参数与结构校核待配置。</small>';
    document.getElementById('renewableControls').after(panel);
    panel.querySelector('select').addEventListener('change',e=>{api.exitTour();selectIndex(e.target.value);api.focus('windNacelle');setOpen(true);});
    panel.querySelector('[data-wind-action=close]').addEventListener('click',()=>{api.exitTour();focusedPart='whole';api.focus('windNacelle');setOpen(true);});
    panel.querySelector('[data-wind-action=transparent]').addEventListener('click',()=>{const next=!opened;api.exitTour();if(!next&&selected===0){focusedPart='whole';api.focus('windNacelle');}setOpen(next);});
    panel.querySelectorAll('[data-wind-part]').forEach(b=>b.addEventListener('click',()=>{api.exitTour();focusedPart=b.dataset.windPart;api.focus('windNacelle');setOpen(true);}));
    LABELS3D.windNacelle.el.dataset.key='windNacelle';LABELS3D.windNacelle.el.setAttribute('aria-label','风力发电机组');LABELS3D.windNacelle.el.setAttribute('role','button');LABELS3D.windNacelle.el.tabIndex=0;LABELS3D.windNacelle.el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();api.focus('windNacelle');}});
    TICKERS.push((t,dt)=>update(dt));
  }
  function audit(){return {product:title,text,index:selected,open:opened,amount,quality,tourId,transformers:items.length,replacements,pose:pose(),compact,viewDirection,turbine:P.turbine,rotorIndependent:items.every(m=>m.g.parent===rotors[m.index].parent),aluminumColor:mats.aluminum.color.getHexString(),materialsExpanded:false,anatomy:anatomy.audit(),anatomyValidation,liveSampleMW:S.turbP[selected]||0};}
  return {ready,selection,selectIndex,setOpen,update,tour,tourTime,endpoint,routePath,pose,audit,focus:key=>key==='windNacelle'?pose():null,setQuality:q=>quality=q};
})();
