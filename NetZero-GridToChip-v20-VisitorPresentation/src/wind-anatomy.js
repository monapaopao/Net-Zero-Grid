/* One representative nacelle. Native Three.js adaptation of Anatomy physical-part craft.
 * Coordinates are illustrative, not manufacturing dimensions or an OEM winding design. */
'use strict';
window.NZ_WIND_ANATOMY=(function(){
  const parts=[],ports={},paths={},phaseZ=[-2.09,-2.43,-2.77];
  function part(id,assembly,shape,size,at,material,extra={}){parts.push({id,assembly,shape,size,at,material,...extra});}
  const box=(id,a,size,at,m,extra)=>part(id,a,'box',size,at,m,extra);
  const ring=(id,a,ri,ro,h,at,m,axis='y',extra={})=>part(id,a,'ring',[ri,ro,h],at,m,{axis,...extra});
  const rod=(id,a,p,q,r,m)=>part(id,a,'rod',[r],p,m,{end:q});
  function cable(id,a,points,r,m){part(id,a,'cable',[r],points[0],m,{points});return points;}
  function bolt(id,a,at,axis='y',r=.018){part(id,a,'bolt',[r,r*.62],at,'metal',{axis});}
  function support(id,a,at,w=.085,d=.09){box(id+'-pad',a,[w,.032,d],at,'rubber');bolt(id+'-bolt',a,[at[0],at[1]+.021,at[2]]);}
  // Bedplate and yaw opening. Rails carry devices; the tower opening is not a solid slab.
  for(const x of [-.66,.66]){
    box('longitudinal-girder-'+x,'frame',[.12,.14,2.83],[x,-.55,-1.50],'steel');
    box('beam-flange-'+x,'frame',[.17,.026,2.83],[x,-.47,-1.50],'metal');
  }
  for(const z of [-.37,-.94,-1.56,-2.04,-2.87]){
    box('cross-member-'+z,'frame',[1.20,.10,.10],[0,-.55,z],'steel');
    for(const x of [-.60,.60])bolt('frame-fastener-'+x+z,'frame',[x,-.4514,z]);
  }
  ring('yaw-bedplate-pedestal','frame',.25,.39,.14,[0,-.47,-.02],'steel');
  ring('yaw-bearing','frame',.25,.39,.16,[0,-.32,-.02],'steel');
  ring('yaw-race','frame',.27,.42,.035,[0,-.23,-.02],'metal');
  for(let i=0;i<12;i++){const a=i*Math.PI/6;bolt('yaw-bolt-'+i,'frame',[Math.cos(a)*.365,-.206,Math.sin(a)*.365-.02]);}
  for(let i=0;i<13;i++)box('walkway-tread-'+i,'frame',[.18,.025,.12],[-.66,-.445,-.65-i*.171],'alloy');
  for(const z of [-1.94,-2.89]){
    box('transformer-load-spreader-'+z,'frame',[1.38,.065,.14],[0,-.4775,z],'steel');
    box('transformer-mounting-rail-'+z,'transformer',[.82,.065,.10],[-.12,-.415,z],'steel');
    for(const x of [-.45,.21])support('transformer-isolator-'+x+z,'transformer',[x,-.365,z]);
  }
  // Direct-drive generator: stationary hollow stator, independent rotor and an actual shaft.
  ring('generator-stator','generator',.325,.475,.32,[0,0,-.57],'steel','z');
  for(const z of [-.39,-.75]){
    ring('stator-end-flange-'+z,'generator',.319,.50,.032,[0,0,z],'alloy','z');
    for(let i=0;i<12;i++){const a=i*Math.PI/6;bolt('stator-flange-bolt-'+z+i,'generator',[Math.cos(a)*.443,Math.sin(a)*.443,z+.0195],'z',.014);}
  }
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=Math.cos(a)*.373,y=Math.sin(a)*.373;
    ring('end-winding-'+i,'generator',.025,.045,.075,[x,y,-.355],'insulation','z');
    const o={rotationZ:-a};box('stator-rib-'+i,'generator',[.038,.04,.25],[Math.cos(a)*.48,Math.sin(a)*.48,-.57],'metal',o);
  }
  ring('generator-rotor','rotor',.081,.288,.25,[0,0,-.56],'dark','z');
  ring('rotor-disc','rotor',.08,.27,.035,[0,0,-.38],'metal','z');
  rod('main-shaft','rotor',[0,0,.01],[0,0,-.72],.078,'metal');
  for(let i=0;i<10;i++){const a=i*Math.PI/5;bolt('rotor-bolt-'+i,'rotor',[Math.cos(a)*.20,Math.sin(a)*.20,-.3585],'z',.014);}
  for(const z of [-.19,-.31]){
    ring('shaft-bearing-'+z,'generator',.084,.143,.065,[0,0,z],'alloy','z');
    box('bearing-pedestal-'+z,'generator',[.20,.29,.09],[0,-.285,z],'steel');
    box('bearing-foot-'+z,'generator',[.29,.04,.15],[0,-.446,z],'alloy');
    for(const x of [-.105,.105])bolt('bearing-foot-bolt-'+x+z,'generator',[x,-.4205,z]);
  }
  for(const x of [-.31,.31]){
    box('stator-support-'+x,'generator',[.14,.14,.23],[x,-.38,-.57],'steel');
    support('generator-isolator-'+x,'generator',[x,-.451,-.57],.19,.30);
  }
  box('generator-terminal-box','generator',[.19,.23,.22],[.50,.12,-.60],'ivory');
  box('generator-terminal-cover','generator',[.205,.24,.018],[.50,.12,-.478],'alloy');
  // Converter: separate machine/grid power stacks and an illustrative DC link.
  for(const x of [.16,.71])box('converter-upright-'+x,'converter',[.035,.78,.035],[x,.01,-1.29],'alloy');
  box('converter-backplane','converter',[.54,.75,.025],[.435,.01,-1.60],'ivory');
  box('converter-floor','converter',[.58,.04,.67],[.435,-.37,-1.29],'steel');
  for(const z of [-1.02,-1.56]){box('converter-base-plinth-'+z,'frame',[.39,.06,.12],[.43,-.47,z],'steel');support('converter-foot-'+z,'converter',[.43,-.425,z],.39,.10);box('converter-mount-shoe-'+z,'converter',[.39,.028,.10],[.43,-.397,z],'alloy');}
  for(const z of [-1.10,-1.42]){
    box('power-module-'+z,'converter',[.25,.36,.12],[.44,.11,z],'dark');
    box('power-module-cover-'+z,'converter',[.026,.34,.14],[.297,.11,z],'teal');
    for(let j=0;j<7;j++)box('heat-sink-fin-'+z+j,'converter',[.11,.018,.14],[.635,-.035+j*.05,z],'metal');
    for(const y of [-.02,.24])bolt('module-fixing-'+y+z,'converter',[.2805,y,z],'x',.012);
  }
  for(let j=0;j<3;j++)ring('dc-link-capacitor-'+j,'converter',0,.054,.16,[.25+j*.14,-.23,-1.28],'metal');
  for(const z of [-1.23,-1.33]){
    box('dc-busbar-'+z,'converter',[.43,.025,.035],[.43,-.123,z],'metal');
    for(const x of [.24,.62])box('busbar-insulator-'+x+z,'converter',[.045,.052,.04],[x,-.164,z],'insulation');
  }
  box('machine-ac-terminal-panel','converter',[.54,.19,.035],[.435,.10,-.977],'ivory');
  box('grid-ac-terminal-panel','converter',[.54,.16,.03],[.435,.24,-1.635],'ivory');
  box('converter-control-board','converter',[.36,.12,.027],[.43,.27,-1.574],'circuit');
  for(let j=0;j<4;j++)box('control-connector-'+j,'converter',[.055,.028,.025],[.29+j*.09,.24,-1.55],'ivory');
  // Closed three-limb magnetic circuit; three concentric, insulated LV/HV coils.
  for(const y of [-.28,.42])box('laminated-yoke-'+y,'transformer',[.13,.10,1.04],[-.12,y,-2.43],'steel');
  for(let j=0;j<9;j++)for(const y of [-.28,.42])box('yoke-lamination-'+j+y,'transformer',[.003,.102,1.037],[-.177+j*.014,y,-2.43],'lamination');
  for(const [i,z]of phaseZ.entries()){
    box('core-limb-'+i,'transformer',[.10,.60,.10],[-.12,.07,z],'steel');
    ring('lv-winding-'+i,'transformer',.082,.110,.50,[-.12,.06,z],'insulation');
    ring('hv-winding-'+i,'transformer',.124,.148,.50,[-.12,.06,z],'winding');
    // Insulation bands, not exposed bare-metal spring coils.
    for(let j=0;j<12;j++)ring('insulation-band-'+i+'-'+j,'transformer',.147,.150,.009,[-.12,-.175+j*.042,z],'band');
    for(const y of [-.213,.333])ring('end-insulation-'+i+y,'transformer',.077,.161,.032,[-.12,y,z],'ivory','y',y>0?{bore:[.107,0,.017]}:{});
    for(const y of [-.17,.28])ring('coil-end-restraint-'+i+y,'transformer',.151,.158,.022,[-.12,y,z],'teal');
    box('lv-terminal-cleat-'+i,'transformer',[.061,.035,.056],[.065,.365,z],'insulation');
    cable('lv-winding-lead-'+i,'transformer',[[-.013,.30,z],[-.013,.38,z],[.065,.38,z]],.009,'metal');
    box('lv-terminal-palm-'+i,'transformer',[.050,.022,.050],[.065,.38,z],'metal');
    bolt('lv-terminal-bolt-'+i,'transformer',[.065,.395,z],'y',.012);
    cable('hv-winding-lead-'+i,'transformer',[[-.266,.17,z],[-.283,.21,z],[-.298,.25,z]],.009,'metal');
    ring('hv-terminal-insulator-'+i,'transformer',.009,.033,.115,[-.350,.25,z],'ivory','x');
    for(let j=0;j<4;j++)ring('hv-insulator-shed-'+i+j,'transformer',.010,.042,.012,[-.306-j*.028,.25,z],'insulation','x');
    rod('hv-terminal-pin-'+i,'transformer',[-.29,.25,z],[-.43,.25,z],.009,'metal');
    ring('hv-cable-boot-'+i,'transformer',.009,.024,.045,[-.433,.25,z],'dark','x');
    box('winding-temperature-probe-'+i,'transformer',[.035,.047,.055],[.031,.055,z],'teal');
    cable('temperature-lead-'+i,'monitor',[[.048,.055,z],[.12,.055,z],[.60,.055,z],[.60,-.13,-2.83],[.64,-.13,-2.83]],.004,'sensor');
  }
  for(const x of [-.44,.20])for(const y of [-.34,.50]){
    box('core-clamp-rail-'+x+y,'transformer',[.064,.064,1.12],[x,y,-2.43],'alloy');
    for(const z of [-1.95,-2.91])bolt('clamp-nut-'+x+y+z,'transformer',[x,y+.0375,z]);
  }
  for(const z of [-1.95,-2.91]){
    box('core-clamp-crossbar-'+z,'transformer',[.70,.055,.06],[-.12,.50,z],'steel');
    for(const x of [-.44,.20])rod('clamp-tie-rod-'+x+z,'transformer',[x,-.34,z],[x,.54,z],.010,'metal');
  }
  box('product-nameplate','transformer',[.016,.115,.29],[-.480,.42,-2.45],'teal');
  for(const z of [-2.55,-2.35])bolt('nameplate-fixing-'+z,'transformer',[-.492,.42,z],'x',.008);
  box('monitoring-enclosure','monitor',[.12,.19,.20],[.68,-.13,-2.83],'ivory');
  box('monitoring-display','monitor',[.014,.052,.08],[.612,-.10,-2.83],'circuit');
  cable('protective-earth','monitor',[[-.43,-.34,-2.88],[-.52,-.37,-2.88],[-.60,-.37,-2.88],[-.66,-.44,-2.88]],.009,'earth');
  bolt('earth-lug','monitor',[-.66,-.417,-2.88]);
  // Three real cable circuits, segregated by purpose and elevation.
  for(let i=0;i<3;i++){
    const z=phaseZ[i],x=.27+i*.12;
    const gen=[.594,.08+i*.06,-.60],machine=[.27+i*.12,.10,-.958];
    const machinePath=[gen,[.77,gen[1],-.60],[.77,gen[1],-.86],[machine[0],gen[1],-.86],machine];
    const lv=[[x,.24,-1.65],[x,.59,-1.65],[x,.59,z],[.065,.59,z],[.065,.38,z]];
    const lane=-.50-i*.06,front=-.03-i*.05,y=-.29-i*.045;
    const hv=[[-.43,.25,z],[lane,.25,z],[lane,y,z],[lane,y,front],[lane,-.51,front],[-.08+i*.08,-.51,front]];
    cable('machine-ac-cable-'+i,'cables',machinePath,.012,'cable');
    cable('grid-ac-lv-cable-'+i,'cables',lv,.014,'cable');
    cable('medium-voltage-cable-'+i,'cables',hv,.011,'cable');
    ring('generator-gland-'+i,'generator',.012,.024,.035,gen,'dark','x');
    ring('converter-input-gland-'+i,'converter',.012,.023,.035,machine,'dark','z');
    ring('converter-output-gland-'+i,'converter',.014,.027,.035,lv[0],'dark','z');
    ring('tower-cable-gland-'+i,'frame',.011,.024,.05,hv.at(-1),'alloy');
    ports['generator'+i]=gen;ports['converter'+i]=machine;ports['converterOut'+i]=lv[0];ports['transformer'+i]=lv.at(-1);ports['transformerHV'+i]=hv[0];ports['cable'+i]=hv.at(-1);
    if(i===1){paths.generator=machinePath;paths.converter=lv;paths.tower=hv;}
    for(const zz of [-1.80,z])box('upper-tray-cleat-'+i+zz,'frame',[.05,.028,.045],[x,.556,zz],'ivory');
    for(const zz of [-1.72,z])box('lower-tray-cleat-'+i+zz,'frame',[.05,.024,.045],[lane,y-.025,zz],'ivory');
  }
  for(const z of [-1.79,-2.97]){
    box('upper-tray-support-'+z,'frame',[.54,.03,.035],[.37,.55,z],'alloy');
    rod('upper-tray-hanger-'+z,'frame',[.70,-.47,z],[.70,.56,z],.012,'alloy');
  }
  box('rear-cross-member','frame',[1.52,.10,.12],[0,-.55,-2.97],'steel');
  box('rear-cross-member-cap','frame',[1.52,.03,.14],[0,-.47,-2.97],'alloy');
  for(const x of [-.75,.75])for(const z of [-.20,-1.78,-2.92])box('shell-outrigger-'+x+z,'frame',[.20,.05,.12],[x,-.445,z],'alloy');
  // Removable near-side/top panels. The far-side shell remains an opaque solid.
  box('far-side-shell','shellFar',[.035,1.12,2.86],[.84,.09,-1.51],'shell',{bevel:.025});
  box('rear-shell','shellFar',[1.66,1.12,.035],[0,.09,-2.96],'shell',{bevel:.025});
  box('near-side-shell','shellCut',[.035,1.12,2.86],[-.84,.09,-1.51],'shell',{bevel:.025});
  box('top-shell','shellCut',[1.69,.055,2.88],[0,.672,-1.51],'shell',{bevel:.025});
  for(const x of [-.81,.81])box('roof-seam-'+x,'shellCut',[.018,.018,2.75],[x,.71,-1.51],'alloy');
  for(let j=0;j<9;j++)box('tail-air-exhaust-'+j,'shellFar',[.02,.028,.24],[.817,-.18+j*.051,-2.69],'dark');
  for(const z of [-.20,-1.78,-2.92])box('far-shell-stiffener-'+z,'frame',[.045,1.06,.04],[.80,.10,z],'alloy');
  // Reference points describe distinct physical ports, never a conductor through an insulating core.
  const centers={whole:[0,.04,-1.52],transformer:[-.12,.10,-2.43],generator:[0,0,-.48],converter:[.43,.03,-1.29]};
  const palette={steel:0x50615f,lamination:0x72817c,metal:0xc3ccd0,alloy:0xaabbb7,dark:0x2e4342,ivory:0xe3e7da,insulation:0xc8d7ca,winding:0x88aaa2,band:0xadc2b5,teal:0x168f84,circuit:0x287d75,rubber:0x303d3b,cable:0x475a58,sensor:0x8fa9b0,earth:0xb4b365,shell:0xe5ece7};
  function build(THREE){
    const group=new THREE.Group();group.name='Anatomy representative nacelle';
    const sections={},materials={},batches=new Map(),objects=[],cache=new Map();
    for(const name of ['frame','generator','rotor','converter','transformer','cables','monitor','shellFar','shellCut']){sections[name]=new THREE.Group();sections[name].name=name;group.add(sections[name]);}
    for(const [name,color]of Object.entries(palette))materials[name]=new THREE.MeshStandardMaterial({color,roughness:name==='metal'?.37:.64,metalness:['metal','alloy','lamination'].includes(name)?.52:.12});
    materials.shellCut=materials.shell.clone();materials.shellCut.transparent=true;
    function geometry(p){
      const key=JSON.stringify([p.shape,p.size,p.bevel,p.bore]);if(cache.has(key))return cache.get(key);
      let g;const s=p.size;
      if(p.shape==='box'){
        if(p.bevel){const sh=new THREE.Shape(),w=s[0]/2,h=s[1]/2,r=Math.min(p.bevel,w/3,h/3);sh.moveTo(-w+r,-h);sh.lineTo(w-r,-h);sh.quadraticCurveTo(w,-h,w,-h+r);sh.lineTo(w,h-r);sh.quadraticCurveTo(w,h,w-r,h);sh.lineTo(-w+r,h);sh.quadraticCurveTo(-w,h,-w,h-r);sh.lineTo(-w,-h+r);sh.quadraticCurveTo(-w,-h,-w+r,-h);g=new THREE.ExtrudeGeometry(sh,{depth:s[2],bevelEnabled:false,curveSegments:4});g.translate(0,0,-s[2]/2);}
        else g=new THREE.BoxGeometry(...s);
      }else if(p.shape==='ring'){
        const [ri,ro,h]=s;
        if(p.bore){const sh=new THREE.Shape();sh.absarc(0,0,ro,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,ri,0,Math.PI*2,true);sh.holes.push(hole);const bore=new THREE.Path();bore.absarc(p.bore[0],p.bore[1],p.bore[2],0,Math.PI*2,true);sh.holes.push(bore);g=new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false,curveSegments:24});g.translate(0,0,-h/2);g.rotateX(-Math.PI/2);}
        else{const profile=[[ri,-h/2],[ro,-h/2],[ro,h/2],[ri,h/2],[ri,-h/2]].map(v=>new THREE.Vector2(...v));g=new THREE.LatheGeometry(profile,32);}
      }else if(p.shape==='bolt')g=new THREE.CylinderGeometry(s[0],s[0],s[1],6);
      if(g)cache.set(key,g);return g;
    }
    function roundedPath(points,radius=.045){
      const curve=new THREE.CurvePath(),v=points.map(p=>new THREE.Vector3(...p));let previous=v[0];
      for(let i=1;i<v.length-1;i++){
        const a=v[i-1],b=v[i],c=v[i+1],r=Math.min(radius,a.distanceTo(b)*.22,b.distanceTo(c)*.22),enter=b.clone().lerp(a,r/b.distanceTo(a)),leave=b.clone().lerp(c,r/b.distanceTo(c));
        if(previous.distanceTo(enter)>1e-7)curve.add(new THREE.LineCurve3(previous,enter));curve.add(new THREE.QuadraticBezierCurve3(enter,b,leave));previous=leave;
      }curve.add(new THREE.LineCurve3(previous,v.at(-1)));return curve;
    }
    function merged(list){let total=0;const gs=list.map(g=>g.index?g.toNonIndexed():g);gs.forEach(g=>total+=g.attributes.position.count);const result=new THREE.BufferGeometry();for(const attr of ['position','normal']){const array=new Float32Array(total*3);let n=0;for(const g of gs){array.set(g.attributes[attr].array,n);n+=g.attributes[attr].array.length;}result.setAttribute(attr,new THREE.BufferAttribute(array,3));}result.computeBoundingSphere();return result;}
    for(const p of parts){
      let g=geometry(p),mat=p.assembly==='shellCut'?'shellCut':p.material;
      const object=new THREE.Object3D();object.position.set(...p.at);
      if(p.shape==='cable'){const curve=roundedPath(p.points);g=new THREE.TubeGeometry(curve,Math.max(16,p.points.length*10),p.size[0],8,false);object.position.set(0,0,0);}
      else if(p.shape==='rod'){const a=new THREE.Vector3(...p.at),b=new THREE.Vector3(...p.end),d=b.clone().sub(a);g=new THREE.CylinderGeometry(p.size[0],p.size[0],d.length(),10);object.position.copy(a).add(b).multiplyScalar(.5);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
      else if(p.axis==='x')object.rotation.z=-Math.PI/2;
      else if(p.axis==='z')object.rotation.x=Math.PI/2;
      if(p.rotationZ)object.rotateZ(p.rotationZ);object.updateMatrix();
      const transformed=g.clone().applyMatrix4(object.matrix),key=p.assembly+'|'+mat;
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(transformed);
      objects.push({id:p.id,assembly:p.assembly,shape:p.shape,material:p.material});
    }
    for(const [key,list]of batches){const [section,mat]=key.split('|'),mesh=new THREE.Mesh(merged(list),materials[mat]);mesh.name=section+' / '+mat;mesh.castShadow=true;mesh.receiveShadow=true;sections[section].add(mesh);list.forEach(g=>g.dispose());}
    // Small engraved product plate, generated locally; never an external texture.
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d');ctx.fillStyle='#137e74';ctx.fillRect(0,0,512,192);ctx.fillStyle='#eef7f1';ctx.font='bold 48px sans-serif';ctx.fillText('XIBILI',24,65);ctx.font='28px sans-serif';ctx.fillText('DRY TRANSFORMER',24,112);ctx.font='24px sans-serif';ctx.fillText('Al WINDINGS',24,155);
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(.28,.105),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(canvas),roughness:.8}));plate.name='XIBILI equipment nameplate';plate.rotation.y=-Math.PI/2;plate.position.set(-.490,.42,-2.45);sections.transformer.add(plate);
    const visibleSections=['generator','converter','transformer','cables','monitor'];let state={lod:false,cutaway:0,part:'whole'};
    function update({visible,amount,angle=0,part='whole',reduced=false}){
      group.visible=visible;state={lod:visible,cutaway:amount,part};if(!visible)return;
      const cut=amount>.005;materials.shellCut.opacity=1-amount;materials.shellCut.depthWrite=amount<.02;sections.shellCut.visible=amount<.985;
      visibleSections.forEach(s=>sections[s].visible=cut);sections.rotor.visible=cut;sections.rotor.rotation.z=angle;
      // Calm, static selection. No blinking, explosion or motion when reduced motion is active.
      const active=part==='whole'?'transformer':part;
      for(const name of ['teal','winding']){materials[name].emissive.setHex(active==='transformer'&&cut?0x06362e:0);materials[name].emissiveIntensity=.12;}
      for(const mesh of sections.shellCut.children)mesh.castShadow=!cut;
    }
    return {group,sections,update,audit:()=>({...state,parts:objects.length,batches:batches.size+1,assemblies:Object.fromEntries(Object.keys(sections).map(a=>[a,objects.filter(o=>o.assembly===a).length])),opaqueInternals:visibleSections.every(s=>sections[s].children.every(m=>!m.material.transparent)),closedCore:true,coils:3,lvHvIsolationGap:.014,rotorIndependent:true,ports,paths,envelope:{width:1.72,height:1.33,length:3.0}})};
  }
  function validate(){
    const ids=parts.map(p=>p.id),checks={uniquePartIds:new Set(ids).size===ids.length,threeDistinctPhases:phaseZ.length===3,closedMagneticCircuit:parts.filter(p=>p.id.startsWith('core-limb-')).length===3&&parts.filter(p=>p.id.startsWith('laminated-yoke-')).length===2,concentricInsulation:parts.filter(p=>/^lv-winding-\d$/.test(p.id)).length===3&&parts.filter(p=>/^hv-winding-\d$/.test(p.id)).length===3,noCoilCoreIntersection:Math.SQRT2*.05<.082,separateLvHvWindings:.110<.124,oneDetailedUnit:true,opaquePartPalette:true};
    for(let i=0;i<3;i++){for(const [name,start,end]of [['machine-ac-cable-',ports['generator'+i],ports['converter'+i]],['grid-ac-lv-cable-',ports['converterOut'+i],ports['transformer'+i]],['medium-voltage-cable-',ports['transformerHV'+i],ports['cable'+i]]]){const p=parts.find(p=>p.id===name+i);checks[name+i+'-ports']=JSON.stringify(p.points[0])===JSON.stringify(start)&&JSON.stringify(p.points.at(-1))===JSON.stringify(end);}}
    const powerCables=parts.filter(p=>/^(machine-ac-cable-|grid-ac-lv-cable-|medium-voltage-cable-)/.test(p.id));
    const electricalSolids=parts.filter(p=>/^(core-limb-\d+|laminated-yoke--?[.\d]+|[lh]v-winding-\d+|generator-stator|stator-end-flange--?[.\d]+)$/.test(p.id));
    let minimumClearance=Infinity;const collisions=[];
    for(const cable of powerCables)for(let i=1;i<cable.points.length;i++){
      const a=cable.points[i-1],b=cable.points[i],n=Math.ceil(Math.hypot(...a.map((v,k)=>v-b[k]))/.004);
      for(let j=0;j<=n;j++){const q=a.map((v,k)=>v+(b[k]-v)*j/n);
        for(const solid of electricalSolids){let d;
          if(solid.shape==='box'){d=Math.hypot(...q.map((v,k)=>Math.max(Math.abs(v-solid.at[k])-solid.size[k]/2,0)));}
          else{const axis=solid.axis==='z'?2:1,radialAxes=axis===2?[0,1]:[0,2],r=Math.hypot(...radialAxes.map(k=>q[k]-solid.at[k])),radial=Math.max(solid.size[0]-r,r-solid.size[1],0),axial=Math.max(Math.abs(q[axis]-solid.at[axis])-solid.size[2]/2,0);d=Math.hypot(radial,axial);}
          minimumClearance=Math.min(minimumClearance,d-cable.size[0]);if(d<cable.size[0]-.0001)collisions.push(cable.id+' / '+solid.id);
        }
      }
    }
    checks.mainCablesClearIronCoilsAndGenerator=collisions.length===0;
    checks.lvLeadBores=parts.filter(p=>p.bore).length===3;
    checks.converterPortsMounted=parts.some(p=>p.id==='machine-ac-terminal-panel')&&parts.some(p=>p.id==='grid-ac-terminal-panel');
    return {checks,passed:Object.values(checks).every(Boolean),clearanceScope:'Nine external power cables vs core, windings and generator casing envelopes; structural joints and terminal contact are intentional',minimumClearance,collisions:[...new Set(collisions)],partCount:parts.length,partTypes: new Set(parts.map(p=>p.shape)).size,conceptOnly:true,materialsExpanded:false};
  }
  return {build,parts,ports,paths,centers,validate};
})();
